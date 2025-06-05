import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get user by access code
export const getUserByAccessCode = query({
  args: { accessCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_access_code", (q) => q.eq("accessCode", args.accessCode))
      .first();
  },
});

// Create or update user
export const createUser = mutation({
  args: {
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("viewer")),
    accessCode: v.string(),
    averageCycleLength: v.optional(v.number()),
    lastPeriodStart: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_access_code", (q) => q.eq("accessCode", args.accessCode))
      .first();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        role: args.role,
        averageCycleLength: args.averageCycleLength,
        lastPeriodStart: args.lastPeriodStart,
      });
      return existingUser._id;
    } else {
      // Create new user
      return await ctx.db.insert("users", {
        name: args.name,
        role: args.role,
        accessCode: args.accessCode,
        averageCycleLength: args.averageCycleLength || 28,
        lastPeriodStart: args.lastPeriodStart,
      });
    }
  },
});

// Update user data
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    averageCycleLength: v.optional(v.number()),
    lastPeriodStart: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      averageCycleLength: args.averageCycleLength,
      lastPeriodStart: args.lastPeriodStart,
    });
  },
}); 