import { describe, it, expect } from "vitest";
import { GAME_WIDTH, GAME_HEIGHT, GAME_FPS } from "@nts/shared";

describe("game config smoke tests", () => {
  it("game dimensions are 960x540 (visual-spec.md S2)", () => {
    expect(GAME_WIDTH).toBe(960);
    expect(GAME_HEIGHT).toBe(540);
  });

  it("FPS target is 30 (visual-spec.md S2)", () => {
    expect(GAME_FPS).toBe(30);
  });

  it("game scale factor is 2x (960→1920, 540→1080)", () => {
    expect(GAME_WIDTH * 2).toBe(1920);
    expect(GAME_HEIGHT * 2).toBe(1080);
  });
});
