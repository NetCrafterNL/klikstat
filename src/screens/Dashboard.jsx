import { useState, useEffect } from 'react' // useState used for stats/loading
import './Dashboard.css'
import { supabase } from '../lib/supabase'
import { COUNTRY_NAMES } from '../data/countries'
import { chartData as SEED_CHART, channels as SEED_CHANNELS, topPages as SEED_PAGES, locations as SEED_LOCS } from '../data/seed'

// Demo stats shown when no real site is connected
const DEMO_STATS = {
  visitors: 18420, pageviews: 52180, bounceRate: 41.2, avgDuration: 168,
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

const CHANNEL_COLORS = {
  Direct: '#C9C1FF', Search: '#5B4BE8', Social: '#FF9F6B',
  Referral: '#36C28E', Email: '#A6A4AE',
}

const STAT_META = [
  { key: 'pageviews',   label: 'Pageviews',   iconBg: '#EEEBFD', iconColor: '#5B4BE8', icon: <path d="M4 13h8M4 9h8M4 5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>, fmt: v => Number(v).toLocaleString() },
  { key: 'bounceRate',  label: 'Bounce rate', iconBg: '#E9F0FE', iconColor: '#2C6FE0', icon: <><path d="M5 13l3-5 3 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 5l-3 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>, fmt: v => `${Number(v).toFixed(0)}%` },
  { key: 'avgDuration', label: 'Avg. visit',  iconBg: '#FDF0E2', iconColor: '#D98324', icon: <><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6"/><path d="M9 6v3l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>, fmt: formatDuration },
  { key: 'goals',       label: 'Goals',       iconBg: '#E7F6EC', iconColor: '#1F9D55', icon: <path d="M3 9l4 4 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>, fmt: v => Number(v).toLocaleString() },
]

function Skeleton({ w = '100%', h = 18, r = 8, mb = 0 }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EEEBFD 25%,#F4F3FB 50%,#EEEBFD 75%)', backgroundSize: '200%', animation: 'shimmer 1.4s infinite', marginBottom: mb }} />
}

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : 30 }

export default function Dashboard({ siteId, siteName, userName, range = '30d', preloadedStats }) {
  const [stats, setStats]     = useState(preloadedStats ?? null)
  const [loading, setLoading] = useState(!preloadedStats)

  const firstName = (userName ?? '').split(/\s+/)[0] || 'there'

  useEffect(() => {
    if (preloadedStats) { setStats(preloadedStats); setLoading(false); return }
    if (!siteId) { setStats(DEMO_STATS); setLoading(false); return }
    setLoading(true)
    supabase.rpc('get_site_stats', { p_site_id: siteId, p_days: rangeToDays(range) })
      .then(({ data, error }) => {
        if (!error) setStats(data)
        setLoading(false)
      })
  }, [siteId, range, preloadedStats])

  const { line, area, last } = buildChartPath(stats?.chart)

  const topPages = stats?.topPages ?? []
  const maxPage  = topPages[0]?.count ?? 1
  const locations = stats?.locations ?? []
  const maxLoc   = locations[0]?.count ?? 1
  const channels  = stats?.channels ?? []
  const totalCh   = channels.reduce((s, c) => s + Number(c.count), 0) || 1

  // Build chart x-axis labels from chart data
  const chartDays = stats?.chart ?? []
  const labelIdxs = chartDays.length > 1
    ? [0, Math.floor(chartDays.length * 0.25), Math.floor(chartDays.length * 0.5), Math.floor(chartDays.length * 0.75), chartDays.length - 1]
    : []
  const chartLabels = [...new Set(labelIdxs)].map(i => {
    const d = new Date(chartDays[i]?.day + 'T00:00:00Z')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  })

  return (
    <>
      {/* Hero */}
      <div className="hero-band">
        <div className="hero-circle hero-circle-1" />
        <div className="hero-circle hero-circle-2" />
        <p className="hero-greeting">{greet(firstName)} — here&apos;s how {siteName} is doing</p>
        <div className="hero-metric">
          {loading
            ? <span className="hero-value" style={{ opacity: .4 }}>—</span>
            : <span className="hero-value">{Number(stats?.visitors ?? 0).toLocaleString()}</span>
          }
        </div>
        <p className="hero-caption">unique visitors · last {range === '30d' ? '30 days' : range === '7d' ? '7 days' : '24 hours'}</p>
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
            {loading
              ? <Skeleton h={28} w="60%" mb={6} />
              : <div className="stat-value">{s.fmt(stats?.[s.key] ?? 0)}</div>
            }
          </div>
        ))}
      </div>

      {/* Chart + Channels */}
      <div className="mid-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Visitors over time</span>
          </div>
          <div className="chart-wrap">
            {loading ? (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Skeleton w="100%" h={130} r={12} />
              </div>
            ) : chartDays.length === 0 ? (
              <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted3)', fontSize: 13 }}>
                No data yet — embed the snippet or generate demo data.
              </div>
            ) : (
              <>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="130" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5B4BE8" stopOpacity=".22"/>
                      <stop offset="100%" stopColor="#5B4BE8" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d={area} fill="url(#areaGrad)"/>
                  <path d={line} fill="none" stroke="#5B4BE8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx={last.x} cy={last.y} r="4" fill="#5B4BE8"/>
                  <circle cx={last.x} cy={last.y} r="7" fill="none" stroke="#5B4BE8" strokeOpacity=".25" strokeWidth="2"/>
                </svg>
                <div className="chart-xaxis">
                  {chartLabels.map((l, i) => <span key={i}>{l}</span>)}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Top channels</span>
          </div>
          {loading ? (
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
          {loading ? [1,2,3,4,5].map(i => <Skeleton key={i} h={28} r={6} mb={6} />) :
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
            <span className="report-col-label">Visitors</span>
          </div>
          {loading ? [1,2,3,4,5].map(i => <Skeleton key={i} h={28} r={6} mb={6} />) :
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
          }
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  )
}
