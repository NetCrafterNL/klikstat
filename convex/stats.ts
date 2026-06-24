import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

function sinceMs(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function classifyChannel(referrer: string | undefined): string {
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (/google|bing|duckduckgo|yahoo|baidu|yandex/.test(host)) return "Search";
    if (/facebook|twitter|instagram|linkedin|tiktok|reddit|pinterest|youtube/.test(host)) return "Social";
    if (referrer.includes("utm_medium=email") || referrer.includes("email")) return "Email";
    return "Referral";
  } catch {
    return "Direct";
  }
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

function topN<T>(obj: Record<string, T[]>, n = 10): { name: string; count: number }[] {
  return Object.entries(obj)
    .map(([name, items]) => ({ name, count: items.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

async function getSessions(ctx: any, siteId: Id<"sites">, since: number) {
  return ctx.db
    .query("sessions")
    .withIndex("by_site_time", (q: any) => q.eq("siteId", siteId).gte("startedAt", since))
    .collect();
}

async function getEvents(ctx: any, siteId: Id<"sites">, since: number) {
  return ctx.db
    .query("events")
    .withIndex("by_site_time", (q: any) => q.eq("siteId", siteId).gte("timestamp", since))
    .collect();
}

// ── getSiteStats ────────────────────────────────────────────────────────────
// Replaces: get_site_stats, get_dashboard_stats, get_top_pages, get_channels
export const getSiteStats = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const since = sinceMs(days);
    const [sessions, events] = await Promise.all([
      getSessions(ctx, siteId, since),
      getEvents(ctx, siteId, since),
    ]);

    const pageviews = events.filter((e: any) => e.name === "pageview").length;
    const visitors = sessions.length;
    const bouncedCount = sessions.filter((s: any) => s.bounced).length;
    const bounceRate = visitors > 0 ? (bouncedCount / visitors) * 100 : 0;
    const totalDuration = sessions.reduce((sum: number, s: any) => sum + (s.duration ?? 0), 0);
    const avgDuration = visitors > 0 ? totalDuration / visitors : 0;
    const goals = events.filter((e: any) => e.name !== "pageview").length;

    // Daily chart: visitors per day
    const byDay = groupBy(sessions, (s) => new Date(s.startedAt).toISOString().slice(0, 10));
    const chart = Array.from({ length: days }, (_, i) => {
      const d = new Date(since + i * 86400000).toISOString().slice(0, 10);
      return { day: d, v: (byDay[d] ?? []).length };
    });

    // Top pages
    const pvEvents = events.filter((e: any) => e.name === "pageview");
    const topPages = topN(groupBy(pvEvents, (e) => e.url ?? "/"), 10).map((p) => ({
      pathname: p.name,
      count: p.count,
    }));

    // Locations
    const locations = topN(groupBy(sessions, (s) => s.country ?? "XX"), 10).map((l) => ({
      country: l.name,
      count: l.count,
    }));

    // Channels
    const channels = topN(
      groupBy(sessions, (s) => classifyChannel(s.referrer)),
      5,
    );

    return { visitors, pageviews, bounceRate, avgDuration, goals, chart, topPages, locations, channels };
  },
});

// Replaces: get_comparison_stats (previous period)
export const getComparisonStats = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const end = sinceMs(days);
    const start = end - days * 24 * 60 * 60 * 1000;

    const [sessions, events] = await Promise.all([
      ctx.db
        .query("sessions")
        .withIndex("by_site_time", (q: any) => q.eq("siteId", siteId).gte("startedAt", start).lt("startedAt", end))
        .collect(),
      ctx.db
        .query("events")
        .withIndex("by_site_time", (q: any) => q.eq("siteId", siteId).gte("timestamp", start).lt("timestamp", end))
        .collect(),
    ]);

    const visitors = sessions.length;
    const pageviews = events.filter((e: any) => e.name === "pageview").length;
    const bouncedCount = sessions.filter((s: any) => s.bounced).length;
    const bounceRate = visitors > 0 ? (bouncedCount / visitors) * 100 : 0;
    const totalDuration = sessions.reduce((sum: number, s: any) => sum + (s.duration ?? 0), 0);
    const avgDuration = visitors > 0 ? totalDuration / visitors : 0;
    const goals = events.filter((e: any) => e.name !== "pageview").length;

    return { visitors, pageviews, bounceRate, avgDuration, goals };
  },
});

// Replaces: get_city_breakdown
export const getCityBreakdown = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const sessions = await getSessions(ctx, siteId, sinceMs(days));
    return topN(
      groupBy(sessions.filter((s: any) => s.city), (s) => s.city!),
      20,
    ).map((r) => ({ city: r.name, count: r.count }));
  },
});

// Replaces: get_aggregate_stats (all sites for this user)
export const getAggregateStats = query({
  args: { days: v.number() },
  handler: async (ctx, { days }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const sites = await ctx.db
      .query("sites")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .collect();

    const since = sinceMs(days);
    const results = await Promise.all(
      sites.map(async (site: any) => {
        const [sessions, events] = await Promise.all([
          getSessions(ctx, site._id, since),
          getEvents(ctx, site._id, since),
        ]);
        return {
          siteId: site._id,
          name: site.name ?? site.domain,
          domain: site.domain,
          visitors: sessions.length,
          pageviews: events.filter((e: any) => e.name === "pageview").length,
        };
      }),
    );

    return results.sort((a, b) => b.visitors - a.visitors);
  },
});

// Replaces: get_pages
export const getPages = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const events = await getEvents(ctx, siteId, sinceMs(days));
    const pvEvents = events.filter((e: any) => e.name === "pageview");
    return topN(groupBy(pvEvents, (e) => e.url ?? "/"), 50).map((r) => ({
      pathname: r.name,
      count: r.count,
    }));
  },
});

// Replaces: get_entry_exit_pages
export const getEntryExitPages = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const sessions = await getSessions(ctx, siteId, sinceMs(days));
    const entries = topN(
      groupBy(sessions.filter((s: any) => s.entryUrl), (s) => s.entryUrl!),
      20,
    ).map((r) => ({ pathname: r.name, count: r.count }));
    return { entries };
  },
});

// Replaces: get_sources
export const getSources = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const sessions = await getSessions(ctx, siteId, sinceMs(days));
    const byRef = groupBy(sessions, (s) => {
      if (!s.referrer) return "Direct";
      try {
        return new URL(s.referrer).hostname.replace(/^www\./, "");
      } catch {
        return s.referrer;
      }
    });
    return Object.entries(byRef)
      .map(([name, items]) => ({ referrer: name, count: items.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  },
});

// Replaces: get_campaigns
export const getCampaigns = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const events = await getEvents(ctx, siteId, sinceMs(days));
    const utmEvents = events.filter(
      (e: any) => e.utmSource || e.utmMedium || e.utmCampaign,
    );

    const byCampaign = groupBy(
      utmEvents,
      (e) => `${e.utmSource ?? ""}|${e.utmMedium ?? ""}|${e.utmCampaign ?? ""}`,
    );

    return Object.entries(byCampaign)
      .map(([key, items]) => {
        const [source, medium, campaign] = key.split("|");
        return { source, medium, campaign, count: items.length };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  },
});

// Replaces: get_technology
export const getTechnology = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const sessions = await getSessions(ctx, siteId, sinceMs(days));
    return {
      devices: topN(groupBy(sessions, (s) => s.device ?? "Unknown"), 5),
      browsers: topN(groupBy(sessions, (s) => s.browser ?? "Unknown"), 10),
      os: topN(groupBy(sessions, (s) => s.os ?? "Unknown"), 10),
    };
  },
});

// Replaces: get_realtime
export const getRealtime = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const since = Date.now() - 5 * 60 * 1000; // last 5 minutes
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_site_time", (q: any) => q.eq("siteId", siteId).gte("startedAt", since))
      .collect();

    // Also check sessions that had activity recently (lastSeenAt)
    const allRecent = sessions.filter(
      (s: any) => (s.lastSeenAt ?? s.startedAt) >= since,
    );

    return { online: allRecent.length, sessions: allRecent.slice(0, 20) };
  },
});

// Replaces: get_retention (weekly cohorts)
export const getRetention = query({
  args: { siteId: v.id("sites"), weeks: v.number() },
  handler: async (ctx, { siteId, weeks }) => {
    const since = sinceMs(weeks * 7);
    const sessions = await getSessions(ctx, siteId, since);

    // Group sessions by week number
    const weekOf = (ts: number) => {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      return Math.floor((ts - since) / msPerWeek);
    };

    // Build cohort: users who first visited in week N, retained in week N+x
    // Since we don't have persistent user IDs, we approximate with sessionId prefix
    const cohorts: Record<number, Record<number, Set<string>>> = {};
    for (const s of sessions) {
      const w = weekOf(s.startedAt);
      if (w < 0 || w >= weeks) continue;
      // Use first 8 chars of sessionId as pseudo-user
      const userId = s.sessionId.slice(0, 8);
      (cohorts[w] ??= {})[w] ??= new Set();
      (cohorts[w][w] ??= new Set()).add(userId);
    }

    const rows = Array.from({ length: weeks }, (_, cohortWeek) => {
      const cohortUsers = cohorts[cohortWeek]?.[cohortWeek] ?? new Set();
      const size = cohortUsers.size;
      if (size === 0) return null;

      const retention = Array.from({ length: weeks - cohortWeek }, (_, offset) => {
        const targetWeek = cohortWeek + offset;
        const targetSessions = sessions.filter(
          (s: any) => weekOf(s.startedAt) === targetWeek && cohortUsers.has(s.sessionId.slice(0, 8)),
        );
        return { week: offset, retained: targetSessions.length, pct: (targetSessions.length / size) * 100 };
      });

      return { cohortWeek, size, retention };
    }).filter(Boolean);

    return rows;
  },
});

// Replaces: get_goals_data
export const getGoalsData = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const since = sinceMs(days);
    const [goals, events] = await Promise.all([
      ctx.db.query("goals").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).collect(),
      getEvents(ctx, siteId, since),
    ]);

    return goals.map((goal: any) => {
      const matchingEvents = events.filter(
        (e: any) => e.name !== "pageview" && (goal.value ? e.name === goal.value : false),
      );
      const revenue = matchingEvents.reduce((sum: number, e: any) => sum + (e.revenue ?? 0), 0);
      return {
        id: goal._id,
        name: goal.name,
        completions: matchingEvents.length,
        revenue,
      };
    });
  },
});

// Replaces: get_revenue_stats
export const getRevenueStats = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const events = await getEvents(ctx, siteId, sinceMs(days));
    const revenueEvents = events.filter((e: any) => e.revenue != null && e.revenue > 0);
    const total = revenueEvents.reduce((sum: number, e: any) => sum + e.revenue, 0);
    return { total, count: revenueEvents.length };
  },
});

// Replaces: get_funnel_data
export const getFunnelData = query({
  args: { siteId: v.id("sites"), days: v.number(), steps: v.array(v.string()) },
  handler: async (ctx, { siteId, days, steps }) => {
    if (steps.length === 0) return [];
    const events = await getEvents(ctx, siteId, sinceMs(days));
    const pvEvents = events.filter((e: any) => e.name === "pageview");

    return steps.map((step) => {
      const count = pvEvents.filter((e: any) => e.url === step || e.url?.startsWith(step)).length;
      return { step, count };
    });
  },
});

// For public dashboard (no auth)
export const getSiteStatsInternal = internalQuery({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const since = sinceMs(days);
    const [sessions, events] = await Promise.all([
      getSessions(ctx, siteId, since),
      getEvents(ctx, siteId, since),
    ]);

    const pageviews = events.filter((e: any) => e.name === "pageview").length;
    const visitors = sessions.length;
    const bouncedCount = sessions.filter((s: any) => s.bounced).length;
    const bounceRate = visitors > 0 ? (bouncedCount / visitors) * 100 : 0;
    const totalDuration = sessions.reduce((sum: number, s: any) => sum + (s.duration ?? 0), 0);
    const avgDuration = visitors > 0 ? totalDuration / visitors : 0;

    const pvEvents = events.filter((e: any) => e.name === "pageview");
    const topPages = topN(groupBy(pvEvents, (e) => e.url ?? "/"), 5).map((p) => ({
      pathname: p.name,
      count: p.count,
    }));
    const locations = topN(groupBy(sessions, (s) => s.country ?? "XX"), 10).map((l) => ({
      country: l.name,
      count: l.count,
    }));
    const channels = topN(groupBy(sessions, (s) => classifyChannel(s.referrer)), 5);

    return { visitors, pageviews, bounceRate, avgDuration, topPages, locations, channels };
  },
});

// For v1/stats API endpoint (by API key)
export const getSiteStatsByKey = internalQuery({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const since = sinceMs(days);
    const [sessions, events] = await Promise.all([
      getSessions(ctx, siteId, since),
      getEvents(ctx, siteId, since),
    ]);
    const pageviews = events.filter((e: any) => e.name === "pageview").length;
    const visitors = sessions.length;
    return { visitors, pageviews };
  },
});

// For AI insights (same as getSiteStats but internal)
export const getSiteStatsForAI = internalQuery({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const since = sinceMs(days);
    const [sessions, events] = await Promise.all([
      getSessions(ctx, siteId, since),
      getEvents(ctx, siteId, since),
    ]);

    const pageviews = events.filter((e: any) => e.name === "pageview").length;
    const visitors = sessions.length;
    const bouncedCount = sessions.filter((s: any) => s.bounced).length;
    const bounceRate = visitors > 0 ? (bouncedCount / visitors) * 100 : 0;
    const totalDuration = sessions.reduce((sum: number, s: any) => sum + (s.duration ?? 0), 0);
    const avgDuration = visitors > 0 ? totalDuration / visitors : 0;
    const goals = events.filter((e: any) => e.name !== "pageview").length;

    const pvEvents = events.filter((e: any) => e.name === "pageview");
    const topPages = topN(groupBy(pvEvents, (e) => e.url ?? "/"), 5).map((p) => ({
      path: p.name,
      views: p.count,
    }));
    const channels = topN(groupBy(sessions, (s) => classifyChannel(s.referrer)), 5);

    return { visitors, pageviews, bounceRate, avgDuration, goals, topPages, channels };
  },
});

// For alerts/check cron
export const getSiteStatsForAlert = internalQuery({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const sessions = await getSessions(ctx, siteId, sinceMs(days));
    return { visitors: sessions.length };
  },
});
