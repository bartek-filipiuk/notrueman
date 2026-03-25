import Phaser from "phaser";
import { ActivitySceneBase } from "./ActivitySceneBase";

export class ReadScene extends ActivitySceneBase {
  protected bgKey = "scene_read_bg";
  protected label = "reading...";
  protected labelColor = "#ce93d8";

  constructor() { super({ key: "ReadScene" }); }

  protected addOverlays(): void {
    // Page turn text (changes every few seconds)
    const quotes = [
      '"The unexamined life\nis not worth living."',
      '"I think, therefore\nI am."',
      '"To be or not to be,\nthat is the question."',
      '"The only true wisdom\nis knowing you\nknow nothing."',
    ];
    let qi = 0;
    const quote = this.add.text(300, 400, quotes[0], { fontSize: "6px", fontFamily: "'Press Start 2P', monospace", color: "#d4c5a9", lineSpacing: 3 }).setAlpha(0.5);
    this.time.addEvent({ delay: 4000, loop: true, callback: () => { qi = (qi + 1) % quotes.length; this.tweens.add({ targets: quote, alpha: 0, duration: 300, onComplete: () => { quote.setText(quotes[qi]); this.tweens.add({ targets: quote, alpha: 0.5, duration: 300 }); } }); } });

    // Lamp warm glow
    const lamp = this.add.circle(200, 200, 50, 0xffa726, 0.04).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: lamp, alpha: { from: 0.03, to: 0.06 }, duration: 3000, yoyo: true, repeat: -1 });

    // Dust in lamplight
    this.makeParticle("read_dust", 0xffd54f, 0.6, 2);
    this.add.particles(220, 180, "read_dust", { speed: { min: 1, max: 4 }, angle: { min: 160, max: 200 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.3, end: 0 }, lifespan: 4000, frequency: 1000, quantity: 1, blendMode: Phaser.BlendModes.ADD });
  }
}
