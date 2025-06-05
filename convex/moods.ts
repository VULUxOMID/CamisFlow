import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get mood logs for a user
export const getMoodLogs = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("moodLogs")
      .withIndex("by_user_and_date", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Log mood
export const logMood = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    mood: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if entry already exists for this date
    const existing = await ctx.db
      .query("moodLogs")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        mood: args.mood,
      });
      return existing._id;
    } else {
      // Create new entry
      return await ctx.db.insert("moodLogs", {
        userId: args.userId,
        date: args.date,
        mood: args.mood,
      });
    }
  },
});

// Delete mood log
export const deleteMoodLog = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("moodLogs")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .first();

    if (entry) {
      await ctx.db.delete(entry._id);
    }
  },
}); 