import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get notes for a user
export const getNotes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notes")
      .withIndex("by_user_and_date", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Save note
export const saveNote = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if entry already exists for this date
    const existing = await ctx.db
      .query("notes")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        content: args.content,
      });
      return existing._id;
    } else {
      // Create new entry
      return await ctx.db.insert("notes", {
        userId: args.userId,
        date: args.date,
        content: args.content,
      });
    }
  },
});

// Delete note
export const deleteNote = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("notes")
      .withIndex("by_user_and_date", (q) => 
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .first();

    if (entry) {
      await ctx.db.delete(entry._id);
    }
  },
}); 