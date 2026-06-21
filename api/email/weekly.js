import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function formatNum(n) { return Number(n || 0).toLocaleString('en-US') }
function formatPct(n) { return `${Number(n || 0).toFixed(1)}%` }

function buildEmailHtml({ siteName, domain, stats, prevStats, days }) {
  const pct = (cur, prev) => {
    if (!prev || Number(prev) === 0) return ''
    const p = ((Number(cur) - Number(prev)) / Number(prev)) * 100
    if (Math.abs(p) < 0.5) return ''
    return p > 0
      ? `<span style="color:#167C43;font-size:12px;margin-left:6px">▲ ${p.toFixed(1)}%</span>`
      : `<span style="color:#DC2626;font-size:12px;margin-left:6px">▼ ${Math.abs(p).toFixed(1)}%</span>`
  }

  const rows = [
    { label: 'Visitors',    cur: stats?.visitors,    prev: prevStats?.visitors },
    { label: 'Pageviews',   cur: stats?.pageviews,   prev: prevStats?.pageviews },
    { label: 'Bounce rate', cur: `${Number(stats?.bounceRate||0).toFixed(0)}%`, prev: null },
    { label: 'Goal events', cur: stats?.goals,        prev: prevStats?.goals },
  ]

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F3FB;font-family:system-ui,sans-serif">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#5B4BE8,#4536C4);padding:28px 32px">
    <div style="font-size:20px;font-weight:800;color:white;letter-spacing:-.02em">klikstat</div>
    <div style="color:rgba(255,255,255,.75);font-size:14px;margin-top:4px">${siteName} · ${domain}</div>
    <div style="font-size:42px;font-weight:800;color:white;margin:16px 0 4px;letter-spacing:-.03em">${formatNum(stats?.visitors)}</div>
    <div style="color:rgba(255,255,255,.65);font-size:13px">unique visitors · last ${days} days ${pct(stats?.visitors, prevStats?.visitors)}</div>
  </div>
  <div style="padding:24px 32px">
    <table style="width:100%;border-collapse:collapse">
      ${rows.map(r => `
      <tr style="border-bottom:1px solid #EAE8F4">
        <td style="padding:12px 0;font-size:14px;color:#6B6A75;font-weight:600">${r.label}</td>
        <td style="padding:12px 0;font-size:14px;font-weight:700;color:#1C1B22;text-align:right">
          ${typeof r.cur === 'number' ? formatNum(r.cur) : (r.cur || '—')}
          ${r.prev ? pct(r.cur, r.prev) : ''}
        </td>
      </tr>`).join('')}
    </table>
    ${stats?.topPages?.length ? `
    <div style="margin-top:20px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9A98A6;margin-bottom:12px">Top pages</div>
      ${stats.topPages.slice(0,5).map(p => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F4F3FB">
        <span style="font-size:13px;color:#26252E;font-weight:600">${p.pathname}</span>
        <span style="font-size:13px;font-weight:700;color:#8A8893">${formatNum(p.count)}</span>
      </div>`).join('')}
    </div>` : ''}
  </div>
  <div style="padding:16px 32px 24px;text-align:center;color:#9A98A6;font-size:12px">
    <a href="${process.env.VITE_APP_URL || 'https://klikstat.vercel.app'}" style="color:#5B4BE8;text-decoration:none;font-weight:700">Open dashboard</a>
    &nbsp;·&nbsp; Powered by Klikstat
  </div>
</div>
</body></html>`
}

export default async function handler(req, res) {
  // Only allow cron calls (secured by Vercel cron secret) or internal
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).end()
  }

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

  const now  = new Date()
  const freq = req.query.frequency || 'weekly'
  const days = freq === 'daily' ? 1 : freq === 'monthly' ? 30 : 7

  // Find subscriptions due for sending
  let query = supabase
    .from('email_subscriptions')
    .select('*, sites(id,name,domain)')
    .eq('enabled', true)
    .eq('frequency', freq)

  const cutoff = new Date(now)
  if (freq === 'daily')   cutoff.setDate(cutoff.getDate() - 1)
  if (freq === 'weekly')  cutoff.setDate(cutoff.getDate() - 7)
  if (freq === 'monthly') cutoff.setDate(cutoff.getDate() - 30)

  const { data: subs } = await query.or(`last_sent.is.null,last_sent.lt.${cutoff.toISOString()}`)
  if (!subs?.length) return res.status(200).json({ sent: 0 })

  let sent = 0
  for (const sub of subs) {
    try {
      const site = sub.sites
      if (!site) continue

      const [{ data: stats }, { data: prevStats }] = await Promise.all([
        supabase.rpc('get_site_stats',       { p_site_id: site.id, p_days: days }),
        supabase.rpc('get_comparison_stats', { p_site_id: site.id, p_days: days }),
      ])

      const html = buildEmailHtml({ siteName: site.name, domain: site.domain, stats, prevStats, days })

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Klikstat <reports@klikstat.com>',
          to:   [sub.email],
          subject: `${site.name} — ${freq === 'daily' ? 'Daily' : freq === 'monthly' ? 'Monthly' : 'Weekly'} report`,
          html,
        }),
      })

      await supabase.from('email_subscriptions')
        .update({ last_sent: now.toISOString() })
        .eq('id', sub.id)
      sent++
    } catch (e) {
      console.error('email send error:', e)
    }
  }

  return res.status(200).json({ sent })
}
