import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VoteAggregator } from "../votes.js";

describe("VoteAggregator", () => {
  let aggregator: VoteAggregator;

  beforeEach(() => {
    vi.useFakeTimers();
    aggregator = new VoteAggregator({
      windowDurationMs: 10_000,
      minVotes: 2,
      allowedOptions: ["read", "computer", "exercise"],
    });
  });

  afterEach(() => {
    aggregator.destroy();
    vi.useRealTimers();
  });

  it("starts a vote session", () => {
    const cb = vi.fn();
    expect(aggregator.startVote(cb)).toBe(true);
    expect(aggregator.isActive()).toBe(true);
  });

  it("prevents starting duplicate votes", () => {
    aggregator.startVote(vi.fn());
    expect(aggregator.startVote(vi.fn())).toBe(false);
  });

  it("accepts valid votes", () => {
    aggregator.startVote(vi.fn());
    const msg = aggregator.castVote("user1", "User1", "read");
    expect(msg).toContain("voted");
    expect(msg).toContain("read");
  });

  it("rejects invalid options", () => {
    aggregator.startVote(vi.fn());
    const msg = aggregator.castVote("user1", "User1", "sleep");
    expect(msg).toContain("Invalid");
  });

  it("allows changing votes (1 vote per user)", () => {
    aggregator.startVote(vi.fn());
    aggregator.castVote("user1", "User1", "read");
    aggregator.castVote("user1", "User1", "computer");

    const tallies = aggregator.getTallies();
    expect(tallies["read"]).toBe(0);
    expect(tallies["computer"]).toBe(1);
  });

  it("resolves with winner when enough votes", () => {
    const cb = vi.fn();
    aggregator.startVote(cb);

    aggregator.castVote("user1", "User1", "read");
    aggregator.castVote("user2", "User2", "read");
    aggregator.castVote("user3", "User3", "computer");

    vi.advanceTimersByTime(10_001);

    expect(cb).toHaveBeenCalledOnce();
    const result = cb.mock.calls[0][0];
    expect(result.winner).toBe("read");
    expect(result.totalVotes).toBe(3);
    expect(result.reason).toBe("winner");
  });

  it("resolves with below_minimum when not enough votes", () => {
    const cb = vi.fn();
    aggregator.startVote(cb);

    aggregator.castVote("user1", "User1", "read");

    vi.advanceTimersByTime(10_001);

    const result = cb.mock.calls[0][0];
    expect(result.winner).toBeNull();
    expect(result.reason).toBe("below_minimum");
  });

  it("resolves with no_votes when empty", () => {
    const cb = vi.fn();
    aggregator.startVote(cb);

    vi.advanceTimersByTime(10_001);

    const result = cb.mock.calls[0][0];
    expect(result.reason).toBe("no_votes");
  });

  it("returns no vote message when not active", () => {
    const msg = aggregator.castVote("user1", "User1", "read");
    expect(msg).toContain("No vote");
  });

  it("manual resolve clears session", () => {
    aggregator.startVote(vi.fn());
    aggregator.resolveVote();
    expect(aggregator.isActive()).toBe(false);
  });
});
