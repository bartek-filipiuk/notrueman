import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  checkLoginRateLimit,
  validateJWTSecret,
} from "../admin-auth.js";

const TEST_SECRET = "a".repeat(32); // 32 chars minimum

describe("Admin Auth (TN.1)", () => {
  describe("password hashing", () => {
    it("hashes and verifies a correct password", async () => {
      const hash = await hashPassword("mypassword");
      expect(await verifyPassword("mypassword", hash)).toBe(true);
    });

    it("rejects incorrect password", async () => {
      const hash = await hashPassword("mypassword");
      expect(await verifyPassword("wrongpassword", hash)).toBe(false);
    });

    it("produces different hashes for same password (salted)", async () => {
      const hash1 = await hashPassword("test");
      const hash2 = await hashPassword("test");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("JWT tokens", () => {
    it("creates and verifies a valid token", () => {
      const token = createToken(TEST_SECRET);
      expect(verifyToken(token, TEST_SECRET)).toBe(true);
    });

    it("rejects token with wrong secret", () => {
      const token = createToken(TEST_SECRET);
      expect(verifyToken(token, "b".repeat(32))).toBe(false);
    });

    it("rejects malformed token", () => {
      expect(verifyToken("not.a.jwt", TEST_SECRET)).toBe(false);
    });

    it("rejects empty token", () => {
      expect(verifyToken("", TEST_SECRET)).toBe(false);
    });
  });

  describe("login rate limiting", () => {
    beforeEach(() => {
      // Reset by using unique IPs per test
    });

    it("allows first 5 attempts from same IP", () => {
      const ip = `rate-test-${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        expect(checkLoginRateLimit(ip)).toBe(true);
      }
    });

    it("blocks 6th attempt from same IP within 1 minute", () => {
      const ip = `rate-block-${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit(ip);
      }
      expect(checkLoginRateLimit(ip)).toBe(false);
    });

    it("allows attempts from different IPs", () => {
      expect(checkLoginRateLimit(`ip-a-${Date.now()}`)).toBe(true);
      expect(checkLoginRateLimit(`ip-b-${Date.now()}`)).toBe(true);
    });
  });

  describe("JWT secret validation", () => {
    it("accepts 32+ char secret", () => {
      expect(validateJWTSecret(TEST_SECRET)).toBe(TEST_SECRET);
    });

    it("rejects short secret", () => {
      expect(() => validateJWTSecret("short")).toThrow("at least 32 characters");
    });

    it("rejects undefined secret", () => {
      expect(() => validateJWTSecret(undefined)).toThrow("at least 32 characters");
    });

    it("rejects empty secret", () => {
      expect(() => validateJWTSecret("")).toThrow("at least 32 characters");
    });
  });
});
