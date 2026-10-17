import type * as Phaser from 'phaser';
import { INK, painter, type Painter } from './brush';
import type { Building } from './world';
import { T, TL, mulberry32 } from './util';

type At = (i: number, fn: (p: Painter) => void) => void;

const WOOD_DARK = '#3e2c1f';

// --- Floors and walls ------------------------------------------------------------------

/** Indoor floors: planks, parquet, chequered stone, a carpet. */
export function paintHouseTiles(at: At, r: () => number): void {
  const pick = (cols: string[]) => cols[Math.floor(r() * cols.length)] as string;

  // Wide planks, joints staggered between the two variants.
  const planks = (shift: number) => (p: Painter) => {
    p.rect(0, 0, T, T, '#2a1c12');
    for (let y = 0; y < T; y += 8) {
      const joint = ((y / 8 + shift) % 2) * 16 + 6;
      for (const [x0, x1] of [
        [0, joint],
        [joint, T],
      ] as const) {
        p.rect(
          x0 + 0.5,
          y + 0.5,
          x1 - x0 - 1,
          7,
          pick(['#6e4d30', '#765335', '#68472b', '#7d5a3a']),
        );
        for (let k = 0; k < 2; k++) {
          const gy = y + 2 + r() * 4;
          p.line(x0 + 2, gy, x1 - 2, gy + (r() - 0.5), 'rgba(40,24,12,.28)', 0.6);
        }
        p.rect(x0 + 2, y + 3.5, 1, 1, '#2a1c12');
      }
      p.rect(0, y + 0.5, T, 1, 'rgba(255,225,180,.08)');
    }
  };
  at(TL.PLANK, planks(0));
  at(TL.PLANK2, planks(1));

  // Basket-weave parquet: four slats per square, alternating direction.
  at(TL.PARQUET, (p) => {
    p.rect(0, 0, T, T, '#2a1a10');
    for (let sy = 0; sy < 2; sy++) {
      for (let sx = 0; sx < 2; sx++) {
        const horiz = (sx + sy) % 2 === 0;
        for (let k = 0; k < 4; k++) {
          const col = pick(['#8a5f38', '#7d5431', '#93683f', '#74502f']);
          if (horiz) p.rect(sx * 16 + 0.5, sy * 16 + k * 4 + 0.5, 15, 3, col);
          else p.rect(sx * 16 + k * 4 + 0.5, sy * 16 + 0.5, 3, 15, col);
        }
      }
    }
    p.rect(0, 0, T, T, 'rgba(255,220,170,.05)');
  });

  // Chequered stone, worn and cracked.
  at(TL.CHECKER, (p) => {
    for (let sy = 0; sy < 2; sy++) {
      for (let sx = 0; sx < 2; sx++) {
        const light = (sx + sy) % 2 === 0;
        p.rect(sx * 16, sy * 16, 16, 16, light ? '#b5a88c' : '#3e3631');
        p.rect(
          sx * 16 + 1,
          sy * 16 + 1,
          14,
          2,
          light ? 'rgba(255,245,220,.25)' : 'rgba(255,240,220,.06)',
        );
        p.rect(sx * 16, sy * 16, 16, 16, 'rgba(0,0,0,0)', 0.6);
      }
    }
    if (r() < 0.5) {
      const x = r() * T;
      const y = r() * T;
      p.line(x, y, x + 6, y + 4, 'rgba(20,12,8,.5)', 0.6);
      p.line(x + 6, y + 4, x + 9, y + 3, 'rgba(20,12,8,.5)', 0.6);
    }
  });

  // A red runner, with a gold diamond pattern.
  at(TL.CARPET, (p) => {
    p.rect(0, 0, T, T, '#6e2622');
    for (let y = -8; y < T; y += 16) {
      p.poly(
        [
          [16, y + 2],
          [24, y + 10],
          [16, y + 18],
          [8, y + 10],
        ],
        'rgba(214,170,90,.35)',
      );
    }
    for (let k = 0; k < 30; k++) p.rect(r() * T, r() * T, 1, 1, 'rgba(20,8,6,.3)');
  });
}

// --- Objects -----------------------------------------------------------------------------

/** Victor's bed, bedside table and garden bench, in one small atlas. */
export function paintHouseAtlas(scene: Phaser.Scene): void {
  const A = scene.textures.createCanvas('ln-house', 128, 72);
  if (!A) return;
  const c = A.getContext();
  let ax = 0;
  let ay = 0;
  let rowH = 0;
  const add = (
    name: string,
    w: number,
    h: number,
    fn: (p: Painter, w: number, h: number) => void,
  ) => {
    if (ax + w > 128) {
      ax = 0;
      ay += rowH + 2;
      rowH = 0;
    }
    c.save();
    c.translate(ax, ay);
    c.beginPath();
    c.rect(0, 0, w, h);
    c.clip();
    fn(painter(c), w, h);
    c.restore();
    A.add(name, 0, ax, ay, w, h);
    ax += w + 2;
    rowH = Math.max(rowH, h);
  };
  const shadow = (p: Painter, x: number, y: number, rx: number, ry: number) =>
    p.ell(x, y, rx, ry, 'rgba(10,6,4,.4)');

  // A bed with a patchwork quilt.
  add('bed', 32, 64, (p) => {
    shadow(p, 17, 34, 15, 30);
    p.rect(2, 2, 28, 60, WOOD_DARK, 1.4);
    p.rect(5, 5, 22, 12, '#e9e0cc', 1);
    for (let y = 18; y < 58; y += 8) {
      for (let x = 4; x < 28; x += 8)
        p.rect(x, y, 8, 8, ['#7c2f28', '#b0884a', '#55603a', '#8a6a4a'][(x + y) % 4] as string);
    }
    p.rect(4, 18, 24, 40, 'rgba(0,0,0,0)', 0.8);
  });
  // A bedside table with a drawer.
  add('stable', 34, 34, (p) => {
    shadow(p, 18, 19, 14, 12);
    p.rect(3, 13, 7, 8, '#4a3322', 1);
    p.rect(24, 13, 7, 8, '#4a3322', 1);
    p.rect(9, 9, 16, 16, '#6e4d30', 1.3);
    p.circ(17, 17, 2.2, '#f3ead6', 0.6);
  });
  add('bench', 34, 16, (p) => {
    shadow(p, 18, 10, 15, 5);
    p.rect(2, 3, 30, 4, WOOD_DARK, 0.8);
    p.rect(2, 8, 30, 5, '#6a4a2e', 0.8);
  });
  A.refresh();
}

// --- Roofs ---------------------------------------------------------------------------------

export const ROOF_PAD = 8;
export const roofKey = (realm: string, i: number) => `ln-roof-${realm}-${i}`;

/** One texture per building: its roof plus the shadow it throws. */
export function paintRoofs(scene: Phaser.Scene, buildings: Building[], realm: string): void {
  buildings.forEach((b, i) => {
    const key = roofKey(realm, i);
    if (scene.textures.exists(key)) return;
    const w = b.w * T + ROOF_PAD * 2 + 10;
    const h = b.h * T + ROOF_PAD * 2 + 10 + (b.porch === undefined ? 0 : PORCH);
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const c = tex.getContext();
    const p = painter(c);
    const r = mulberry32(31 + i * 17);
    const x0 = 2;
    const y0 = 2;
    const rw = b.w * T + ROOF_PAD * 2 - 4;
    const rh = b.h * T + ROOF_PAD * 2 - 4;
    // Shadow to the south-east.
    p.rect(x0 + 10, y0 + 10, rw, rh, 'rgba(10,6,4,.35)');
    const horizontal = b.w >= b.h;
    const mid = horizontal ? y0 + rh / 2 : x0 + rw / 2;
    const half = (first: boolean): [number, number, number, number] =>
      horizontal
        ? first
          ? [x0, y0, rw, rh / 2]
          : [x0, mid, rw, rh / 2]
        : first
          ? [x0, y0, rw / 2, rh]
          : [mid, y0, rw / 2, rh];

    const pal: Record<string, [string, string]> = {
      tiles: ['#5e2521', '#80322a'],
      tin: ['#5f5d57', '#76736a'],
    };
    const [dark, light] = pal[b.roof] as [string, string];
    for (const first of [true, false]) {
      const [hx, hy, hw, hh] = half(first);
      p.rect(hx, hy, hw, hh, first ? dark : light, 2);
      c.save();
      c.beginPath();
      c.rect(hx, hy, hw, hh);
      c.clip();
      texture(c, p, r, b.roof, hx, hy, hw, hh, horizontal);
      c.restore();
    }
    // Ridge, not quite straight.
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.lineCap = 'butt';
    c.beginPath();
    const len = horizontal ? rw : rh;
    for (let t = 0; t <= len; t += 8) {
      const o = (r() - 0.5) * 1.4;
      const [px, py] = horizontal ? [x0 + t, mid + o] : [mid + o, y0 + t];
      if (t) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.stroke();
    // Moss and wear.
    if (b.roof !== 'tin') {
      for (let k = 0; k < 6; k++) {
        p.ell(x0 + r() * rw, y0 + r() * rh, 4 + r() * 8, 3 + r() * 3, 'rgba(70,85,45,.3)');
      }
    }
    for (const ch of b.chimneys) {
      const cx = ROOF_PAD + ch.x * T;
      const cy = ROOF_PAD + ch.y * T;
      p.rect(cx - 7, cy - 7, 14, 14, '#5a5147', 1.4);
      p.rect(cx - 4, cy - 4, 8, 8, '#0f0c0a');
    }
    if (b.porch !== undefined) porch(c, p, r, ROOF_PAD + b.porch * T, ROOF_PAD + b.h * T);
    tex.refresh();
  });
}

/** How far a porch canopy reaches past the eaves, in pixels. */
const PORCH = 20;

/**
 * A small canopy over a front door, its ridge running out from the roof, in
 * green-painted boards that stand out from the tiles. Its lamp hangs
 * underneath, out of sight from above: only its light shows, on the ground
 * (a light in the scene). `x` is the door's middle and `y` the wall's outer
 * face.
 */
function porch(
  c: CanvasRenderingContext2D,
  p: Painter,
  r: () => number,
  x: number,
  y: number,
): void {
  const w = 30;
  const top = y - 18;
  const bottom = y + ROOF_PAD + PORCH - 2;
  c.save();
  // Not quite square to the house.
  c.translate(x, top);
  c.rotate(0.025);
  p.rect(-w + 6, 6, w * 2, bottom - top, 'rgba(10,6,4,.35)');
  p.rect(-w, 0, w, bottom - top, '#35543a', 2);
  p.rect(0, 0, w, bottom - top, '#4c7450', 2);
  for (let k = 5; k < w; k += 5) {
    const o = (r() - 0.5) * 0.8;
    p.line(-k + o, 2, -k, bottom - top - 2, 'rgba(10,20,10,.35)', 0.8);
    p.line(k + o, 2, k, bottom - top - 2, 'rgba(10,20,10,.3)', 0.8);
  }
  // Paint flaking at one corner.
  p.rect(w - 9, bottom - top - 6, 6, 3, 'rgba(160,130,90,.5)');
  p.line(0, 0, 0, bottom - top, INK, 3);
  c.restore();
}

function texture(
  c: CanvasRenderingContext2D,
  p: Painter,
  r: () => number,
  kind: Building['roof'],
  x: number,
  y: number,
  w: number,
  h: number,
  horizontal: boolean,
): void {
  // Rows run along the ridge; each row is a course of tiles or shingles.
  const rows = (step: number, draw: (rx: number, ry: number, along: number) => void) => {
    const across = horizontal ? h : w;
    const along = horizontal ? w : h;
    for (let a = 0; a < across; a += step) {
      for (let b = ((a / step) % 2) * (step / 2) - step; b < along; b += step) {
        draw(horizontal ? x + b : x + a, horizontal ? y + a : y + b, step);
      }
    }
  };
  if (kind === 'tiles') {
    rows(7, (rx, ry, s) => {
      c.beginPath();
      if (horizontal) c.arc(rx + s / 2, ry + s, s / 2, Math.PI, 0);
      else c.arc(rx + s, ry + s / 2, s / 2, -Math.PI / 2, Math.PI / 2);
      c.strokeStyle = 'rgba(20,6,4,.45)';
      c.lineWidth = 1;
      c.stroke();
      // No two tiles alike: some faded, some newer, a few slipped or gone.
      const v = r();
      if (v < 0.15) p.rect(rx + 1, ry + 1, s - 2, s - 2, 'rgba(255,200,170,.1)');
      else if (v < 0.27) p.rect(rx + 1, ry + 1, s - 2, s - 2, 'rgba(20,6,4,.14)');
      else if (v < 0.278) p.rect(rx + 1, ry + 1, s - 2, s - 2, 'rgba(18,8,6,.45)');
      else if (v < 0.29) p.rect(rx + 1.5, ry + 2.5, s - 2, s - 2, 'rgba(160,80,60,.4)');
    });
  } else if (kind === 'tin') {
    // Corrugated sheets running down from the ridge, overlapping, one a
    // little out of line; rust bleeding from the nails and the eaves.
    const across = horizontal ? w : h;
    const sheet = 22 + Math.floor(r() * 6);
    for (let a = 0; a < across; a += sheet) {
      const slip = r() < 0.25 ? (r() - 0.5) * 4 : 0;
      for (let k = 2; k < sheet; k += 3) {
        const o = a + k + slip;
        c.strokeStyle = k % 6 < 3 ? 'rgba(255,255,255,.1)' : 'rgba(20,18,14,.28)';
        c.lineWidth = 1;
        c.beginPath();
        if (horizontal) {
          c.moveTo(x + o, y);
          c.lineTo(x + o, y + h);
        } else {
          c.moveTo(x, y + o);
          c.lineTo(x + w, y + o);
        }
        c.stroke();
      }
      // The seam where one sheet lies over the next.
      if (horizontal) p.rect(x + a, y, 1.4, h, 'rgba(20,18,14,.5)');
      else p.rect(x, y + a, w, 1.4, 'rgba(20,18,14,.5)');
    }
    for (let k = 0; k < 7; k++) {
      p.ell(x + r() * w, y + r() * h, 3 + r() * 7, 2 + r() * 4, 'rgba(140,70,30,.35)');
    }
    for (let k = 0; k < 4; k++) p.ell(x + r() * w, y + r() * h, 2, 1.4, 'rgba(110,50,20,.55)');
  }
}
