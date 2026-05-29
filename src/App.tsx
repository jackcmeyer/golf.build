import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation, Link } from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { AuthModal } from './components/AuthModal'
import { CourseDashboard } from './components/CourseDashboard'

// Auth session shared with child routes via RouterProvider context
export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  function handleSignOut() {
    supabase?.auth.signOut()
    navigate({ to: '/editor' })
  }

  const isEditor = pathname.startsWith('/editor')
  const isGallery = pathname === '/gallery'
  const isViewer = pathname.startsWith('/view/')

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
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Page content */}
      <Outlet />

      {/* Global top-right nav — always rendered above page content */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'monospace',
          fontSize: 11,
          zIndex: 50,
          userSelect: 'none',
        }}
      >
        {/* Context-sensitive back link */}
        {isGallery && (
          <Link
            to="/editor"
            style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}
          >
            ← Editor
          </Link>
        )}
        {isViewer && (
          <Link
            to="/gallery"
            style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}
          >
            ← Gallery
          </Link>
        )}

        {/* Gallery link when in editor */}
        {isEditor && (
          <Link
            to="/gallery"
            style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}
          >
            Gallery
          </Link>
        )}

        {/* Auth */}
        {session ? (
          <>
            {(isEditor || isViewer) && (
              <button onClick={() => setShowDashboard(true)} style={ghostBtn}>
                My Courses
              </button>
            )}
            <button onClick={handleSignOut} style={{ ...ghostBtn, color: 'rgba(255,255,255,0.2)' }}>
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
      </div>

      {/* Modals */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showDashboard && session && (
        <CourseDashboard
          userId={session.user.id}
          currentCourseId={null}
          onOpen={(id) => {
            setShowDashboard(false)
            navigate({ to: '/editor/$courseId', params: { courseId: id } })
          }}
          onCreateNew={() => {
            setShowDashboard(false)
            navigate({ to: '/editor' })
          }}
          onClose={() => setShowDashboard(false)}
        />
      )}
    </div>
  )
}
