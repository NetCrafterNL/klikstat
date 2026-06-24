import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { nanoid } from "nanoid";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return ctx.db
      .query("sites")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const site = await ctx.db.get(siteId);
    if (!site || site.userId !== identity.subject) return null;
    return site;
  },
});

export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return ctx.db
      .query("sites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
  },
});

export const getByPublicToken = internalQuery({
  args: { publicToken: v.string() },
  handler: async (ctx, { publicToken }) => {
    return ctx.db
      .query("sites")
      .withIndex("by_public_token", (q) => q.eq("publicToken", publicToken))
      .unique();
  },
});

export const create = mutation({
  args: {
    domain: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { domain, name }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const token = nanoid(32);
    const publicToken = nanoid(32);
    const id = await ctx.db.insert("sites", {
      userId: identity.subject,
      domain,
      name: name ?? domain,
      token,
      publicToken,
      isPublic: false,
    });
    return { _id: id, token, publicToken };
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const site = await ctx.db.get(siteId);
    if (!site || site.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.patch(siteId, fields);
    return ctx.db.get(siteId);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const site = await ctx.db.get(siteId);
    if (!site || site.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.delete(siteId);
  },
});

export const internalGetById = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => ctx.db.get(siteId),
});

export const internalPatch = internalMutation({
  args: { siteId: v.id("sites"), fields: v.any() },
  handler: async (ctx, { siteId, fields }) => ctx.db.patch(siteId, fields),
});
