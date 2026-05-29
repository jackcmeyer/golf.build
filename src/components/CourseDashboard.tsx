import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Course {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface Props {
  userId: string
  currentCourseId: string | null
  onOpen: (courseId: string) => void
  onCreateNew: () => void
  onClose: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function CourseDashboard({ userId, currentCourseId, onOpen, onCreateNew, onClose }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('courses')
      .select('id, name, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setCourses((data as Course[]) ?? [])
        setLoading(false)
      })
  }, [userId])

  async function handleDelete(courseId: string) {
    if (!supabase) return
    await supabase.from('courses').delete().eq('id', courseId)
    setCourses((prev) => prev.filter((c) => c.id !== courseId))
    setDeleteConfirm(null)
    if (courseId === currentCourseId) onOpen(courses.find((c) => c.id !== courseId)?.id ?? '')
  }

  async function handleRename(courseId: string) {
    if (!supabase || !renameValue.trim()) return
    await supabase.from('courses').update({ name: renameValue.trim() }).eq('id', courseId)
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, name: renameValue.trim() } : c)),
    )
    setRenamingId(null)
  }

  const rowStyle = (id: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    background: id === currentCourseId ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${id === currentCourseId ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
    cursor: 'default',
  })

  const btnStyle = (variant: 'ghost' | 'green' | 'red'): React.CSSProperties => ({
    background:
      variant === 'green'
        ? 'rgba(34,197,94,0.12)'
        : variant === 'red'
          ? 'rgba(239,68,68,0.12)'
          : 'transparent',
    border: `1px solid ${variant === 'green' ? 'rgba(34,197,94,0.3)' : variant === 'red' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 5,
    color:
      variant === 'green'
        ? 'rgba(134,239,172,0.85)'
        : variant === 'red'
          ? 'rgba(252,165,165,0.85)'
          : 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
    fontSize: 10,
    padding: '4px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'rgba(12,12,16,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: '24px 24px',
          width: 420,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>My Courses</span>
          <button onClick={onClose} style={{ ...btnStyle('ghost'), padding: '4px 8px' }}>
            ✕
          </button>
        </div>

        {/* New course */}
        <button
          onClick={onCreateNew}
          style={{
            ...btnStyle('green'),
            padding: '9px 0',
            width: '100%',
            fontSize: 11,
            letterSpacing: '0.04em',
          }}
        >
          + New course
        </button>

        {/* Course list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflowY: 'auto',
            maxHeight: 380,
            paddingRight: 2,
          }}
        >
          {loading && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', padding: '8px 0' }}>
              Loading…
            </div>
          )}
          {!loading && courses.length === 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', padding: '8px 0' }}>
              No courses yet.
            </div>
          )}
          {courses.map((course) => (
            <div key={course.id} style={rowStyle(course.id)}>
              {/* Name / rename */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingId === course.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(course.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 4,
                      color: 'rgba(255,255,255,0.85)',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      padding: '3px 7px',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color:
                          course.id === currentCourseId
                            ? 'rgba(134,239,172,0.9)'
                            : 'rgba(255,255,255,0.8)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {course.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                      {formatDate(course.updated_at)}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {renamingId === course.id ? (
                  <>
                    <button style={btnStyle('green')} onClick={() => handleRename(course.id)}>
                      Save
                    </button>
                    <button style={btnStyle('ghost')} onClick={() => setRenamingId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {course.id !== currentCourseId && (
                      <button
                        style={btnStyle('green')}
                        onClick={() => {
                          onOpen(course.id)
                          onClose()
                        }}
                      >
                        Open
                      </button>
                    )}
                    <button
                      style={btnStyle('ghost')}
                      onClick={() => {
                        setRenamingId(course.id)
                        setRenameValue(course.name)
                      }}
                    >
                      Rename
                    </button>
                    {deleteConfirm === course.id ? (
                      <>
                        <button style={btnStyle('red')} onClick={() => handleDelete(course.id)}>
                          Confirm
                        </button>
                        <button style={btnStyle('ghost')} onClick={() => setDeleteConfirm(null)}>
                          No
                        </button>
                      </>
                    ) : (
                      <button style={btnStyle('ghost')} onClick={() => setDeleteConfirm(course.id)}>
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
