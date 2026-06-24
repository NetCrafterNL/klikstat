import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

// ── Alert subscriptions ──────────────────────────────────────────────────────

export const listAlerts = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db
      .query("alertSubscriptions")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
  },
});

export const createAlert = mutation({
  args: {
    siteId: v.id("sites"),
    email: v.string(),
    spikePct: v.optional(v.number()),
    dropPct: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return ctx.db.insert("alertSubscriptions", { ...args, enabled: true });
  },
});

export const removeAlert = mutation({
  args: { alertId: v.id("alertSubscriptions") },
  handler: async (ctx, { alertId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await ctx.db.delete(alertId);
  },
});

export const listAllAlerts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("alertSubscriptions")
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect();
  },
});

export const updateAlertLastAlerted = internalMutation({
  args: { alertId: v.id("alertSubscriptions") },
  handler: async (ctx, { alertId }) => {
    await ctx.db.patch(alertId, { lastAlertedAt: Date.now() });
  },
});

// ── Email subscriptions ──────────────────────────────────────────────────────

export const listEmail = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db
      .query("emailSubscriptions")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
  },
});

export const createEmail = mutation({
  args: {
    siteId: v.id("sites"),
    email: v.string(),
    frequency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return ctx.db.insert("emailSubscriptions", {
      ...args,
      userId: identity.subject,
      enabled: true,
    });
  },
});

export const toggleEmail = mutation({
  args: { subId: v.id("emailSubscriptions") },
  handler: async (ctx, { subId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const sub = await ctx.db.get(subId);
    if (!sub) throw new Error("Not found");
    await ctx.db.patch(subId, { enabled: !sub.enabled });
    return ctx.db.get(subId);
  },
});

export const removeEmail = mutation({
  args: { subId: v.id("emailSubscriptions") },
  handler: async (ctx, { subId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await ctx.db.delete(subId);
  },
});

export const listAllEmailSubs = internalQuery({
  args: { frequency: v.string() },
  handler: async (ctx, { frequency }) => {
    return ctx.db
      .query("emailSubscriptions")
      .filter((q) =>
        q.and(q.eq(q.field("enabled"), true), q.eq(q.field("frequency"), frequency)),
      )
      .collect();
  },
});

export const updateEmailLastSent = internalMutation({
  args: { subId: v.id("emailSubscriptions") },
  handler: async (ctx, { subId }) => {
    await ctx.db.patch(subId, { lastSentAt: Date.now() });
  },
});
