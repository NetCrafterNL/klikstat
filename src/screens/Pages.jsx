import { useState, useEffect } from 'react'
import './Pages.css'
import { supabase } from '../lib/supabase'
import { topPages as SEED_PAGES } from '../data/seed'

const DEMO_DATA = SEED_PAGES.map(p => ({
  pathname: p.path, pageviews: p.count,
  visitors: Math.round(p.count * 0.72), bounce_rate: 38 + Math.round(Math.random() * 20), avg_duration: 90 + Math.round(Math.random() * 120),
}))

function formatDuration(s) {
  if (!s) return '—'
  const sec = Math.round(s)
  return sec < 60 ? `${sec}s` : `${Math.floor(sec/60)}m ${sec%60}s`
}

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : 30 }

export default function Pages({ siteId, range }) {
  const [rows, setRows]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    if (!siteId) { setRows(DEMO_DATA); setLoading(false); return }
    setLoading(true)
    supabase.rpc('get_pages', { p_site_id: siteId, p_days: rangeToDays(range) })
      .then(({ data, error }) => {
        if (!error && data) setRows(data)
        setLoading(false)
      })
  }, [siteId, range])

  const filtered = (rows ?? []).filter(r =>
    !search || r.pathname.toLowerCase().includes(search.toLowerCase())
  )
  const maxVisitors = filtered[0]?.visitors ?? 1

  return (
    <>
      <div className="pages-title-row">
        <h1 className="pages-title">Pages</h1>
        <div className="pages-search-wrap">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="var(--c-text-muted3)" strokeWidth="1.4"/>
            <path d="M10 10l2.5 2.5" stroke="var(--c-text-muted3)" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="pages-search"
            placeholder="Filter pages…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="pages-card">
        <div className="pages-header-row">
          <span className="pages-col-main">Page</span>
          <span className="pages-col">Visitors</span>
          <span className="pages-col">Pageviews</span>
          <span className="pages-col">Bounce rate</span>
          <span className="pages-col">Avg. duration</span>
        </div>

        {loading ? (
          Array.from({length:8}).map((_,i) => (
            <div key={i} className="pages-row">
              <div className="pages-row-bar" style={{ width:`${90-i*10}%` }} />
              <span className="pages-col-main" style={{ background:'var(--c-violet-tint)', borderRadius:4, height:14, display:'block', width:'40%' }} />
              {[1,2,3,4].map(j => <span key={j} className="pages-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:40 }} />)}
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="pages-empty">No pages found{search ? ` matching "${search}"` : ' yet'}.</div>
        ) : (
          filtered.map(r => (
            <div key={r.pathname} className="pages-row">
              <div className="pages-row-bar" style={{ width:`${(r.visitors/maxVisitors*100).toFixed(1)}%` }} />
              <span className="pages-col-main pages-path">{r.pathname}</span>
              <span className="pages-col pages-num">{Number(r.visitors).toLocaleString()}</span>
              <span className="pages-col pages-num">{Number(r.pageviews).toLocaleString()}</span>
              <span className="pages-col pages-num">{r.bounce_rate != null ? `${Number(r.bounce_rate).toFixed(0)}%` : '—'}</span>
              <span className="pages-col pages-num">{formatDuration(r.avg_duration)}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
