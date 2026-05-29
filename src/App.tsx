import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import VoxelCanvas, { SaveStatus } from './components/VoxelCanvas'
import { AuthModal } from './components/AuthModal'
import { CourseDashboard } from './components/CourseDashboard'
import { OnboardingModal } from './components/OnboardingModal'
import { Gallery } from './components/Gallery'
import type { TerrainPreset } from './engine/terrainPresets'

async function fetchOrCreateCourseId(userId: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('courses')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (data) return data.id

  const { data: created } = await supabase
    .from('courses')
    .insert({ user_id: userId, name: 'Untitled Course' })
    .select('id')
    .single()
  return created?.id ?? null
}

type AppView = 'editor' | 'viewer'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [viewCourseId, setViewCourseId] = useState<string | null>(null)
  const [appView, setAppView] = useState<AppView>('editor')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [showAuth, setShowAuth] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [initialPreset, setInitialPreset] = useState<TerrainPreset>('default')
  const [isPublished, setIsPublished] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const screenshotCbRef = useRef<(() => Promise<Blob | null>) | null>(null)

  useEffect(() => {
    if (!supabase) return

    async function handleSession(s: Session | null) {
      setSession(s)
      if (s?.user) {
        const id = await fetchOrCreateCourseId(s.user.id)
        setCourseId(id)
      } else {
        setCourseId(null)
      }
    }

    supabase.auth.getSession().then(({ data }) => handleSession(data.session))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => handleSession(s))

    return () => subscription.unsubscribe()
  }, [])

  // Load publish state when courseId changes
  useEffect(() => {
    async function load() {
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
    load()
  }, [courseId])

  function handleSaveStatus(status: SaveStatus) {
    setSaveStatus(status)
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current)
    if (status === 'saved') {
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  function handleSignOut() {
    supabase?.auth.signOut()
  }

  async function handleTogglePublish() {
    if (!supabase || !courseId || publishing) return
    setPublishing(true)
    const next = !isPublished
    try {
      let thumbnailUrl: string | undefined
      if (next && screenshotCbRef.current) {
        const blob = await screenshotCbRef.current()
        if (blob) {
          const fileName = `${courseId}.jpg`
          const { error: upErr } = await supabase.storage
            .from('thumbnails')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
            thumbnailUrl = urlData.publicUrl
          }
        }
      }
      await supabase
        .from('courses')
        .update({ is_published: next, ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}) })
        .eq('id', courseId)
      setIsPublished(next)
    } finally {
      setPublishing(false)
    }
  }

  function openViewer(id: string) {
    setViewCourseId(id)
    setAppView('viewer')
    setShowGallery(false)
  }

  function closeViewer() {
    setAppView('editor')
    setViewCourseId(null)
  }

  const isViewer = appView === 'viewer'
  const activeCourseId = isViewer ? viewCourseId : courseId

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
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <VoxelCanvas
        key={activeCourseId ?? 'no-course'}
        courseId={activeCourseId}
        initialPreset={initialPreset}
        readOnly={isViewer}
        screenshotCbRef={screenshotCbRef}
        onSaveStatus={handleSaveStatus}
      />

      {/* Top-right HUD */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'monospace',
          fontSize: 11,
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        {isViewer ? (
          <button onClick={closeViewer} style={ghostBtn}>
            ← Back to editor
          </button>
        ) : (
          <>
            {/* Save status */}
            {saveStatus === 'saving' && (
              <span style={{ color: 'rgba(255,255,255,0.32)' }}>Saving…</span>
            )}
            {saveStatus === 'saved' && (
              <span style={{ color: 'rgba(134,239,172,0.5)' }}>Saved</span>
            )}
            {saveStatus === 'error' && (
              <span style={{ color: 'rgba(248,113,113,0.7)' }}>Save failed</span>
            )}

            {/* Gallery */}
            <button onClick={() => setShowGallery(true)} style={ghostBtn}>
              Gallery
            </button>

            {session ? (
              <>
                {/* Publish toggle */}
                {courseId && (
                  <button
                    onClick={handleTogglePublish}
                    disabled={publishing}
                    style={{
                      background: isPublished ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isPublished ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 6,
                      color: isPublished ? 'rgba(134,239,172,0.9)' : 'rgba(255,255,255,0.4)',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      padding: '5px 12px',
                      cursor: publishing ? 'default' : 'pointer',
                    }}
                  >
                    {publishing ? '…' : isPublished ? '✓ Published' : 'Publish'}
                  </button>
                )}

                <button
                  onClick={() => setShowDashboard(true)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    color: 'rgba(255,255,255,0.45)',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    padding: '5px 12px',
                    cursor: 'pointer',
                  }}
                >
                  My Courses
                </button>

                <button onClick={handleSignOut} style={ghostBtn}>
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                style={{
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 6,
                  color: 'rgba(134,239,172,0.85)',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  padding: '5px 12px',
                  cursor: 'pointer',
                }}
              >
                Sign in to save
              </button>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showGallery && <Gallery onView={openViewer} onClose={() => setShowGallery(false)} />}
      {showDashboard && session && (
        <CourseDashboard
          userId={session.user.id}
          currentCourseId={courseId}
          onOpen={(id) => {
            setCourseId(id)
            setInitialPreset('default')
          }}
          onCreateNew={() => {
            setShowDashboard(false)
            setShowOnboarding(true)
          }}
          onClose={() => setShowDashboard(false)}
        />
      )}
      {showOnboarding && session && (
        <OnboardingModal
          userId={session.user.id}
          onCreate={(id, preset) => {
            setInitialPreset(preset)
            setCourseId(id)
            setShowOnboarding(false)
          }}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  )
}
