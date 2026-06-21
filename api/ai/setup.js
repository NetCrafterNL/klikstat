export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { url } = req.body ?? {}
  if (!url) return res.status(400).json({ error: 'URL is required.' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI not configured. Add ANTHROPIC_API_KEY to your environment variables.' })

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

  let html = ''
  try {
    const r = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Klikstat/1.0 (analytics setup bot)' },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    html = await r.text()
  } catch (e) {
    return res.status(400).json({ error: 'Could not fetch that URL. Make sure it is publicly accessible.' })
  }

  let domain = ''
  try {
    domain = new URL(normalizedUrl).hostname.replace(/^www\./, '')
  } catch {}

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
  "goals": [
    { "name": "Goal display name", "event": "event-slug" }
  ],
  "funnels": [
    { "name": "Funnel name", "steps": ["/path1", "/path2"] }
  ]
}

Rules:
- Include 2-4 goals relevant to the site type
- Include 1-2 funnels with realistic page paths (minimum 2 steps each)
- Event slugs must be lowercase-with-dashes only, no spaces
- Ecommerce → goals: Purchase, Add to Cart; funnel: /product → /cart → /checkout
- SaaS → goals: Signup, Trial Start, Upgrade; funnel: / → /pricing → /signup
- Blog → goals: Newsletter Signup, Share Article; funnel: / → /post → /newsletter
- Use actual paths you see in the page content when possible

Website URL: ${normalizedUrl}
Page content: ${text}`

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const claudeData = await claudeRes.json()
    if (!claudeRes.ok) {
      console.error('Claude API error:', claudeData)
      return res.status(500).json({ error: 'AI analysis failed. Please try again.' })
    }

    const jsonText = claudeData.content?.[0]?.text
    if (!jsonText) return res.status(500).json({ error: 'AI could not analyze this site.' })

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : jsonText)
    return res.status(200).json({ ...parsed, domain })
  } catch (e) {
    console.error('AI setup error:', e)
    return res.status(500).json({ error: 'AI analysis failed. Please try again.' })
  }
}
