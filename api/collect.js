import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import geoip from 'geoip-lite'
import { UAParser } from 'ua-parser-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const {
      token, type = 'pageview', pathname, referrer = '', width,
      utm_source = '', utm_medium = '', utm_campaign = '',
      revenue, depth, url, host,
      ...extraProps
    } = req.body ?? {}

    if (!token || !pathname) return res.status(400).json({ error: 'missing token or pathname' })

    const { data: site, error: siteErr } = await supabase
      .from('sites').select('id').eq('token', token).single()
    if (siteErr || !site) return res.status(404).end()

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || '127.0.0.1'
    const ua    = req.headers['user-agent'] || ''
    const today = new Date().toISOString().slice(0, 10)

    const sessionId = createHash('sha256')
      .update(`${ip}|${ua}|${today}|${token}`)
      .digest('hex').slice(0, 32)

    const geo     = geoip.lookup(ip)
    const country = geo?.country ?? 'XX'
    const city    = geo?.city    ?? null
    const parser  = new UAParser(ua)
    const browser = parser.getBrowser().name ?? 'Unknown'
    const os      = parser.getOS().name      ?? 'Unknown'
    const rawDev  = parser.getDevice().type
    const device  = rawDev === 'mobile' ? 'Mobile' : rawDev === 'tablet' ? 'Tablet' : 'Desktop'
    const now     = new Date().toISOString()

    // Build event props JSONB
    const builtProps = {}
    if (depth != null) builtProps.depth = depth
    if (url   != null) builtProps.url   = url
    if (host  != null) builtProps.host  = host
    Object.assign(builtProps, extraProps)
    const props = Object.keys(builtProps).length > 0 ? builtProps : null

    // Revenue only stored for custom events
    const parsedRevenue = (type !== 'pageview' && revenue != null && !isNaN(Number(revenue)))
      ? Number(revenue) : null

    // Upsert session
    const { data: existing } = await supabase
      .from('sessions').select('pageviews, timestamp').eq('id', sessionId).maybeSingle()

    if (!existing) {
      await supabase.from('sessions').insert({
        id: sessionId, site_id: site.id, country, city, browser, os, device,
        referrer: referrer || null, entry_page: pathname,
        timestamp: now, last_seen: now,
      })
    } else {
      const duration = Math.floor((Date.now() - new Date(existing.timestamp).getTime()) / 1000)
      await supabase.from('sessions').update({
        pageviews: existing.pageviews + 1, bounced: false, duration, last_seen: now,
      }).eq('id', sessionId)
    }

    await supabase.from('events').insert({
      site_id: site.id, session_id: sessionId,
      type, pathname, referrer: referrer || null,
      country, city, browser, os, device, timestamp: now,
      utm_source:   utm_source   || null,
      utm_medium:   utm_medium   || null,
      utm_campaign: utm_campaign || null,
      revenue: parsedRevenue,
      props,
    })

    return res.status(204).end()
  } catch (err) {
    console.error('collect error:', err)
    return res.status(500).end()
  }
}

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } }
