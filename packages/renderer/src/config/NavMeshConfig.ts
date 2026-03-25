import { ROOM_OBJECTS, ROOM_FLOOR_TOP_Y, ROOM_FLOOR_BOTTOM_Y, GAME_WIDTH } from "@nts/shared";

interface Point {
  x: number;
  y: number;
}

/** Margin around obstacles for Truman clearance (pixels) */
const OBSTACLE_MARGIN = 12;
/** Floor boundary margin from screen edges */
const FLOOR_MARGIN = 40;

/** Get obstacle rectangles from room objects with collision boxes */
export function getObstacles(): { x: number; y: number; w: number; h: number }[] {
  return ROOM_OBJECTS
    .filter((obj) => !obj.wallMounted && obj.collisionBox)
    .map((obj) => {
      const cb = obj.collisionBox!;
      return {
        x: obj.x + cb.x - OBSTACLE_MARGIN,
        y: obj.y + cb.y - OBSTACLE_MARGIN,
        w: cb.w + OBSTACLE_MARGIN * 2,
        h: cb.h + OBSTACLE_MARGIN * 2,
      };
    });
}

/** Build navmesh polygons by subdividing the floor around obstacles.
 *  Returns array of convex polygons (each polygon = array of {x,y} points).
 *  Uses a simple approach: create a grid of rectangles covering the floor,
 *  removing cells that overlap with obstacles. */
export function buildNavMeshPolygons(): Point[][] {
  const floorLeft = FLOOR_MARGIN;
  const floorRight = GAME_WIDTH - FLOOR_MARGIN;
  const floorTop = ROOM_FLOOR_TOP_Y + 10;
  const floorBottom = ROOM_FLOOR_BOTTOM_Y;

  const obstacles = getObstacles();

  // Grid cell size — smaller = more precise but more polygons
  const cellW = 40;
  const cellH = 30;

  const polygons: Point[][] = [];

  for (let y = floorTop; y < floorBottom; y += cellH) {
    for (let x = floorLeft; x < floorRight; x += cellW) {
      const cx = x;
      const cy = y;
      const cw = Math.min(cellW, floorRight - x);
      const ch = Math.min(cellH, floorBottom - y);

      // Check if cell overlaps any obstacle
      const blocked = obstacles.some(
        (ob) => cx < ob.x + ob.w && cx + cw > ob.x && cy < ob.y + ob.h && cy + ch > ob.y,
      );

      if (!blocked) {
        polygons.push([
          { x: cx, y: cy },
          { x: cx + cw, y: cy },
          { x: cx + cw, y: cy + ch },
          { x: cx, y: cy + ch },
        ]);
      }
    }
  }

  return polygons;
}
