import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db.query("funnels").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.string(),
    steps: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return ctx.db.insert("funnels", { ...args, active: true });
  },
});

export const update = mutation({
  args: {
    funnelId: v.id("funnels"),
    name: v.optional(v.string()),
    steps: v.optional(v.any()),
  },
  handler: async (ctx, { funnelId, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await ctx.db.patch(funnelId, fields);
  },
});

export const remove = mutation({
  args: { funnelId: v.id("funnels") },
  handler: async (ctx, { funnelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await ctx.db.delete(funnelId);
  },
});
