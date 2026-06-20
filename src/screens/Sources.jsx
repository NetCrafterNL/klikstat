import { useState, useEffect } from 'react'
import './Sources.css'
import { supabase } from '../lib/supabase'
import { channels as SEED_CH } from '../data/seed'

const CHANNEL_COLORS = {
  Direct: '#C9C1FF', Search: '#5B4BE8', Social: '#FF9F6B',
  Referral: '#36C28E', Email: '#A6A4AE',
}

const DEMO_DATA = [
  { source: 'google.com',   channel: 'Search',   visitors: 7800, pageviews: 11200 },
  { source: 'Direct',       channel: 'Direct',   visitors: 4550, pageviews: 6300 },
  { source: 'twitter.com',  channel: 'Social',   visitors: 1820, pageviews: 2400 },
  { source: 'reddit.com',   channel: 'Social',   visitors: 940,  pageviews: 1300 },
  { source: 'github.com',   channel: 'Referral', visitors: 810,  pageviews: 1020 },
  { source: 'bing.com',     channel: 'Search',   visitors: 620,  pageviews: 890 },
  { source: 'linkedin.com', channel: 'Social',   visitors: 410,  pageviews: 540 },
  { source: 'duckduckgo.com', channel: 'Search', visitors: 380,  pageviews: 490 },
  { source: 'producthunt.com', channel: 'Referral', visitors: 290, pageviews: 380 },
]

const CHANNELS = ['All', 'Search', 'Social', 'Direct', 'Referral']

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : 30 }

export default function Sources({ siteId, range }) {
  const [rows, setRows]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeChannel, setActive] = useState('All')

  useEffect(() => {
    if (!siteId) { setRows(DEMO_DATA); setLoading(false); return }
    setLoading(true)
    supabase.rpc('get_sources', { p_site_id: siteId, p_days: rangeToDays(range) })
      .then(({ data, error }) => {
        if (!error && data) setRows(data)
        setLoading(false)
      })
  }, [siteId, range])

  const filtered = (rows ?? []).filter(r => activeChannel === 'All' || r.channel === activeChannel)
  const maxVisitors = filtered[0]?.visitors ?? 1

  return (
    <>
      <div className="sources-title-row">
        <h1 className="sources-title">Sources</h1>
        <div className="sources-channel-tabs">
          {CHANNELS.map(c => (
            <button
              key={c}
              className={`sources-tab${activeChannel === c ? ' active' : ''}`}
              onClick={() => setActive(c)}
            >
              {c !== 'All' && <span className="sources-tab-dot" style={{ background: CHANNEL_COLORS[c] }} />}
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="sources-card">
        <div className="sources-header-row">
          <span className="sources-col-main">Source</span>
          <span className="sources-col-ch">Channel</span>
          <span className="sources-col">Visitors</span>
          <span className="sources-col">Pageviews</span>
        </div>

        {loading ? (
          Array.from({length:6}).map((_,i) => (
            <div key={i} className="sources-row">
              <div className="sources-row-bar" style={{ width:`${90-i*13}%` }} />
              <span className="sources-col-main" style={{ background:'var(--c-violet-tint)', borderRadius:4, height:14, display:'block', width:'35%' }} />
              <span className="sources-col-ch" />
              <span className="sources-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:40 }} />
              <span className="sources-col" style={{ background:'var(--c-bg)', borderRadius:4, height:14, display:'block', width:40 }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="sources-empty">No {activeChannel !== 'All' ? activeChannel.toLowerCase() + ' ' : ''}sources found yet.</div>
        ) : (
          filtered.map((r, i) => (
            <div key={i} className="sources-row">
              <div className="sources-row-bar" style={{ width:`${(r.visitors/maxVisitors*100).toFixed(1)}%` }} />
              <span className="sources-col-main">
                <span className="sources-avatar" style={{ background: CHANNEL_COLORS[r.channel] ?? '#C9C1FF' }}>
                  {(r.source[0] ?? '?').toUpperCase()}
                </span>
                <span className="sources-domain">{r.source}</span>
              </span>
              <span className="sources-col-ch">
                <span className="sources-badge" style={{ background: `${CHANNEL_COLORS[r.channel] ?? '#C9C1FF'}22`, color: r.channel === 'Search' ? 'var(--c-primary)' : r.channel === 'Direct' ? 'var(--c-text-muted)' : 'var(--c-text-body2)' }}>
                  {r.channel}
                </span>
              </span>
              <span className="sources-col sources-num">{Number(r.visitors).toLocaleString()}</span>
              <span className="sources-col sources-num">{Number(r.pageviews).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
