/** Awakening arc phases (agent-spec.md S7.3) */
export type AwakeningPhase =
  | "unaware" // 0.0-0.15
  | "subtle" // 0.15-0.35
  | "pattern" // 0.35-0.55
  | "questioning" // 0.55-0.75
  | "exploring"; // 0.75-1.0

/** Awakening arc state (agent-spec.md S7.1) */
export interface AwakeningState {
  suspicionLevel: number; // 0.0-1.0 (starts at 0.0)
  anomalyExposure: number; // Counter of unexplained events observed
  anomalyLog: AnomalyEvent[];
  lastSuspicionUpdate: Date;
  phase: AwakeningPhase;
}

/** Individual anomaly event (agent-spec.md S7.1) */
export interface AnomalyEvent {
  id: string;
  description: string; // "Food appeared in fridge that I didn't buy"
  severity: number; // 0.1-1.0
  timestamp: Date;
  trumanReaction: string; // How Truman processed it
  dismissed: boolean; // Did Truman rationalize it away?
}
