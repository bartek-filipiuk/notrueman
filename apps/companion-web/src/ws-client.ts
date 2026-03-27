/**
 * WebSocket client with auto-reconnect for the mind feed.
 * Exponential backoff: 1s, 2s, 4s, ... max 30s.
 */

export interface MindFeedClientEvent {
  type: string;
  timestamp?: number;
  data: Record<string, unknown>;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface MindFeedClientOptions {
  /** WebSocket URL, e.g. ws://localhost:3001/ws/mind-feed */
  url: string;
  /** Called on each parsed event */
  onEvent: (event: MindFeedClientEvent) => void;
  /** Called when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Max reconnect delay in ms (default 30000) */
  maxReconnectDelay?: number;
  /** Initial reconnect delay in ms (default 1000) */
  initialReconnectDelay?: number;
}

export class MindFeedClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onEvent: (event: MindFeedClientEvent) => void;
  private onStatusChange: (status: ConnectionStatus) => void;
  private maxDelay: number;
  private initialDelay: number;
  private reconnectDelay: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private _status: ConnectionStatus = "disconnected";

  constructor(options: MindFeedClientOptions) {
    this.url = options.url;
    this.onEvent = options.onEvent;
    this.onStatusChange = options.onStatusChange ?? (() => {});
    this.maxDelay = options.maxReconnectDelay ?? 30_000;
    this.initialDelay = options.initialReconnectDelay ?? 1_000;
    this.reconnectDelay = this.initialDelay;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.onStatusChange(status);
  }

  connect(): void {
    this.intentionalClose = false;
    this.doConnect();
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  private doConnect(): void {
    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.setStatus("connected");
      this.reconnectDelay = this.initialDelay;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(event.data)) as MindFeedClientEvent;
        this.onEvent(parsed);
      } catch {
        // Ignore unparseable messages
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.intentionalClose) {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
  }
}

/** Helper to compute backoff delay for a given attempt (for testing) */
export function computeBackoff(
  attempt: number,
  initial: number = 1000,
  max: number = 30000,
): number {
  return Math.min(initial * Math.pow(2, attempt), max);
}
