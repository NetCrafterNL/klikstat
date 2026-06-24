import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sites: defineTable({
    userId: v.string(),
    domain: v.string(),
    name: v.optional(v.string()),
    token: v.string(),
    publicToken: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
    settings: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"])
    .index("by_public_token", ["publicToken"]),

  events: defineTable({
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
  })
    .index("by_site", ["siteId"])
    .index("by_site_time", ["siteId", "timestamp"]),

  sessions: defineTable({
    siteId: v.id("sites"),
    sessionId: v.string(),
    entryUrl: v.optional(v.string()),
    referrer: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    device: v.optional(v.string()),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    duration: v.optional(v.number()),
    pageviews: v.optional(v.number()),
    bounced: v.optional(v.boolean()),
    startedAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_time", ["siteId", "startedAt"])
    .index("by_session_id", ["sessionId"]),

  goals: defineTable({
    siteId: v.id("sites"),
    name: v.string(),
    type: v.optional(v.string()),
    value: v.optional(v.string()),
    active: v.optional(v.boolean()),
  }).index("by_site", ["siteId"]),

  funnels: defineTable({
    siteId: v.id("sites"),
    name: v.string(),
    steps: v.any(),
    active: v.optional(v.boolean()),
  }).index("by_site", ["siteId"]),

  annotations: defineTable({
    siteId: v.id("sites"),
    date: v.string(),
    label: v.string(),
    color: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  apiKeys: defineTable({
    userId: v.string(),
    siteId: v.optional(v.id("sites")),
    name: v.string(),
    keyHash: v.string(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["keyHash"]),

  alertSubscriptions: defineTable({
    siteId: v.id("sites"),
    email: v.string(),
    spikePct: v.optional(v.number()),
    dropPct: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
    lastAlertedAt: v.optional(v.number()),
  }).index("by_site", ["siteId"]),

  emailSubscriptions: defineTable({
    siteId: v.id("sites"),
    userId: v.optional(v.string()),
    email: v.string(),
    frequency: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    lastSentAt: v.optional(v.number()),
  }).index("by_site", ["siteId"]),

  dailyStats: defineTable({
    siteId: v.id("sites"),
    date: v.string(),
    visitors: v.optional(v.number()),
    pageviews: v.optional(v.number()),
    sessions: v.optional(v.number()),
    bounceRate: v.optional(v.number()),
    avgDuration: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_date", ["siteId", "date"]),
});
