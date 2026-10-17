import { CELLAR_MIRROR, CELLAR_STAIRS, LAB_MIRROR, SHED_HATCH, T, type Pt } from './util';
import type { ThinWall } from './world';

/** Where each way between the places comes out (world pixels). */
export const labMirror = (): Pt => ({ x: LAB_MIRROR.x * T, y: LAB_MIRROR.y * T });
export const upperHatch = (): Pt => ({ x: SHED_HATCH.x * T, y: SHED_HATCH.y * T });
export const cellarStairs = (): Pt => ({ x: CELLAR_STAIRS.x * T, y: CELLAR_STAIRS.y * T });
export const cellarMirror = (): Pt => ({ x: CELLAR_MIRROR.x * T, y: CELLAR_MIRROR.y * T });

/** Every tile a set of thin walls touches: solid for path-finding. */
export function wallTiles(walls: ThinWall[], fn: (x: number, y: number) => void): void {
  for (const r of walls) {
    for (let ty = Math.floor(r.y / T); ty <= Math.floor((r.y + r.h - 0.01) / T); ty++) {
      for (let tx = Math.floor(r.x / T); tx <= Math.floor((r.x + r.w - 0.01) / T); tx++) fn(tx, ty);
    }
  }
}
