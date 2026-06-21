import { createClient } from '@supabase/supabase-js'

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

  const { site_id, days = 30 } = req.body ?? {}
  if (!site_id) return res.status(400).json({ error: 'site_id required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI not configured.' })

  const [
    { data: stats },
    { data: topPages },
    { data: channels },
    { data: goals },
  ] = await Promise.all([
    supabase.rpc('get_dashboard_stats', { p_site_id: site_id, p_days: days }),
    supabase.rpc('get_top_pages',       { p_site_id: site_id, p_days: days }),
    supabase.rpc('get_channels',        { p_site_id: site_id, p_days: days }),
    supabase.rpc('get_goals_data',      { p_site_id: site_id, p_days: days }),
  ])

  const summary = {
    period: `last ${days} days`,
    visitors:        stats?.visitors     ?? 0,
    pageviews:       stats?.pageviews    ?? 0,
    bounceRate:      stats?.bounce_rate  ?? 0,
    avgDuration:     stats?.avg_duration ?? 0,
    topPages:       (topPages ?? []).slice(0, 5).map(p => ({ path: p.pathname, views: p.count })),
    channels:       (channels ?? []).slice(0, 5),
    goalCompletions: (goals ?? []).reduce((s, g) => s + Number(g.completions ?? 0), 0),
  }

  const prompt = `You are an analytics expert reviewing a website's traffic data. Write exactly 3 short, specific, actionable insights based on the data below. Be direct and helpful — like a smart analyst talking to a business owner. Each insight should be 1-2 sentences.

Analytics data (${summary.period}):
- Visitors: ${summary.visitors.toLocaleString()}
- Pageviews: ${summary.pageviews.toLocaleString()}
- Bounce rate: ${summary.bounceRate}%
- Avg visit duration: ${Math.round(summary.avgDuration)}s
- Goal completions: ${summary.goalCompletions}
- Top pages: ${summary.topPages.map(p => `${p.path} (${p.views} views)`).join(', ')}
- Traffic sources: ${summary.channels.map(c => `${c.name}: ${c.count}`).join(', ')}

Return ONLY a JSON array of exactly 3 insight strings:
["insight 1", "insight 2", "insight 3"]`

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const claudeData = await claudeRes.json()
    if (!claudeRes.ok) {
      console.error('Claude API error:', claudeData)
      return res.status(500).json({ error: 'Could not generate insights.' })
    }

    const jsonText = claudeData.content?.[0]?.text
    if (!jsonText) return res.status(500).json({ error: 'Could not generate insights.' })

    const jsonMatch = jsonText.match(/\[[\s\S]*\]/)
    const insights = JSON.parse(jsonMatch ? jsonMatch[0] : jsonText)
    return res.status(200).json({ insights })
  } catch (e) {
    console.error('AI insights error:', e)
    return res.status(500).json({ error: 'Could not generate insights.' })
  }
}
