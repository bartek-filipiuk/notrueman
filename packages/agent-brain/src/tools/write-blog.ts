import { z } from "zod";
import { tool } from "ai";

/** Input schema for blog writing tool */
export const WriteBlogInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  tags: z.array(z.string()).max(5),
});

/** Output type */
export interface WriteBlogOutput {
  id: string;
  status: "draft_saved";
}

/**
 * Create blog post tool (placeholder).
 * Does NOT publish — saves to memory as observation.
 * Trigger: "computer" activity.
 */
type WriteBlogInput = z.infer<typeof WriteBlogInputSchema>;

export function createWriteBlogTool() {
  return tool({
    description: "Write a blog post about something you've been thinking about. The post is saved as a draft in your journal.",
    inputSchema: WriteBlogInputSchema,
    execute: async (input: WriteBlogInput): Promise<WriteBlogOutput> => {
      const id = `blog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(`[TOOL] write_blog_post("${input.title}") → draft_saved [${input.tags.join(", ")}]`);
      return { id, status: "draft_saved" };
    },
  });
}

/** Tool metadata for ToolRegistry */
export const WRITE_BLOG_METADATA = {
  name: "write_blog_post",
  description: "Write a blog post draft and save it to your journal",
  costPerCall: 1,
  activityTriggers: ["computer"] as const,
};
