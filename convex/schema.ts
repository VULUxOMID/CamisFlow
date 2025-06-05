import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("viewer")),
    accessCode: v.string(),
    averageCycleLength: v.optional(v.number()),
    lastPeriodStart: v.optional(v.string()),
  }).index("by_access_code", ["accessCode"]),

  cycleLogs: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    phase: v.union(
      v.literal("period"),
      v.literal("fertile"),
      v.literal("ovulation"),
      v.literal("pms"),
      v.literal("normal")
    ),
    actualStart: v.optional(v.boolean()), // true if this is an actual period start vs predicted
  }).index("by_user_and_date", ["userId", "date"]),

  moodLogs: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    mood: v.number(), // 1-5 scale
  }).index("by_user_and_date", ["userId", "date"]),

  notes: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    content: v.string(),
  }).index("by_user_and_date", ["userId", "date"]),
}); 