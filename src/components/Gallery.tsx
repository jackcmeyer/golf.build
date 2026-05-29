import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PublishedCourse {
  id: string
  name: string
  club_name: string | null
  thumbnail_url: string | null
  updated_at: string
}

interface Props {
  onView: (courseId: string) => void
  onClose: () => void
}

export function Gallery({ onView, onClose }: Props) {
  const [courses, setCourses] = useState<PublishedCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('courses')
      .select('id, name, club_name, thumbnail_url, updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setCourses((data as PublishedCourse[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,8,12,0.97)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        color: 'rgba(255,255,255,0.8)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em' }}>
          Community Gallery
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: '5px 14px',
            cursor: 'pointer',
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
        }}
      >
        {loading && (
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.25)',
              paddingTop: 40,
              textAlign: 'center',
            }}
          >
            Loading…
          </div>
        )}
        {!loading && courses.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.25)',
              paddingTop: 60,
              textAlign: 'center',
              lineHeight: 2,
            }}
          >
            No published courses yet.
            <br />
            Publish your course to appear here.
          </div>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => onView(course.id)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,197,94,0.35)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)')
              }
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: 28, opacity: 0.18 }}>⛳</span>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: '12px 14px' }}>
                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.8)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {course.name}
                </div>
                {course.club_name && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.3)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {course.club_name}
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'rgba(134,239,172,0.7)',
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}
                  >
                    View →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
