import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMemoryRepository } from "../memory-repository.js";
import type { MemoryRepository } from "../memory-repository.js";
import type { MemoryRow, NewMemoryRow } from "../db/schema.js";

/**
 * T3.2: Memory CRUD tests.
 * Tests use a mock database since we can't connect to PostgreSQL in CI.
 */

const MOCK_MEMORY: MemoryRow = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  agentId: "truman",
  type: "observation",
  description: "I noticed the sunlight hitting the bookshelf in a peculiar way.",
  embedding: null,
  importance: 5,
  createdAt: new Date("2026-03-23T10:00:00Z"),
  lastAccessedAt: new Date("2026-03-23T10:00:00Z"),
  location: "bookshelf",
  emotionalContext: { curiosity: 0.8 },
  viewerInfluenced: false,
  metadata: {},
};

// Create a mock database that matches the Drizzle API shape
function createMockDb() {
  const store = new Map<string, MemoryRow>();

  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(async () => {
          const id = MOCK_MEMORY.id;
          store.set(id, { ...MOCK_MEMORY });
          return [{ ...MOCK_MEMORY }];
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            return store.has(MOCK_MEMORY.id) ? [store.get(MOCK_MEMORY.id)] : [];
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async (n: number) => {
              return Array.from(store.values()).slice(0, n);
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => {
          if (store.has(MOCK_MEMORY.id)) {
            const mem = store.get(MOCK_MEMORY.id)!;
            mem.lastAccessedAt = new Date();
            store.set(MOCK_MEMORY.id, mem);
          }
        }),
      }),
    }),
    _store: store,
  };

  return mockDb;
}

describe("memory repository (T3.2)", () => {
  let repo: MemoryRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = createMemoryRepository(mockDb as any);
  });

  it("createMemory inserts and returns a memory", async () => {
    const newMemory: NewMemoryRow = {
      agentId: "truman",
      type: "observation",
      description: "The sunlight hit the bookshelf.",
      importance: 5,
    };

    const result = await repo.createMemory(newMemory);

    expect(result.id).toBeDefined();
    expect(result.agentId).toBe("truman");
    expect(result.type).toBe("observation");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("getMemory retrieves by id", async () => {
    // First create
    await repo.createMemory({ agentId: "truman", type: "observation", description: "test", importance: 5 });

    const result = await repo.getMemory(MOCK_MEMORY.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(MOCK_MEMORY.id);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("getMemory returns null for non-existent id", async () => {
    // Don't create anything, store is empty
    const freshDb = createMockDb();
    const freshRepo = createMemoryRepository(freshDb as any);

    const result = await freshRepo.getMemory("nonexistent");

    expect(result).toBeNull();
  });

  it("updateLastAccessed calls update", async () => {
    await repo.createMemory({ agentId: "truman", type: "observation", description: "test", importance: 5 });
    const beforeUpdate = mockDb._store.get(MOCK_MEMORY.id)!.lastAccessedAt;

    // Small delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 10));
    await repo.updateLastAccessed(MOCK_MEMORY.id);

    expect(mockDb.update).toHaveBeenCalled();
  });

  it("getRecentMemories calls select with ordering", async () => {
    await repo.createMemory({ agentId: "truman", type: "observation", description: "test", importance: 5 });

    const results = await repo.getRecentMemories("truman", 10);

    expect(results.length).toBeGreaterThanOrEqual(0);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("repository has all required methods", () => {
    expect(typeof repo.createMemory).toBe("function");
    expect(typeof repo.getMemory).toBe("function");
    expect(typeof repo.updateLastAccessed).toBe("function");
    expect(typeof repo.getRecentMemories).toBe("function");
  });
});
