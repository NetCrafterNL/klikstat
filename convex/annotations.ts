import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { siteId: v.id("sites"), days: v.number() },
  handler: async (ctx, { siteId, days }) => {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const all = await ctx.db
      .query("annotations")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return all.filter((a) => a.date >= since);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    date: v.string(),
    label: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return ctx.db.insert("annotations", { ...args, createdBy: identity.subject });
  },
});

export const remove = mutation({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, { annotationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await ctx.db.delete(annotationId);
  },
});
