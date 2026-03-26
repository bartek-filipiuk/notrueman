/**
 * BudgetManager — tracks daily tool call budget.
 * Hard-blocks calls when budget exceeded.
 * Daily reset at midnight UTC.
 */
export class BudgetManager {
  private maxCallsPerDay: number;
  private callsToday = 0;
  private lastResetDate: string; // "YYYY-MM-DD" in UTC

  constructor(maxCallsPerDay = 20) {
    this.maxCallsPerDay = maxCallsPerDay;
    this.lastResetDate = this.getTodayUTC();
  }

  /** Track a tool call. Returns false if budget exceeded (hard block). */
  trackCall(toolName: string, cost = 1): boolean {
    this.checkDailyReset();
    if (this.callsToday + cost > this.maxCallsPerDay) {
      console.warn(`[BUDGET] BLOCKED: ${toolName} — budget exceeded (${this.callsToday}/${this.maxCallsPerDay})`);
      return false;
    }
    this.callsToday += cost;
    console.log(`[BUDGET] ${this.callsToday}/${this.maxCallsPerDay} calls used after ${toolName}`);
    return true;
  }

  /** Get remaining budget */
  getRemainingBudget(): { callsLeft: number; totalCalls: number } {
    this.checkDailyReset();
    return {
      callsLeft: Math.max(0, this.maxCallsPerDay - this.callsToday),
      totalCalls: this.maxCallsPerDay,
    };
  }

  /** Check if a tool call is within budget */
  isWithinBudget(cost = 1): boolean {
    this.checkDailyReset();
    return this.callsToday + cost <= this.maxCallsPerDay;
  }

  /** Get calls used today */
  getCallsUsed(): number {
    this.checkDailyReset();
    return this.callsToday;
  }

  /** Reset if day changed (midnight UTC) */
  private checkDailyReset(): void {
    const today = this.getTodayUTC();
    if (today !== this.lastResetDate) {
      this.callsToday = 0;
      this.lastResetDate = today;
      console.log("[BUDGET] Daily reset — budget refreshed");
    }
  }

  private getTodayUTC(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
