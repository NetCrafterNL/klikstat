import { useState, useCallback } from 'react'
import { useEffect } from 'react'
import './App.css'
import { useUser, useClerk, SignedIn, SignedOut } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import TopBar from './components/TopBar'
import AddSite from './components/AddSite'
import Dashboard from './screens/Dashboard'
import Realtime from './screens/Realtime'
import Profile from './screens/Profile'
import Pages from './screens/Pages'
import Sources from './screens/Sources'
import Technology from './screens/Technology'
import Goals from './screens/Goals'
import Funnels from './screens/Funnels'
import Overview from './screens/Overview'
import Retention from './screens/Retention'
import Login from './screens/Login'

const DEMO_SITE = { _id: null, name: 'Klikstat App', domain: 'app.klikstat.com' }

function SharePage({ token }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const convexUrl = import.meta.env.VITE_CONVEX_URL?.replace('.cloud', '.site') ?? ''
    fetch(`${convexUrl}/public/${token}?days=30`)
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error) }))
      .then(setData)
      .catch(e => setError(e.message))
  }, [token])

  if (error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:18, fontWeight:800, color:'var(--c-text-primary)' }}>Dashboard not available</div>
      <div style={{ color:'var(--c-text-muted)', fontSize:14 }}>{error}</div>
    </div>
  )
  if (!data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div style={{ color:'var(--c-text-muted2)', fontSize:14, fontWeight:600 }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh' }}>
      <div style={{ background:'var(--c-surface)', borderBottom:'1px solid var(--c-border)', padding:'14px 28px', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:30, height:30, background:'var(--c-primary)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 12L8 4l4 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="4" r="1.5" fill="white"/></svg>
        </div>
        <span style={{ fontSize:18, fontWeight:800, letterSpacing:'-.02em' }}>klikstat</span>
        <span style={{ fontSize:14, color:'var(--c-text-muted)', marginLeft:8 }}>/ {data.site.name}</span>
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--c-text-muted3)', fontWeight:600 }}>Public dashboard</span>
      </div>
      <div style={{ maxWidth:1240, margin:'0 auto', padding:28 }}>
        <Dashboard siteId={null} siteName={data.site.name} userName="" range="30d" preloadedStats={data.stats} />
      </div>
      <div style={{ textAlign:'center', padding:'20px 0 32px', fontSize:12.5, color:'var(--c-text-muted3)', fontWeight:600 }}>
        Powered by <a href="https://klikstat.nl" style={{ color:'var(--c-primary)', textDecoration:'none' }}>Klikstat</a>
      </div>
    </div>
  )
}

function AuthenticatedApp() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const sites = useQuery(api.sites.list) ?? []
  const updateSite = useMutation(api.sites.update)
  const removeSite = useMutation(api.sites.remove)

  const [currentSiteIdx, setCurrentSiteIdx] = useState(0)
  const [screen, setScreen]                 = useState('dashboard')
  const [range, setRange]                   = useState('30d')
  const [switcherOpen, setSwitcherOpen]     = useState(false)
  const [showAddSite, setShowAddSite]       = useState(false)
  const [realtimeCount, setRealtimeCount]   = useState(0)
  const [darkMode, setDarkMode]             = useState(() => localStorage.getItem('ks-dark') === '1')

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode)
    localStorage.setItem('ks-dark', darkMode ? '1' : '0')
  }, [darkMode])

  const handleSiteAdded = useCallback((newSiteId) => {
    setShowAddSite(false)
    setScreen('dashboard')
  }, [])

  const handleLogout = useCallback(async () => {
    await signOut()
  }, [signOut])

  const handleTogglePublic = useCallback(async (site) => {
    const newPublic = !site.isPublic
    const updated = await updateSite({ siteId: site._id, isPublic: newPublic })
    if (newPublic && updated?.publicToken) {
      const url = `${window.location.origin}?share=${updated.publicToken}`
      await navigator.clipboard.writeText(url).catch(() => {})
      alert(`Public dashboard enabled!\n\nShare link copied to clipboard:\n${url}`)
    }
  }, [updateSite])

  const handleDeleteSite = useCallback(async (site) => {
    if (!window.confirm(`Delete "${site.name}"?\n\nThis will permanently remove the site and all its analytics data. This cannot be undone.`)) return
    await removeSite({ siteId: site._id })
    setCurrentSiteIdx(i => Math.max(0, i - 1))
    setScreen('dashboard')
  }, [removeSite])

  const currentSite = sites[currentSiteIdx] ?? null
  const siteId      = currentSite?._id ?? null
  const siteName    = currentSite?.name ?? 'My Site'
  const userName    = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ''

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
        isDemo={false}
        range={range}
        onRangeChange={setRange}
        onTogglePublic={handleTogglePublic}
        onDeleteSite={handleDeleteSite}
      />

      <main className="app-content">
        {screen === 'dashboard' && (
          <Dashboard siteId={siteId} siteName={siteName} userName={userName} range={range} />
        )}
        {screen === 'realtime' && (
          <Realtime siteId={siteId} onOnlineCount={setRealtimeCount} />
        )}
        {screen === 'overview'   && <Overview   range={range} onNavigateToSite={id => { const idx = sites.findIndex(s => s._id === id); if (idx >= 0) { setCurrentSiteIdx(idx); setScreen('dashboard') } }} />}
        {screen === 'pages'      && <Pages      siteId={siteId} range={range} />}
        {screen === 'sources'    && <Sources    siteId={siteId} range={range} />}
        {screen === 'technology' && <Technology siteId={siteId} range={range} />}
        {screen === 'goals'      && <Goals      siteId={siteId} range={range} />}
        {screen === 'funnels'    && <Funnels    siteId={siteId} range={range} />}
        {screen === 'retention'  && <Retention  siteId={siteId} range={range} />}
        {screen === 'profile'    && (
          <Profile
            user={user}
            onLogout={handleLogout}
            isDemo={false}
            darkMode={darkMode}
            onToggleDark={() => setDarkMode(v => !v)}
            sites={sites}
          />
        )}
      </main>

      {showAddSite && (
        <AddSite onClose={() => setShowAddSite(false)} onSiteAdded={handleSiteAdded} />
      )}
    </div>
  )
}

function DemoApp() {
  const [screen, setScreen]     = useState('dashboard')
  const [range, setRange]       = useState('30d')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [showLogin, setShowLogin]       = useState(false)
  const [darkMode, setDarkMode]         = useState(() => localStorage.getItem('ks-dark') === '1')

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode)
    localStorage.setItem('ks-dark', darkMode ? '1' : '0')
  }, [darkMode])

  if (showLogin) return <Login onBack={() => setShowLogin(false)} />

  return (
    <div className="app-shell" onClick={() => setSwitcherOpen(false)}>
      <TopBar
        user={{ firstName: 'Demo', primaryEmailAddress: { emailAddress: 'demo@klikstat.com' } }}
        sites={[DEMO_SITE]}
        currentSiteIdx={0}
        switcherOpen={switcherOpen}
        onToggleSwitcher={e => { e.stopPropagation(); setSwitcherOpen(v => !v) }}
        onSelectSite={() => {}}
        onAddSite={() => setShowLogin(true)}
        activeScreen={screen}
        onNavigate={setScreen}
        realtimeCount={0}
        onLogout={() => setShowLogin(true)}
        isDemo={true}
        range={range}
        onRangeChange={setRange}
        onTogglePublic={() => setShowLogin(true)}
        onDeleteSite={() => setShowLogin(true)}
      />
      <main className="app-content">
        {screen === 'dashboard' && (
          <Dashboard siteId={null} siteName="Klikstat App" userName="Demo" range={range} />
        )}
      </main>
    </div>
  )
}

export default function App() {
  const shareToken = new URLSearchParams(window.location.search).get('share')
  if (shareToken) return <SharePage token={shareToken} />

  return (
    <>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
      <SignedOut>
        <DemoApp />
      </SignedOut>
    </>
  )
}
