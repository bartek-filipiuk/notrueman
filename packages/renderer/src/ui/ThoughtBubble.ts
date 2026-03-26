import Phaser from "phaser";
import {
  TYPEWRITER_CHAR_MS,
  BUBBLE_DISPLAY_MS,
  BUBBLE_FADE_MS,
  MOOD_BUBBLE_STYLES,
} from "@nts/shared";

const BUBBLE_MAX_WIDTH = 280;
const BUBBLE_PADDING = 10;
const BUBBLE_OFFSET_Y = -50;
const TAIL_SIZE = 6;

/** Get border radius based on mood border style — exported for tests */
export function getBubbleBorderRadius(borderStyle: string): number {
  switch (borderStyle) {
    case "rounded":
      return 8;
    case "angular":
      return 3;
    case "wobbly":
      return 6;
    case "bouncy":
      return 10;
    case "sharp":
      return 0;
    case "minimal":
      return 4;
    default:
      return 8;
  }
}

/** Bubble type: thought (cloud tail) or speech (pointed tail) */
export type BubbleDisplayType = "thought" | "speech";

/**
 * Thought/Speech bubble system: renders a bubble above Truman with typewriter effect.
 * Thought: cloud-shaped tail (small circles). Speech: pointed balloon tail.
 * Color based on mood (visual-spec.md S7.3). Max 1 bubble at a time. Fade out after 8-10s.
 */
export class ThoughtBubble {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private textObj: Phaser.GameObjects.Text;
  private tailDots: Phaser.GameObjects.Graphics;

  private fullText = "";
  private displayedChars = 0;
  private typewriterTimer?: Phaser.Time.TimerEvent;
  private fadeTimer?: Phaser.Time.TimerEvent;
  private fadeTween?: Phaser.Tweens.Tween;
  private isVisible = false;
  private currentType: BubbleDisplayType = "thought";
  private speakingPulse?: Phaser.Tweens.Tween;
  private speakingGlow: Phaser.GameObjects.Graphics | null = null;
  private isSpeakingActive = false;

  /** Fired when a speech bubble starts displaying (for TTS sync) */
  onSpeechBubbleShow: ((text: string, mood: string) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0).setDepth(90).setAlpha(0);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.textObj = scene.add
      .text(0, 0, "", {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#333333",
        wordWrap: { width: BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2 },
      })
      .setOrigin(0.5, 0.5);
    this.container.add(this.textObj);

    this.tailDots = scene.add.graphics();
    this.container.add(this.tailDots);

    // Speaking glow overlay (pulsing border during TTS playback)
    this.speakingGlow = scene.add.graphics();
    this.speakingGlow.setAlpha(0);
    this.container.add(this.speakingGlow);
  }

  /**
   * Show a thought bubble with typewriter effect.
   * @param text The thought text
   * @param mood Current mood (for color styling)
   * @param anchorX X position to anchor the bubble
   * @param anchorY Y position to anchor the bubble
   */
  showThought(text: string, mood: string, anchorX: number, anchorY: number): void {
    this.showBubble(text, mood, anchorX, anchorY, "thought");
  }

  /**
   * Show a speech bubble with typewriter effect (pointed tail).
   * Triggers onSpeechBubbleShow callback for TTS sync.
   */
  showSpeech(text: string, mood: string, anchorX: number, anchorY: number): void {
    this.showBubble(text, mood, anchorX, anchorY, "speech");
    this.onSpeechBubbleShow?.(text, mood);
  }

  /** Internal: show a bubble of the given type */
  private showBubble(
    text: string,
    mood: string,
    anchorX: number,
    anchorY: number,
    type: BubbleDisplayType,
  ): void {
    this.hide();

    this.currentType = type;
    const style = MOOD_BUBBLE_STYLES[mood] ?? MOOD_BUBBLE_STYLES["contemplative"];

    this.fullText = text;
    this.displayedChars = 0;
    this.textObj.setText("");
    this.textObj.setColor(style.textColor);

    // Position above Truman
    const bubbleX = anchorX;
    const bubbleY = anchorY + BUBBLE_OFFSET_Y;
    this.container.setPosition(bubbleX, bubbleY);

    // Draw background with mood-specific border radius
    const borderRadius = getBubbleBorderRadius(style.border);
    this.drawBubbleBg(style.bubbleColor, text, borderRadius, style.border);

    // Draw tail (cloud dots for thought, pointed for speech)
    if (type === "speech") {
      this.drawSpeechTail(style.bubbleColor);
    } else {
      this.drawTail(style.bubbleColor, anchorY + BUBBLE_OFFSET_Y + 20, anchorY - 10);
    }

    this.container.setAlpha(1);
    this.isVisible = true;

    // Typewriter effect
    this.typewriterTimer = this.scene.time.addEvent({
      delay: TYPEWRITER_CHAR_MS,
      loop: true,
      callback: () => {
        this.displayedChars++;
        this.textObj.setText(this.fullText.substring(0, this.displayedChars));

        if (this.displayedChars >= this.fullText.length) {
          this.typewriterTimer?.destroy();
          this.typewriterTimer = undefined;

          // Start fade out after display duration
          this.fadeTimer = this.scene.time.delayedCall(BUBBLE_DISPLAY_MS, () => {
            this.fadeTween = this.scene.tweens.add({
              targets: this.container,
              alpha: 0,
              duration: BUBBLE_FADE_MS,
              onComplete: () => {
                this.isVisible = false;
                this.fadeTween = undefined;
              },
            });
          });
        }
      },
    });
  }

  /** Immediately hide the bubble and clean up all timers/tweens */
  hide(): void {
    this.typewriterTimer?.destroy();
    this.typewriterTimer = undefined;
    this.fadeTimer?.destroy();
    this.fadeTimer = undefined;
    this.fadeTween?.destroy();
    this.fadeTween = undefined;
    this.stopSpeakingPulse();
    this.container.setAlpha(0);
    this.isVisible = false;
    this.bg.clear();
    this.tailDots.clear();
    this.textObj.setText("");
  }

  /** Check if a bubble is currently visible */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Set speaking state — shows a pulsing glow on speech bubbles during TTS playback.
   * Called by RoomScene in response to TTSManager onSpeechStart/onSpeechEnd.
   */
  setSpeaking(speaking: boolean): void {
    this.isSpeakingActive = speaking;

    if (speaking && this.isVisible && this.currentType === "speech") {
      this.startSpeakingPulse();
    } else {
      this.stopSpeakingPulse();
    }
  }

  /** Whether speaking animation is active */
  getIsSpeaking(): boolean {
    return this.isSpeakingActive;
  }

  /** Start a pulsing glow effect on the speech bubble border */
  private startSpeakingPulse(): void {
    if (this.speakingPulse) return; // already pulsing
    if (!this.speakingGlow) return;

    // Draw a slightly larger border as glow
    this.speakingGlow.clear();
    this.speakingGlow.lineStyle(2, 0x4fc3f7, 0.6);
    // Approximate bubble bounds
    const charWidth = 6;
    const lineHeight = 14;
    const maxCharsPerLine = Math.floor((BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2) / charWidth);
    const lines = Math.ceil(this.fullText.length / maxCharsPerLine);
    const textWidth = Math.min(this.fullText.length * charWidth, BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2);
    const textHeight = lines * lineHeight;
    const w = textWidth + BUBBLE_PADDING * 2 + 4;
    const h = textHeight + BUBBLE_PADDING * 2 + 4;
    this.speakingGlow.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

    this.speakingGlow.setAlpha(0.5);

    // Pulse tween
    this.speakingPulse = this.scene.tweens.add({
      targets: this.speakingGlow,
      alpha: { from: 0.2, to: 0.7 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Stop the pulsing glow */
  private stopSpeakingPulse(): void {
    if (this.speakingPulse) {
      this.speakingPulse.destroy();
      this.speakingPulse = undefined;
    }
    if (this.speakingGlow) {
      this.speakingGlow.clear();
      this.speakingGlow.setAlpha(0);
    }
  }

  private drawBubbleBg(colorHex: string, text: string, borderRadius: number, borderStyle: string): void {
    this.bg.clear();
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;

    // Estimate text size
    const charWidth = 6;
    const lineHeight = 14;
    const maxCharsPerLine = Math.floor((BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2) / charWidth);
    const lines = Math.ceil(text.length / maxCharsPerLine);
    const textWidth = Math.min(text.length * charWidth, BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2);
    const textHeight = lines * lineHeight;

    const w = textWidth + BUBBLE_PADDING * 2;
    const h = textHeight + BUBBLE_PADDING * 2;

    // Bubble fill
    this.bg.fillStyle(color, 0.92);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, borderRadius);

    // Border style varies by mood
    const borderColor = borderStyle === "sharp" ? 0xff6666 : 0xcccccc;
    const borderAlpha = borderStyle === "minimal" ? 0.2 : 0.5;
    const borderWidth = borderStyle === "bouncy" ? 2 : 1;
    this.bg.lineStyle(borderWidth, borderColor, borderAlpha);
    this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, borderRadius);

    // Inner highlight for non-sharp styles (subtle depth)
    if (borderStyle !== "sharp" && borderStyle !== "minimal") {
      this.bg.fillStyle(0xffffff, 0.08);
      this.bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, 4, Math.max(borderRadius - 2, 0));
    }
  }

  /** Draw a pointed speech balloon tail (triangle pointing down to Truman) */
  private drawSpeechTail(colorHex: string): void {
    this.tailDots.clear();
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;

    // Pointed triangle from bubble bottom to Truman
    this.tailDots.fillStyle(color, 0.92);
    this.tailDots.fillTriangle(
      -6, 18,   // left point at bubble bottom
      6, 18,    // right point at bubble bottom
      0, 38,    // tip pointing down toward Truman
    );

    // Border on tail
    this.tailDots.lineStyle(1, 0xcccccc, 0.5);
    this.tailDots.strokeTriangle(
      -6, 18,
      6, 18,
      0, 38,
    );
  }

  private drawTail(colorHex: string, bubbleBottom: number, trumanHead: number): void {
    this.tailDots.clear();
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;

    // Three small circles leading from bubble to Truman
    this.tailDots.fillStyle(color, 0.8);
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / (steps + 1);
      const dotY = 20 + i * 8;
      const size = TAIL_SIZE - i * 1.5;
      this.tailDots.fillCircle(0, dotY, Math.max(size, 2));
    }
  }
}
