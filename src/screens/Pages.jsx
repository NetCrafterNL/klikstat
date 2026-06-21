import { useState, useEffect } from 'react'
import './Pages.css'
import { supabase } from '../lib/supabase'
import { downloadCSV } from '../lib/csv'
import { topPages as SEED_PAGES } from '../data/seed'

const DEMO_TOP = SEED_PAGES.map(p => ({
  pathname: p.path, pageviews: p.count,
  visitors: Math.round(p.count * 0.72), bounce_rate: 42, avg_duration: 115,
}))
const DEMO_ENTRY = SEED_PAGES.slice(0, 7).map(p => ({
  pathname: p.path, sessions: Math.round(p.count * 0.6), bounce_rate: 38,
}))
const DEMO_EXIT = SEED_PAGES.slice(0, 7).map(p => ({
  pathname: p.path, sessions: Math.round(p.count * 0.55),
}))

const TABS = [
  { id: 'top',   label: 'Top Pages' },
  { id: 'entry', label: 'Entry Pages' },
  { id: 'exit',  label: 'Exit Pages' },
]

function formatDuration(s) {
  if (!s) return '—'
  const sec = Math.round(s)
  return sec < 60 ? `${sec}s` : `${Math.floor(sec/60)}m ${sec%60}s`
}

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : r === '365d' ? 365 : 30 }

export default function Pages({ siteId, range }) {
  const [rows, setRows]           = useState(null)
  const [entryExit, setEntryExit] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState('top')

  useEffect(() => {
    if (!siteId) {
      setRows(DEMO_TOP)
      setEntryExit({ entry: DEMO_ENTRY, exit: DEMO_EXIT })
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      supabase.rpc('get_pages',            { p_site_id: siteId, p_days: rangeToDays(range) }),
      supabase.rpc('get_entry_exit_pages', { p_site_id: siteId, p_days: rangeToDays(range) }),
    ]).then(([{ data, error }, { data: eeData }]) => {
      if (!error && data) setRows(data)
      if (eeData) setEntryExit(eeData)
      setLoading(false)
    })
  }, [siteId, range])

  const currentRows = activeTab === 'top'
    ? (rows ?? [])
    : activeTab === 'entry'
      ? (entryExit?.entry ?? [])
      : (entryExit?.exit ?? [])

  const filtered = currentRows.filter(r =>
    !search || r.pathname.toLowerCase().includes(search.toLowerCase())
  )

  const maxCount = filtered[0]?.visitors ?? filtered[0]?.sessions ?? 1

  function handleExport() {
    const cols = activeTab === 'top'
      ? [
          { key: 'pathname',     label: 'Page' },
          { key: 'visitors',     label: 'Visitors' },
          { key: 'pageviews',    label: 'Pageviews' },
          { key: 'bounce_rate',  label: 'Bounce Rate (%)' },
          { key: 'avg_duration', label: 'Avg Duration (s)' },
        ]
      : activeTab === 'entry'
        ? [
            { key: 'pathname',    label: 'Page' },
            { key: 'sessions',    label: 'Sessions' },
            { key: 'bounce_rate', label: 'Bounce Rate (%)' },
          ]
        : [
            { key: 'pathname', label: 'Page' },
            { key: 'sessions', label: 'Sessions' },
          ]
    downloadCSV(`klikstat-${activeTab}-pages.csv`, filtered, cols)
  }

  const isTopTab   = activeTab === 'top'
  const isEntryTab = activeTab === 'entry'

  return (
    <>
      <div className="pages-title-row">
        <h1 className="pages-title">Pages</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
          <button className="pages-export-btn" onClick={handleExport} title="Export CSV">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v7M4 6l2.5 2.5L9 6M1.5 9.5v1A1.5 1.5 0 003 12h7a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            CSV
          </button>
        </div>
      </div>

      <div className="pages-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`pages-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pages-card">
        {/* Header */}
        {isTopTab ? (
          <div className="pages-header-row">
            <span className="pages-col-main">Page</span>
            <span className="pages-col">Visitors</span>
            <span className="pages-col">Pageviews</span>
            <span className="pages-col">Bounce rate</span>
            <span className="pages-col">Avg. duration</span>
          </div>
        ) : isEntryTab ? (
          <div className="pages-header-row pages-header-entry">
            <span className="pages-col-main">Page</span>
            <span className="pages-col">Sessions</span>
            <span className="pages-col">Bounce rate</span>
          </div>
        ) : (
          <div className="pages-header-row pages-header-exit">
            <span className="pages-col-main">Page</span>
            <span className="pages-col">Sessions</span>
          </div>
        )}

        {/* Rows */}
        {loading ? (
          Array.from({length:8}).map((_,i) => (
            <div key={i} className={`pages-row${isTopTab ? '' : isEntryTab ? ' pages-row-entry' : ' pages-row-exit'}`}>
              <div className="pages-row-bar" style={{ width:`${90-i*10}%` }} />
              <span className="pages-col-main" style={{ background:'var(--c-violet-tint)', borderRadius:4, height:14, display:'block', width:'40%' }} />
              {isTopTab
                ? [1,2,3,4].map(j => <span key={j} className="pages-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:40 }} />)
                : isEntryTab
                  ? [1,2].map(j => <span key={j} className="pages-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:40 }} />)
                  : [1].map(j => <span key={j} className="pages-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:40 }} />)
              }
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="pages-empty">No pages found{search ? ` matching "${search}"` : ' yet'}.</div>
        ) : isTopTab ? (
          filtered.map(r => (
            <div key={r.pathname} className="pages-row">
              <div className="pages-row-bar" style={{ width:`${(r.visitors/maxCount*100).toFixed(1)}%` }} />
              <span className="pages-col-main pages-path">{r.pathname}</span>
              <span className="pages-col pages-num">{Number(r.visitors).toLocaleString()}</span>
              <span className="pages-col pages-num">{Number(r.pageviews).toLocaleString()}</span>
              <span className="pages-col pages-num">{r.bounce_rate != null ? `${Number(r.bounce_rate).toFixed(0)}%` : '—'}</span>
              <span className="pages-col pages-num">{formatDuration(r.avg_duration)}</span>
            </div>
          ))
        ) : isEntryTab ? (
          filtered.map(r => (
            <div key={r.pathname} className="pages-row pages-row-entry">
              <div className="pages-row-bar" style={{ width:`${(r.sessions/maxCount*100).toFixed(1)}%` }} />
              <span className="pages-col-main pages-path">{r.pathname}</span>
              <span className="pages-col pages-num">{Number(r.sessions).toLocaleString()}</span>
              <span className="pages-col pages-num">{r.bounce_rate != null ? `${Number(r.bounce_rate).toFixed(0)}%` : '—'}</span>
            </div>
          ))
        ) : (
          filtered.map(r => (
            <div key={r.pathname} className="pages-row pages-row-exit">
              <div className="pages-row-bar" style={{ width:`${(r.sessions/maxCount*100).toFixed(1)}%` }} />
              <span className="pages-col-main pages-path">{r.pathname}</span>
              <span className="pages-col pages-num">{Number(r.sessions).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
