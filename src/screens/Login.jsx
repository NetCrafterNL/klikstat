import { useState } from 'react'
import './Login.css'
import { supabase } from '../lib/supabase'

const SPARKLINE_PTS = [28,22,18,24,20,16,22,26,20,24,22,28,26,30,28]

function sparklinePath(pts, W=240, H=32) {
  const max = Math.max(...pts), min = Math.min(...pts)
  return pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W
    const y = H - ((v - min) / (max - min + 1)) * (H * 0.8) - H * 0.1
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

export default function Login({ onBack }) {
  const [mode, setMode]       = useState('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // App will react to auth state change automatically
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email to confirm your account before signing in.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M4 12L8 4l4 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="8" cy="4" r="1.5" fill="white"/>
            </svg>
          </div>
          <span className="login-brand-name">klikstat</span>
        </div>

        <div className="login-hero">
          <div className="login-chart-preview">
            <div className="login-chart-label">Visitors</div>
            <div className="login-chart-value">18,420</div>
            <svg width={240} height={32} viewBox={`0 0 240 32`}>
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d={`${sparklinePath(SPARKLINE_PTS)} L240 32 L0 32 Z`} fill="url(#lg)"/>
              <path d={sparklinePath(SPARKLINE_PTS)} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="login-headline">Analytics that<br/>actually help.</h1>
          <p className="login-sub">Simple, privacy-friendly website analytics. See what's working and grow faster.</p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-wrap">
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); setMessage('') }}
            >Sign in</button>
            <button
              className={`login-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); setMessage('') }}
            >Create account</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 6 }}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--c-border-input)', fontSize: 14, fontWeight: 500, background: 'var(--c-bg)', color: 'var(--c-text-body)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--c-border-input)', fontSize: 14, fontWeight: 500, background: 'var(--c-bg)', color: 'var(--c-text-body)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', background: '#FEE2E2', padding: '8px 12px', borderRadius: 8 }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1F9D55', background: '#E7F6EC', padding: '8px 12px', borderRadius: 8 }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '11px 16px', borderRadius: 10, background: 'var(--c-primary)', color: 'white', border: 'none', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4 }}
            >
              {loading ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          {onBack && (
            <button
              onClick={onBack}
              style={{ marginTop:16, background:'none', border:'none', color:'var(--c-text-muted)', fontSize:13, cursor:'pointer', fontWeight:600 }}
            >
              ← Back to demo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
