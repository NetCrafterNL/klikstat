import { useState, useEffect } from 'react'
import './Pages.css'
import { downloadCSV } from '../lib/csv'
import { topPages as SEED_PAGES } from '../data/seed'

const DEMO_TOP = SEED_PAGES.map(p => ({
  pathname: p.path, count: p.count,
}))
const DEMO_ENTRY = SEED_PAGES.slice(0, 7).map(p => ({
  pathname: p.path, count: Math.round(p.count * 0.6),
}))

const TABS = [
  { id: 'top',   label: 'Top Pages' },
  { id: 'entry', label: 'Entry Pages' },
]

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : r === '365d' ? 365 : 30 }

export default function Pages({ siteId, range }) {
  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState('top')
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    fetch(`/api/pages/${siteId}?range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [siteId, range])

  const topPages   = siteId ? (data?.topPages ?? []) : DEMO_TOP
  const entryPages = siteId ? (data?.entryPages ?? []) : DEMO_ENTRY
  const isLoading  = siteId ? loading : false

  const currentRows = activeTab === 'top' ? topPages : entryPages
  const filtered = currentRows.filter(r =>
    !search || r.pathname.toLowerCase().includes(search.toLowerCase())
  )
  const maxCount = filtered[0]?.count ?? 1

  function handleExport() {
    const cols = [
      { key: 'pathname', label: 'Page' },
      { key: 'count',    label: activeTab === 'top' ? 'Pageviews' : 'Sessions' },
    ]
    downloadCSV(`klikstat-${activeTab}-pages.csv`, filtered, cols)
  }

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
        <div className="pages-header-row">
          <span className="pages-col-main">Page</span>
          <span className="pages-col">{activeTab === 'top' ? 'Pageviews' : 'Sessions'}</span>
        </div>

        {isLoading ? (
          Array.from({length:8}).map((_,i) => (
            <div key={i} className="pages-row">
              <div className="pages-row-bar" style={{ width:`${90-i*10}%` }} />
              <span className="pages-col-main" style={{ background:'var(--c-violet-tint)', borderRadius:4, height:14, display:'block', width:'40%' }} />
              <span className="pages-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:40 }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="pages-empty">No pages found{search ? ` matching "${search}"` : ' yet'}.</div>
        ) : (
          filtered.map(r => (
            <div key={r.pathname} className="pages-row">
              <div className="pages-row-bar" style={{ width:`${(r.count/maxCount*100).toFixed(1)}%` }} />
              <span className="pages-col-main pages-path">{r.pathname}</span>
              <span className="pages-col pages-num">{Number(r.count).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
