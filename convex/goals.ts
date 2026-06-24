import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db.query("goals").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.string(),
    type: v.optional(v.string()),
    value: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return ctx.db.insert("goals", { ...args, active: true });
  },
});

export const remove = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, { goalId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    await ctx.db.delete(goalId);
  },
});
