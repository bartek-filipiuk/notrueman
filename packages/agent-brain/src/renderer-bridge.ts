import type {
  RendererCommand,
  RendererCommandType,
  RendererCommands,
  InteractiveObjectId,
  ActivityType,
} from "@nts/shared";

/** Map activity types to their target room objects */
const ACTIVITY_OBJECT_MAP: Record<ActivityType, InteractiveObjectId> = {
  sleep: "bed",
  eat: "table_chair",
  read: "bookshelf",
  computer: "computer",
  exercise: "exercise_mat",
  think: "window",
  cook: "stove",
  draw: "easel",
};

/**
 * Handler interface that the renderer implements.
 * In-process for now, prepared for BullMQ later.
 */
export interface RendererHandler {
  moveTo(objectId: InteractiveObjectId): Promise<void>;
  playActivity(activity: string): void;
  showThought(text: string, mood: string): void;
  updateHUD(update: { mood?: string; activity?: string; time?: string }): void;
}

/**
 * Bridge between brain and renderer.
 * Translates high-level brain decisions into renderer commands.
 */
/** Max commands to keep in log to prevent unbounded memory growth */
const MAX_COMMAND_LOG_SIZE = 500;

export class RendererBridge {
  private handler: RendererHandler;
  private commandLog: RendererCommand[] = [];

  constructor(handler: RendererHandler) {
    this.handler = handler;
  }

  /** Execute a typed renderer command */
  async executeCommand<T extends RendererCommandType>(
    command: RendererCommand<T>,
  ): Promise<void> {
    this.commandLog.push(command as RendererCommand);
    // Cap log to prevent unbounded memory growth in long-running sessions
    if (this.commandLog.length > MAX_COMMAND_LOG_SIZE) {
      this.commandLog = this.commandLog.slice(-MAX_COMMAND_LOG_SIZE);
    }

    switch (command.type) {
      case "move_to": {
        const payload = command.payload as RendererCommands["move_to"];
        await this.handler.moveTo(payload.objectId);
        break;
      }
      case "play_animation": {
        const payload = command.payload as RendererCommands["play_animation"];
        this.handler.playActivity(payload.state);
        break;
      }
      case "show_bubble": {
        const payload = command.payload as RendererCommands["show_bubble"];
        this.handler.showThought(payload.text, payload.mood);
        break;
      }
      case "update_hud": {
        const payload = command.payload as RendererCommands["update_hud"];
        this.handler.updateHUD(payload);
        break;
      }
      case "set_object_state":
        // No-op for now, will be used later for object interactions
        break;
    }
  }

  /** Execute a brain action: move to object, play activity, show thought, update HUD */
  async executeAction(
    activity: ActivityType,
    thought: string,
    mood: string,
  ): Promise<void> {
    const objectId = ACTIVITY_OBJECT_MAP[activity];

    // 1. Update HUD
    await this.executeCommand({
      type: "update_hud",
      payload: { activity, mood },
    });

    // 2. Move to target object
    await this.executeCommand({
      type: "move_to",
      payload: { objectId },
    });

    // 3. Play activity animation
    await this.executeCommand({
      type: "play_animation",
      payload: { state: activity },
    });

    // 4. Show thought bubble
    if (thought) {
      await this.executeCommand({
        type: "show_bubble",
        payload: { text: thought, type: "thought", mood },
      });
    }
  }

  /** Get the activity → object mapping */
  static getObjectForActivity(activity: ActivityType): InteractiveObjectId {
    return ACTIVITY_OBJECT_MAP[activity];
  }

  /** Get command log (for testing/debugging) */
  getCommandLog(): ReadonlyArray<RendererCommand> {
    return this.commandLog;
  }

  /** Clear command log */
  clearCommandLog(): void {
    this.commandLog = [];
  }
}
