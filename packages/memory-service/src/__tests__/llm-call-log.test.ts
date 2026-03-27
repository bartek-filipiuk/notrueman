import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLLMCallLog } from "../llm-call-log.js";
import type { LLMCallLog } from "../llm-call-log.js";
import type { LLMCallRow } from "../db/schema.js";

const MOCK_CALL: LLMCallRow = {
  id: "660e8400-e29b-41d4-a716-446655440001",
  agentId: "truman",
  model: "openrouter/deepseek-r1",
  callType: "generateText",
  promptPreview: "What should I do next?",
  systemPreview: "You are Truman.",
  responsePreview: "I think I will go for a walk.",
  inputTokens: 150,
  outputTokens: 42,
  costUsd: "0.0012",
  durationMs: 823,
  success: true,
  error: null,
  createdAt: new Date("2026-03-27T10:00:00Z"),
};

function createMockDb() {
  const store: LLMCallRow[] = [];

  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(async () => {
          const row = { ...MOCK_CALL, id: `id-${store.length}` };
          store.push(row);
          return [row];
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockImplementation(async () => store.slice().reverse()),
            }),
          }),
        }),
      }),
    }),
    _store: store,
  };
}

function createMockDbForStats() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_CALL }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            callCount: 5,
            tokensIn: "750",
            tokensOut: "210",
            totalCost: "0.006",
            avgDuration: "800",
            errors: 1,
          },
        ]),
      }),
    }),
  };
}

describe("LLM call log (TU.2)", () => {
  let log: LLMCallLog;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    log = createLLMCallLog(mockDb as any);
  });

  it("logCall inserts and returns a row", async () => {
    const result = await log.logCall({
      agentId: "truman",
      model: "openrouter/deepseek-r1",
      callType: "generateText",
      promptPreview: "What should I do?",
      responsePreview: "Go for a walk.",
      durationMs: 500,
      success: true,
    });
    expect(result.id).toBeDefined();
    expect(result.model).toBe("openrouter/deepseek-r1");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("getRecentCalls queries with correct ordering", async () => {
    await log.logCall({
      agentId: "truman",
      model: "openrouter/deepseek-r1",
      callType: "generateText",
      promptPreview: "test",
      responsePreview: "test",
      durationMs: 100,
      success: true,
    });
    const results = await log.getRecentCalls("truman", 10, 0);
    expect(results.length).toBeGreaterThanOrEqual(0);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("getRecentCalls passes filters", async () => {
    const results = await log.getRecentCalls("truman", 10, 0, {
      model: "openrouter/deepseek-r1",
      success: true,
    });
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("getStats returns aggregated data", async () => {
    const statsDb = createMockDbForStats();
    const statsLog = createLLMCallLog(statsDb as any);
    const stats = await statsLog.getStats("truman", 24);

    expect(stats.callsToday).toBe(5);
    expect(stats.totalTokensIn).toBe(750);
    expect(stats.totalTokensOut).toBe(210);
    expect(stats.totalCostUsd).toBe(0.006);
    expect(stats.avgDurationMs).toBe(800);
    expect(stats.errorCount).toBe(1);
  });

  it("getStats handles empty results", async () => {
    const emptyDb = {
      ...createMockDbForStats(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              callCount: 0,
              tokensIn: null,
              tokensOut: null,
              totalCost: null,
              avgDuration: null,
              errors: 0,
            },
          ]),
        }),
      }),
    };
    const emptyLog = createLLMCallLog(emptyDb as any);
    const stats = await emptyLog.getStats("truman", 24);

    expect(stats.callsToday).toBe(0);
    expect(stats.totalTokensIn).toBe(0);
    expect(stats.totalCostUsd).toBe(0);
    expect(stats.avgDurationMs).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  it("has all required methods", () => {
    expect(typeof log.logCall).toBe("function");
    expect(typeof log.getRecentCalls).toBe("function");
    expect(typeof log.getStats).toBe("function");
  });
});
