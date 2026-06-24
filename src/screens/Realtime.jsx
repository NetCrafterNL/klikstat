import { useState, useEffect, useRef } from 'react'
import './Realtime.css'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { activePages as SEED_PAGES, liveEvents as SEED_EVENTS, realtimeBars as SEED_BARS } from '../data/seed'

const DEMO_RT = {
  onlineNow: 24,
  histogram: SEED_BARS.map((count, i) => ({ bucket: SEED_BARS.length - 1 - i, count })),
  activePages: SEED_PAGES.map(p => ({ pathname: p.path, count: p.count })),
  liveEvents: SEED_EVENTS.map((e, i) => ({
    country: e.country, pathname: e.page,
    referrer: e.source === 'Google' ? 'https://google.com' : '',
    ts: Math.floor(Date.now() / 1000) - i * 14,
  })),
}

function buildHistogram(rawBuckets) {
  // rawBuckets = [{bucket: 0..29, count}] — bucket 0 = most recent minute
  const arr = new Array(30).fill(0)
  if (rawBuckets) {
    rawBuckets.forEach(b => {
      const idx = Math.min(29, Math.max(0, Number(b.bucket)))
      arr[29 - idx] = Number(b.count) // reverse: index 0 = oldest
    })
  }
  return arr
}

function formatTime(ts) {
  if (!ts) return ''
  const secs = Math.floor(Date.now() / 1000) - ts
  if (secs < 5)  return 'just now'
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
}

function classifyReferrer(ref) {
  if (!ref) return 'direct'
  try {
    const host = new URL(ref).hostname.replace('www.', '')
    const SEARCH = ['google', 'bing', 'duckduckgo', 'yahoo', 'baidu', 'ecosia', 'yandex']
    const SOCIAL  = ['facebook', 'twitter', 'x.com', 'linkedin', 'reddit', 'instagram', 'tiktok', 'youtube']
    if (SEARCH.some(s => host.includes(s))) return `from ${host.split('.')[0].replace(/^./, c => c.toUpperCase())}`
    if (SOCIAL.some(s => host.includes(s))) return `from ${host.split('.')[0].replace(/^./, c => c.toUpperCase())}`
    return `from ${host}`
  } catch { return 'direct' }
}

export default function Realtime({ siteId, onOnlineCount }) {
  const tickRef = useRef(0)
  const [, forceUpdate] = useState(0)

  // Convex useQuery is reactive — auto-polls via Convex's WebSocket
  const rtQuery = useQuery(api.stats.getRealtime, siteId ? { siteId } : 'skip')

  const rt = siteId ? (rtQuery ? {
    onlineNow: rtQuery.online,
    histogram: [],
    activePages: [],
    liveEvents: rtQuery.sessions.map(s => ({
      country: s.country,
      pathname: s.entryUrl ?? '/',
      referrer: s.referrer ?? '',
      ts: Math.floor((s.lastSeenAt ?? s.startedAt) / 1000),
    })),
  } : null) : DEMO_RT

  useEffect(() => {
    if (!siteId) onOnlineCount?.(DEMO_RT.onlineNow)
  }, [siteId])

  useEffect(() => {
    if (rt) onOnlineCount?.(Number(rt.onlineNow ?? 0))
  }, [rt])

  // Force re-render every second to keep "X ago" fresh
  useEffect(() => {
    const id = setInterval(() => { tickRef.current++; forceUpdate(n => n + 1) }, 1000)
    return () => clearInterval(id)
  }, [])

  const histogram  = buildHistogram(rt?.histogram)
  const maxBar     = Math.max(...histogram, 1)
  const activePages = rt?.activePages ?? []
  const liveEvents  = rt?.liveEvents  ?? []

  return (
    <>
      <div className="realtime-title-row">
        <h1 className="realtime-title">Realtime</h1>
        <span className="live-badge">
          <span className="live-dot"><span className="live-dot-inner" /><span className="live-dot-ring" /></span>
          Live
        </span>
      </div>

      <div className="realtime-grid">
        <div className="rt-card">
          <div className="rt-card-label">Visitors right now</div>
          <div className="rt-big-num">{rt ? Number(rt.onlineNow ?? 0) : '—'}</div>
          <div className="rt-histogram">
            {histogram.map((v, i) => {
              const isLast = i === histogram.length - 1
              const isSecondLast = i === histogram.length - 2
              return (
                <div key={i} className={`rt-bar${isLast ? ' accent' : isSecondLast ? ' accent-light' : ''}`}
                  style={{ height: `${(v / maxBar) * 100}%` }}
                />
              )
            })}
          </div>
          <div className="rt-histogram-label">pageviews per minute · last 30 min</div>
        </div>

        <div className="rt-card">
          <div className="rt-card-label">Active pages</div>
          {activePages.length === 0
            ? <div style={{ color: 'var(--c-text-muted3)', fontSize: 13, marginTop: 8 }}>No active visitors.</div>
            : (
              <div className="active-pages-list">
                {activePages.map(p => (
                  <div key={p.pathname} className="active-page-row">
                    <span className="active-page-path">{p.pathname}</span>
                    <span className="active-page-count">{p.count}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      <div className="feed-card">
        <div className="feed-title">Live event feed</div>
        {liveEvents.length === 0
          ? <div style={{ color: 'var(--c-text-muted3)', fontSize: 13, padding: '12px 0' }}>No events yet — embed the snippet to start seeing live data.</div>
          : liveEvents.map((e, i) => (
              <div key={i} className="feed-row">
                <span className="feed-dot" />
                <span className="feed-country">{e.country ?? 'XX'}</span>
                <span className="feed-text">
                  viewed <strong>{e.pathname}</strong> {classifyReferrer(e.referrer)}
                </span>
                <span className="feed-time">{formatTime(e.ts)}</span>
              </div>
            ))
        }
      </div>
    </>
  )
}
