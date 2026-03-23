import { describe, it, expect, vi } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("rate limiter (S2.3)", () => {
  it("allows calls within the limit", () => {
    const limiter = new RateLimiter(10);
    expect(limiter.canCall()).toBe(true);
    limiter.recordCall();
    expect(limiter.getRemainingCalls()).toBe(9);
  });

  it("blocks calls when limit exceeded", () => {
    const limiter = new RateLimiter(3);
    limiter.recordCall();
    limiter.recordCall();
    limiter.recordCall();

    expect(limiter.canCall()).toBe(false);
    expect(() => limiter.recordCall()).toThrow("Rate limit exceeded");
  });

  it("reports usage as fraction", () => {
    const limiter = new RateLimiter(10);
    expect(limiter.getUsage()).toBe(0);
    limiter.recordCall();
    expect(limiter.getUsage()).toBeCloseTo(0.1);
  });

  it("logs warning at >80% usage", () => {
    const logFn = vi.fn();
    const limiter = new RateLimiter(5, logFn);

    // Record 4 calls (80%)
    limiter.recordCall();
    limiter.recordCall();
    limiter.recordCall();
    limiter.recordCall();

    // The 4th call should have triggered a warning
    expect(logFn).toHaveBeenCalledWith("warn", expect.stringContaining("80%"));
  });

  it("logs error when limit exceeded", () => {
    const logFn = vi.fn();
    const limiter = new RateLimiter(2, logFn);
    limiter.recordCall();
    limiter.recordCall();

    try {
      limiter.recordCall();
    } catch {
      // expected
    }

    expect(logFn).toHaveBeenCalledWith("error", expect.stringContaining("exceeded"));
  });

  it("remaining calls decreases correctly", () => {
    const limiter = new RateLimiter(5);
    expect(limiter.getRemainingCalls()).toBe(5);
    limiter.recordCall();
    expect(limiter.getRemainingCalls()).toBe(4);
    limiter.recordCall();
    expect(limiter.getRemainingCalls()).toBe(3);
  });
});
