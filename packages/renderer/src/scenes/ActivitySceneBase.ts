import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";

/** Tool result data passed from brain context */
export interface SceneToolResult {
  tool: string;
  query?: string;
  title?: string;
  content?: string;
  description?: string;
}

/** Brain context passed to activity scenes */
export interface SceneContext {
  thought?: string;
  reason?: string;
  mood?: string;
  toolResults?: SceneToolResult[];
  recentMemory?: string;
}

export interface ActivitySceneData {
  duration: number;
  mood: string;
  onComplete: () => void;
  context?: SceneContext;
}

/** Mood → tint color mapping for subtle scene coloring */
const MOOD_TINT_MAP: Record<string, number> = {
  happy: 0xffd700,       // warm gold
  curious: 0x00bcd4,     // cyan
  anxious: 0xff4444,     // red
  excited: 0xffeb3b,     // bright yellow
  content: 0x4caf50,     // green
  frustrated: 0xff9800,  // orange
  bored: 0x9e9e9e,       // grey
  contemplative: 0x7986cb, // muted blue
  neutral: 0xffffff,     // no tint
};

/**
 * Base class for activity close-up scenes.
 * Handles: background loading, fade in/out, timer, cleanup, brain context display.
 * Subclasses override addOverlays() for activity-specific effects.
 * Subclasses can override displayContent() for custom brain context rendering.
 */
export abstract class ActivitySceneBase extends Phaser.Scene {
  protected duration = 12000;
  protected onComplete: (() => void) | null = null;
  protected context: SceneContext | null = null;
  private activityTimer?: Phaser.Time.TimerEvent;
  protected abstract bgKey: string;
  protected abstract label: string;
  protected abstract labelColor: string;

  init(data: ActivitySceneData): void {
    this.duration = data?.duration || 12000;
    this.onComplete = data?.onComplete || null;
    this.context = data?.context || null;
  }

  create(): void {
    // Background
    if (this.textures.exists(this.bgKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.bgKey)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.cameras.main.setBackgroundColor("#1a1a2e");
    }

    // Mood tint overlay (subtle 10-15%)
    this.applyMoodTint();

    // Activity-specific overlays
    this.addOverlays();

    // Dynamic content from brain context
    if (this.context) {
      this.displayContent(this.context);
    }

    // HUD label
    this.add.text(GAME_WIDTH - 16, 12, this.label, {
      fontSize: "8px",
      fontFamily: "'Press Start 2P', monospace",
      color: this.labelColor,
    }).setOrigin(1, 0).setAlpha(0.4);

    // Fade in
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // End timer
    this.activityTimer = this.time.delayedCall(this.duration, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.onComplete?.();
      });
    });
  }

  /** Apply a subtle mood-based tint overlay (10-15% alpha) */
  private applyMoodTint(): void {
    const mood = this.context?.mood;
    if (!mood || mood === "neutral") return;

    const tintColor = MOOD_TINT_MAP[mood] ?? MOOD_TINT_MAP.neutral;
    if (tintColor === 0xffffff) return;

    const tintOverlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      tintColor, 0.12,
    ).setBlendMode(Phaser.BlendModes.ADD);

    // Subtle pulse
    this.tweens.add({
      targets: tintOverlay,
      alpha: { from: 0.10, to: 0.15 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Display brain context on the scene. Default: thought text bar at bottom.
   * Subclasses can override for custom rendering.
   */
  protected displayContent(context: SceneContext): void {
    if (!context.thought) return;

    // Semi-transparent bar at bottom
    const barY = GAME_HEIGHT - 50;
    const barHeight = 45;
    this.add.rectangle(
      GAME_WIDTH / 2, barY + barHeight / 2,
      GAME_WIDTH * 0.85, barHeight,
      0x000000, 0.5,
    ).setOrigin(0.5, 0.5);

    // Truncate thought to ~120 chars for display
    const displayText = context.thought.length > 120
      ? context.thought.substring(0, 117) + "..."
      : context.thought;

    this.add.text(GAME_WIDTH / 2, barY + barHeight / 2, displayText, {
      fontSize: "11px",
      fontFamily: "Inter, 'Segoe UI', sans-serif",
      color: "#e0e0e0",
      wordWrap: { width: GAME_WIDTH * 0.80 },
      align: "center",
      lineSpacing: 2,
    }).setOrigin(0.5, 0.5).setAlpha(0.9);
  }

  /** Override to add activity-specific visual effects */
  protected abstract addOverlays(): void;

  /** Helper: create a particle texture */
  protected makeParticle(key: string, color: number, alpha = 0.5, size = 2): void {
    const g = this.add.graphics();
    g.fillStyle(color, alpha);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  shutdown(): void {
    this.activityTimer?.destroy();
  }
}
