import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get cycle logs for a user
export const getCycleLogs = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cycleLogs")
      .withIndex("by_user_and_date", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Log cycle data
export const logCycle = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    phase: v.union(
      v.literal("period"),
      v.literal("fertile"),
      v.literal("ovulation"),
      v.literal("pms"),
      v.literal("normal")
    ),
    actualStart: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if entry already exists for this date
    const existing = await ctx.db
      .query("cycleLogs")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        phase: args.phase,
        actualStart: args.actualStart,
      });
      return existing._id;
    } else {
      // Create new entry
      return await ctx.db.insert("cycleLogs", {
        userId: args.userId,
        date: args.date,
        phase: args.phase,
        actualStart: args.actualStart,
      });
    }
  },
});

// Delete cycle log
export const deleteCycleLog = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("cycleLogs")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .first();

    if (entry) {
      await ctx.db.delete(entry._id);
    }
  },
}); 