import NavMeshModule from "navmesh";
// navmesh exports both default and named — Vite may resolve either way
const NavMesh = (NavMeshModule as unknown as { default?: typeof NavMeshModule }).default ?? NavMeshModule;
import type { Position } from "@nts/shared";
import { buildNavMeshPolygons } from "../config/NavMeshConfig";

/**
 * NavMesh-based pathfinding system.
 * Builds a navigation mesh from floor polygons (avoiding furniture collision boxes).
 * findPath() returns an array of waypoints that form an obstacle-free path.
 */
export class NavMeshSystem {
  private navMesh: NavMesh;

  constructor() {
    const polygons = buildNavMeshPolygons();
    this.navMesh = new NavMesh(polygons);
  }

  /** Find a path from `from` to `to`, avoiding obstacles.
   *  Returns array of waypoints (including start and end).
   *  Returns null if no path found — caller should fallback to direct line. */
  findPath(from: Position, to: Position): Position[] | null {
    const path = this.navMesh.findPath(
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
    );
    if (!path || path.length === 0) return null;
    return path.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
  }

  /** Rebuild navmesh (call if room layout changes) */
  rebuild(): void {
    const polygons = buildNavMeshPolygons();
    this.navMesh = new NavMesh(polygons);
  }
}
