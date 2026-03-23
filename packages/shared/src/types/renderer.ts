/** 2D position in game coordinates */
export interface Position {
  x: number;
  y: number;
}

/** Animation state descriptor */
export interface AnimationState {
  key: string;
  frameRate: number;
  loop: boolean;
}

/** Bubble types (visual-spec.md S7.1) */
export type BubbleType = "thought" | "speech" | "exclamation" | "whisper";

/** Mood-based bubble styling (visual-spec.md S7.3) */
export interface BubbleStyle {
  bubbleColor: string;
  textColor: string;
  border: string;
}

/** Interactive object IDs matching room layout (visual-spec.md S4.1) */
export type InteractiveObjectId =
  | "bed"
  | "desk"
  | "computer"
  | "bookshelf"
  | "fridge"
  | "stove"
  | "table_chair"
  | "easel"
  | "exercise_mat"
  | "window"
  | "clock"
  | "plant"
  | "poster"
  | "door";

/** Room object definition (visual-spec.md S3.1, S4.1) */
export interface RoomObject {
  id: InteractiveObjectId;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  zone: RoomZone;
}

/** Room zones (visual-spec.md S3.2) */
export type RoomZone =
  | "sleep"
  | "kitchen"
  | "work"
  | "creative"
  | "exercise"
  | "reading"
  | "window"
  | "door";

/** Renderer command types (brain-algorithm.md S3.3) */
export type RendererCommandType =
  | "move_to"
  | "play_animation"
  | "show_bubble"
  | "update_hud"
  | "set_object_state";

/** Renderer command payloads */
export interface RendererCommands {
  move_to: { objectId: InteractiveObjectId };
  play_animation: { state: string };
  show_bubble: { text: string; type: BubbleType; mood: string };
  update_hud: { mood?: string; activity?: string; time?: string };
  set_object_state: { objectId: InteractiveObjectId; state: string };
}

/** Typed renderer command */
export interface RendererCommand<
  T extends RendererCommandType = RendererCommandType,
> {
  type: T;
  payload: RendererCommands[T];
}

/** HUD state (visual-spec.md S6) */
export interface HUDState {
  mood: string;
  time: string;
  activity: string;
}

/** Character position + animation state */
export interface CharacterState {
  x: number;
  y: number;
  animation: string;
  facing: "left" | "right";
}

/** Full renderer state snapshot */
export interface RendererState {
  character: CharacterState;
  hud: HUDState;
  activeBubble: { text: string; type: BubbleType } | null;
  objectStates: Record<InteractiveObjectId, string>;
}
