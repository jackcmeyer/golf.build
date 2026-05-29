import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  onClose: () => void
}

export function AuthModal({ onClose }: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ email })
      if (error) throw error
      setSent(true)
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
        {sent ? (
          <div style={{ textAlign: 'center', lineHeight: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              A sign-in link has been sent to {email}.
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
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Sign in</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>
              We'll send a magic link to your email.
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
                  autoFocus
                  style={inputStyle}
                  placeholder="you@example.com"
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
                {loading ? '...' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
