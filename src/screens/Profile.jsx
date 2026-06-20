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

function displayName(user) {
  return user?.user_metadata?.name ?? user?.email ?? ''
}

function joinedDate(user) {
  if (!user?.created_at) return ''
  return new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function Profile({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState('profile')
  const [twoFA, setTwoFA]         = useState(false)
  const [name, setName]           = useState(user?.user_metadata?.name ?? '')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.auth.updateUser({ data: { name } })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
          {/* Header */}
          <div className="profile-card">
            <div className="profile-header-inner">
              <div className="profile-avatar">{initials(user)}</div>
              <div className="profile-meta">
                <div className="profile-name-row">
                  <span className="profile-name">{displayName(user)}</span>
                  <span className="role-pill">Owner</span>
                </div>
                <div className="profile-info-line">
                  {user?.email} · Joined {joinedDate(user)}
                </div>
              </div>
              <button className="btn-outline">Change photo</button>
            </div>
          </div>

          {/* Personal info */}
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
                  <input className="field-input" type="email" defaultValue={user?.email} disabled style={{ opacity: .6 }} />
                </div>
                <div className="field-group">
                  <label className="field-label">Role</label>
                  <input className="field-input" defaultValue="Founder" />
                </div>
                <div className="field-group">
                  <label className="field-label">Timezone</label>
                  <select className="field-input field-select">
                    <option>(GMT−05:00) Eastern Time</option>
                    <option>(GMT−08:00) Pacific Time</option>
                    <option>(GMT+00:00) UTC</option>
                    <option>(GMT+01:00) London</option>
                  </select>
                </div>
              </div>
              <div className="card-footer">
                <button type="button" className="btn-outline">Cancel</button>
                <button type="submit" className="btn-primary-sm" disabled={saving}>
                  {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Security */}
          <div className="profile-card">
            <div className="card-section-title">Password &amp; security</div>

            <div className="security-row">
              <div className="security-info">
                <div className="security-info-title">Password</div>
                <div className="security-info-sub">Managed via your auth provider</div>
              </div>
              <button className="btn-outline">Update</button>
            </div>

            <div className="security-row">
              <div className="security-info">
                <div className="security-info-title">Two-factor authentication</div>
                <div className="security-info-sub">Add an extra layer of security at login</div>
              </div>
              <div className="toggle-wrap">
                <span className="toggle-label">{twoFA ? 'On' : 'Off'}</span>
                <div className={`toggle${twoFA ? ' on' : ''}`} onClick={() => setTwoFA(v => !v)}>
                  <div className="toggle-knob" />
                </div>
              </div>
            </div>

            <div className="security-row">
              <div className="security-info">
                <div className="security-info-title">Active sessions</div>
                <div className="security-info-sub">This browser session — current</div>
              </div>
              <button className="btn-danger" onClick={onLogout}>Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
