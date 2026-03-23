import { describe, it, expect } from "vitest";
import { loadPersonalityPrompt } from "../personality.js";
import { resolve } from "path";

describe("personality prompt (T2.2)", () => {
  const configPath = resolve(__dirname, "../../../../config/truman-personality.md");

  it("loads personality prompt from config file", () => {
    const prompt = loadPersonalityPrompt(configPath);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("contains core identity elements", () => {
    const prompt = loadPersonalityPrompt(configPath);
    expect(prompt).toContain("Truman");
    expect(prompt).toContain("curious introvert");
    expect(prompt).toContain("dry humor");
    expect(prompt).toContain("philosophical");
  });

  it("contains behavioral rules", () => {
    const prompt = loadPersonalityPrompt(configPath);
    expect(prompt).toContain("PG-13");
    expect(prompt).toContain("fourth wall");
  });

  it("contains speaking style guidelines", () => {
    const prompt = loadPersonalityPrompt(configPath);
    expect(prompt).toContain("Speaking Style");
    expect(prompt).toContain("deadpan");
  });

  it("contains backstory fragments", () => {
    const prompt = loadPersonalityPrompt(configPath);
    expect(prompt).toContain("Backstory");
    expect(prompt).toContain("Schrodinger");
  });

  it("throws on missing file", () => {
    expect(() => loadPersonalityPrompt("/nonexistent/path.md")).toThrow();
  });
});
