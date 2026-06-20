import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import TopBar from './components/TopBar'
import AddSite from './components/AddSite'
import Dashboard from './screens/Dashboard'
import Realtime from './screens/Realtime'
import Profile from './screens/Profile'
import Login from './screens/Login'

export default function App() {
  const [session, setSession]         = useState(undefined) // undefined = loading
  const [sites, setSites]             = useState([])
  const [currentSiteIdx, setCurrentSiteIdx] = useState(0)
  const [screen, setScreen]           = useState('dashboard')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [showAddSite, setShowAddSite]  = useState(false)
  const [realtimeCount, setRealtimeCount] = useState(0)

  // Restore session on mount + listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load sites whenever the user logs in
  useEffect(() => {
    if (!session) { setSites([]); return }
    supabase.from('sites').select('*').order('created_at')
      .then(({ data }) => {
        if (data) setSites(data)
      })
  }, [session])

  const handleSiteAdded = useCallback((newSite) => {
    setSites(prev => {
      const updated = [...prev, newSite]
      setCurrentSiteIdx(updated.length - 1)
      return updated
    })
    setShowAddSite(false)
    setScreen('dashboard')
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setSites([])
    setCurrentSiteIdx(0)
    setScreen('dashboard')
  }, [])

  // Loading state while restoring session
  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--c-text-muted2)', fontSize: 14, fontWeight: 600 }}>Loading…</div>
      </div>
    )
  }

  // Not logged in
  if (!session) {
    return <Login />
  }

  const user = session.user
  const currentSite = sites[currentSiteIdx] ?? null

  // Logged in but no sites yet
  if (sites.length === 0 && !showAddSite) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)',
          padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <div style={{ width: 30, height: 30, background: 'var(--c-primary)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 12L8 4l4 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="8" cy="4" r="1.5" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em' }}>klikstat</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: 40 }}>
          <div style={{ width: 56, height: 56, background: 'var(--c-violet-tint)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="24" height="24" rx="5" stroke="var(--c-primary)" strokeWidth="2"/>
              <path d="M14 8v12M8 14h12" stroke="var(--c-primary)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-primary)', marginBottom: 8 }}>Add your first website</div>
            <div style={{ fontSize: 14, color: 'var(--c-text-muted)', maxWidth: 340 }}>
              Get a tracking snippet to embed on your site. Data starts flowing immediately.
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ padding: '12px 28px', fontSize: 15, borderRadius: 11, background: 'var(--c-primary)', color: 'white', fontWeight: 700, border: 'none', boxShadow: 'var(--shadow-btn)', cursor: 'pointer' }}
            onClick={() => setShowAddSite(true)}
          >
            Add a website
          </button>
          <button
            onClick={handleLogout}
            style={{ fontSize: 13, color: 'var(--c-text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell" onClick={() => setSwitcherOpen(false)}>
      <TopBar
        user={user}
        sites={sites}
        currentSiteIdx={currentSiteIdx}
        switcherOpen={switcherOpen}
        onToggleSwitcher={e => { e.stopPropagation(); setSwitcherOpen(v => !v) }}
        onSelectSite={i => { setCurrentSiteIdx(i); setSwitcherOpen(false) }}
        onAddSite={() => { setSwitcherOpen(false); setShowAddSite(true) }}
        activeScreen={screen}
        onNavigate={setScreen}
        realtimeCount={realtimeCount}
        onLogout={handleLogout}
      />

      <main className="app-content">
        {screen === 'dashboard' && currentSite && (
          <Dashboard siteId={currentSite.id} siteName={currentSite.name} userName={user.user_metadata?.name ?? user.email} />
        )}
        {screen === 'realtime' && currentSite && (
          <Realtime siteId={currentSite.id} onOnlineCount={setRealtimeCount} />
        )}
        {screen === 'profile' && (
          <Profile user={user} onLogout={handleLogout} />
        )}
      </main>

      {showAddSite && (
        <AddSite
          onClose={() => setShowAddSite(false)}
          onSiteAdded={handleSiteAdded}
        />
      )}
    </div>
  )
}
