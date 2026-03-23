type LogFn = (level: "info" | "warn" | "error", message: string) => void;

/**
 * Simple rate limiter for LLM calls.
 * Tracks calls per minute and enforces a configurable max.
 */
export class RateLimiter {
  private maxCallsPerMinute: number;
  private callTimestamps: number[] = [];
  private log: LogFn;

  constructor(maxCallsPerMinute: number, log?: LogFn) {
    this.maxCallsPerMinute = maxCallsPerMinute;
    this.log = log ?? (() => {});
  }

  /** Check if a call is allowed. Returns true if within limits. */
  canCall(): boolean {
    this.pruneOldTimestamps();
    return this.callTimestamps.length < this.maxCallsPerMinute;
  }

  /** Record a call. Throws if rate limit exceeded. */
  recordCall(): void {
    this.pruneOldTimestamps();

    if (this.callTimestamps.length >= this.maxCallsPerMinute) {
      this.log("error", `LLM rate limit exceeded: ${this.maxCallsPerMinute} calls/min`);
      throw new Error(`Rate limit exceeded: ${this.maxCallsPerMinute} calls per minute`);
    }

    this.callTimestamps.push(Date.now());

    const usage = this.callTimestamps.length / this.maxCallsPerMinute;
    if (usage >= 0.8) {
      this.log("warn", `LLM rate limiter at ${Math.round(usage * 100)}% (${this.callTimestamps.length}/${this.maxCallsPerMinute} calls/min)`);
    }
  }

  /** Get current usage as a fraction (0.0-1.0) */
  getUsage(): number {
    this.pruneOldTimestamps();
    return this.callTimestamps.length / this.maxCallsPerMinute;
  }

  /** Get remaining calls in the current window */
  getRemainingCalls(): number {
    this.pruneOldTimestamps();
    return Math.max(0, this.maxCallsPerMinute - this.callTimestamps.length);
  }

  private pruneOldTimestamps(): void {
    const oneMinuteAgo = Date.now() - 60_000;
    this.callTimestamps = this.callTimestamps.filter((t) => t > oneMinuteAgo);
  }
}
