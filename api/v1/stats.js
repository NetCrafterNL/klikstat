import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const auth = req.headers['authorization'] || ''
  const raw  = auth.replace(/^Bearer\s+/i, '').trim()
  if (!raw) return res.status(401).json({ error: 'missing API key' })

  const keyHash = createHash('sha256').update(raw).digest('hex')

  const { data: keyRow } = await supabase
    .from('api_keys')
    .select('id, site_id, user_id')
    .eq('key_hash', keyHash)
    .single()

  if (!keyRow) return res.status(401).json({ error: 'invalid API key' })

  // Update last_used
  await supabase.from('api_keys').update({ last_used: new Date().toISOString() }).eq('id', keyRow.id)

  const siteId = req.query.site_id || keyRow.site_id
  const days   = Math.min(365, Math.max(1, Number(req.query.days) || 30))

  if (!siteId) return res.status(400).json({ error: 'site_id required' })

  // Verify this user owns the site
  const { data: site } = await supabase
    .from('sites').select('id, name, domain').eq('id', siteId).eq('user_id', keyRow.user_id).single()
  if (!site) return res.status(403).json({ error: 'access denied' })

  const { data: stats } = await supabase.rpc('get_site_stats', { p_site_id: siteId, p_days: days })

  return res.status(200).json({ site, days, stats })
}
