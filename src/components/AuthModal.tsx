import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  onClose: () => void
}

export function AuthModal({ onClose }: Props) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setLoading(true)
    try {
      if (tab === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setDone(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '8px 10px',
    outline: 'none',
    boxSizing: 'border-box',
  }

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
          borderRadius: 12,
          padding: '28px 32px',
          width: 320,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.8)',
        }}
      >
        {done ? (
          <div style={{ textAlign: 'center', lineHeight: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              A confirmation link has been sent to {email}.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 20,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'monospace',
                fontSize: 11,
                padding: '6px 16px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                marginBottom: 20,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {(['signin', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t)
                    setError(null)
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    borderBottom:
                      tab === t ? '2px solid rgba(134,239,172,0.7)' : '2px solid transparent',
                    color: tab === t ? 'rgba(134,239,172,0.9)' : 'rgba(255,255,255,0.3)',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: tab === t ? 600 : 400,
                    padding: '6px 0 10px',
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t === 'signin' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}
                >
                  EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="you@example.com"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}
                >
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={inputStyle}
                  placeholder="••••••"
                />
              </div>

              {error && (
                <div style={{ fontSize: 11, color: 'rgba(248,113,113,0.9)', marginTop: -4 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  background: loading ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.35)',
                  borderRadius: 6,
                  color: 'rgba(134,239,172,0.9)',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  padding: '9px 0',
                  cursor: loading ? 'default' : 'pointer',
                  width: '100%',
                  letterSpacing: '0.04em',
                }}
              >
                {loading ? '...' : tab === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
