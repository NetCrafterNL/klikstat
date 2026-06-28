import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { UAParser } from 'ua-parser-js'

const app = express()
const PORT = 3001

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://api-klikstat.forkbyte.nl'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json())

// ── Helpers ──────────────────────────────────────────────────────────────────

function sinceTs(days) {
  return new Date(Date.now() - days * 86400000).toISOString()
}

function classifyChannel(referrer) {
  if (!referrer) return 'Direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (/google|bing|duckduckgo|yahoo|baidu|yandex/.test(host)) return 'Search'
    if (/facebook|twitter|instagram|linkedin|tiktok|reddit|pinterest|youtube/.test(host)) return 'Social'
    if (referrer.includes('utm_medium=email') || referrer.includes('email')) return 'Email'
    return 'Referral'
  } catch {
    return 'Direct'
  }
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item)
    ;(acc[k] = acc[k] || []).push(item)
    return acc
  }, {})
}

function topN(obj, n = 10) {
  return Object.entries(obj)
    .map(([name, items]) => ({ name, count: items.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

async function buildStats(siteId, days) {
  const since = sinceTs(days)

  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase.from('sessions').select('*').eq('site_id', siteId).gte('started_at', since),
    supabase.from('events').select('*').eq('site_id', siteId).gte('timestamp', since),
  ])

  const pvEvents = (events || []).filter(e => e.name === 'pageview')
  const visitors = (sessions || []).length
  const pageviews = pvEvents.length
  const bouncedCount = (sessions || []).filter(s => s.bounced).length
  const bounceRate = visitors > 0 ? (bouncedCount / visitors) * 100 : 0
  const totalDuration = (sessions || []).reduce((sum, s) => sum + (s.duration || 0), 0)
  const avgDuration = visitors > 0 ? totalDuration / visitors : 0
  const goals = (events || []).filter(e => e.name !== 'pageview').length

  // daily chart
  const byDay = groupBy(sessions || [], s => (s.started_at || '').slice(0, 10))
  const chart = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10)
    return { day: d, v: (byDay[d] || []).length }
  })

  const topPages = topN(groupBy(pvEvents, e => e.url || '/'), 10).map(p => ({ pathname: p.name, count: p.count }))
  const locations = topN(groupBy(sessions || [], s => s.country || 'XX'), 10).map(l => ({ country: l.name, count: l.count }))
  const channels = topN(groupBy(sessions || [], s => classifyChannel(s.referrer)), 5)

  return { visitors, pageviews, bounceRate, avgDuration, goals, chart, topPages, locations, channels }
}

// ── POST /collect ─────────────────────────────────────────────────────────────

app.options('/collect', (req, res) => res.status(204).end())

app.post('/collect', async (req, res) => {
  const {
    token,
    type = 'pageview',
    pathname,
    referrer = '',
    utm_source = '',
    utm_medium = '',
    utm_campaign = '',
    revenue,
    ...extraProps
  } = req.body || {}

  if (!token || !pathname) return res.status(400).end()

  const { data: site } = await supabase.from('sites').select('*').eq('token', token).single()
  if (!site) return res.status(404).end()

  const ip =
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'

  const ua = req.headers['user-agent'] || ''
  const today = new Date().toISOString().slice(0, 10)

  const sessionId = createHash('sha256')
    .update(`${ip}|${ua}|${today}|${token}`)
    .digest('hex')
    .slice(0, 32)

  const parser = new UAParser(ua)
  const browser = parser.getBrowser().name || 'Unknown'
  const os = parser.getOS().name || 'Unknown'
  const rawDev = parser.getDevice().type
  const device = rawDev === 'mobile' ? 'Mobile' : rawDev === 'tablet' ? 'Tablet' : 'Desktop'

  let country = req.headers['cf-ipcountry'] || 'XX'
  let city = req.headers['cf-ipcity'] || null

  if (country === 'XX' && ip !== '127.0.0.1') {
    try {
      const geo = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,city`, {
        signal: AbortSignal.timeout(800),
      }).then(r => r.json())
      if (geo?.countryCode) country = geo.countryCode
      if (geo?.city) city = geo.city
    } catch {}
  }

  const now = new Date().toISOString()
  const parsedRevenue =
    type !== 'pageview' && revenue != null && !isNaN(Number(revenue)) ? Number(revenue) : null
  const props = Object.keys(extraProps).length > 0 ? extraProps : null

  // Upsert session
  const { data: existing } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (!existing) {
    await supabase.from('sessions').insert({
      site_id: site.id,
      session_id: sessionId,
      entry_url: pathname,
      referrer: referrer || null,
      country,
      city,
      browser,
      os,
      device,
      pageviews: 1,
      bounced: true,
      started_at: now,
      last_seen_at: now,
    })
  } else {
    const duration = Math.floor((Date.now() - new Date(existing.started_at).getTime()) / 1000)
    await supabase.from('sessions').update({
      pageviews: (existing.pageviews || 1) + 1,
      bounced: false,
      duration,
      last_seen_at: now,
    }).eq('id', existing.id)
  }

  // Insert event
  await supabase.from('events').insert({
    site_id: site.id,
    session_id: sessionId,
    name: type,
    url: pathname,
    referrer: referrer || null,
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    country,
    city,
    browser,
    os,
    device,
    revenue: parsedRevenue,
    props,
    timestamp: now,
    created_at: now,
  })

  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }).status(204).end()
})

// ── GET /public/:token ────────────────────────────────────────────────────────

app.get('/public/:token', async (req, res) => {
  const { token } = req.params
  const days = Math.max(1, Math.min(365, Number(req.query.days || 30)))

  const { data: site } = await supabase.from('sites').select('*').eq('public_token', token).single()
  if (!site) return res.status(404).json({ error: 'not found' })
  if (!site.is_public) return res.status(403).json({ error: 'this dashboard is not public' })

  const stats = await buildStats(site.id, days)
  res.json({ site: { name: site.name, domain: site.domain }, stats, range: days })
})

// ── GET /v1/stats ─────────────────────────────────────────────────────────────

app.options('/v1/stats', (req, res) => res.status(204).end())

app.get('/v1/stats', async (req, res) => {
  const auth = req.headers['authorization'] || ''
  const raw = auth.replace(/^Bearer\s+/i, '').trim()
  if (!raw) return res.status(401).json({ error: 'missing API key' })

  const keyHash = createHash('sha256').update(raw).digest('hex')
  const { data: keyRow } = await supabase.from('api_keys').select('*').eq('key_hash', keyHash).single()
  if (!keyRow) return res.status(401).json({ error: 'invalid API key' })

  const { data: keyedSite } = await supabase.from('sites').select('*').eq('id', keyRow.site_id).single()
  if (!keyedSite) return res.status(403).json({ error: 'access denied' })

  const days = Math.min(365, Math.max(1, Number(req.query.days || 30)))
  const stats = await buildStats(keyedSite.id, days)
  res.json({ site: { name: keyedSite.name, domain: keyedSite.domain }, days, stats })
})

// ── GET /api/stats/:siteId ────────────────────────────────────────────────────

app.get('/api/stats/:siteId', async (req, res) => {
  const { siteId } = req.params
  const range = req.query.range || '30d'
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const since = sinceTs(days)

  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase.from('sessions').select('*').eq('site_id', siteId).gte('started_at', since),
    supabase.from('events').select('*').eq('site_id', siteId).gte('timestamp', since),
  ])

  const pvEvents = (events || []).filter(e => e.name === 'pageview')
  const visitors = (sessions || []).length
  const pageviews = pvEvents.length
  const bouncedCount = (sessions || []).filter(s => s.bounced).length
  const bounceRate = visitors > 0 ? (bouncedCount / visitors) * 100 : 0
  const totalDuration = (sessions || []).reduce((sum, s) => sum + (s.duration || 0), 0)
  const avgDuration = visitors > 0 ? totalDuration / visitors : 0
  const goals = (events || []).filter(e => e.name !== 'pageview').length

  // chart
  const byDay = groupBy(sessions || [], s => (s.started_at || '').slice(0, 10))
  const chart = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10)
    return { day: d, v: (byDay[d] || []).length }
  })

  const topPages = topN(groupBy(pvEvents, e => e.url || '/'), 10).map(p => ({ pathname: p.name, count: p.count }))
  const locations = topN(groupBy(sessions || [], s => s.country || 'XX'), 10).map(l => ({ country: l.name, count: l.count }))
  const channels = topN(groupBy(sessions || [], s => classifyChannel(s.referrer)), 5)

  // top sources
  const topSources = Object.entries(groupBy(sessions || [], s => {
    if (!s.referrer) return 'Direct'
    try { return new URL(s.referrer).hostname.replace(/^www\./, '') } catch { return s.referrer }
  })).map(([referrer, items]) => ({ referrer, count: items.length }))
    .sort((a, b) => b.count - a.count).slice(0, 20)

  // tech
  const topDevices = topN(groupBy(sessions || [], s => s.device || 'Unknown'), 5)
  const topBrowsers = topN(groupBy(sessions || [], s => s.browser || 'Unknown'), 10)

  // cities
  const cities = Object.entries(groupBy((sessions || []).filter(s => s.city), s => s.city))
    .map(([city, items]) => ({ city, country: items[0].country, count: items.length }))
    .sort((a, b) => b.count - a.count).slice(0, 20)

  res.json({
    visitors, pageviews, bounceRate, avgDuration, goals,
    chart, topPages, locations, channels,
    topSources, topDevices, topBrowsers, cities
  })
})

// ── GET /api/comparison/:siteId ───────────────────────────────────────────────

app.get('/api/comparison/:siteId', async (req, res) => {
  const { siteId } = req.params
  const range = req.query.range || '30d'
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const end = new Date(Date.now() - days * 86400000).toISOString()
  const start = new Date(Date.now() - days * 2 * 86400000).toISOString()

  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase.from('sessions').select('*').eq('site_id', siteId).gte('started_at', start).lt('started_at', end),
    supabase.from('events').select('*').eq('site_id', siteId).gte('timestamp', start).lt('timestamp', end),
  ])

  const visitors = (sessions || []).length
  const pageviews = (events || []).filter(e => e.name === 'pageview').length
  const bouncedCount = (sessions || []).filter(s => s.bounced).length
  const bounceRate = visitors > 0 ? (bouncedCount / visitors) * 100 : 0
  const totalDuration = (sessions || []).reduce((sum, s) => sum + (s.duration || 0), 0)
  const avgDuration = visitors > 0 ? totalDuration / visitors : 0
  const goals = (events || []).filter(e => e.name !== 'pageview').length

  res.json({ visitors, pageviews, bounceRate, avgDuration, goals })
})

// ── GET /api/pages/:siteId ────────────────────────────────────────────────────

app.get('/api/pages/:siteId', async (req, res) => {
  const { siteId } = req.params
  const range = req.query.range || '30d'
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const since = sinceTs(days)

  const [{ data: events }, { data: sessions }] = await Promise.all([
    supabase.from('events').select('*').eq('site_id', siteId).gte('timestamp', since),
    supabase.from('sessions').select('*').eq('site_id', siteId).gte('started_at', since),
  ])

  const pvEvents = (events || []).filter(e => e.name === 'pageview')
  const topPages = topN(groupBy(pvEvents, e => e.url || '/'), 50).map(p => ({ pathname: p.name, count: p.count }))
  const entryPages = topN(groupBy((sessions || []).filter(s => s.entry_url), s => s.entry_url), 20)
    .map(r => ({ pathname: r.name, count: r.count }))

  res.json({ topPages, entryPages })
})

// ── GET /api/sources/:siteId ──────────────────────────────────────────────────

app.get('/api/sources/:siteId', async (req, res) => {
  const { siteId } = req.params
  const range = req.query.range || '30d'
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const since = sinceTs(days)

  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase.from('sessions').select('*').eq('site_id', siteId).gte('started_at', since),
    supabase.from('events').select('*').eq('site_id', siteId).gte('timestamp', since),
  ])

  const sources = Object.entries(groupBy(sessions || [], s => {
    if (!s.referrer) return 'Direct'
    try { return new URL(s.referrer).hostname.replace(/^www\./, '') } catch { return s.referrer }
  })).map(([referrer, items]) => ({ referrer, count: items.length }))
    .sort((a, b) => b.count - a.count).slice(0, 50)

  const utmEvents = (events || []).filter(e => e.utm_source || e.utm_medium || e.utm_campaign)
  const campaigns = Object.entries(groupBy(utmEvents, e => `${e.utm_source || ''}|${e.utm_medium || ''}|${e.utm_campaign || ''}`))
    .map(([key, items]) => {
      const [source, medium, campaign] = key.split('|')
      return { source, medium, campaign, count: items.length }
    }).sort((a, b) => b.count - a.count).slice(0, 20)

  res.json({ sources, campaigns })
})

// ── GET /api/technology/:siteId ───────────────────────────────────────────────

app.get('/api/technology/:siteId', async (req, res) => {
  const { siteId } = req.params
  const range = req.query.range || '30d'
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const since = sinceTs(days)

  const { data: sessions } = await supabase.from('sessions').select('*').eq('site_id', siteId).gte('started_at', since)

  res.json({
    devices: topN(groupBy(sessions || [], s => s.device || 'Unknown'), 5),
    browsers: topN(groupBy(sessions || [], s => s.browser || 'Unknown'), 10),
    os: topN(groupBy(sessions || [], s => s.os || 'Unknown'), 10),
  })
})

// ── GET /api/realtime/:siteId ─────────────────────────────────────────────────

app.get('/api/realtime/:siteId', async (req, res) => {
  const { siteId } = req.params
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: sessions } = await supabase
    .from('sessions').select('*').eq('site_id', siteId).gte('last_seen_at', since)

  res.json({
    online: (sessions || []).length,
    sessions: (sessions || []).slice(0, 20),
  })
})

// ── GET /api/retention/:siteId ────────────────────────────────────────────────

app.get('/api/retention/:siteId', async (req, res) => {
  const { siteId } = req.params
  const range = req.query.range || '30d'
  const weeks = range === '7d' ? 4 : range === '90d' ? 12 : range === '365d' ? 20 : 8
  const since = sinceTs(weeks * 7)

  const { data: sessions } = await supabase.from('sessions').select('*').eq('site_id', siteId).gte('started_at', since)

  const sinceMs = new Date(since).getTime()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000

  const weekOf = ts => Math.floor((new Date(ts).getTime() - sinceMs) / msPerWeek)

  const cohorts = {}
  for (const s of (sessions || [])) {
    const w = weekOf(s.started_at)
    if (w < 0 || w >= weeks) continue
    const userId = (s.session_id || '').slice(0, 8)
    if (!cohorts[w]) cohorts[w] = new Set()
    cohorts[w].add(userId)
  }

  const rows = Array.from({ length: weeks }, (_, cohortWeek) => {
    const cohortUsers = cohorts[cohortWeek] || new Set()
    const size = cohortUsers.size
    if (size === 0) return null

    const retention = Array.from({ length: weeks - cohortWeek }, (_, offset) => {
      const targetWeek = cohortWeek + offset
      const targetSessions = (sessions || []).filter(s =>
        weekOf(s.started_at) === targetWeek && cohortUsers.has((s.session_id || '').slice(0, 8))
      )
      return { week: offset, retained: targetSessions.length, pct: (targetSessions.length / size) * 100 }
    })

    return { cohortWeek, size, retention }
  }).filter(Boolean)

  res.json(rows)
})

// ── GET /api/goals/:siteId ────────────────────────────────────────────────────

app.get('/api/goals/:siteId', async (req, res) => {
  const { siteId } = req.params
  const { data: goals } = await supabase.from('goals').select('*').eq('site_id', siteId)
  res.json(goals || [])
})

app.post('/api/goals/:siteId', async (req, res) => {
  const { siteId } = req.params
  const { name, type, value } = req.body || {}
  const { data, error } = await supabase.from('goals').insert({ site_id: siteId, name, type, value }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

app.delete('/api/goals/:goalId', async (req, res) => {
  const { goalId } = req.params
  await supabase.from('goals').delete().eq('id', goalId)
  res.json({ ok: true })
})

// ── GET /api/goals-data/:siteId ───────────────────────────────────────────────

app.get('/api/goals-data/:siteId', async (req, res) => {
  const { siteId } = req.params
  const range = req.query.range || '30d'
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const since = sinceTs(days)

  const [{ data: goals }, { data: events }] = await Promise.all([
    supabase.from('goals').select('*').eq('site_id', siteId),
    supabase.from('events').select('*').eq('site_id', siteId).gte('timestamp', since).neq('name', 'pageview'),
  ])

  const result = (goals || []).map(goal => {
    const matching = (events || []).filter(e => goal.value ? e.name === goal.value : false)
    const revenue = matching.reduce((sum, e) => sum + (e.revenue || 0), 0)
    return { id: goal.id, name: goal.name, event: goal.value, completions: matching.length, revenue }
  })

  const revenueEvents = (events || []).filter(e => e.revenue != null && e.revenue > 0)
  const totalRevenue = revenueEvents.reduce((sum, e) => sum + e.revenue, 0)

  res.json({ goals: result, revenue: { total: totalRevenue, count: revenueEvents.length } })
})

// ── Funnels ───────────────────────────────────────────────────────────────────

app.get('/api/funnels/:siteId', async (req, res) => {
  const { siteId } = req.params
  const { data: funnels } = await supabase.from('funnels').select('*').eq('site_id', siteId)
  res.json(funnels || [])
})

app.post('/api/funnels/:siteId', async (req, res) => {
  const { siteId } = req.params
  const { name, steps } = req.body || {}
  const { data, error } = await supabase.from('funnels').insert({ site_id: siteId, name, steps }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

app.patch('/api/funnels/:funnelId', async (req, res) => {
  const { funnelId } = req.params
  const { name, steps } = req.body || {}
  const updates = {}
  if (name !== undefined) updates.name = name
  if (steps !== undefined) updates.steps = steps
  const { data, error } = await supabase.from('funnels').update(updates).eq('id', funnelId).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

app.delete('/api/funnels/:funnelId', async (req, res) => {
  const { funnelId } = req.params
  await supabase.from('funnels').delete().eq('id', funnelId)
  res.json({ ok: true })
})

// ── GET /api/funnel-data/:siteId ──────────────────────────────────────────────

app.post('/api/funnel-data/:siteId', async (req, res) => {
  const { siteId } = req.params
  const { steps = [], range = '30d' } = req.body || {}
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const since = sinceTs(days)

  if (steps.length === 0) return res.json([])

  const { data: events } = await supabase.from('events').select('url,name')
    .eq('site_id', siteId).gte('timestamp', since).eq('name', 'pageview')

  const result = steps.map(step => {
    const count = (events || []).filter(e => e.url === step || (e.url || '').startsWith(step)).length
    return { step, count }
  })

  res.json(result)
})

// ── Annotations ───────────────────────────────────────────────────────────────

app.get('/api/annotations/:siteId', async (req, res) => {
  const { siteId } = req.params
  const range = req.query.range || '30d'
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

  const { data } = await supabase.from('annotations').select('*').eq('site_id', siteId).gte('date', since)
  res.json(data || [])
})

app.post('/api/annotations/:siteId', async (req, res) => {
  const { siteId } = req.params
  const { date, label, color } = req.body || {}
  const { data, error } = await supabase.from('annotations').insert({ site_id: siteId, date, label }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

app.delete('/api/annotations/:annotationId', async (req, res) => {
  const { annotationId } = req.params
  await supabase.from('annotations').delete().eq('id', annotationId)
  res.json({ ok: true })
})

// ── Sites ─────────────────────────────────────────────────────────────────────

app.get('/api/sites', async (req, res) => {
  const userId = req.query.user_id
  if (!userId) return res.status(400).json({ error: 'user_id required' })
  const { data } = await supabase.from('sites').select('*').eq('user_id', userId)
  res.json(data || [])
})

app.post('/api/sites', async (req, res) => {
  const { user_id, domain, name } = req.body || {}
  if (!user_id || !domain) return res.status(400).json({ error: 'user_id and domain required' })

  const { nanoid } = await import('nanoid')
  const token = nanoid(32)
  const public_token = nanoid(32)

  const { data, error } = await supabase.from('sites').insert({
    user_id,
    domain,
    name: name || domain,
    token,
    public_token,
    is_public: false,
  }).select().single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

app.patch('/api/sites/:siteId', async (req, res) => {
  const { siteId } = req.params
  const { name, is_public } = req.body || {}
  const updates = {}
  if (name !== undefined) updates.name = name
  if (is_public !== undefined) updates.is_public = is_public

  const { data, error } = await supabase.from('sites').update(updates).eq('id', siteId).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

app.delete('/api/sites/:siteId', async (req, res) => {
  const { siteId } = req.params
  await supabase.from('sites').delete().eq('id', siteId)
  res.json({ ok: true })
})

// ── Aggregate stats for Overview ──────────────────────────────────────────────

app.get('/api/aggregate', async (req, res) => {
  const userId = req.query.user_id
  const range = req.query.range || '30d'
  if (!userId) return res.status(400).json({ error: 'user_id required' })

  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  const since = sinceTs(days)

  const { data: sites } = await supabase.from('sites').select('*').eq('user_id', userId)
  if (!sites?.length) return res.json([])

  const results = await Promise.all(sites.map(async site => {
    const [{ data: sessions }, { data: events }] = await Promise.all([
      supabase.from('sessions').select('id').eq('site_id', site.id).gte('started_at', since),
      supabase.from('events').select('id,name').eq('site_id', site.id).gte('timestamp', since),
    ])
    return {
      siteId: site.id,
      name: site.name || site.domain,
      domain: site.domain,
      visitors: (sessions || []).length,
      pageviews: (events || []).filter(e => e.name === 'pageview').length,
    }
  }))

  res.json(results.sort((a, b) => b.visitors - a.visitors))
})

// ── API Keys ──────────────────────────────────────────────────────────────────

app.get('/api/api-keys', async (req, res) => {
  const siteId = req.query.site_id
  if (!siteId) return res.status(400).json({ error: 'site_id required' })
  const { data } = await supabase.from('api_keys').select('id,name,created_at').eq('site_id', siteId)
  res.json(data || [])
})

app.post('/api/api-keys', async (req, res) => {
  const { site_id, name, key_hash } = req.body || {}
  const { data, error } = await supabase.from('api_keys').insert({ site_id, name, key_hash }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

app.delete('/api/api-keys/:keyId', async (req, res) => {
  await supabase.from('api_keys').delete().eq('id', req.params.keyId)
  res.json({ ok: true })
})

// ── AI endpoints (proxy to Anthropic) ────────────────────────────────────────

app.post('/ai/setup', async (req, res) => {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'URL is required.' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI not configured.' })

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

  let html = ''
  try {
    const r = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Klikstat/1.0 (analytics setup bot)' },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    html = await r.text()
  } catch {
    return res.status(400).json({ error: 'Could not fetch that URL.' })
  }

  let domain = ''
  try { domain = new URL(normalizedUrl).hostname.replace(/^www\./, '') } catch {}

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000)

  const prompt = `Analyze this website and return a JSON object to configure analytics tracking.

Return ONLY this JSON, no other text:
{
  "siteName": "Brand or product name (2-4 words max)",
  "siteType": "ecommerce|saas|blog|portfolio|landing|marketplace|news|other",
  "description": "One sentence describing what this site does.",
  "goals": [{ "name": "Goal display name", "event": "event-slug" }],
  "funnels": [{ "name": "Funnel name", "steps": ["/path1", "/path2"] }]
}

Rules: Include 2-4 goals, 1-2 funnels with minimum 2 steps, event slugs must be lowercase-with-dashes.

Website URL: ${normalizedUrl}
Page content: ${text}`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  })

  const claudeData = await claudeRes.json()
  if (!claudeRes.ok) return res.status(500).json({ error: 'AI analysis failed.' })

  const jsonText = claudeData.content?.[0]?.text
  if (!jsonText) return res.status(500).json({ error: 'AI could not analyze this site.' })

  const match = jsonText.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(match ? match[0] : jsonText)
  res.json({ ...parsed, domain })
})

app.listen(PORT, () => {
  console.log(`Klikstat API server running on port ${PORT}`)
})
