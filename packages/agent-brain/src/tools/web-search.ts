import { z } from "zod";
import { tool } from "ai";

/** Brave Search API response types */
interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

/** Input schema for web search tool */
export const WebSearchInputSchema = z.object({
  query: z.string().min(1).max(200),
  count: z.number().int().min(1).max(5).optional().default(3),
});

type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

/** Output type */
export interface WebSearchOutput {
  results: Array<{ title: string; url: string; snippet: string }>;
}

/**
 * Create Brave Search tool definition for Vercel AI SDK.
 * Requires BRAVE_SEARCH_API_KEY environment variable.
 */
export function createWebSearchTool(apiKey: string) {
  return tool({
    description: "Search the internet using Brave Search. Use this to find information about topics you're curious about.",
    inputSchema: WebSearchInputSchema,
    execute: async (input: WebSearchInput): Promise<WebSearchOutput> => {
      const effectiveCount = input.count ?? 3;

      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", input.query);
      url.searchParams.set("count", String(effectiveCount));

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as BraveSearchResponse;
      const results = (data.web?.results ?? []).slice(0, effectiveCount).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      }));

      console.log(`[TOOL] web_search("${input.query}") → ${results.length} results`);
      return { results };
    },
  });
}

/** Tool metadata for ToolRegistry */
export const WEB_SEARCH_METADATA = {
  name: "web_search",
  description: "Search the internet using Brave Search",
  costPerCall: 1,
  activityTriggers: ["computer", "think", "read", "draw"] as const,
};
