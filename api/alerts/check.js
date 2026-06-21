import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).end()
  }

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

  const { data: alerts } = await supabase
    .from('alert_subscriptions')
    .select('*, sites(id,name,domain)')
    .eq('enabled', true)

  if (!alerts?.length) return res.status(200).json({ checked: 0 })

  let fired = 0
  for (const alert of alerts) {
    try {
      const site = alert.sites
      if (!site) continue

      // Get today's visitors vs 7-day average
      const [{ data: today }, { data: week }] = await Promise.all([
        supabase.rpc('get_site_stats', { p_site_id: site.id, p_days: 1 }),
        supabase.rpc('get_site_stats', { p_site_id: site.id, p_days: 7 }),
      ])

      const todayV   = Number(today?.visitors || 0)
      const avgDaily = Number(week?.visitors  || 0) / 7

      if (avgDaily < 10) continue // not enough data

      const changePct = ((todayV - avgDaily) / avgDaily) * 100
      const isSpike   = changePct >= alert.spike_pct
      const isDrop    = changePct <= -alert.drop_pct

      if (!isSpike && !isDrop) continue

      // Don't re-alert within 24h
      if (alert.last_alerted) {
        const lastH = (Date.now() - new Date(alert.last_alerted).getTime()) / 3600000
        if (lastH < 22) continue
      }

      const type    = isSpike ? 'spike' : 'drop'
      const subject = isSpike
        ? `Traffic spike on ${site.name} (+${changePct.toFixed(0)}%)`
        : `Traffic drop on ${site.name} (${changePct.toFixed(0)}%)`
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:32px auto">
          <div style="font-size:18px;font-weight:800;margin-bottom:8px">${subject}</div>
          <p style="color:#6B6A75;font-size:14px;line-height:1.6">
            <strong>${site.name}</strong> (${site.domain}) had
            <strong>${todayV.toLocaleString()} visitors today</strong>,
            compared to a daily average of <strong>${avgDaily.toFixed(0)}</strong> over the past week.
            That's a <strong>${Math.abs(changePct).toFixed(0)}% ${type}</strong>.
          </p>
          <a href="${process.env.VITE_APP_URL || 'https://klikstat.vercel.app'}"
             style="display:inline-block;margin-top:16px;padding:10px 20px;background:#5B4BE8;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            View dashboard
          </a>
        </div>`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Klikstat <alerts@klikstat.com>',
          to: [alert.email], subject, html,
        }),
      })

      await supabase.from('alert_subscriptions')
        .update({ last_alerted: new Date().toISOString() })
        .eq('id', alert.id)
      fired++
    } catch (e) {
      console.error('alert check error:', e)
    }
  }

  return res.status(200).json({ checked: alerts.length, fired })
}
