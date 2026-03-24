/** Get human-readable time of day based on current hour */
export function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Async sleep utility */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
