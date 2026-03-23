import { describe, it, expect, vi, beforeEach } from "vitest";
import { RendererBridge } from "../renderer-bridge.js";
import type { RendererHandler } from "../renderer-bridge.js";

function createMockHandler(): RendererHandler {
  return {
    moveTo: vi.fn().mockResolvedValue(undefined),
    playActivity: vi.fn(),
    showThought: vi.fn(),
    updateHUD: vi.fn(),
  };
}

describe("renderer bridge (T2.7)", () => {
  let handler: RendererHandler;
  let bridge: RendererBridge;

  beforeEach(() => {
    handler = createMockHandler();
    bridge = new RendererBridge(handler);
  });

  it("executeCommand move_to calls handler.moveTo", async () => {
    await bridge.executeCommand({
      type: "move_to",
      payload: { objectId: "desk" },
    });

    expect(handler.moveTo).toHaveBeenCalledWith("desk");
  });

  it("executeCommand play_animation calls handler.playActivity", async () => {
    await bridge.executeCommand({
      type: "play_animation",
      payload: { state: "read" },
    });

    expect(handler.playActivity).toHaveBeenCalledWith("read");
  });

  it("executeCommand show_bubble calls handler.showThought", async () => {
    await bridge.executeCommand({
      type: "show_bubble",
      payload: { text: "Interesting...", type: "thought", mood: "curious" },
    });

    expect(handler.showThought).toHaveBeenCalledWith("Interesting...", "curious");
  });

  it("executeCommand update_hud calls handler.updateHUD", async () => {
    await bridge.executeCommand({
      type: "update_hud",
      payload: { mood: "happy", activity: "read" },
    });

    expect(handler.updateHUD).toHaveBeenCalledWith({ mood: "happy", activity: "read" });
  });

  it("executeAction performs full sequence: HUD → move → activity → thought", async () => {
    await bridge.executeAction("read", "This book is fascinating.", "curious");

    expect(handler.updateHUD).toHaveBeenCalledWith({ activity: "read", mood: "curious" });
    expect(handler.moveTo).toHaveBeenCalledWith("bookshelf");
    expect(handler.playActivity).toHaveBeenCalledWith("read");
    expect(handler.showThought).toHaveBeenCalledWith("This book is fascinating.", "curious");
  });

  it("executeAction skips thought bubble when thought is empty", async () => {
    await bridge.executeAction("sleep", "", "tired");

    expect(handler.moveTo).toHaveBeenCalledWith("bed");
    expect(handler.playActivity).toHaveBeenCalledWith("sleep");
    expect(handler.showThought).not.toHaveBeenCalled();
  });

  it("getObjectForActivity maps activities to correct objects", () => {
    expect(RendererBridge.getObjectForActivity("sleep")).toBe("bed");
    expect(RendererBridge.getObjectForActivity("eat")).toBe("table_chair");
    expect(RendererBridge.getObjectForActivity("read")).toBe("bookshelf");
    expect(RendererBridge.getObjectForActivity("computer")).toBe("computer");
    expect(RendererBridge.getObjectForActivity("exercise")).toBe("exercise_mat");
    expect(RendererBridge.getObjectForActivity("think")).toBe("window");
    expect(RendererBridge.getObjectForActivity("cook")).toBe("stove");
    expect(RendererBridge.getObjectForActivity("draw")).toBe("easel");
  });

  it("logs all executed commands", async () => {
    await bridge.executeCommand({ type: "move_to", payload: { objectId: "bed" } });
    await bridge.executeCommand({ type: "play_animation", payload: { state: "sleep" } });

    const log = bridge.getCommandLog();
    expect(log).toHaveLength(2);
    expect(log[0].type).toBe("move_to");
    expect(log[1].type).toBe("play_animation");
  });

  it("clearCommandLog resets the log", async () => {
    await bridge.executeCommand({ type: "move_to", payload: { objectId: "bed" } });
    bridge.clearCommandLog();

    expect(bridge.getCommandLog()).toHaveLength(0);
  });
});
