import type { ActivityType } from "@nts/shared";

export interface ToolMetadata {
  name: string;
  description: string;
  costPerCall: number;
  activityTriggers: ActivityType[];
}

// Use 'any' for tool definitions to avoid tight coupling to AI SDK internal types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolDefinition = any;

/**
 * Registry of tools available to Truman's cognitive loop.
 * Maps activities to available tools and filters by budget.
 */
export class ToolRegistry {
  private tools = new Map<string, { metadata: ToolMetadata; definition: ToolDefinition }>();

  /** Register a tool with its metadata and AI SDK definition */
  register(metadata: ToolMetadata, definition: ToolDefinition): void {
    this.tools.set(metadata.name, { metadata, definition });
  }

  /** Get all tool definitions available for a given activity */
  getToolsForActivity(activity: ActivityType): Record<string, ToolDefinition> {
    const result: Record<string, ToolDefinition> = {};
    for (const [name, { metadata, definition }] of this.tools) {
      if (metadata.activityTriggers.includes(activity)) {
        result[name] = definition;
      }
    }
    return result;
  }

  /** Get tools that fit within the remaining budget */
  getAvailableTools(budgetRemaining: number): Record<string, ToolDefinition> {
    const result: Record<string, ToolDefinition> = {};
    for (const [name, { metadata, definition }] of this.tools) {
      if (metadata.costPerCall <= budgetRemaining) {
        result[name] = definition;
      }
    }
    return result;
  }

  /** Get metadata for a specific tool */
  getMetadata(name: string): ToolMetadata | undefined {
    return this.tools.get(name)?.metadata;
  }

  /** Get all registered tool names */
  getToolNames(): string[] {
    return [...this.tools.keys()];
  }

  /** Get count of registered tools */
  get size(): number {
    return this.tools.size;
  }
}
