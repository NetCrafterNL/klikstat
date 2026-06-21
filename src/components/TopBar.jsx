import { useState } from 'react'
import './TopBar.css'

const PALETTE = ['#5B4BE8','#2C6FE0','#36C28E','#D98324','#D24A4F','#FF9F6B','#9B59B6']

function siteColor(site) {
  return PALETTE[(site.id?.charCodeAt(0) ?? 0) % PALETTE.length]
}

const NAV_TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'realtime',   label: 'Realtime', liveCount: true },
  { id: 'pages',      label: 'Pages' },
  { id: 'sources',    label: 'Sources' },
  { id: 'technology', label: 'Technology' },
  { id: 'goals',      label: 'Goals' },
  { id: 'funnels',    label: 'Funnels' },
  { id: 'retention',  label: 'Retention' },
  { id: 'profile',    label: 'Settings' },
]

const RANGES = [
  { id: '1d',   label: 'Today' },
  { id: '7d',   label: 'Last 7 days' },
  { id: '30d',  label: 'Last 30 days' },
  { id: '90d',  label: 'Last 3 months' },
  { id: '365d', label: 'Last 12 months' },
]

function initials(user) {
  const name = user?.user_metadata?.name ?? user?.email ?? ''
  return name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0,2).toUpperCase() || '?'
}

export default function TopBar({
  user, sites, currentSiteIdx, switcherOpen,
  onToggleSwitcher, onSelectSite, onAddSite,
  activeScreen, onNavigate, realtimeCount, isDemo,
  onLogout, range = '30d', onRangeChange, onTogglePublic, onDeleteSite,
}) {
  const [rangeOpen, setRangeOpen] = useState(false)
  const currentSite  = sites[currentSiteIdx]
  const rangeLabel   = RANGES.find(r => r.id === range)?.label ?? 'Last 30 days'

  return (
    <>
    {isDemo && (
      <div style={{ background:'var(--c-primary)', color:'white', fontSize:12.5, fontWeight:600, textAlign:'center', padding:'7px 16px', letterSpacing:'.01em' }}>
        Viewing demo data —{' '}
        <a href="#" style={{ color:'white', textDecoration:'underline' }} onClick={e => { e.preventDefault(); onNavigate('login') }}>
          Sign in
        </a>
        {' '}to connect a real site
      </div>
    )}
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-row1">
          <div className="topbar-logo">
            <div className="logo-badge">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 12L8 4l4 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="8" cy="4" r="1.5" fill="white"/>
              </svg>
            </div>
            <span className="logo-wordmark">klikstat</span>
          </div>

          <div className="topbar-divider" />

          {currentSite && (
            <div className="switcher-wrap" onClick={e => e.stopPropagation()}>
              <button className="switcher-btn" onClick={onToggleSwitcher}>
                <span className="prop-square" style={{ background: siteColor(currentSite) }}>
                  {(currentSite.name[0] ?? '?').toUpperCase()}
                </span>
                <span className="prop-info">
                  <span className="prop-name">{currentSite.name}</span>
                  <span className="prop-domain">{currentSite.domain}</span>
                </span>
                <svg className="switcher-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M4 5l3-3 3 3M4 9l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {switcherOpen && (
                <div className="switcher-dropdown">
                  <div className="dropdown-header">Your Properties</div>
                  {sites.map((s, i) => (
                    <div key={s.id} className="dropdown-item" onClick={() => onSelectSite(i)}>
                      <span className="prop-square" style={{ background: siteColor(s) }}>
                        {(s.name[0] ?? '?').toUpperCase()}
                      </span>
                      <span className="dropdown-item-info">
                        <div className="dropdown-item-name">{s.name}</div>
                        <div className="dropdown-item-sub">{s.domain}</div>
                      </span>
                      {i === currentSiteIdx && (
                        <svg className="dropdown-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ))}
                  {currentSite?.public_token && (
                    <>
                      <div className="dropdown-divider" />
                      <div className="dropdown-item" onClick={() => onTogglePublic?.(currentSite)}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
                          <path d="M8 2c-1.5 2-2 4-2 6s.5 4 2 6M8 2c1.5 2 2 4 2 6s-.5 4-2 6M2 8h12" stroke="currentColor" strokeWidth="1.4"/>
                        </svg>
                        <span style={{ flex:1, fontSize:13.5, fontWeight:600 }}>
                          {currentSite.is_public ? 'Public link (on)' : 'Share publicly'}
                        </span>
                        {currentSite.is_public && (
                          <span style={{ fontSize:11, fontWeight:700, color:'var(--c-green-text)', background:'var(--c-green-tint)', padding:'2px 7px', borderRadius:999 }}>On</span>
                        )}
                      </div>
                    </>
                  )}
                  <div className="dropdown-divider" />
                  <div className="dropdown-add" onClick={onAddSite}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Add a website
                  </div>
                  {currentSite && !isDemo && (
                    <>
                      <div className="dropdown-divider" />
                      <div
                        className="dropdown-item dropdown-item-danger"
                        onClick={() => { onDeleteSite?.(currentSite); setSwitcherOpen(false) }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 5h10M6 5V3.5h4V5M6.5 11V7M9.5 11V7M4 5l.7 9h6.6L12 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Delete this site
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="topbar-right">
            {/* Date range dropdown */}
            <div className="range-wrap" onClick={e => e.stopPropagation()}>
              <button className="date-range-btn" onClick={() => setRangeOpen(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M1.5 5.5h11M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {rangeLabel}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: rangeOpen ? 'rotate(180deg)' : undefined, transition:'transform 150ms' }}>
                  <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {rangeOpen && (
                <div className="range-dropdown">
                  {RANGES.map(r => (
                    <div
                      key={r.id}
                      className={`range-option${range === r.id ? ' active' : ''}`}
                      onClick={() => { onRangeChange?.(r.id); setRangeOpen(false) }}
                    >
                      {r.label}
                      {range === r.id && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7l4 4 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`topbar-avatar${activeScreen === 'profile' ? ' active' : ''}`}
              onClick={() => onNavigate(activeScreen === 'profile' ? 'dashboard' : 'profile')}
            >
              {initials(user)}
            </div>
          </div>
        </div>

        <nav className="topbar-nav">
          {NAV_TABS.map(t => (
            <button
              key={t.id}
              className={`nav-tab${activeScreen === t.id ? ' active' : ''}`}
              onClick={() => onNavigate(t.id)}
            >
              {t.label}
              {t.liveCount && realtimeCount > 0 && (
                <span className="nav-tab-pill">{realtimeCount}</span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </header>
    </>
  )
}
