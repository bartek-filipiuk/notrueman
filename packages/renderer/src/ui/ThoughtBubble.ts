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

/**
 * Thought bubble system: renders a cloud-shaped bubble above Truman with typewriter effect.
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
  private isVisible = false;

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
  }

  /**
   * Show a thought bubble with typewriter effect.
   * @param text The thought text
   * @param mood Current mood (for color styling)
   * @param anchorX X position to anchor the bubble
   * @param anchorY Y position to anchor the bubble
   */
  showThought(text: string, mood: string, anchorX: number, anchorY: number): void {
    this.hide();

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

    // Draw tail dots (leading to Truman's head)
    this.drawTail(style.bubbleColor, anchorY + BUBBLE_OFFSET_Y + 20, anchorY - 10);

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
            this.scene.tweens.add({
              targets: this.container,
              alpha: 0,
              duration: BUBBLE_FADE_MS,
              onComplete: () => {
                this.isVisible = false;
              },
            });
          });
        }
      },
    });
  }

  /** Immediately hide the bubble */
  hide(): void {
    this.typewriterTimer?.destroy();
    this.typewriterTimer = undefined;
    this.fadeTimer?.destroy();
    this.fadeTimer = undefined;
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
