"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const checkAlerts = internalAction({
  args: {},
  handler: async (ctx) => {
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return;

    const alerts = await ctx.runQuery(internal.subscriptions.listAllAlerts, {});

    for (const alert of alerts) {
      try {
        const site = await ctx.runQuery(internal.sites.internalGetById, { siteId: alert.siteId });
        if (!site) continue;

        const [today, week] = await Promise.all([
          ctx.runQuery(internal.stats.getSiteStatsForAlert, { siteId: alert.siteId, days: 1 }),
          ctx.runQuery(internal.stats.getSiteStatsForAlert, { siteId: alert.siteId, days: 7 }),
        ]);

        const todayV = today.visitors;
        const avgDaily = week.visitors / 7;
        if (avgDaily < 10) continue;

        const changePct = ((todayV - avgDaily) / avgDaily) * 100;
        const isSpike = changePct >= (alert.spikePct ?? 50);
        const isDrop = changePct <= -(alert.dropPct ?? 50);
        if (!isSpike && !isDrop) continue;

        if (alert.lastAlertedAt) {
          const lastH = (Date.now() - alert.lastAlertedAt) / 3600000;
          if (lastH < 22) continue;
        }

        const type = isSpike ? "spike" : "drop";
        const subject = isSpike
          ? `Traffic spike on ${site.name} (+${changePct.toFixed(0)}%)`
          : `Traffic drop on ${site.name} (${changePct.toFixed(0)}%)`;

        const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:32px auto">
          <div style="font-size:18px;font-weight:800;margin-bottom:8px">${subject}</div>
          <p style="color:#6B6A75;font-size:14px;line-height:1.6">
            <strong>${site.name}</strong> (${site.domain}) had
            <strong>${todayV.toLocaleString()} visitors today</strong>,
            compared to a daily average of <strong>${avgDaily.toFixed(0)}</strong> over the past week.
            That's a <strong>${Math.abs(changePct).toFixed(0)}% ${type}</strong>.
          </p>
        </div>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Klikstat <alerts@klikstat.com>",
            to: [alert.email],
            subject,
            html,
          }),
        });

        await ctx.runMutation(internal.subscriptions.updateAlertLastAlerted, { alertId: alert._id });
      } catch (e) {
        console.error("alert check error:", e);
      }
    }
  },
});

export const sendEmails = internalAction({
  args: { frequency: v.string() },
  handler: async (ctx, { frequency }) => {
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return;

    const days = frequency === "daily" ? 1 : frequency === "monthly" ? 30 : 7;
    const subs = await ctx.runQuery(internal.subscriptions.listAllEmailSubs, { frequency });

    for (const sub of subs) {
      try {
        if (sub.lastSentAt) {
          const elapsed = Date.now() - sub.lastSentAt;
          if (elapsed < days * 86400000 * 0.9) continue;
        }

        const site = await ctx.runQuery(internal.sites.internalGetById, { siteId: sub.siteId });
        if (!site) continue;

        const [stats, prevStats] = await Promise.all([
          ctx.runQuery(internal.stats.getSiteStatsInternal, { siteId: sub.siteId, days }),
          ctx.runQuery(internal.stats.getSiteStatsForAlert, { siteId: sub.siteId, days }),
        ]);

        const fmt = (n: number) => Number(n || 0).toLocaleString("en-US");
        const pct = (cur: number, prev: number) => {
          if (!prev) return "";
          const p = ((cur - prev) / prev) * 100;
          if (Math.abs(p) < 0.5) return "";
          return p > 0
            ? `<span style="color:#167C43;font-size:12px;margin-left:6px">▲ ${p.toFixed(1)}%</span>`
            : `<span style="color:#DC2626;font-size:12px;margin-left:6px">▼ ${Math.abs(p).toFixed(1)}%</span>`;
        };

        const siteName = site.name ?? site.domain;
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F3FB;font-family:system-ui,sans-serif">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#5B4BE8,#4536C4);padding:28px 32px">
    <div style="font-size:20px;font-weight:800;color:white">klikstat</div>
    <div style="color:rgba(255,255,255,.75);font-size:14px;margin-top:4px">${siteName} · ${site.domain}</div>
    <div style="font-size:42px;font-weight:800;color:white;margin:16px 0 4px">${fmt(stats.visitors)}</div>
    <div style="color:rgba(255,255,255,.65);font-size:13px">unique visitors · last ${days} days ${pct(stats.visitors, prevStats.visitors)}</div>
  </div>
  <div style="padding:24px 32px">
    <table style="width:100%;border-collapse:collapse">
      <tr style="border-bottom:1px solid #EAE8F4">
        <td style="padding:12px 0;font-size:14px;color:#6B6A75;font-weight:600">Pageviews</td>
        <td style="padding:12px 0;font-size:14px;font-weight:700;color:#1C1B22;text-align:right">${fmt(stats.pageviews)}</td>
      </tr>
      <tr style="border-bottom:1px solid #EAE8F4">
        <td style="padding:12px 0;font-size:14px;color:#6B6A75;font-weight:600">Bounce rate</td>
        <td style="padding:12px 0;font-size:14px;font-weight:700;color:#1C1B22;text-align:right">${Number(stats.bounceRate ?? 0).toFixed(0)}%</td>
      </tr>
    </table>
    ${stats.topPages?.length ? `<div style="margin-top:20px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9A98A6;margin-bottom:12px">Top pages</div>
      ${stats.topPages.slice(0, 5).map((p: any) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F4F3FB">
        <span style="font-size:13px;color:#26252E;font-weight:600">${p.pathname}</span>
        <span style="font-size:13px;font-weight:700;color:#8A8893">${fmt(p.count)}</span>
      </div>`).join("")}
    </div>` : ""}
  </div>
  <div style="padding:16px 32px 24px;text-align:center;color:#9A98A6;font-size:12px">Powered by Klikstat</div>
</div></body></html>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Klikstat <reports@klikstat.com>",
            to: [sub.email],
            subject: `${siteName} — ${frequency === "daily" ? "Daily" : frequency === "monthly" ? "Monthly" : "Weekly"} report`,
            html,
          }),
        });

        await ctx.runMutation(internal.subscriptions.updateEmailLastSent, { subId: sub._id });
      } catch (e) {
        console.error("email send error:", e);
      }
    }
  },
});
