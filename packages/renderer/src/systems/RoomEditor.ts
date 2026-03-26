import Phaser from "phaser";
import { ROOM_OBJECTS, GAME_WIDTH, GAME_HEIGHT } from "@nts/shared";
import type { InteractiveObjectId } from "@nts/shared";

/**
 * Room Editor — drag & drop + resize furniture in browser.
 * Activated via ?edit=true URL param.
 *
 * Controls:
 * - Drag objects with mouse
 * - Mouse wheel on object = scale up/down
 * - Press P = print all positions to console (copy-paste into constants.ts)
 * - Press R = reset scale of selected object
 */
export class RoomEditor {
  private scene: Phaser.Scene;
  private objects: Map<InteractiveObjectId, Phaser.GameObjects.Image>;
  private selectedId: InteractiveObjectId | null = null;
  private label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    objects: Map<InteractiveObjectId, Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>,
  ) {
    this.scene = scene;
    this.objects = objects as Map<InteractiveObjectId, Phaser.GameObjects.Image>;

    // Status label
    this.label = scene.add.text(10, GAME_HEIGHT - 24, "EDIT MODE — drag, scroll=scale, shift+scroll=rotate, P=print", {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#00ff00",
      backgroundColor: "#000000aa",
      padding: { x: 4, y: 2 },
    }).setDepth(100).setScrollFactor(0);

    // Make all objects interactive + draggable
    for (const [id, obj] of this.objects.entries()) {
      if (!(obj instanceof Phaser.GameObjects.Image)) continue;
      if (obj.x < 0) continue; // skip off-screen placeholders

      obj.setInteractive({ draggable: true, cursor: "grab" });

      obj.on("dragstart", () => {
        this.selectedId = id;
        this.updateLabel();
      });

      obj.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        obj.x = Math.round(dragX);
        obj.y = Math.round(dragY);
        obj.setDepth(obj.y); // update depth sorting live
        this.updateLabel();
      });

      obj.on("dragend", () => {
        this.updateLabel();
        this.printSingle(id, obj);
      });
    }

    // Mouse wheel via DOM (Phaser wheel event has unreliable deltaY)
    const canvas = scene.game.canvas;
    canvas.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      const pointer = scene.input.activePointer;
      let target: { id: InteractiveObjectId; obj: Phaser.GameObjects.Image } | null = null;

      for (const [id, obj] of this.objects.entries()) {
        if (!(obj instanceof Phaser.GameObjects.Image)) continue;
        if (obj.x < 0) continue;
        const bounds = obj.getBounds();
        if (bounds.contains(pointer.x, pointer.y)) {
          target = { id, obj };
          break;
        }
      }

      if (target) {
        if (e.shiftKey) {
          // Shift + scroll = rotate by 15 degrees
          const rotDelta = e.deltaY > 0 ? 15 : -15;
          target.obj.angle = Math.round(target.obj.angle + rotDelta);
        } else {
          // Scroll = scale up/down (preserve aspect ratio)
          const scaleDelta = e.deltaY > 0 ? -0.03 : 0.03;
          const newScale = Math.max(0.05, target.obj.scaleX + scaleDelta);
          target.obj.setScale(newScale);
        }
        this.selectedId = target.id;
        this.updateLabel();
        this.printSingle(target.id, target.obj);
      }
    }, { passive: false });

    // P key = print all positions
    scene.input.keyboard?.on("keydown-P", () => {
      this.printAll();
    });

    console.log("%c[RoomEditor] EDIT MODE ACTIVE", "color: #00ff00; font-weight: bold");
    console.log("  Drag objects to position them");
    console.log("  Mouse wheel on object = scale");
    console.log("  P = print all positions for constants.ts");
  }

  private updateLabel(): void {
    if (!this.selectedId) return;
    const obj = this.objects.get(this.selectedId);
    if (!obj || !(obj instanceof Phaser.GameObjects.Image)) return;
    this.label.setText(
      `EDIT: ${this.selectedId} | x:${Math.round(obj.x)} y:${Math.round(obj.y)} | scale:${obj.scaleX.toFixed(2)} | rot:${Math.round(obj.angle)}° | ${Math.round(obj.displayWidth)}x${Math.round(obj.displayHeight)}`,
    );
  }

  private printSingle(id: InteractiveObjectId, obj: Phaser.GameObjects.Image): void {
    console.log(
      `%c${id}: x:${Math.round(obj.x)}, y:${Math.round(obj.y)}, scale:${obj.scaleX.toFixed(3)}, angle:${Math.round(obj.angle)}, display:${Math.round(obj.displayWidth)}x${Math.round(obj.displayHeight)}`,
      "color: #ffd700",
    );
  }

  printAll(): void {
    console.log("%c\n=== ROOM OBJECTS POSITIONS (copy to constants.ts) ===", "color: #00ff00; font-weight: bold");
    for (const [id, obj] of this.objects.entries()) {
      if (!(obj instanceof Phaser.GameObjects.Image)) continue;
      if (obj.x < 0) continue;
      const ro = ROOM_OBJECTS.find(o => o.id === id);
      const wm = ro?.wallMounted ?? false;
      const angle = Math.round(obj.angle);
      const angleStr = angle !== 0 ? `angle: ${angle}, ` : "";
      console.log(
        `  { id: "${id}", x: ${Math.round(obj.x)}, y: ${Math.round(obj.y)}, width: ${ro?.width ?? 1}, height: ${ro?.height ?? 1}, displayWidth: ${Math.round(obj.displayWidth)}, displayHeight: ${Math.round(obj.displayHeight)}, wallMounted: ${wm}, ${angleStr}${!wm ? `collisionBox: { x: ${-Math.round(obj.displayWidth * 0.4)}, y: ${-Math.round(obj.displayHeight * 0.15)}, w: ${Math.round(obj.displayWidth * 0.8)}, h: ${Math.round(obj.displayHeight * 0.15)} }, ` : ""}label: "${ro?.label ?? id}", zone: "${ro?.zone ?? "work"}" },`
      );
    }
    console.log("%c=== END ===\n", "color: #00ff00");
  }
}
