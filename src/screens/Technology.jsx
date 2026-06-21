import { useState, useEffect } from 'react'
import './Technology.css'
import { supabase } from '../lib/supabase'
import { downloadCSV } from '../lib/csv'

const TABS = ['Devices', 'Browsers', 'OS']
const KEY  = { Devices: 'devices', Browsers: 'browsers', OS: 'os' }

const DEVICE_ICONS = {
  Desktop: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 14h6M8 11v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Mobile: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="4" y="1" width="8" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="12.5" r=".8" fill="currentColor"/>
    </svg>
  ),
  Tablet: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="12.5" r=".8" fill="currentColor"/>
    </svg>
  ),
}

const DEMO = {
  devices:  [{ name:'Desktop', count:12400 }, { name:'Mobile', count:5200 }, { name:'Tablet', count:820 }],
  browsers: [{ name:'Chrome', count:10800 }, { name:'Safari', count:5100 }, { name:'Firefox', count:1600 }, { name:'Edge', count:920 }],
  os:       [{ name:'Windows', count:8200 }, { name:'macOS', count:5600 }, { name:'iOS', count:2800 }, { name:'Android', count:1800 }, { name:'Linux', count:600 }],
}

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : r === '365d' ? 365 : 30 }

export default function Technology({ siteId, range }) {
  const [activeTab, setActiveTab] = useState('Devices')
  const [tech, setTech]           = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!siteId) { setTech(DEMO); setLoading(false); return }
    setLoading(true)
    supabase.rpc('get_technology', { p_site_id: siteId, p_days: rangeToDays(range) })
      .then(({ data, error }) => {
        if (!error && data) setTech(data)
        setLoading(false)
      })
  }, [siteId, range])

  const rows     = tech?.[KEY[activeTab]] ?? []
  const maxCount = rows[0]?.count ?? 1

  return (
    <>
      <div className="tech-title-row">
        <h1 className="tech-title">Technology</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button
          onClick={() => {
            downloadCSV(`klikstat-technology-${activeTab.toLowerCase()}.csv`, rows, [
              { key: 'name',  label: activeTab },
              { key: 'count', label: 'Visitors' },
            ])
          }}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, background:'var(--c-surface)', border:'1.5px solid var(--c-border)', fontSize:12.5, fontWeight:700, color:'var(--c-text-muted2)', cursor:'pointer', flexShrink:0 }}
          title="Export CSV"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v7M4 6l2.5 2.5L9 6M1.5 9.5v1A1.5 1.5 0 003 12h7a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          CSV
        </button>
        <div className="tech-tabs">
          {TABS.map(t => (
            <button key={t} className={`tech-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
              {t}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className="tech-card">
        <div className="tech-header-row">
          <span className="tech-col-main">{activeTab}</span>
          <span className="tech-col">Visitors</span>
          <span className="tech-col">Share</span>
        </div>

        {loading ? (
          Array.from({length:4}).map((_,i) => (
            <div key={i} className="tech-row">
              <div className="tech-row-bar" style={{ width:`${85-i*18}%` }} />
              <span className="tech-col-main" style={{ background:'var(--c-violet-tint)', borderRadius:4, height:14, display:'block', width:'40%' }} />
              <span className="tech-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:44 }} />
              <span className="tech-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:40 }} />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="tech-empty">No data yet for this period.</div>
        ) : (
          rows.map(r => {
            const total = rows.reduce((s, x) => s + Number(x.count), 0)
            const pct   = total > 0 ? (r.count / total * 100) : 0
            return (
              <div key={r.name} className="tech-row">
                <div className="tech-row-bar" style={{ width:`${(r.count/maxCount*100).toFixed(1)}%` }} />
                <span className="tech-col-main tech-name">
                  {activeTab === 'Devices' && DEVICE_ICONS[r.name] && (
                    <span className="tech-icon">{DEVICE_ICONS[r.name]}</span>
                  )}
                  {r.name}
                </span>
                <span className="tech-col tech-num">{Number(r.count).toLocaleString()}</span>
                <span className="tech-col tech-pct">{pct.toFixed(1)}%</span>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
