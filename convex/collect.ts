import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const upsertSession = internalMutation({
  args: {
    siteId: v.id("sites"),
    sessionId: v.string(),
    entryUrl: v.optional(v.string()),
    referrer: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    device: v.optional(v.string()),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, { siteId, sessionId, now, ...geo }) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
      .unique();

    if (!existing) {
      await ctx.db.insert("sessions", {
        siteId,
        sessionId,
        ...geo,
        pageviews: 1,
        bounced: true,
        startedAt: now,
        lastSeenAt: now,
      });
    } else {
      const duration = Math.floor((now - existing.startedAt) / 1000);
      await ctx.db.patch(existing._id, {
        pageviews: (existing.pageviews ?? 1) + 1,
        bounced: false,
        duration,
        lastSeenAt: now,
      });
    }
  },
});

export const insertEvent = internalMutation({
  args: {
    siteId: v.id("sites"),
    sessionId: v.string(),
    name: v.string(),
    url: v.optional(v.string()),
    referrer: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    device: v.optional(v.string()),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    revenue: v.optional(v.number()),
    props: v.optional(v.any()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", args);
  },
});
