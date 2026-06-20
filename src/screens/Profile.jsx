import { useState } from 'react'
import './Profile.css'
import { supabase } from '../lib/supabase'

const SUBNAV = [
  { id: 'profile',  label: 'Profile',  icon: <path d="M9 9a3 3 0 100-6 3 3 0 000 6zM3 17c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/> },
  { id: 'security', label: 'Security', icon: <path d="M9 3L3 6v5c0 3.55 2.58 6.87 6 7.67C12.42 17.87 15 14.55 15 11V6L9 3z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/> },
  { id: 'team',     label: 'Team',     icon: <><path d="M13 14c0-1.86-1.79-3-4-3s-4 1.14-4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="M16 14c0-1.36-1.12-2.5-3-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="13.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.6"/></> },
  { id: 'billing',  label: 'Billing',  icon: <><rect x="2" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M2 9h14" stroke="currentColor" strokeWidth="1.6"/></> },
]

function initials(user) {
  const name = user?.user_metadata?.name ?? user?.email ?? ''
  return name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0,2).toUpperCase() || '?'
}

function joinedDate(user) {
  if (!user?.created_at) return ''
  return new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function Profile({ user, onLogout, isDemo }) {
  const [activeNav, setActiveNav]   = useState('profile')
  const [twoFA, setTwoFA]           = useState(false)
  const [name, setName]             = useState(user?.user_metadata?.name ?? '')
  const [role, setRole]             = useState(user?.user_metadata?.role ?? 'Founder')
  const [timezone, setTimezone]     = useState(user?.user_metadata?.timezone ?? 'eastern')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [pwError, setPwError]       = useState('')
  const [pwSaved, setPwSaved]       = useState(false)

  const originalName = user?.user_metadata?.name ?? ''

  async function handleSave(e) {
    e.preventDefault()
    if (isDemo) return
    setSaving(true)
    await supabase.auth.updateUser({ data: { name, role, timezone } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleCancel() {
    setName(originalName)
    setRole(user?.user_metadata?.role ?? 'Founder')
    setTimezone(user?.user_metadata?.timezone ?? 'eastern')
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault()
    setPwError('')
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
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
            <div key={n.id} className={`subnav-item${activeNav === n.id ? ' active' : ''}`} onClick={() => setActiveNav(n.id)}>
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
                  <div className="profile-info-line">{user?.email} · Joined {joinedDate(user)}</div>
                </div>
                <button className="btn-outline">Change photo</button>
              </div>
            </div>

            <div className="profile-card">
              <div className="card-section-title">Personal information</div>
              <form onSubmit={handleSave}>
                <div className="fields-grid">
                  <div className="field-group">
                    <label className="field-label">Full name</label>
                    <input className="field-input" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Email address</label>
                    <input className="field-input" type="email" defaultValue={user?.email} disabled style={{ opacity:.6 }} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Role</label>
                    <input className="field-input" value={role} onChange={e => setRole(e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Timezone</label>
                    <select className="field-input field-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
                      <option value="eastern">(GMT−05:00) Eastern Time</option>
                      <option value="central">(GMT−06:00) Central Time</option>
                      <option value="pacific">(GMT−08:00) Pacific Time</option>
                      <option value="utc">(GMT+00:00) UTC</option>
                      <option value="london">(GMT+01:00) London</option>
                      <option value="amsterdam">(GMT+02:00) Amsterdam</option>
                    </select>
                  </div>
                </div>
                <div className="card-footer">
                  <button type="button" className="btn-outline" onClick={handleCancel}>Cancel</button>
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
                    <input className="field-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} minLength={8} placeholder="At least 8 characters" />
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
                  <div className="security-info-title">Two-factor authentication</div>
                  <div className="security-info-sub">Add an extra layer of security at login</div>
                </div>
                <div className="toggle-wrap">
                  <span className="toggle-label" style={{ color: twoFA ? 'var(--c-green-text)' : 'var(--c-text-muted3)' }}>{twoFA ? 'On' : 'Off'}</span>
                  <div className={`toggle${twoFA ? ' on' : ''}`} onClick={() => setTwoFA(v => !v)}>
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

          {/* ── TEAM TAB ── */}
          {activeNav === 'team' && (
            <div className="profile-card">
              <div className="card-section-title">Team members</div>
              <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 0' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#FFB37B,#FF7BA8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'white', flexShrink:0 }}>
                  {initials(user)}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--c-text-primary)' }}>{name || user?.email}</div>
                  <div style={{ fontSize:12.5, color:'var(--c-text-muted2)' }}>{user?.email}</div>
                </div>
                <span style={{ marginLeft:'auto', background:'var(--c-violet-tint)', color:'var(--c-primary)', fontSize:12, fontWeight:700, padding:'2px 9px', borderRadius:999 }}>Owner</span>
              </div>
              <div style={{ marginTop:16, padding:'14px', background:'var(--c-bg)', borderRadius:12, fontSize:13.5, color:'var(--c-text-muted)', lineHeight:1.6 }}>
                Team collaboration and multi-user access is coming soon. You'll be able to invite teammates to view and manage analytics.
              </div>
            </div>
          )}

          {/* ── BILLING TAB ── */}
          {activeNav === 'billing' && (
            <div className="profile-card">
              <div className="card-section-title">Plan &amp; billing</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px', background:'var(--c-violet-tint)', borderRadius:14, marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:'var(--c-primary)', marginBottom:4 }}>Free plan</div>
                  <div style={{ fontSize:13, color:'var(--c-text-muted)', lineHeight:1.5 }}>1 site · Up to 10,000 events/month · 30-day data retention</div>
                </div>
                <span style={{ background:'var(--c-primary)', color:'white', fontSize:11.5, fontWeight:700, padding:'4px 12px', borderRadius:999 }}>Current</span>
              </div>
              <div style={{ fontSize:13.5, color:'var(--c-text-muted)', lineHeight:1.7, padding:'0 2px' }}>
                Paid plans with unlimited sites, longer retention, and team features are coming soon. You'll be notified when upgrades are available.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
