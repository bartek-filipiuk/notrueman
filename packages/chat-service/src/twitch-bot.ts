/**
 * Main Twitch bot class.
 * Wires together: Twurple chat client, commands, sanitizer, votes, channel points.
 */
import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { ApiClient } from "@twurple/api";
import { z } from "zod";
import type { ViewerEvent } from "@nts/shared";
import type { AgentStateProvider } from "./agent-state-provider.js";
import { sanitize } from "./sanitizer.js";
import { dispatchCommand } from "./commands.js";
import { dispatchReward } from "./channel-points.js";
import { VoteAggregator, type VoteResult } from "./votes.js";

/** Zod schema for bot config — validates env vars at boundary */
export const TwitchBotConfigSchema = z.object({
  clientId: z.string().min(1, "TWITCH_CLIENT_ID required"),
  clientSecret: z.string().min(1, "TWITCH_CLIENT_SECRET required"),
  accessToken: z.string().min(1, "TWITCH_ACCESS_TOKEN required"),
  refreshToken: z.string().min(1, "TWITCH_REFRESH_TOKEN required"),
  channel: z.string().min(1, "Twitch channel name required"),
  botUserId: z.string().min(1, "Bot user ID required"),
});

export type TwitchBotConfig = z.infer<typeof TwitchBotConfigSchema>;

type LogFn = (level: "info" | "warn" | "error", msg: string) => void;

const defaultLog: LogFn = (level, msg) => {
  const prefix = `[twitch-bot:${level}]`;
  if (level === "error") console.error(prefix, msg);
  else if (level === "warn") console.warn(prefix, msg);
  else console.log(prefix, msg);
};

export class TwitchBot {
  private config: TwitchBotConfig;
  private stateProvider: AgentStateProvider;
  private log: LogFn;

  private authProvider: RefreshingAuthProvider | null = null;
  private apiClient: ApiClient | null = null;
  private chatClient: ChatClient | null = null;
  private eventSub: EventSubWsListener | null = null;
  private voteAggregator: VoteAggregator;

  /** Callback for viewer events (channel points, letters, votes) */
  private onViewerEvent: ((event: ViewerEvent) => void) | null = null;

  /** Cooldown tracking per command per user (ms) */
  private cooldowns = new Map<string, number>();
  private readonly COOLDOWN_MS = 5_000;

  constructor(
    config: TwitchBotConfig,
    stateProvider: AgentStateProvider,
    options?: {
      log?: LogFn;
      onViewerEvent?: (event: ViewerEvent) => void;
    },
  ) {
    this.config = config;
    this.stateProvider = stateProvider;
    this.log = options?.log ?? defaultLog;
    this.onViewerEvent = options?.onViewerEvent ?? null;
    this.voteAggregator = new VoteAggregator();
  }

  /** Initialize auth, chat client, and EventSub listener. */
  async start(): Promise<void> {
    this.log("info", `Connecting to Twitch channel: ${this.config.channel}`);

    // Auth
    this.authProvider = new RefreshingAuthProvider({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
    });

    this.authProvider.addUser(this.config.botUserId, {
      accessToken: this.config.accessToken,
      refreshToken: this.config.refreshToken,
      expiresIn: 0,
      obtainmentTimestamp: 0,
    }, ["chat"]);

    // API client
    this.apiClient = new ApiClient({ authProvider: this.authProvider });

    // Chat client
    this.chatClient = new ChatClient({
      authProvider: this.authProvider,
      channels: [this.config.channel],
    });

    this.chatClient.onMessage((channel, user, text, msg) => {
      this.handleMessage(channel, user, text, msg.userInfo.userId).catch(
        (err) => this.log("error", `Message handler error: ${err}`),
      );
    });

    this.chatClient.onConnect(() => {
      this.log("info", "Connected to Twitch chat");
    });

    this.chatClient.onDisconnect((_manually: boolean, reason: Error | undefined) => {
      this.log("warn", `Disconnected from chat: ${reason ?? "unknown"}`);
    });

    await this.chatClient.connect();

    // EventSub for channel points
    this.eventSub = new EventSubWsListener({
      apiClient: this.apiClient,
    });

    try {
      const broadcaster = await this.apiClient.users.getUserByName(this.config.channel);
      if (broadcaster) {
        this.eventSub.onChannelRedemptionAdd(broadcaster.id, (event: { rewardTitle: string; userId: string; userDisplayName: string; input: string }) => {
          this.handleRedemption(
            event.rewardTitle,
            event.userId,
            event.userDisplayName,
            event.input,
          ).catch((err) =>
            this.log("error", `Redemption handler error: ${err}`),
          );
        });
      }
      this.eventSub.start();
      this.log("info", "EventSub listener started");
    } catch (err) {
      this.log("warn", `EventSub setup failed (channel points won't work): ${err}`);
    }

    this.log("info", "Twitch bot started successfully");
  }

  /** Handle incoming chat message. */
  async handleMessage(
    channel: string,
    user: string,
    text: string,
    userId: string,
  ): Promise<void> {
    // Sanitize
    const result = sanitize(text);
    if (!result.safe) {
      this.log("info", `Blocked message from ${user}: ${result.reason}`);
      return;
    }

    const cleaned = result.cleaned;

    // Check if it's a command
    if (cleaned.startsWith("!")) {
      // Cooldown check
      const cooldownKey = `${userId}:${cleaned.split(" ")[0]}`;
      const now = Date.now();
      const lastUsed = this.cooldowns.get(cooldownKey) ?? 0;
      if (now - lastUsed < this.COOLDOWN_MS) return;
      this.cooldowns.set(cooldownKey, now);

      // Handle !vote specially
      if (cleaned.toLowerCase().startsWith("!vote ")) {
        this.handleVoteCommand(userId, user, cleaned);
        return;
      }

      // Handle !startvote (mod/broadcaster only)
      if (cleaned.toLowerCase() === "!startvote") {
        this.handleStartVote(channel);
        return;
      }

      const cmdResult = dispatchCommand(
        cleaned.split(" ")[0],
        this.stateProvider,
      );
      if (cmdResult) {
        this.say(channel, cmdResult.response);
      }
      return;
    }
  }

  /** Handle a channel points redemption. */
  async handleRedemption(
    rewardTitle: string,
    userId: string,
    displayName: string,
    input: string,
  ): Promise<void> {
    // Sanitize the input text
    const sanitized = sanitize(input);
    if (!sanitized.safe) {
      this.log("info", `Blocked redemption input from ${displayName}: ${sanitized.reason}`);
      return;
    }

    const result = dispatchReward(rewardTitle, userId, displayName, sanitized.cleaned);
    if (!result) {
      this.log("info", `Unknown reward: ${rewardTitle}`);
      return;
    }

    if (result.accepted && result.event) {
      this.onViewerEvent?.(result.event);
      this.say(this.config.channel, result.message);
    } else {
      this.say(this.config.channel, result.message);
    }
  }

  /** Start a vote. */
  private handleStartVote(channel: string): void {
    const started = this.voteAggregator.startVote((voteResult: VoteResult) => {
      this.announceVoteResult(channel, voteResult);
    });

    if (started) {
      const remaining = this.voteAggregator.getRemainingSeconds();
      this.say(
        channel,
        `📊 Vote started! What should Truman do next? Type !vote <activity> (${remaining}s). Options: read, computer, exercise, cook, draw, think`,
      );
    } else {
      this.say(channel, "A vote is already in progress!");
    }
  }

  /** Handle a !vote command. */
  private handleVoteCommand(userId: string, displayName: string, text: string): void {
    const option = text.replace(/^!vote\s+/i, "").trim();
    const feedback = this.voteAggregator.castVote(userId, displayName, option);
    this.say(this.config.channel, feedback);
  }

  /** Announce vote results. */
  private announceVoteResult(channel: string, result: VoteResult): void {
    if (result.reason === "no_votes") {
      this.say(channel, "📊 Vote ended — no votes were cast.");
      return;
    }
    if (result.reason === "below_minimum") {
      this.say(
        channel,
        `📊 Vote ended — not enough votes (${result.totalVotes}). Truman will decide on his own!`,
      );
      return;
    }

    const talliesStr = Object.entries(result.tallies)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([opt, count]) => `${opt}: ${count}`)
      .join(", ");

    this.say(
      channel,
      `📊 Vote result: "${result.winner}" wins! (${talliesStr}) Total: ${result.totalVotes} votes.`,
    );

    // Emit as viewer event
    if (result.winner) {
      const event: ViewerEvent = {
        id: `vote-${Date.now()}`,
        platform: "twitch",
        type: "chat_vote",
        userId: "aggregate",
        displayName: "Chat Vote",
        content: result.winner,
        metadata: { tallies: result.tallies, totalVotes: result.totalVotes },
        timestamp: new Date(),
      };
      this.onViewerEvent?.(event);
    }
  }

  /** Send a message to chat. */
  private say(channel: string, message: string): void {
    this.chatClient?.say(channel, message).catch((err: unknown) => {
      this.log("error", `Failed to send message: ${err}`);
    });
  }

  /** Stop the bot and clean up. */
  async stop(): Promise<void> {
    this.voteAggregator.destroy();
    this.eventSub?.stop();
    this.chatClient?.quit();
    this.log("info", "Twitch bot stopped");
  }
}
