import {
  generateText as aiGenerateText,
  generateObject as aiGenerateObject,
  stepCountIs,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel, ToolSet } from "ai";
import type { ZodType } from "zod";

export type ModelType = "think" | "classify";

export interface LLMClientConfig {
  apiKey: string;
  thinkModel: string;
  classifyModel: string;
}

export interface GenerateTextParams {
  prompt: string;
  model: ModelType;
  system?: string;
}

export interface GenerateTextResult {
  text: string;
  usage?: { inputTokens: number | undefined; outputTokens: number | undefined };
}

export interface GenerateObjectParams<T> {
  prompt: string;
  schema: ZodType<T>;
  model: ModelType;
  system?: string;
}

export interface GenerateObjectResult<T> {
  object: T;
  usage?: { inputTokens: number | undefined; outputTokens: number | undefined };
}

export interface GenerateWithToolsParams {
  prompt: string;
  model: ModelType;
  system?: string;
  tools: ToolSet;
  maxToolRoundtrips?: number;
}

export interface GenerateWithToolsResult {
  text: string;
  toolCalls: Array<{ toolName: string; args: unknown }>;
  toolResults: Array<{ toolName: string; result: unknown }>;
  usage?: { inputTokens: number | undefined; outputTokens: number | undefined };
}

export interface LLMClient {
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateObject<T>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>>;
  generateWithTools(params: GenerateWithToolsParams): Promise<GenerateWithToolsResult>;
}

export function createLLMClient(config: LLMClientConfig): LLMClient {
  const openrouter = createOpenRouter({ apiKey: config.apiKey });

  const models: Record<ModelType, LanguageModel> = {
    think: openrouter(config.thinkModel),
    classify: openrouter(config.classifyModel),
  };

  return {
    async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
      const result = await aiGenerateText({
        model: models[params.model],
        prompt: params.prompt,
        system: params.system,
      });
      return {
        text: result.text,
        usage: result.usage as GenerateTextResult["usage"],
      };
    },

    async generateObject<T>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>> {
      const result = await aiGenerateObject({
        model: models[params.model],
        prompt: params.prompt,
        schema: params.schema,
        system: params.system,
      });
      return {
        object: result.object as T,
        usage: result.usage as GenerateObjectResult<T>["usage"],
      };
    },

    async generateWithTools(params: GenerateWithToolsParams): Promise<GenerateWithToolsResult> {
      const maxRoundtrips = params.maxToolRoundtrips ?? 3;

      const result = await aiGenerateText({
        model: models[params.model],
        prompt: params.prompt,
        system: params.system,
        tools: params.tools,
        stopWhen: stepCountIs(maxRoundtrips),
      });

      // Extract tool calls and results from steps
      const toolCalls: Array<{ toolName: string; args: unknown }> = [];
      const toolResults: Array<{ toolName: string; result: unknown }> = [];

      for (const step of result.steps ?? []) {
        for (const tc of step.toolCalls ?? []) {
          toolCalls.push({ toolName: tc.toolName, args: (tc as any).input });
          console.log(`[TOOL] ${tc.toolName}(${JSON.stringify((tc as any).input).slice(0, 100)})`);
        }
        for (const tr of step.toolResults ?? []) {
          toolResults.push({ toolName: tr.toolName, result: (tr as any).output });
        }
      }

      return {
        text: result.text,
        toolCalls,
        toolResults,
        usage: result.usage as GenerateWithToolsResult["usage"],
      };
    },
  };
}
