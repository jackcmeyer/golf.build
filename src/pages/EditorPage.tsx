import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import VoxelCanvas, { type SaveStatus } from '../components/VoxelCanvas'
import { OnboardingModal } from '../components/OnboardingModal'
import { supabase } from '../lib/supabase'
import { deleteCourse, deleteLocalCourse } from '../lib/persistence'
import type { TerrainPreset } from '../engine/terrainPresets'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const LAST_COURSE_KEY = 'golf_build:last_course_id'

type PageState = 'loading' | 'onboarding' | 'ready'

export function EditorPage() {
  const { courseId } = useParams({ strict: false })
  const navigate = useNavigate()

  const [pageState, setPageState] = useState<PageState>(courseId ? 'ready' : 'loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [guestPreset, setGuestPreset] = useState<TerrainPreset>('default')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isPublished, setIsPublished] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const screenshotCbRef = useRef<(() => Promise<Blob | null>) | null>(null)
  const restartCbRef = useRef<((preset: TerrainPreset) => void) | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (courseId) {
        setPageState('ready')
        if (!supabase) return
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!cancelled) setUserId(session?.user.id ?? null)
        return
      }

      setPageState('loading')
      if (!supabase) {
        setPageState('onboarding')
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      setUserId(session?.user.id ?? null)
      if (!session || !supabase) {
        // Returning anonymous user — resume their local draft if one exists
        const lastId = localStorage.getItem(LAST_COURSE_KEY)
        if (lastId) {
          navigate({ to: '/editor/$courseId', params: { courseId: lastId } })
        } else {
          setPageState('onboarding')
        }
        return
      }

      const { data } = await supabase
        .from('courses')
        .select('id')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      if (cancelled) return
      if (data?.id) {
        navigate({ to: '/editor/$courseId', params: { courseId: data.id } })
      } else {
        setPageState('onboarding')
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [courseId, navigate])

  useEffect(() => {
    async function loadPublished() {
      if (!courseId || !supabase) {
        setIsPublished(false)
        return
      }
      const { data } = await supabase
        .from('courses')
        .select('is_published')
        .eq('id', courseId)
        .single()
      setIsPublished(data?.is_published ?? false)
    }
    loadPublished()
  }, [courseId])

  async function handlePublishToggle() {
    if (!courseId || !supabase) return
    const newVal = !isPublished
    if (newVal && screenshotCbRef.current) {
      const blob = await screenshotCbRef.current()
      if (blob) {
        const path = `${courseId}.jpg`
        await supabase.storage.from('thumbnails').upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        })
        const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(path)
        await supabase
          .from('courses')
          .update({ is_published: newVal, thumbnail_url: urlData.publicUrl })
          .eq('id', courseId)
      } else {
        await supabase.from('courses').update({ is_published: newVal }).eq('id', courseId)
      }
    } else {
      await supabase.from('courses').update({ is_published: newVal }).eq('id', courseId)
    }
    setIsPublished(newVal)
  }

  function handleOnboardingCreate(newCourseId: string, preset: TerrainPreset) {
    setGuestPreset(preset)
    setPageState('ready')
    localStorage.setItem(LAST_COURSE_KEY, newCourseId)
    navigate({ to: '/editor/$courseId', params: { courseId: newCourseId } })
  }

  function handleRestart(preset: TerrainPreset) {
    restartCbRef.current?.(preset)
    setRestarting(false)
  }

  async function handleDelete() {
    if (!courseId || deleting) return
    setDeleting(true)
    try {
      if (supabase && userId) {
        await deleteCourse(courseId)
      } else {
        await deleteLocalCourse(courseId)
      }
      if (localStorage.getItem(LAST_COURSE_KEY) === courseId) {
        localStorage.removeItem(LAST_COURSE_KEY)
      }
      setConfirmingDelete(false)
      navigate({ to: '/editor' })
    } finally {
      setDeleting(false)
    }
  }

  const ghostBtn: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: 'monospace',
    fontSize: 11,
    padding: '5px 12px',
    cursor: 'pointer',
  }

  return (
    <>
      {pageState === 'ready' && (
        <VoxelCanvas
          key={courseId ?? 'guest'}
          courseId={courseId ?? null}
          initialPreset={guestPreset}
          readOnly={false}
          screenshotCbRef={screenshotCbRef}
          restartCbRef={restartCbRef}
          onRequestRestart={() => setRestarting(true)}
          onRequestDelete={() => setConfirmingDelete(true)}
          onSaveStatus={setSaveStatus}
        />
      )}

      {courseId && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 50,
          }}
        >
          {saveStatus === 'saving' && (
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(134,239,172,0.5)' }}>
              saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(239,68,68,0.7)' }}>
              save failed
            </span>
          )}
          <button
            onClick={handlePublishToggle}
            style={{
              ...ghostBtn,
              ...(isPublished
                ? {
                    color: 'rgba(134,239,172,0.85)',
                    borderColor: 'rgba(34,197,94,0.3)',
                    background: 'rgba(34,197,94,0.12)',
                  }
                : {}),
            }}
          >
            {isPublished ? 'Published' : 'Publish'}
          </button>
        </div>
      )}

      {pageState === 'onboarding' && (
        <OnboardingModal
          userId={userId}
          onCreate={handleOnboardingCreate}
          onClose={() => setPageState('ready')}
        />
      )}

      {restarting && (
        <OnboardingModal
          userId={userId}
          onCreate={handleOnboardingCreate}
          onRestart={handleRestart}
          onClose={() => setRestarting(false)}
        />
      )}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the world and everything in it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
            >
              {deleting ? 'Deleting…' : 'Delete course'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
