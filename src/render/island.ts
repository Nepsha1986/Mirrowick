import * as Phaser from 'phaser';
import { TILE_H, TILE_W, gridToWorld } from '../core/iso';

const TOP_LEFT = 0x6b4b34;
const TOP_RIGHT = 0x4e3626;
const BOTTOM = 0x1e140d;

/** Deterministic 0..1 hash for a lattice point. */
export function hash2(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Paints the earth hanging under the island's front edges so the level reads
 * as a floating diorama, like the reference art. Depth tapers towards the
 * left and right extremes and is jittered per corner so faces join up.
 */
export function drawIslandUnderside(g: Phaser.GameObjects.Graphics, ground: string[]): void {
  const height = ground.length;
  const width = ground[0]?.length ?? 0;
  const solid = (c: number, r: number) => (ground[r]?.[c] ?? ' ') !== ' ';
  const halfSpan = ((width + height) / 2) * (TILE_W / 2);

  const drop = (x: number, cx2: number, cr2: number) => {
    const t = Math.min(1, Math.abs(x) / halfSpan);
    return 36 + 420 * (1 - t ** 1.6) * (0.7 + 0.3 * hash2(cx2, cr2));
  };

  // Vertical fade in a few bands; flat fills batch well and need no shader.
  const BANDS = [
    [0, 0.35, 1],
    [0.35, 0.6, 0.75],
    [0.6, 0.8, 0.45],
    [0.8, 1, 0.18],
  ] as const;
  const face = (
    ax: number,
    ay: number,
    ad: number,
    bx: number,
    by: number,
    bd: number,
    top: number,
  ) => {
    for (const [t0, t1, alpha] of BANDS) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(top),
        Phaser.Display.Color.ValueToColor(BOTTOM),
        1,
        t0,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), alpha);
      g.fillPoints(
        [
          { x: ax, y: ay + ad * t0 },
          { x: bx, y: by + bd * t0 },
          { x: bx, y: by + bd * t1 },
          { x: ax, y: ay + ad * t1 },
        ] as Phaser.Math.Vector2[],
        true,
      );
    }
  };

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!solid(c, r)) continue;
      const { x, y } = gridToWorld(c, r);
      const left = { x: x - TILE_W / 2, y, k: [2 * c - 1, 2 * r + 1] as const };
      const bottom = { x, y: y + TILE_H / 2, k: [2 * c + 1, 2 * r + 1] as const };
      const right = { x: x + TILE_W / 2, y, k: [2 * c + 1, 2 * r - 1] as const };
      const d = (p: typeof left) => drop(p.x, p.k[0], p.k[1]);
      if (!solid(c, r + 1)) face(left.x, left.y, d(left), bottom.x, bottom.y, d(bottom), TOP_LEFT);
      if (!solid(c + 1, r))
        face(bottom.x, bottom.y, d(bottom), right.x, right.y, d(right), TOP_RIGHT);
    }
  }
}
