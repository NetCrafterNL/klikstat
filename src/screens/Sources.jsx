import { useState } from 'react'
import './Sources.css'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { downloadCSV } from '../lib/csv'
import { channels as SEED_CH } from '../data/seed'

function SourceIcon({ source, channel }) {
  const [failed, setFailed] = useState(false)

  if (source === 'Direct') {
    return (
      <span className="sources-avatar" style={{ background: '#F4F3FB' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1l6 6-6 6M1 7h12" stroke="var(--c-text-muted2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    )
  }

  if (!failed) {
    return (
      <span className="sources-avatar sources-avatar-favicon">
        <img
          src={`https://icons.duckduckgo.com/ip3/${encodeURIComponent(source)}.ico`}
          alt={source}
          width="16"
          height="16"
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ borderRadius: 2 }}
        />
      </span>
    )
  }

  return (
    <span className="sources-avatar" style={{ background: CHANNEL_COLORS[channel] ?? '#C9C1FF' }}>
      {(source[0] ?? '?').toUpperCase()}
    </span>
  )
}

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

const CHANNELS = ['All', 'Search', 'Social', 'Direct', 'Referral', 'Campaigns']

function rangeToDays(r) { return r === '1d' ? 1 : r === '7d' ? 7 : r === '90d' ? 90 : r === '365d' ? 365 : 30 }

function classifyChannel(ref) {
  if (!ref || ref === 'Direct') return 'Direct'
  try {
    const host = new URL(ref.startsWith('http') ? ref : `https://${ref}`).hostname.replace(/^www\./, '')
    if (/google|bing|duckduckgo|yahoo|baidu|yandex/.test(host)) return 'Search'
    if (/facebook|twitter|instagram|linkedin|tiktok|reddit|pinterest|youtube/.test(host)) return 'Social'
    return 'Referral'
  } catch { return 'Referral' }
}

export default function Sources({ siteId, range }) {
  const [activeChannel, setActive] = useState('All')

  const days      = rangeToDays(range)
  const sourcesQ  = useQuery(api.stats.getSources,  siteId ? { siteId, days } : 'skip')
  const campaignQ = useQuery(api.stats.getCampaigns, siteId ? { siteId, days } : 'skip')

  const rows      = siteId ? (sourcesQ ?? []).map(r => ({ source: r.referrer, channel: classifyChannel(r.referrer), visitors: r.count })) : DEMO_DATA
  const campaigns = siteId ? (campaignQ ?? null) : null
  const loading   = siteId ? sourcesQ === undefined : false

  const filtered = (rows ?? []).filter(r => activeChannel === 'All' || r.channel === activeChannel)
  const maxVisitors = filtered[0]?.visitors ?? 1

  return (
    <>
      <div className="sources-title-row">
        <h1 className="sources-title">Sources</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button
          onClick={() => {
            const data = activeChannel === 'Campaigns' ? (campaigns ?? []) : filtered
            const cols = activeChannel === 'Campaigns'
              ? [{ key:'campaign', label:'Campaign' }, { key:'source', label:'Source' }, { key:'medium', label:'Medium' }, { key:'visitors', label:'Visitors' }, { key:'pageviews', label:'Pageviews' }]
              : [{ key:'source', label:'Source' }, { key:'channel', label:'Channel' }, { key:'visitors', label:'Visitors' }, { key:'pageviews', label:'Pageviews' }]
            downloadCSV('klikstat-sources.csv', data, cols)
          }}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:10, background:'var(--c-surface)', border:'1.5px solid var(--c-border)', fontSize:12.5, fontWeight:700, color:'var(--c-text-muted2)', cursor:'pointer', flexShrink:0 }}
          title="Export CSV"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v7M4 6l2.5 2.5L9 6M1.5 9.5v1A1.5 1.5 0 003 12h7a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          CSV
        </button>
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
      </div>

      {activeChannel === 'Campaigns' ? (
        <div className="sources-card">
          <div className="sources-header-row" style={{ gridTemplateColumns:'1fr 130px 130px 90px 100px' }}>
            <span className="sources-col-main">Campaign</span>
            <span className="sources-col-ch">Source</span>
            <span className="sources-col-ch">Medium</span>
            <span className="sources-col">Visitors</span>
            <span className="sources-col">Pageviews</span>
          </div>
          {!campaigns || campaigns.length === 0 ? (
            <div className="sources-empty">
              No UTM campaigns tracked yet. Add <code style={{ background:'var(--c-bg)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>?utm_campaign=name</code> to your links.
            </div>
          ) : (
            campaigns.map((c, i) => (
              <div key={i} className="sources-row" style={{ gridTemplateColumns:'1fr 130px 130px 90px 100px' }}>
                <span className="sources-col-main"><span className="sources-domain">{c.campaign}</span></span>
                <span className="sources-col-ch" style={{ textAlign:'left', paddingLeft:4, fontSize:13, color:'var(--c-text-muted2)', fontWeight:600 }}>{c.source}</span>
                <span className="sources-col-ch" style={{ textAlign:'left', paddingLeft:4, fontSize:13, color:'var(--c-text-muted2)', fontWeight:600 }}>{c.medium}</span>
                <span className="sources-col sources-num">{Number(c.visitors).toLocaleString()}</span>
                <span className="sources-col sources-num">{Number(c.pageviews).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      ) : (
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
                <SourceIcon source={r.source} channel={r.channel} />
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
      )}
    </>
  )
}
