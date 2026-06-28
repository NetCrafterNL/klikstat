import { useState, useEffect } from 'react'
import './Dashboard.css'
import { COUNTRY_NAMES } from '../data/countries'
import { chartData as SEED_CHART, channels as SEED_CHANNELS, topPages as SEED_PAGES, locations as SEED_LOCS } from '../data/seed'

const DEMO_STATS = {
  visitors: 18420, pageviews: 52180, bounceRate: 41.2, avgDuration: 168, goals: 312,
  chart:    SEED_CHART.map((v, i) => ({ day: `2026-05-${String(i + 21).padStart(2,'0')}`, v })),
  topPages: SEED_PAGES.map(p => ({ pathname: p.path, count: p.count })),
  locations: SEED_LOCS.map(l => ({ country: l.code, count: l.count })),
  channels:  SEED_CHANNELS.map(c => ({ name: c.name, count: Math.round(c.percent * 182) })),
}

const W = 480, H = 130

function buildChartPath(data) {
  if (!data?.length) return { line: '', area: '', last: { x: 0, y: H } }
  const vals = data.map(d => Number(d.v))
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * W,
    y: H - ((v - min) / range) * (H * 0.82) - H * 0.08,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return { line, area: `${line} L${W} ${H} L0 ${H} Z`, last: pts[pts.length - 1] }
}

function formatDuration(seconds) {
  const s = Math.round(seconds ?? 0)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function greet(firstName) {
  const h = new Date().getHours()
  const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${tod}, ${firstName}`
}

const RANGE_LABELS = { '1d': 'today', '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 3 months', '365d': 'last 12 months' }

const CHANNEL_COLORS = {
  Direct: '#C9C1FF', Search: '#5B4BE8', Social: '#FF9F6B',
  Referral: '#36C28E', Email: '#A6A4AE',
}

const STAT_META = [
  { key: 'pageviews',   label: 'Pageviews',   lowerIsBetter: false, iconBg: '#EEEBFD', iconColor: '#5B4BE8', icon: <path d="M4 13h8M4 9h8M4 5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>, fmt: v => Number(v).toLocaleString() },
  { key: 'bounceRate',  label: 'Bounce rate', lowerIsBetter: true,  iconBg: '#E9F0FE', iconColor: '#2C6FE0', icon: <><path d="M5 13l3-5 3 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 5l-3 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>, fmt: v => `${Number(v).toFixed(0)}%` },
  { key: 'avgDuration', label: 'Avg. visit',  lowerIsBetter: false, iconBg: '#FDF0E2', iconColor: '#D98324', icon: <><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6"/><path d="M9 6v3l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>, fmt: formatDuration },
  { key: 'goals',       label: 'Goals',       lowerIsBetter: false, iconBg: '#E7F6EC', iconColor: '#1F9D55', icon: <path d="M3 9l4 4 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>, fmt: v => Number(v).toLocaleString() },
]

function Skeleton({ w = '100%', h = 18, r = 8, mb = 0 }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EEEBFD 25%,#F4F3FB 50%,#EEEBFD 75%)', backgroundSize: '200%', animation: 'shimmer 1.4s infinite', marginBottom: mb }} />
}

function TrendBadge({ current, previous, lowerIsBetter = false }) {
  if (!previous || Number(previous) === 0) return null
  const pct  = ((Number(current) - Number(previous)) / Number(previous)) * 100
  if (Math.abs(pct) < 0.5) return null
  const isUp   = pct > 0
  const isGood = lowerIsBetter ? !isUp : isUp
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      background: isGood ? '#E7F6EC' : '#FEE2E2',
      color: isGood ? '#1F9D55' : '#DC2626',
      display: 'inline-block', marginTop: 4,
    }}>
      {isUp ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function HeroDelta({ current, previous }) {
  if (!previous || Number(previous) === 0) return null
  const pct  = ((Number(current) - Number(previous)) / Number(previous)) * 100
  if (Math.abs(pct) < 0.5) return null
  const isUp = pct > 0
  return (
    <span className="hero-delta">
      {isUp ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% vs prev.
    </span>
  )
}

function AnnotationModal({ onSave, onClose }) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('#5B4BE8')
  const COLORS = ['#5B4BE8','#36C28E','#D98324','#D24A4F','#2C6FE0','#9B59B6']
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:800, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'var(--c-surface)', borderRadius:20, padding:24, width:320 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:800, color:'var(--c-text-primary)', marginBottom:16 }}>Add annotation</div>
        <input
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Launched v2.0"
          style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1.5px solid var(--c-border-input)', fontSize:13.5, fontWeight:500, background:'var(--c-bg)', color:'var(--c-text-body)', outline:'none', marginBottom:14, boxSizing:'border-box' }}
          onKeyDown={e => { if (e.key === 'Enter' && label.trim()) onSave(label.trim(), color) }}
        />
        <div style={{ display:'flex', gap:8, marginBottom:18 }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ width:24, height:24, borderRadius:6, background:c, border: color === c ? '2.5px solid var(--c-text-primary)' : '2px solid transparent', cursor:'pointer' }}
            />
          ))}
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:9, border:'1.5px solid var(--c-border)', background:'none', fontSize:13.5, fontWeight:700, color:'var(--c-text-muted2)', cursor:'pointer' }}>Cancel</button>
          <button onClick={() => label.trim() && onSave(label.trim(), color)}
            style={{ padding:'8px 16px', borderRadius:9, background:'var(--c-primary)', color:'white', border:'none', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ siteId, siteName, userName, range = '30d', preloadedStats }) {
  const [stats, setStats]         = useState(null)
  const [prevStats, setPrevStats] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [cities, setCities]       = useState(null)
  const [annotModal, setAnnotModal] = useState(null)
  const [locTab, setLocTab]       = useState('country')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    const p1 = fetch(`/api/stats/${siteId}?range=${range}`).then(r => r.json())
    const p2 = fetch(`/api/comparison/${siteId}?range=${range}`).then(r => r.json())
    const p3 = fetch(`/api/annotations/${siteId}?range=${range}`).then(r => r.json())
    Promise.all([p1, p2, p3]).then(([s, prev, annots]) => {
      setStats(s)
      setPrevStats(prev)
      setAnnotations(annots)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [siteId, range])

  useEffect(() => {
    if (!siteId || locTab !== 'city' || !stats) return
    // cities are included in the stats response
    setCities(stats.cities || [])
  }, [siteId, locTab, stats])

  async function handleSaveAnnotation(label, color) {
    if (!siteId) return
    const date = annotModal?.date
    setAnnotModal(null)
    const res = await fetch(`/api/annotations/${siteId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, label, color }),
    })
    const annot = await res.json()
    setAnnotations(prev => [...prev, annot])
  }

  async function handleDeleteAnnotation(annotationId) {
    await fetch(`/api/annotations/${annotationId}`, { method: 'DELETE' })
    setAnnotations(prev => prev.filter(a => a.id !== annotationId))
  }

  const displayStats = preloadedStats ?? (siteId ? stats : DEMO_STATS)
  const isLoading = siteId ? loading : false
  const firstName = (userName ?? '').split(/\s+/)[0] || 'there'

  const { line, area, last } = buildChartPath(displayStats?.chart)

  const topPages  = displayStats?.topPages  ?? []
  const maxPage   = topPages[0]?.count ?? 1
  const locations = displayStats?.locations ?? []
  const maxLoc    = locations[0]?.count ?? 1
  const channels  = displayStats?.channels  ?? []
  const totalCh   = channels.reduce((s, c) => s + Number(c.count), 0) || 1

  const chartDays    = displayStats?.chart ?? []
  const isHourly     = chartDays.length > 0 && (chartDays[0]?.day ?? '').includes('T')
  const labelIdxs    = chartDays.length > 1
    ? [0, Math.floor(chartDays.length * 0.25), Math.floor(chartDays.length * 0.5), Math.floor(chartDays.length * 0.75), chartDays.length - 1]
    : []
  const chartLabels = [...new Set(labelIdxs)].map(i => {
    const dayStr = chartDays[i]?.day
    if (isHourly) {
      return new Date(dayStr).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' })
    }
    return new Date(dayStr + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  })

  return (
    <>
      {/* Hero */}
      <div className="hero-band">
        <div className="hero-circle hero-circle-1" />
        <div className="hero-circle hero-circle-2" />
        <p className="hero-greeting">{greet(firstName)} — here&apos;s how {siteName} is doing</p>
        <div className="hero-metric">
          {isLoading
            ? <span className="hero-value" style={{ opacity: .4 }}>—</span>
            : <span className="hero-value">{Number(displayStats?.visitors ?? 0).toLocaleString()}</span>
          }
          {!isLoading && prevStats && (
            <HeroDelta current={displayStats?.visitors ?? 0} previous={prevStats?.visitors ?? 0} />
          )}
        </div>
        <p className="hero-caption">unique visitors · {RANGE_LABELS[range] ?? 'last 30 days'}</p>
      </div>

      {/* Stat cards */}
      <div className="stat-cards">
        {STAT_META.map(s => (
          <div key={s.key} className="stat-card">
            <div className="stat-card-top">
              <span className="stat-icon-chip" style={{ background: s.iconBg }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: s.iconColor }}>{s.icon}</svg>
              </span>
              <span className="stat-label">{s.label}</span>
            </div>
            {isLoading
              ? <><Skeleton h={28} w="60%" mb={6} /><Skeleton h={18} w="40%" /></>
              : <>
                  <div className="stat-value">{s.fmt(displayStats?.[s.key] ?? 0)}</div>
                  {prevStats && (
                    <TrendBadge
                      current={displayStats?.[s.key] ?? 0}
                      previous={prevStats?.[s.key] ?? 0}
                      lowerIsBetter={s.lowerIsBetter}
                    />
                  )}
                </>
            }
          </div>
        ))}
      </div>

      {/* Chart + Channels */}
      <div className="mid-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Visitors over time</span>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {isHourly && <span style={{ fontSize:11.5, fontWeight:700, color:'var(--c-text-muted3)' }}>Hourly</span>}
              {siteId && !isLoading && !isHourly && (
                <button
                  title="Add annotation"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0,10)
                    setAnnotModal({ date: today })
                  }}
                  style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, border:'1.5px solid var(--c-border)', background:'none', fontSize:12, fontWeight:700, color:'var(--c-text-muted2)', cursor:'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Annotate
                </button>
              )}
            </div>
          </div>
          <div className="chart-wrap" style={{ position:'relative' }}>
            {isLoading ? (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Skeleton w="100%" h={130} r={12} />
              </div>
            ) : chartDays.length === 0 ? (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted3)', fontSize: 13 }}>
                No data yet — embed the snippet or generate demo data.
              </div>
            ) : (
              <>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="130" preserveAspectRatio="none" style={{ display:'block' }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5B4BE8" stopOpacity=".22"/>
                      <stop offset="100%" stopColor="#5B4BE8" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d={area} fill="url(#areaGrad)"/>
                  <path d={line} fill="none" stroke="#5B4BE8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  {!isHourly && annotations.map(a => {
                    const idx = chartDays.findIndex(d => d.day === a.date)
                    if (idx < 0) return null
                    const x = chartDays.length > 1 ? (idx / (chartDays.length - 1)) * W : W / 2
                    return (
                      <g key={a.id}>
                        <line x1={x} y1="0" x2={x} y2={H} stroke={a.color} strokeWidth="1.5" strokeDasharray="3,3" opacity=".8"/>
                        <circle cx={x} cy="8" r="5" fill={a.color} style={{ cursor:'pointer' }}>
                          <title>{a.label} · {a.date}</title>
                        </circle>
                      </g>
                    )
                  })}
                  <circle cx={last.x} cy={last.y} r="4" fill="#5B4BE8"/>
                  <circle cx={last.x} cy={last.y} r="7" fill="none" stroke="#5B4BE8" strokeOpacity=".25" strokeWidth="2"/>
                </svg>
                <div className="chart-xaxis">
                  {chartLabels.map((l, i) => <span key={i}>{l}</span>)}
                </div>
                {annotations.length > 0 && (
                  <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                    {annotations.map(a => (
                      <span key={a.id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, fontWeight:600, color:'var(--c-text-muted2)', background:'var(--c-bg)', borderRadius:6, padding:'2px 8px 2px 6px', border:'1px solid var(--c-border)' }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:a.color, flexShrink:0 }}/>
                        {a.label}
                        <button onClick={() => handleDeleteAnnotation(a.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--c-text-muted3)', fontSize:13, lineHeight:1, padding:0, marginLeft:2 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Top channels</span>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4].map(i => <Skeleton key={i} h={14} r={4} />)}
            </div>
          ) : channels.length === 0 ? (
            <div style={{ color: 'var(--c-text-muted3)', fontSize: 13 }}>No data yet.</div>
          ) : (
            <>
              <div className="channels-bar-wrap">
                {channels.map(c => (
                  <div key={c.name} className="channels-bar-segment"
                    style={{ width: `${(c.count/totalCh*100).toFixed(1)}%`, background: CHANNEL_COLORS[c.name] ?? '#C9C1FF' }}
                  />
                ))}
              </div>
              <div className="channels-legend">
                {channels.map(c => (
                  <div key={c.name} className="channel-row">
                    <span className="channel-swatch" style={{ background: CHANNEL_COLORS[c.name] ?? '#C9C1FF' }} />
                    <span className="channel-name">{c.name}</span>
                    <span className="channel-pct">{(c.count/totalCh*100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top pages + Locations */}
      <div className="bottom-grid">
        <div className="card">
          <div className="report-header">
            <span className="card-title">Top pages</span>
            <span className="report-col-label">Visitors</span>
          </div>
          {isLoading ? [1,2,3,4,5].map(i => <Skeleton key={i} h={28} r={6} mb={6} />) :
           topPages.length === 0
            ? <div style={{ color: 'var(--c-text-muted3)', fontSize: 13 }}>No data yet.</div>
            : topPages.map(p => (
                <div key={p.pathname} className="bar-row">
                  <div className="bar-bg" style={{ width: `${(p.count/maxPage*100).toFixed(1)}%`, background: 'var(--c-violet-tint)' }} />
                  <span className="bar-label">{p.pathname}</span>
                  <span className="bar-count">{Number(p.count).toLocaleString()}</span>
                </div>
              ))
          }
        </div>

        <div className="card">
          <div className="report-header">
            <span className="card-title">Locations</span>
            <div style={{ display:'flex', gap:4 }}>
              {['country','city'].map(t => (
                <button key={t} onClick={() => setLocTab(t)}
                  style={{ padding:'3px 10px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', border:'1.5px solid var(--c-border)', background: locTab === t ? 'var(--c-primary)' : 'none', color: locTab === t ? 'white' : 'var(--c-text-muted2)' }}>
                  {t === 'country' ? 'Country' : 'City'}
                </button>
              ))}
            </div>
          </div>
          {isLoading ? [1,2,3,4,5].map(i => <Skeleton key={i} h={28} r={6} mb={6} />) :
           locTab === 'country' ? (
            locations.length === 0
              ? <div style={{ color: 'var(--c-text-muted3)', fontSize: 13 }}>No data yet.</div>
              : locations.map(l => (
                  <div key={l.country} className="loc-row">
                    <div className="loc-bar-bg" style={{ width: `${(l.count/maxLoc*100).toFixed(1)}%`, background: 'var(--c-green-tint)' }} />
                    <span className="loc-code">{l.country}</span>
                    <span className="loc-name">{COUNTRY_NAMES[l.country] ?? l.country}</span>
                    <span className="loc-count">{Number(l.count).toLocaleString()}</span>
                  </div>
                ))
           ) : (
            !cities
              ? <div style={{ color: 'var(--c-text-muted3)', fontSize: 13 }}>Loading cities…</div>
              : cities.length === 0
                ? <div style={{ color: 'var(--c-text-muted3)', fontSize: 13 }}>No city data yet.</div>
                : cities.map((c, i) => (
                    <div key={i} className="loc-row">
                      <div className="loc-bar-bg" style={{ width: `${(c.count/(cities[0]?.count||1)*100).toFixed(1)}%`, background: 'var(--c-green-tint)' }} />
                      <span className="loc-code">{c.country}</span>
                      <span className="loc-name">{c.city}</span>
                      <span className="loc-count">{Number(c.count).toLocaleString()}</span>
                    </div>
                  ))
           )
          }
        </div>
      </div>

      {annotModal && (
        <AnnotationModal
          onSave={handleSaveAnnotation}
          onClose={() => setAnnotModal(null)}
        />
      )}

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  )
}
