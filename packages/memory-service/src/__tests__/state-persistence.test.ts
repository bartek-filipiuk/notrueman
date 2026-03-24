import { describe, it, expect, vi } from "vitest";
import { createStatePersistence } from "../state-persistence.js";

describe("state persistence (T3.10)", () => {
  it("has saveState and loadLatestState methods", () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    };

    const persistence = createStatePersistence(mockDb as any);
    expect(typeof persistence.saveState).toBe("function");
    expect(typeof persistence.loadLatestState).toBe("function");
  });

  it("saveState calls db insert", async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined);
    const mockDb = {
      insert: vi.fn().mockReturnValue({ values: valuesFn }),
    };

    const persistence = createStatePersistence(mockDb as any);
    await persistence.saveState("truman", { mood: "happy", tickCount: 42 });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(valuesFn).toHaveBeenCalled();
  });

  it("loadLatestState returns null when no state exists", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    };

    const persistence = createStatePersistence(mockDb as any);
    const state = await persistence.loadLatestState("truman");

    expect(state).toBeNull();
  });

  it("loadLatestState returns the most recent state", async () => {
    const mockState = { mood: "contemplative", tickCount: 100 };
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: "123",
                agentId: "truman",
                state: mockState,
                createdAt: new Date(),
              }]),
            }),
          }),
        }),
      }),
    };

    const persistence = createStatePersistence(mockDb as any);
    const state = await persistence.loadLatestState("truman");

    expect(state).toEqual(mockState);
  });
});
