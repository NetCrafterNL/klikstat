import { useState } from 'react'
import './Profile.css'
import { supabase } from '../lib/supabase'

const SUBNAV = [
  { id: 'profile',  label: 'Profile',  icon: <path d="M9 9a3 3 0 100-6 3 3 0 000 6zM3 17c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/> },
  { id: 'security', label: 'Security', icon: <path d="M9 3L3 6v5c0 3.55 2.58 6.87 6 7.67C12.42 17.87 15 14.55 15 11V6L9 3z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/> },
  { id: 'api',      label: 'API',      icon: <><path d="M5 9l-3 3 3 3M13 9l3 3-3 3M9 5l-2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></> },
]

function randomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return 'ks_live_' + Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function initials(user) {
  const name = user?.user_metadata?.name ?? user?.email ?? ''
  return name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0,2).toUpperCase() || '?'
}

export default function Profile({ user, onLogout, isDemo, darkMode, onToggleDark, sites }) {
  const [activeNav, setActiveNav]     = useState('profile')
  const [name, setName]               = useState(user?.user_metadata?.name ?? '')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyPlain, setNewKeyPlain] = useState(null)
  const [apiKeys, setApiKeys]         = useState([])
  const [keysLoaded, setKeysLoaded]   = useState(false)
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [pwError, setPwError]         = useState('')
  const [pwSaved, setPwSaved]         = useState(false)
  const [showPwForm, setShowPwForm]   = useState(false)

  async function loadApiKeys() {
    if (keysLoaded || !sites?.length) return
    const siteId = sites[0]?.id
    if (!siteId) return
    const res = await fetch(`/api/api-keys?site_id=${siteId}`)
    const data = await res.json()
    setApiKeys(data || [])
    setKeysLoaded(true)
  }

  async function handleCreateKey(e) {
    e.preventDefault()
    if (!newKeyLabel.trim() || !sites?.length) return
    const plain = randomKey()
    const hash  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain))
    const keyHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('')
    const siteId = sites[0]?.id
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: siteId, name: newKeyLabel.trim(), key_hash: keyHash }),
    })
    const key = await res.json()
    setApiKeys(prev => [...prev, key])
    setNewKeyPlain(plain)
    setNewKeyLabel('')
  }

  async function handleDeleteKey(keyId) {
    await fetch(`/api/api-keys/${keyId}`, { method: 'DELETE' })
    setApiKeys(prev => prev.filter(k => k.id !== keyId))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (isDemo || !user) return
    setSaving(true)
    await supabase.auth.updateUser({ data: { name } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault()
    setPwError('')
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) { setPwError(error.message); return }
    setPwSaved(true)
    setNewPw(''); setConfirmPw('')
    setTimeout(() => { setPwSaved(false); setShowPwForm(false) }, 2000)
  }

  return (
    <>
      <h1 className="profile-title">Account settings</h1>

      <div className="profile-grid">
        <div className="subnav-card">
          {SUBNAV.map(n => (
            <div
              key={n.id}
              className={`subnav-item${activeNav === n.id ? ' active' : ''}`}
              onClick={() => { setActiveNav(n.id); if (n.id === 'api') loadApiKeys() }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">{n.icon}</svg>
              {n.label}
            </div>
          ))}
        </div>

        <div className="profile-right">
          {/* ── PROFILE TAB ── */}
          {activeNav === 'profile' && (<>
            <div className="profile-card">
              <div className="profile-header-inner">
                <div className="profile-avatar">{initials(user)}</div>
                <div className="profile-meta">
                  <div className="profile-name-row">
                    <span className="profile-name">{name || user?.email}</span>
                    <span className="role-pill">Owner</span>
                  </div>
                  <div className="profile-info-line">{user?.email}</div>
                </div>
              </div>
            </div>

            <div className="profile-card">
              <div className="card-section-title">Personal information</div>
              <form onSubmit={handleSave}>
                <div className="fields-grid">
                  <div className="field-group">
                    <label className="field-label">Display name</label>
                    <input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Email address</label>
                    <input className="field-input" type="email" defaultValue={user?.email} disabled style={{ opacity:.6 }} />
                  </div>
                </div>
                <div className="card-footer">
                  <button type="button" className="btn-outline" onClick={() => setName(user?.user_metadata?.name ?? '')}>Cancel</button>
                  <button type="submit" className="btn-primary-sm" disabled={saving || isDemo}>
                    {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          </>)}

          {/* ── SECURITY TAB ── */}
          {activeNav === 'security' && (
            <div className="profile-card">
              <div className="card-section-title">Password &amp; security</div>

              <div className="security-row">
                <div className="security-info">
                  <div className="security-info-title">Password</div>
                  <div className="security-info-sub">
                    {pwSaved ? '✓ Password updated!' : 'Keep your account secure with a strong password.'}
                  </div>
                </div>
                <button className="btn-outline" onClick={() => { setShowPwForm(v => !v); setPwError('') }}>
                  {showPwForm ? 'Cancel' : 'Update'}
                </button>
              </div>

              {showPwForm && (
                <form onSubmit={handlePasswordUpdate} style={{ padding:'14px 0 6px', display:'flex', flexDirection:'column', gap:10 }}>
                  <div className="field-group">
                    <label className="field-label">New password</label>
                    <input className="field-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} minLength={6} placeholder="At least 6 characters" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Confirm password</label>
                    <input className="field-input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
                  </div>
                  {pwError && <div style={{ fontSize:13, color:'var(--c-danger)', fontWeight:600 }}>{pwError}</div>}
                  <button type="submit" className="btn-primary-sm" style={{ alignSelf:'flex-start' }}>Set new password</button>
                </form>
              )}

              <div className="security-row">
                <div className="security-info">
                  <div className="security-info-title">Dark mode</div>
                  <div className="security-info-sub">Switch to a dark color theme</div>
                </div>
                <div className="toggle-wrap">
                  <span className="toggle-label" style={{ color: darkMode ? 'var(--c-green-text)' : 'var(--c-text-muted3)' }}>{darkMode ? 'On' : 'Off'}</span>
                  <div className={`toggle${darkMode ? ' on' : ''}`} onClick={onToggleDark}>
                    <div className="toggle-knob" />
                  </div>
                </div>
              </div>

              <div className="security-row">
                <div className="security-info">
                  <div className="security-info-title">Active sessions</div>
                  <div className="security-info-sub">This browser — current session</div>
                </div>
                <button className="btn-danger" onClick={onLogout}>Sign out</button>
              </div>
            </div>
          )}

          {/* ── API TAB ── */}
          {activeNav === 'api' && (
            <div className="profile-card">
              <div className="card-section-title">API keys</div>
              <div style={{ fontSize:13, color:'var(--c-text-muted)', lineHeight:1.6, marginBottom:16 }}>
                Use your API key to read analytics data via <code style={{ background:'var(--c-bg)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>GET /v1/stats?site_id=…</code> with <code style={{ background:'var(--c-bg)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>Authorization: Bearer ks_live_…</code>
              </div>

              {newKeyPlain && (
                <div style={{ background:'var(--c-green-tint)', border:'1.5px solid #36C28E', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--c-green-text)', marginBottom:8 }}>✓ Key created — copy it now, it won't be shown again.</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <code style={{ flex:1, fontSize:12.5, background:'var(--c-surface)', padding:'8px 12px', borderRadius:8, color:'var(--c-text-body)', wordBreak:'break-all' }}>{newKeyPlain}</code>
                    <button className="btn-outline" onClick={() => navigator.clipboard.writeText(newKeyPlain)}>Copy</button>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateKey} style={{ display:'flex', gap:8, marginBottom:20 }}>
                <input className="field-input" style={{ flex:1 }} placeholder="Key label (e.g. Zapier)" value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} />
                <button type="submit" className="btn-primary-sm" disabled={!newKeyLabel.trim()}>Create key</button>
              </form>

              {apiKeys.length === 0
                ? <div style={{ color:'var(--c-text-muted3)', fontSize:13, fontWeight:600 }}>No API keys yet.</div>
                : apiKeys.map(k => (
                    <div key={k.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid var(--c-border)' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--c-text-body)' }}>{k.name}</div>
                        <div style={{ fontSize:12, color:'var(--c-text-muted3)', marginTop:2 }}>
                          Created {new Date(k.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <code style={{ fontSize:12, color:'var(--c-text-muted3)', background:'var(--c-bg)', padding:'3px 8px', borderRadius:6 }}>ks_live_••••••••</code>
                      <button className="btn-danger" onClick={() => handleDeleteKey(k.id)}>Delete</button>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      </div>
    </>
  )
}
