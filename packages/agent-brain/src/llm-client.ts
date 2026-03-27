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
  /** URL to POST LLM call logs to (fire-and-forget). E.g. "http://localhost:3001/api/llm-log" */
  logEndpoint?: string;
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

  /** Fire-and-forget POST to log endpoint */
  function logCall(data: Record<string, unknown>): void {
    if (!config.logEndpoint) return;
    fetch(config.logEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch((e) => console.debug("[llm-log] POST failed:", e.message));
  }

  return {
    async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
      const start = Date.now();
      const modelName = params.model === "think" ? config.thinkModel : config.classifyModel;
      console.log(`[LLM:${params.model}] generateText — prompt: ${params.prompt.substring(0, 100)}...`);
      let text = "";
      let usage: GenerateTextResult["usage"];
      let success = true;
      let error: string | undefined;
      try {
        const result = await aiGenerateText({
          model: models[params.model],
          prompt: params.prompt,
          system: params.system,
        });
        text = result.text;
        usage = result.usage as GenerateTextResult["usage"];
      } catch (e: unknown) {
        success = false;
        error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        const ms = Date.now() - start;
        if (success) {
          console.log(`[LLM:${params.model}] → ${ms}ms | ${usage?.inputTokens ?? "?"}in/${usage?.outputTokens ?? "?"}out | "${text.substring(0, 80)}..."`);
        }
        logCall({
          agentId: "truman",
          model: modelName,
          callType: "generateText",
          promptPreview: params.prompt.slice(0, 500),
          systemPreview: params.system?.slice(0, 200),
          responsePreview: (error ?? text).slice(0, 500),
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          durationMs: ms,
          success,
          error,
        });
      }
      return { text, usage };
    },

    async generateObject<T>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>> {
      const start = Date.now();
      const modelName = params.model === "think" ? config.thinkModel : config.classifyModel;
      console.log(`[LLM:${params.model}] generateObject — prompt: ${params.prompt.substring(0, 100)}...`);
      let object: T | undefined;
      let usage: GenerateObjectResult<T>["usage"];
      let success = true;
      let error: string | undefined;
      try {
        const result = await aiGenerateObject({
          model: models[params.model],
          prompt: params.prompt,
          schema: params.schema,
          system: params.system,
        });
        object = result.object as T;
        usage = result.usage as GenerateObjectResult<T>["usage"];
      } catch (e: unknown) {
        success = false;
        error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        const ms = Date.now() - start;
        const responseStr = error ?? JSON.stringify(object);
        if (success) {
          console.log(`[LLM:${params.model}] → ${ms}ms | ${usage?.inputTokens ?? "?"}in/${usage?.outputTokens ?? "?"}out | result:`, responseStr.substring(0, 120));
        }
        logCall({
          agentId: "truman",
          model: modelName,
          callType: "generateObject",
          promptPreview: params.prompt.slice(0, 500),
          systemPreview: params.system?.slice(0, 200),
          responsePreview: responseStr.slice(0, 500),
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          durationMs: ms,
          success,
          error,
        });
      }
      return { object: object as T, usage };
    },

    async generateWithTools(params: GenerateWithToolsParams): Promise<GenerateWithToolsResult> {
      const start = Date.now();
      const modelName = params.model === "think" ? config.thinkModel : config.classifyModel;
      const maxRoundtrips = params.maxToolRoundtrips ?? 3;
      let resultText = "";
      let usage: GenerateWithToolsResult["usage"];
      let success = true;
      let error: string | undefined;
      const toolCalls: Array<{ toolName: string; args: unknown }> = [];
      const toolResults: Array<{ toolName: string; result: unknown }> = [];

      try {
        const result = await aiGenerateText({
          model: models[params.model],
          prompt: params.prompt,
          system: params.system,
          tools: params.tools,
          stopWhen: stepCountIs(maxRoundtrips),
        });

        resultText = result.text;
        usage = result.usage as GenerateWithToolsResult["usage"];

        for (const step of result.steps ?? []) {
          for (const tc of step.toolCalls ?? []) {
            toolCalls.push({ toolName: tc.toolName, args: (tc as any).input });
            console.log(`[TOOL] ${tc.toolName}(${JSON.stringify((tc as any).input).slice(0, 100)})`);
          }
          for (const tr of step.toolResults ?? []) {
            toolResults.push({ toolName: tr.toolName, result: (tr as any).output });
          }
        }
      } catch (e: unknown) {
        success = false;
        error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        const ms = Date.now() - start;
        const toolSummary = toolCalls.map((tc) => tc.toolName).join(", ");
        logCall({
          agentId: "truman",
          model: modelName,
          callType: "generateWithTools",
          promptPreview: params.prompt.slice(0, 500),
          systemPreview: params.system?.slice(0, 200),
          responsePreview: (error ?? `${resultText.slice(0, 400)} [tools: ${toolSummary}]`).slice(0, 500),
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          durationMs: ms,
          success,
          error,
        });
      }

      return { text: resultText, toolCalls, toolResults, usage };
    },
  };
}
