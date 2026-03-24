export interface CostTrackerConfig {
  dailyCapUsd: number;
  onWarning?: (info: { percentage: number; spend: number; cap: number }) => void;
}

/**
 * Daily LLM cost tracker (S4.3).
 * Tracks cumulative daily spend, warns at 80%, hard stop at 100%.
 */
export class CostTracker {
  private dailyCapUsd: number;
  private dailySpendUsd = 0;
  private warningEmitted = false;
  private onWarning?: CostTrackerConfig["onWarning"];

  constructor(config: CostTrackerConfig) {
    this.dailyCapUsd = config.dailyCapUsd;
    this.onWarning = config.onWarning;
  }

  /** Record spending in USD */
  recordSpend(amountUsd: number): void {
    this.dailySpendUsd += amountUsd;

    const pct = this.getCapPercentage();
    if (pct >= 80 && !this.warningEmitted) {
      this.warningEmitted = true;
      this.onWarning?.({
        percentage: pct,
        spend: this.dailySpendUsd,
        cap: this.dailyCapUsd,
      });
    }
  }

  /** Can we afford another LLM call? */
  canSpend(): boolean {
    return this.dailySpendUsd < this.dailyCapUsd;
  }

  /** Is the daily cap reached? */
  isCapReached(): boolean {
    return this.dailySpendUsd >= this.dailyCapUsd;
  }

  /** Get current daily spend */
  getDailySpend(): number {
    return this.dailySpendUsd;
  }

  /** Get cap usage as percentage */
  getCapPercentage(): number {
    return (this.dailySpendUsd / this.dailyCapUsd) * 100;
  }

  /** Reset daily counter (call at midnight or new day) */
  resetDaily(): void {
    this.dailySpendUsd = 0;
    this.warningEmitted = false;
  }
}
