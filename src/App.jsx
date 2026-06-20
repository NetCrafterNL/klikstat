import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import TopBar from './components/TopBar'
import AddSite from './components/AddSite'
import Dashboard from './screens/Dashboard'
import Realtime from './screens/Realtime'
import Profile from './screens/Profile'

const DEMO_USER = { email: 'demo@klikstat.com', user_metadata: { name: 'Jordan Diaz' } }
const DEMO_SITE = { id: null, name: 'Klikstat App', domain: 'app.klikstat.com' }

export default function App() {
  const [session, setSession]               = useState(undefined)
  const [sites, setSites]                   = useState([])
  const [currentSiteIdx, setCurrentSiteIdx] = useState(0)
  const [screen, setScreen]                 = useState('dashboard')
  const [switcherOpen, setSwitcherOpen]     = useState(false)
  const [showAddSite, setShowAddSite]       = useState(false)
  const [realtimeCount, setRealtimeCount]   = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

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

  // Still resolving session — show nothing briefly
  if (session === undefined) return null

  // Use real session data if logged in, otherwise demo values
  const user        = session?.user ?? DEMO_USER
  const effectiveSites = session ? sites : [DEMO_SITE]
  const currentSite    = effectiveSites[currentSiteIdx] ?? null

  return (
    <div className="app-shell" onClick={() => setSwitcherOpen(false)}>
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
      />

      <main className="app-content">
        {screen === 'dashboard' && (
          <Dashboard
            siteId={currentSite?.id ?? null}
            siteName={currentSite?.name ?? 'Demo'}
            userName={user.user_metadata?.name ?? user.email}
          />
        )}
        {screen === 'realtime' && (
          <Realtime siteId={currentSite?.id ?? null} onOnlineCount={setRealtimeCount} />
        )}
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
            <a href="/login" style={{ display:'inline-block', padding:'11px 28px', background:'var(--c-primary)', color:'white', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}
              onClick={() => setScreen('login')}>
              Get started
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
