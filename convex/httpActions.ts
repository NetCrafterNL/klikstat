"use node";

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createHash } from "crypto";
import { UAParser } from "ua-parser-js";

export function cors(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

export const collectOptions = httpAction(async () =>
  new Response(null, { status: 204, headers: cors() })
);

export const collectPost = httpAction(async (ctx, request) => {
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const {
    token,
    type = "pageview",
    pathname,
    referrer = "",
    utm_source = "",
    utm_medium = "",
    utm_campaign = "",
    revenue,
    ...extraProps
  } = body ?? {};

  if (!token || !pathname) return new Response(null, { status: 400 });

  const site = await ctx.runQuery(internal.sites.getByToken, { token });
  if (!site) return new Response(null, { status: 404 });

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "127.0.0.1";
  const ua = request.headers.get("user-agent") ?? "";
  const today = new Date().toISOString().slice(0, 10);

  const sessionId = createHash("sha256")
    .update(`${ip}|${ua}|${today}|${token}`)
    .digest("hex")
    .slice(0, 32);

  const parser = new UAParser(ua);
  const browser = parser.getBrowser().name ?? "Unknown";
  const os = parser.getOS().name ?? "Unknown";
  const rawDev = parser.getDevice().type;
  const device = rawDev === "mobile" ? "Mobile" : rawDev === "tablet" ? "Tablet" : "Desktop";

  let country = request.headers.get("cf-ipcountry") ?? "XX";
  let city: string | undefined = request.headers.get("cf-ipcity") ?? undefined;

  if (country === "XX" && ip !== "127.0.0.1") {
    try {
      const geo = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,city`, {
        signal: AbortSignal.timeout(800),
      }).then((r) => r.json());
      if (geo?.countryCode) country = geo.countryCode;
      if (geo?.city) city = geo.city;
    } catch {}
  }

  const now = Date.now();
  const parsedRevenue =
    type !== "pageview" && revenue != null && !isNaN(Number(revenue))
      ? Number(revenue)
      : undefined;

  const props = Object.keys(extraProps).length > 0 ? extraProps : undefined;

  await ctx.runMutation(internal.collect.upsertSession, {
    siteId: site._id,
    sessionId,
    entryUrl: pathname,
    referrer: referrer || undefined,
    country,
    city,
    browser,
    os,
    device,
    now,
  });

  await ctx.runMutation(internal.collect.insertEvent, {
    siteId: site._id,
    sessionId,
    name: type,
    url: pathname,
    referrer: referrer || undefined,
    utmSource: utm_source || undefined,
    utmMedium: utm_medium || undefined,
    utmCampaign: utm_campaign || undefined,
    country,
    city,
    browser,
    os,
    device,
    revenue: parsedRevenue,
    props,
    timestamp: now,
  });

  return new Response(null, { status: 204, headers: cors() });
});

export const publicGet = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const publicToken = url.pathname.replace("/public/", "");
  const days = Number(url.searchParams.get("days") ?? "30");

  const site = await ctx.runQuery(internal.sites.getByPublicToken, { publicToken });
  if (!site) return json({ error: "not found" }, 404);
  if (!site.isPublic) return json({ error: "this dashboard is not public" }, 403);

  const stats = await ctx.runQuery(internal.stats.getSiteStatsInternal, {
    siteId: site._id,
    days,
  });

  return json({ site: { name: site.name, domain: site.domain }, stats, range: days });
});

export const v1StatsOptions = httpAction(async () =>
  new Response(null, { status: 204, headers: cors() })
);

export const v1StatsGet = httpAction(async (ctx, request) => {
  const auth = request.headers.get("authorization") ?? "";
  const raw = auth.replace(/^Bearer\s+/i, "").trim();
  if (!raw) return json({ error: "missing API key" }, 401);

  const keyHash = createHash("sha256").update(raw).digest("hex");
  const keyRow = await ctx.runQuery(internal.apiKeys.getByHash, { keyHash });
  if (!keyRow) return json({ error: "invalid API key" }, 401);

  await ctx.runMutation(internal.apiKeys.updateLastUsed, { keyId: keyRow._id });

  const url = new URL(request.url);
  const siteId = (url.searchParams.get("site_id") as any) ?? keyRow.siteId;
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? "30")));

  if (!siteId) return json({ error: "site_id required" }, 400);

  const site = await ctx.runQuery(internal.sites.internalGetById, { siteId });
  if (!site || site.userId !== keyRow.userId) return json({ error: "access denied" }, 403);

  const stats = await ctx.runQuery(internal.stats.getSiteStatsByKey, { siteId, days });
  return json({ site: { name: site.name, domain: site.domain }, days, stats });
});

export const aiInsightsOptions = httpAction(async () =>
  new Response(null, { status: 204, headers: cors() })
);

export const aiInsightsPost = httpAction(async (ctx, request) => {
  const { site_id, days = 30 } = (await request.json()) ?? {};
  if (!site_id) return json({ error: "site_id required" }, 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "AI not configured." }, 500);

  const summary = await ctx.runQuery(internal.stats.getSiteStatsForAI, {
    siteId: site_id,
    days,
  });

  const prompt = `You are an analytics expert reviewing a website's traffic data. Write exactly 3 short, specific, actionable insights based on the data below. Be direct and helpful — like a smart analyst talking to a business owner. Each insight should be 1-2 sentences.

Analytics data (last ${days} days):
- Visitors: ${summary.visitors.toLocaleString()}
- Pageviews: ${summary.pageviews.toLocaleString()}
- Bounce rate: ${summary.bounceRate}%
- Avg visit duration: ${Math.round(summary.avgDuration)}s
- Goal completions: ${summary.goals}
- Top pages: ${summary.topPages.map((p: any) => `${p.path} (${p.views} views)`).join(", ")}
- Traffic sources: ${summary.channels.map((c: any) => `${c.name}: ${c.count}`).join(", ")}

Return ONLY a JSON array of exactly 3 insight strings:
["insight 1", "insight 2", "insight 3"]`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const claudeData = await claudeRes.json();
  if (!claudeRes.ok) return json({ error: "Could not generate insights." }, 500);

  const jsonText = claudeData.content?.[0]?.text;
  if (!jsonText) return json({ error: "Could not generate insights." }, 500);

  const match = jsonText.match(/\[[\s\S]*\]/);
  const insights = JSON.parse(match ? match[0] : jsonText);
  return json({ insights });
});

export const aiSetupOptions = httpAction(async () =>
  new Response(null, { status: 204, headers: cors() })
);

export const aiSetupPost = httpAction(async (_ctx, request) => {
  const { url } = (await request.json()) ?? {};
  if (!url) return json({ error: "URL is required." }, 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "AI not configured." }, 500);

  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  let html = "";
  try {
    const r = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Klikstat/1.0 (analytics setup bot)" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    html = await r.text();
  } catch {
    return json({ error: "Could not fetch that URL. Make sure it is publicly accessible." }, 400);
  }

  let domain = "";
  try {
    domain = new URL(normalizedUrl).hostname.replace(/^www\./, "");
  } catch {}

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

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

Website URL: ${normalizedUrl}
Page content: ${text}`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const claudeData = await claudeRes.json();
  if (!claudeRes.ok) return json({ error: "AI analysis failed. Please try again." }, 500);

  const jsonText = claudeData.content?.[0]?.text;
  if (!jsonText) return json({ error: "AI could not analyze this site." }, 500);

  const match = jsonText.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : jsonText);
  return json({ ...parsed, domain });
});

export const alertsCheck = httpAction(async (ctx, request) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response(null, { status: 401 });
  }
  await ctx.runAction(internal.jobs.checkAlerts, {});
  return json({ ok: true });
});

export const emailWeekly = httpAction(async (ctx, request) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response(null, { status: 401 });
  }
  const freq = new URL(request.url).searchParams.get("frequency") ?? "weekly";
  await ctx.runAction(internal.jobs.sendEmails, { frequency: freq });
  return json({ ok: true });
});
