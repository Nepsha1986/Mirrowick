import { CELLAR_MIRROR, CELLAR_STAIRS, LOWER_MILL, T, UPPER_MILL, type Pt } from './util';
import type { ThinWall } from './world';

/** Half the side of the windmill's square footprint, in tiles. */
export const MILL_HALF = 3;
/** Radius of the tower wall's middle line, and its thickness (pixels). */
const RADIUS = 2.9 * T;
const THICK = 14;
/** Half the doorway's width, as an angle round the tower. */
const DOOR = 0.36;

/** The door is in the south wall. */
export const millDoor = (c: Pt): Pt => ({ x: c.x, y: c.y + MILL_HALF });
/** Centre of a mill's centre tile, in pixels. */
export const millCentre = (c: Pt): Pt => ({ x: (c.x + 0.5) * T, y: (c.y + 0.5) * T });
/** Where the mirror lies in the Lower World mill's floor, and the hatch in the Upper's. */
export const lowerMirror = (): Pt => ({ x: (LOWER_MILL.x + 0.5) * T, y: (LOWER_MILL.y - 1.2) * T });
export const upperHatch = (): Pt => ({ x: (UPPER_MILL.x + 0.5) * T, y: (UPPER_MILL.y - 1.2) * T });
/** The foot of the cellar stairs, and the mirror in the cellar. */
export const cellarStairs = (): Pt => ({ x: CELLAR_STAIRS.x * T, y: CELLAR_STAIRS.y * T });
export const cellarMirror = (): Pt => ({ x: CELLAR_MIRROR.x * T, y: CELLAR_MIRROR.y * T });

/**
 * The tower's round stone wall as a chain of small blocks, leaving the
 * doorway open. `gone` can knock stretches out of it, for a ruin.
 */
export function millWall(c: Pt, gone: (stretch: number) => boolean = () => false): ThinWall[] {
  const { x: cx, y: cy } = millCentre(c);
  const out: ThinWall[] = [];
  const n = Math.ceil((2 * Math.PI * RADIUS) / 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // The doorway faces south (a = π/2).
    if (Math.abs(a - Math.PI / 2) < DOOR) continue;
    if (gone(Math.floor(i / 9))) continue;
    out.push({
      kind: 'stone',
      x: cx + Math.cos(a) * RADIUS - THICK / 2,
      y: cy + Math.sin(a) * RADIUS - THICK / 2,
      w: THICK,
      h: THICK,
    });
  }
  return out;
}

/** Tiles a mill takes up, to keep trees and roads off it. */
export function millTiles(c: Pt, fn: (x: number, y: number) => void): void {
  for (let dy = -MILL_HALF; dy <= MILL_HALF; dy++) {
    for (let dx = -MILL_HALF; dx <= MILL_HALF; dx++) {
      if (Math.hypot(dx, dy) < 3.7) fn(c.x + dx, c.y + dy);
    }
  }
}

/** Every tile a set of thin walls touches: solid for path-finding. */
export function wallTiles(walls: ThinWall[], fn: (x: number, y: number) => void): void {
  for (const r of walls) {
    for (let ty = Math.floor(r.y / T); ty <= Math.floor((r.y + r.h - 0.01) / T); ty++) {
      for (let tx = Math.floor(r.x / T); tx <= Math.floor((r.x + r.w - 0.01) / T); tx++) fn(tx, ty);
    }
  }
}

/** Diameter of a mill's round floor, in pixels. */
export const MILL_FLOOR = 2 * RADIUS + 4;
