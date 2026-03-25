/**
 * Interface for accessing agent state from chat-service.
 * Decouples chat-service from direct brain-loop dependency.
 */
export interface AgentStateProvider {
  getCurrentActivity(): string | null;
  getCurrentMood(): string;
  getRecentActivities(): Array<{ activity: string; completedSecondsAgo: number }>;
  getTickCount(): number;
  isRunning(): boolean;
}
