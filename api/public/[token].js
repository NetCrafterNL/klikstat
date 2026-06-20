import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()

  const { token } = req.query
  const days = Number(req.query.days) || 30

  if (!token) return res.status(400).json({ error: 'missing token' })

  // Verify the site exists and is public
  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('id, name, domain, is_public')
    .eq('public_token', token)
    .single()

  if (siteErr || !site) return res.status(404).json({ error: 'not found' })
  if (!site.is_public)  return res.status(403).json({ error: 'this dashboard is not public' })

  const { data: stats } = await supabase.rpc('get_site_stats_public', {
    p_site_id: site.id,
    p_days:    days,
  })

  return res.status(200).json({
    site: { name: site.name, domain: site.domain },
    stats,
    range: days,
  })
}
