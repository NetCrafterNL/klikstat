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
    const { token, type = 'pageview', pathname, referrer = '', width } = req.body ?? {}
    if (!token || !pathname) return res.status(400).json({ error: 'missing token or pathname' })

    // Resolve site from token
    const { data: site, error: siteErr } = await supabase
      .from('sites').select('id').eq('token', token).single()
    if (siteErr || !site) return res.status(404).end()

    // IP — respect proxy headers
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress
      || '127.0.0.1'

    const ua  = req.headers['user-agent'] || ''
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC

    // Privacy-first session ID: changes every UTC day, no cookies needed
    const sessionId = createHash('sha256')
      .update(`${ip}|${ua}|${today}|${token}`)
      .digest('hex')
      .slice(0, 32)

    // Geo + UA parsing
    const geo     = geoip.lookup(ip)
    const country = geo?.country ?? 'XX'
    const parser  = new UAParser(ua)
    const browser = parser.getBrowser().name ?? 'Unknown'
    const os      = parser.getOS().name      ?? 'Unknown'
    const rawDevice = parser.getDevice().type
    const device  = rawDevice === 'mobile' ? 'Mobile' : rawDevice === 'tablet' ? 'Tablet' : 'Desktop'

    const now = new Date().toISOString()

    // Upsert session
    const { data: existing } = await supabase
      .from('sessions').select('pageviews, timestamp').eq('id', sessionId).maybeSingle()

    if (!existing) {
      await supabase.from('sessions').insert({
        id: sessionId, site_id: site.id, country, browser, os, device,
        referrer: referrer || null, entry_page: pathname,
        timestamp: now, last_seen: now,
      })
    } else {
      const duration = Math.floor(
        (Date.now() - new Date(existing.timestamp).getTime()) / 1000
      )
      await supabase.from('sessions').update({
        pageviews: existing.pageviews + 1,
        bounced:   false,
        duration,
        last_seen: now,
      }).eq('id', sessionId)
    }

    // Insert event
    await supabase.from('events').insert({
      site_id: site.id, session_id: sessionId,
      type, pathname, referrer: referrer || null,
      country, browser, os, device, timestamp: now,
    })

    return res.status(204).end()
  } catch (err) {
    console.error('collect error:', err)
    return res.status(500).end()
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '2kb' } },
}
