import { describe, it, expect } from "vitest";
import { memories, reflectionSources, agentStateSnapshots } from "../db/schema.js";
import { getTableName, getTableColumns } from "drizzle-orm";

/**
 * T3.1: Drizzle ORM schema tests.
 * Validates table structure without requiring a live database.
 */
describe("database schema (T3.1)", () => {
  describe("memories table", () => {
    it("has correct table name", () => {
      expect(getTableName(memories)).toBe("memories");
    });

    it("has all required columns", () => {
      const columns = Object.keys(getTableColumns(memories));
      expect(columns).toContain("id");
      expect(columns).toContain("agentId");
      expect(columns).toContain("type");
      expect(columns).toContain("description");
      expect(columns).toContain("embedding");
      expect(columns).toContain("importance");
      expect(columns).toContain("createdAt");
      expect(columns).toContain("lastAccessedAt");
      expect(columns).toContain("location");
      expect(columns).toContain("emotionalContext");
      expect(columns).toContain("viewerInfluenced");
      expect(columns).toContain("metadata");
    });

    it("has 12 columns total", () => {
      const columns = Object.keys(getTableColumns(memories));
      expect(columns.length).toBe(12);
    });

    it("type column has correct enum values", () => {
      const typeCol = memories.type;
      expect(typeCol.enumValues).toEqual(["observation", "reflection", "plan"]);
    });
  });

  describe("reflection_sources table", () => {
    it("has correct table name", () => {
      expect(getTableName(reflectionSources)).toBe("reflection_sources");
    });

    it("has foreign key columns", () => {
      const columns = Object.keys(getTableColumns(reflectionSources));
      expect(columns).toContain("id");
      expect(columns).toContain("reflectionId");
      expect(columns).toContain("sourceMemoryId");
    });
  });

  describe("agent_state_snapshots table", () => {
    it("has correct table name", () => {
      expect(getTableName(agentStateSnapshots)).toBe("agent_state_snapshots");
    });

    it("has required columns", () => {
      const columns = Object.keys(getTableColumns(agentStateSnapshots));
      expect(columns).toContain("id");
      expect(columns).toContain("agentId");
      expect(columns).toContain("state");
      expect(columns).toContain("createdAt");
    });
  });
});
