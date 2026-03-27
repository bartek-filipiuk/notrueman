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
    // Clean stale overlays from any previous scene
    document.querySelectorAll(".scene-html-overlay, #scene-text-overlay").forEach(el => el.remove());

    this.duration = data?.duration || 12000;
    this.onComplete = data?.onComplete || null;
    this.context = data?.context || null;
  }

  create(): void {
    // Aggressively clean up any leftover HTML overlays from previous scenes
    this.cleanupAllOverlays();

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

    // Cleanup all HTML overlays when scene stops (belt-and-suspenders)
    this.events.once("shutdown", () => this.cleanupAllOverlays());
    this.events.once("destroy", () => this.cleanupAllOverlays());

    // End timer
    this.activityTimer = this.time.delayedCall(this.duration, () => {
      // Fade out all overlays before scene transition
      this.fadeOutAllOverlays();
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.cleanupAllOverlays();
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

  /** HTML overlay element for crisp text rendering (bypasses canvas DPI limit) */
  private htmlOverlay: HTMLDivElement | null = null;

  /**
   * Display brain context via HTML overlay — renders at native screen DPI
   * so text is always crisp regardless of canvas resolution.
   */
  protected displayContent(context: SceneContext): void {
    if (!context.thought) return;

    // Create HTML overlay positioned over the game canvas
    this.htmlOverlay = document.createElement("div");
    this.htmlOverlay.id = "scene-text-overlay";
    this.htmlOverlay.style.cssText = `
      position: fixed;
      bottom: 8%;
      left: 50%;
      transform: translateX(-50%);
      max-width: 80%;
      padding: 14px 24px;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e8e8e8;
      font-family: 'Space Grotesk', Inter, sans-serif;
      font-size: 17px;
      font-weight: 400;
      line-height: 1.5;
      text-align: center;
      z-index: 500;
      opacity: 0;
      transition: opacity 0.6s ease;
      pointer-events: none;
    `;

    const displayText = context.thought.length > 180
      ? context.thought.substring(0, 177) + "..."
      : context.thought;

    this.htmlOverlay.textContent = displayText;
    document.body.appendChild(this.htmlOverlay);

    // Fade in
    requestAnimationFrame(() => {
      if (this.htmlOverlay) this.htmlOverlay.style.opacity = "1";
    });
  }

  /** Remove ALL HTML overlays (main + any subclass overlays) */
  protected cleanupAllOverlays(): void {
    if (this.htmlOverlay) {
      this.htmlOverlay.remove();
      this.htmlOverlay = null;
    }
    // Remove ALL scene overlays (covers subclass overlays like dream text)
    document.querySelectorAll(".scene-html-overlay, #scene-text-overlay").forEach(el => el.remove());
  }

  /** Fade out all overlays before scene exit */
  private fadeOutAllOverlays(): void {
    if (this.htmlOverlay) this.htmlOverlay.style.opacity = "0";
    document.querySelectorAll(".scene-html-overlay, #scene-text-overlay").forEach(el => {
      (el as HTMLElement).style.opacity = "0";
    });
  }

  /** Add a centered HTML text element (crisp, above canvas). Returns element for cleanup. */
  protected addHtmlText(text: string, opts: {
    top?: string; bottom?: string; color?: string; fontSize?: string;
    italic?: boolean; maxWidth?: string; animation?: string;
  } = {}): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "scene-html-overlay";
    el.style.cssText = `
      position: fixed;
      ${opts.top ? `top: ${opts.top};` : ""}
      ${opts.bottom ? `bottom: ${opts.bottom};` : ""}
      left: 50%;
      transform: translateX(-50%);
      max-width: ${opts.maxWidth || "70%"};
      padding: 8px 16px;
      color: ${opts.color || "#e0e0e0"};
      font-family: 'Space Grotesk', Inter, sans-serif;
      font-size: ${opts.fontSize || "16px"};
      ${opts.italic ? "font-style: italic;" : ""}
      line-height: 1.5;
      text-align: center;
      z-index: 501;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s ease;
      ${opts.animation || ""}
    `;
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; });
    return el;
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
    this.cleanupAllOverlays();
  }
}
