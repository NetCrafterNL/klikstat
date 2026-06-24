import './Overview.css'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { downloadCSV } from '../lib/csv'

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : r === '365d' ? 365 : 30 }

function TrendMini({ visitors }) {
  const max = Math.max(...visitors, 1)
  const w = 52, h = 20
  const pts = visitors.map((v, i) => ({
    x: (i / (visitors.length - 1)) * w,
    y: h - (v / max) * h * 0.9 - h * 0.05,
  }))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:'block' }}>
      <path d={d} fill="none" stroke="#5B4BE8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Overview({ range, onNavigateToSite }) {
  const days  = rangeToDays(range)
  const rows  = useQuery(api.stats.getAggregateStats, { days })
  const loading = rows === undefined

  const totals = (rows ?? []).reduce((acc, r) => ({
    visitors:  acc.visitors  + Number(r.visitors),
    pageviews: acc.pageviews + Number(r.pageviews),
  }), { visitors: 0, pageviews: 0 })

  function handleExport() {
    downloadCSV('klikstat-overview.csv', rows ?? [], [
      { key: 'site_name',  label: 'Site' },
      { key: 'domain',     label: 'Domain' },
      { key: 'visitors',   label: 'Visitors' },
      { key: 'pageviews',  label: 'Pageviews' },
      { key: 'bounce_rate',label: 'Bounce Rate (%)' },
      { key: 'revenue',    label: 'Revenue' },
    ])
  }

  const maxVisitors = (rows ?? [])[0]?.visitors ?? 1

  return (
    <>
      <div className="ov-title-row">
        <h1 className="ov-title">Overview</h1>
        <button className="pages-export-btn" onClick={handleExport} title="Export CSV">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v7M4 6l2.5 2.5L9 6M1.5 9.5v1A1.5 1.5 0 003 12h7a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          CSV
        </button>
      </div>

      {/* Totals row */}
      {!loading && rows && (
        <div className="ov-totals">
          {[
            { label: 'Total visitors',  val: Number(totals.visitors).toLocaleString() },
            { label: 'Total pageviews', val: Number(totals.pageviews).toLocaleString() },
            { label: 'Sites tracked',   val: rows.length },
          ].map(t => (
            <div key={t.label} className="ov-total-card">
              <div className="ov-total-label">{t.label}</div>
              <div className="ov-total-val">{t.val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="ov-card">
        <div className="ov-header-row">
          <span className="ov-col-main">Site</span>
          <span className="ov-col">Visitors</span>
          <span className="ov-col">Pageviews</span>
        </div>

        {loading ? (
          Array.from({length:4}).map((_,i) => (
            <div key={i} className="ov-row">
              <div className="ov-row-bar" style={{ width:`${80-i*15}%` }}/>
              <span className="ov-col-main" style={{ background:'var(--c-violet-tint)', borderRadius:4, height:14, display:'block', width:'45%' }}/>
              {[1,2,3,4].map(j => <span key={j} className="ov-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'inline-block', width:50 }}/>)}
            </div>
          ))
        ) : !rows?.length ? (
          <div className="ov-empty">No sites found. Add a site to get started.</div>
        ) : (
          rows.map(r => (
            <div key={r.siteId} className="ov-row" onClick={() => onNavigateToSite?.(r.siteId)} style={{ cursor:'pointer' }}>
              <div className="ov-row-bar" style={{ width:`${(Number(r.visitors)/Number(maxVisitors)*100).toFixed(1)}%` }}/>
              <span className="ov-col-main">
                <span className="ov-site-dot" style={{ background: `hsl(${r.name.charCodeAt(0)*7 % 360},60%,55%)` }}/>
                <span className="ov-col-main-inner">
                  <span className="ov-site-name">{r.name}</span>
                  <span className="ov-site-domain">{r.domain}</span>
                </span>
              </span>
              <span className="ov-col ov-num">{Number(r.visitors).toLocaleString()}</span>
              <span className="ov-col ov-num">{Number(r.pageviews).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
