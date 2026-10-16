import { T, type Pt } from './util';

/** Half the side of the windmill's square footprint, in tiles. */
export const MILL_HALF = 3;

/**
 * The windmill's round stone tower on a tile grid, around a centre tile:
 * calls back for every wall and floor tile. The wall is thick enough on the
 * diagonals that nothing slips through between two corners.
 */
export function millRing(
  cx: number,
  cy: number,
  fn: (x: number, y: number, wall: boolean) => void,
): void {
  for (let dy = -MILL_HALF; dy <= MILL_HALF; dy++) {
    for (let dx = -MILL_HALF; dx <= MILL_HALF; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < 2.5) fn(cx + dx, cy + dy, false);
      else if (d < 3.7) fn(cx + dx, cy + dy, true);
    }
  }
}

/** The door is in the south wall; the mirror lies in the floor by the north wall. */
export const millDoor = (c: Pt): Pt => ({ x: c.x, y: c.y + MILL_HALF });
export const millMirror = (c: Pt): Pt => ({ x: c.x, y: c.y - 2 });

/** Centre of a tile in world pixels. */
export const tileCentre = (p: Pt): Pt => ({ x: (p.x + 0.5) * T, y: (p.y + 0.5) * T });
