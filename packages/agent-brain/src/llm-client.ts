import {
  generateText as aiGenerateText,
  generateObject as aiGenerateObject,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
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

export interface LLMClient {
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateObject<T>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>>;
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
  };
}
