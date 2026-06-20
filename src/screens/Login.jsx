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

export default function Login() {
  const [mode, setMode]           = useState('login') // 'login' | 'register'
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [remember, setRemember]   = useState(true)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      // onAuthStateChange in App.jsx handles the redirect
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(provider) {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="login-page">
      {/* Left brand panel */}
      <div className="login-brand">
        <div className="login-brand-circle login-brand-circle-1" />
        <div className="login-brand-circle login-brand-circle-2" />

        <div className="brand-logo">
          <div className="brand-logo-badge">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 12L8 4l4 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="8" cy="4" r="1.5" fill="white"/>
            </svg>
          </div>
          <span className="brand-logo-word">klikstat</span>
        </div>

        <div className="brand-body">
          <h1 className="brand-headline">Analytics your whole team will actually use.</h1>
          <p className="brand-sub">
            Privacy-friendly, real-time insight across every site you run — from your own apps to client dashboards.
          </p>
          <div className="brand-glass-card">
            <div className="glass-card-header">
              <span className="glass-card-label">Unique visitors</span>
              <span className="glass-live-pill">
                <span className="glass-live-dot" />
                Live
              </span>
            </div>
            <div className="glass-metric">
              <span className="glass-value">18,420</span>
              <span className="glass-delta">▲ 12.4%</span>
            </div>
            <svg className="glass-sparkline" viewBox="0 0 240 32" preserveAspectRatio="none">
              <path d={sparklinePath(SPARKLINE_PTS)} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <p className="brand-trust">Trusted on 1,200+ sites · GDPR-ready · No cookie banners</p>
      </div>

      {/* Right form panel */}
      <div className="login-form-panel">
        <div className="login-form-inner">
          <h2 className="login-title">{mode === 'login' ? 'Welcome back' : 'Create an account'}</h2>
          <p className="login-sub">
            {mode === 'login' ? 'Log in to your Klikstat dashboard.' : 'Start tracking your websites for free.'}
          </p>

          <button className="sso-btn" onClick={() => handleOAuth('google')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908C16.658 14.01 17.64 11.807 17.64 9.2z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button className="sso-btn" onClick={() => handleOAuth('github')}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.027 0 0 4.027 0 9c0 3.978 2.578 7.344 6.155 8.532.45.083.615-.196.615-.435 0-.214-.008-.782-.012-1.535-2.504.544-3.031-1.207-3.031-1.207-.41-1.04-1-1.317-1-1.317-.817-.559.062-.547.062-.547.903.063 1.378.927 1.378.927.803 1.375 2.107.977 2.62.748.082-.583.314-.977.571-1.201-1.998-.227-4.1-1-4.1-4.448 0-.982.352-1.785.926-2.415-.093-.228-.4-1.143.087-2.38 0 0 .755-.241 2.474.922A8.617 8.617 0 019 4.362c.764.004 1.534.104 2.252.303 1.717-1.163 2.472-.921 2.472-.921.488 1.237.181 2.152.089 2.38.576.63.924 1.433.924 2.415 0 3.457-2.104 4.218-4.108 4.44.323.278.61.826.61 1.666 0 1.203-.011 2.173-.011 2.469 0 .241.162.522.618.434C15.425 16.34 18 12.976 18 9c0-4.973-4.027-9-9-9z" fill="#1C1B22"/>
            </svg>
            Continue with GitHub
          </button>

          <div className="login-or">or</div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-field">
                <label className="form-label">Full name</label>
                <input className="form-input" type="text" placeholder="Jordan Diaz" value={name} onChange={e => setName(e.target.value)} required />
              </div>
            )}

            <div className="form-field">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div className="form-field">
              <div className="form-row-between" style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                {mode === 'login' && <a href="#" className="forgot-link">Forgot?</a>}
              </div>
              <div className="form-input-wrap">
                <input
                  className="form-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: 42 }}
                  required
                  minLength={8}
                />
                <button type="button" className="form-input-suffix" onClick={() => setShowPwd(v => !v)}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M2 9s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.5"/>
                    {!showPwd && <line x1="2" y1="2" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
                  </svg>
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="form-row-between" style={{ marginBottom: 18 }}>
                <div className="form-checkbox-row" onClick={() => setRemember(v => !v)}>
                  <div className={`custom-checkbox${remember ? ' checked' : ''}`}>
                    {remember && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 5.5l3 3 4-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  Keep me logged in
                </div>
              </div>
            )}

            {error && (
              <div style={{ marginBottom: 14, padding: '9px 13px', background: 'var(--c-danger-tint)', border: '1px solid var(--c-danger-border)', borderRadius: 9, fontSize: 13, color: 'var(--c-danger)', fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="login-footer">
            {mode === 'login'
              ? <>New to Klikstat? <a href="#" onClick={e => { e.preventDefault(); setMode('register'); setError('') }}>Create an account</a></>
              : <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setMode('login'); setError('') }}>Log in</a></>
            }
          </p>
        </div>
      </div>
    </div>
  )
}
