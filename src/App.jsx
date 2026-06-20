import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
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
import Login from './screens/Login'

const DEMO_USER = { email: 'demo@klikstat.com', user_metadata: { name: 'Jordan Diaz' } }
const DEMO_SITE = { id: null, name: 'Klikstat App', domain: 'app.klikstat.com' }

// Public share page — rendered outside the normal auth shell
function SharePage({ token }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch(`/api/public/${token}?days=30`)
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
        Powered by <a href="https://klikstat.vercel.app" style={{ color:'var(--c-primary)', textDecoration:'none' }}>Klikstat</a>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession]               = useState(undefined)
  const [sites, setSites]                   = useState([])
  const [currentSiteIdx, setCurrentSiteIdx] = useState(0)
  const [screen, setScreen]                 = useState('dashboard')
  const [range, setRange]                   = useState('30d')
  const [switcherOpen, setSwitcherOpen]     = useState(false)
  const [showAddSite, setShowAddSite]       = useState(false)
  const [realtimeCount, setRealtimeCount]   = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  // After sign-in, drop back to dashboard
  useEffect(() => {
    if (session) setScreen('dashboard')
  }, [session])

  useEffect(() => {
    if (!session) { setSites([]); return }
    supabase.from('sites').select('*').order('created_at')
      .then(({ data }) => { if (data) setSites(data) })
  }, [session])

  const handleSiteAdded = useCallback((newSite) => {
    setSites(prev => { const u = [...prev, newSite]; setCurrentSiteIdx(u.length - 1); return u })
    setShowAddSite(false)
    setScreen('dashboard')
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setSites([])
    setCurrentSiteIdx(0)
  }, [])

  const handleTogglePublic = useCallback(async (site) => {
    const newPublic = !site.is_public
    const { data } = await supabase
      .from('sites').update({ is_public: newPublic }).eq('id', site.id).select().single()
    if (data) {
      setSites(prev => prev.map(s => s.id === site.id ? data : s))
      if (newPublic) {
        const url = `${window.location.origin}?share=${data.public_token}`
        await navigator.clipboard.writeText(url).catch(() => {})
        alert(`Public dashboard enabled!\n\nShare link copied to clipboard:\n${url}`)
      }
    }
  }, [])

  if (session === undefined) return null

  // Public share page — no auth needed
  const shareToken = new URLSearchParams(window.location.search).get('share')
  if (shareToken) return <SharePage token={shareToken} />

  if (screen === 'login' && !session) return <Login />

  const user           = session?.user ?? DEMO_USER
  const effectiveSites = session ? sites : [DEMO_SITE]
  const currentSite    = effectiveSites[currentSiteIdx] ?? null
  const siteId         = currentSite?.id ?? null
  const siteName       = currentSite?.name ?? 'Demo'

  return (
    <div className="app-shell" onClick={() => setSwitcherOpen(false)} onClickCapture={() => {}}>
      <TopBar
        user={user}
        sites={effectiveSites}
        currentSiteIdx={currentSiteIdx}
        switcherOpen={switcherOpen}
        onToggleSwitcher={e => { e.stopPropagation(); setSwitcherOpen(v => !v) }}
        onSelectSite={i => { setCurrentSiteIdx(i); setSwitcherOpen(false) }}
        onAddSite={() => { setSwitcherOpen(false); setShowAddSite(true) }}
        activeScreen={screen}
        onNavigate={setScreen}
        realtimeCount={realtimeCount}
        onLogout={handleLogout}
        isDemo={!session}
        range={range}
        onRangeChange={setRange}
        onTogglePublic={handleTogglePublic}
      />

      <main className="app-content">
        {screen === 'dashboard' && (
          <Dashboard siteId={siteId} siteName={siteName} userName={user.user_metadata?.name ?? user.email} range={range} />
        )}
        {screen === 'realtime' && (
          <Realtime siteId={siteId} onOnlineCount={setRealtimeCount} />
        )}
        {screen === 'pages'      && <Pages      siteId={siteId} range={range} />}
        {screen === 'sources'    && <Sources    siteId={siteId} range={range} />}
        {screen === 'technology' && <Technology siteId={siteId} range={range} />}
        {screen === 'goals'      && <Goals      siteId={siteId} range={range} />}
        {screen === 'funnels'    && <Funnels    siteId={siteId} range={range} />}
        {screen === 'profile' && (
          <Profile user={user} onLogout={handleLogout} isDemo={!session} />
        )}
      </main>

      {showAddSite && session && (
        <AddSite onClose={() => setShowAddSite(false)} onSiteAdded={handleSiteAdded} />
      )}
      {showAddSite && !session && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowAddSite(false)}>
          <div style={{ background:'white', borderRadius:20, padding:32, maxWidth:400, textAlign:'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:800, marginBottom:10 }}>Sign in to add a website</div>
            <div style={{ fontSize:14, color:'var(--c-text-muted)', marginBottom:20 }}>Create a free account to start tracking your sites.</div>
            <button style={{ padding:'11px 28px', background:'var(--c-primary)', color:'white', borderRadius:10, fontWeight:700, fontSize:14, border:'none', cursor:'pointer', boxShadow:'var(--shadow-btn)' }}
              onClick={() => { setShowAddSite(false); setScreen('login') }}>
              Get started
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
