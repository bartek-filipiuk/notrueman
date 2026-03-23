import { readFileSync } from "fs";

/**
 * Load Truman's personality prompt from a markdown file.
 * The prompt is loaded dynamically so it can be edited without rebuilding.
 */
export function loadPersonalityPrompt(filePath: string): string {
  const content = readFileSync(filePath, "utf-8");
  if (!content.trim()) {
    throw new Error(`Personality prompt file is empty: ${filePath}`);
  }
  return content;
}
