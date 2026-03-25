/**
 * Vote aggregation system with configurable time windows.
 * Viewers vote for an activity, and when the window closes the winner is resolved.
 */

export interface VoteConfig {
  /** Duration of a vote window in ms (default: 60_000 = 1 minute) */
  windowDurationMs: number;
  /** Minimum votes required for a valid result (default: 3) */
  minVotes: number;
  /** Allowed vote options */
  allowedOptions: string[];
}

export interface VoteSession {
  startedAt: number;
  endsAt: number;
  votes: Map<string, string>; // userId -> option (1 vote per user)
  tallies: Map<string, number>; // option -> count
}

export interface VoteResult {
  winner: string | null;
  totalVotes: number;
  tallies: Record<string, number>;
  reason: "winner" | "no_votes" | "below_minimum";
}

const DEFAULT_CONFIG: VoteConfig = {
  windowDurationMs: 60_000,
  minVotes: 3,
  allowedOptions: ["read", "computer", "exercise", "cook", "draw", "think"],
};

export class VoteAggregator {
  private config: VoteConfig;
  private session: VoteSession | null = null;
  private onResolve: ((result: VoteResult) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<VoteConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Start a new vote window. Returns false if one is already active. */
  startVote(onResolve: (result: VoteResult) => void): boolean {
    if (this.session) return false;

    const now = Date.now();
    this.session = {
      startedAt: now,
      endsAt: now + this.config.windowDurationMs,
      votes: new Map(),
      tallies: new Map(),
    };
    this.onResolve = onResolve;

    this.timer = setTimeout(() => {
      this.resolveVote();
    }, this.config.windowDurationMs);

    return true;
  }

  /** Cast a vote. Returns feedback message. */
  castVote(userId: string, displayName: string, option: string): string {
    if (!this.session) {
      return "No vote is active right now.";
    }

    const normalized = option.toLowerCase().trim();
    if (!this.config.allowedOptions.includes(normalized)) {
      return `Invalid option. Choose from: ${this.config.allowedOptions.join(", ")}`;
    }

    const previousVote = this.session.votes.get(userId);
    if (previousVote) {
      // Update previous vote
      const oldTally = this.session.tallies.get(previousVote) ?? 0;
      this.session.tallies.set(previousVote, Math.max(0, oldTally - 1));
    }

    this.session.votes.set(userId, normalized);
    this.session.tallies.set(
      normalized,
      (this.session.tallies.get(normalized) ?? 0) + 1,
    );

    const remaining = Math.ceil(
      (this.session.endsAt - Date.now()) / 1000,
    );
    return `${displayName} voted for "${normalized}"! ${remaining}s remaining.`;
  }

  /** Check if a vote is currently active. */
  isActive(): boolean {
    return this.session !== null;
  }

  /** Get current tallies (for display). */
  getTallies(): Record<string, number> {
    if (!this.session) return {};
    return Object.fromEntries(this.session.tallies);
  }

  /** Get remaining seconds. */
  getRemainingSeconds(): number {
    if (!this.session) return 0;
    return Math.max(0, Math.ceil((this.session.endsAt - Date.now()) / 1000));
  }

  /** Resolve the vote immediately (also called by timer). */
  resolveVote(): VoteResult {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.session) {
      return { winner: null, totalVotes: 0, tallies: {}, reason: "no_votes" };
    }

    const tallies = Object.fromEntries(this.session.tallies);
    const totalVotes = this.session.votes.size;

    let result: VoteResult;

    if (totalVotes === 0) {
      result = { winner: null, totalVotes: 0, tallies, reason: "no_votes" };
    } else if (totalVotes < this.config.minVotes) {
      result = { winner: null, totalVotes, tallies, reason: "below_minimum" };
    } else {
      // Find winner (highest tally)
      let maxVotes = 0;
      let winner: string | null = null;
      for (const [option, count] of Object.entries(tallies)) {
        if (count > maxVotes) {
          maxVotes = count;
          winner = option;
        }
      }
      result = { winner, totalVotes, tallies, reason: "winner" };
    }

    this.session = null;
    this.onResolve?.(result);
    this.onResolve = null;

    return result;
  }

  /** Clean up resources. */
  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.session = null;
    this.onResolve = null;
  }
}
