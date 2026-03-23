/** Platform source (interaction-spec.md S5.1) */
export type Platform = "twitch" | "youtube";

/** Viewer event types (interaction-spec.md S5.2) */
export type ViewerEventType =
  | "chat_vote"
  | "channel_points"
  | "poll_vote"
  | "letter"
  | "headline";

/** Unified viewer event (interaction-spec.md S5.2) */
export interface ViewerEvent {
  id: string;
  platform: Platform;
  type: ViewerEventType;
  userId: string;
  displayName: string;
  content: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}
