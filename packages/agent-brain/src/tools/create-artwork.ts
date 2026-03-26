import { z } from "zod";
import { tool } from "ai";

/** Input schema for artwork creation tool */
export const CreateArtworkInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  style: z.string().min(1).max(100),
});

/** Output type */
export interface CreateArtworkOutput {
  id: string;
  status: "concept_saved";
}

/**
 * Create artwork tool (placeholder).
 * Does NOT generate images — saves concept to memory.
 * Trigger: "draw" activity.
 */
type CreateArtworkInput = z.infer<typeof CreateArtworkInputSchema>;

export function createArtworkTool() {
  return tool({
    description: "Create an artwork concept — describe what you want to draw or paint. The concept is saved for reference.",
    inputSchema: CreateArtworkInputSchema,
    execute: async (input: CreateArtworkInput): Promise<CreateArtworkOutput> => {
      const id = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(`[TOOL] create_artwork("${input.title}", style: ${input.style}) → concept_saved`);
      return { id, status: "concept_saved" };
    },
  });
}

/** Tool metadata for ToolRegistry */
export const CREATE_ARTWORK_METADATA = {
  name: "create_artwork",
  description: "Create an artwork concept with title, description, and style",
  costPerCall: 1,
  activityTriggers: ["draw"] as const,
};
