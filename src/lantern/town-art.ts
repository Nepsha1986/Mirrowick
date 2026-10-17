import type * as Phaser from 'phaser';
import { INK, painter, type P, type Painter } from './brush';
import type { Building } from './town';
import { T, TL, mulberry32 } from './util';

type At = (i: number, fn: (p: Painter) => void) => void;

const CREAM = '#cbbd9b';
const CRIMSON = '#7c2f28';
const WOOD = '#6a4a2e';
const WOOD_DARK = '#3e2c1f';

// --- Floors and walls ------------------------------------------------------------------

/** Village and interior tiles: planks, parquet, chequered stone, flagstones… */
export function paintTownTiles(at: At, r: () => number): void {
  const pick = (cols: string[]) => cols[Math.floor(r() * cols.length)] as string;

  // Wide tavern planks, joints staggered between the two variants.
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

  // Chequered chapel stone, worn and cracked.
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

  // Flagstones: irregular slabs inset from the edges so mortar lines meet.
  at(TL.FLAG, (p) => {
    p.rect(0, 0, T, T, '#2c2620');
    const cut = 10 + r() * 12;
    const slabs: P[][] = [
      [
        [1, 1],
        [cut, 1],
        [cut - 1, 15],
        [1, 14],
      ],
      [
        [cut + 1, 1],
        [31, 1],
        [31, 13],
        [cut, 15],
      ],
      [
        [1, 16],
        [18, 17],
        [17, 31],
        [1, 31],
      ],
      [
        [19, 17],
        [31, 15],
        [31, 31],
        [18, 31],
      ],
    ];
    for (const s of slabs) {
      p.poly(s, pick(['#6d655a', '#776e61', '#625a50', '#7f7568']));
      const [x, y] = s[0] as P;
      p.rect(x + 1, y + 1, 6, 1.2, 'rgba(255,240,215,.12)');
    }
  });

  // Packed earth yards with pebbles and old footprints.
  at(TL.EARTH, (p) => {
    p.rect(0, 0, T, T, '#4e3f2d');
    for (let k = 0; k < 80; k++) {
      const s = 1 + Math.floor(r() * 2);
      p.rect(
        Math.floor(r() * T),
        Math.floor(r() * T),
        s,
        s,
        pick(['#453727', '#594834', '#433526', '#5f4d38']),
      );
    }
    for (let k = 0; k < 3; k++) p.ell(r() * T, r() * T, 1.6, 1, '#7a7062');
    if (r() < 0.3) p.ell(r() * T, r() * T, 2, 3.2, 'rgba(30,20,12,.25)');
  });

  // A wall top seen from above: plaster between dark beams.
  at(TL.TIMBER, (p) => {
    p.rect(0, 0, T, T, '#b4a07c');
    for (let k = 0; k < 40; k++) p.rect(r() * T, r() * T, 1, 1, 'rgba(70,50,30,.25)');
    p.rect(0, 0, T, 4, WOOD_DARK);
    p.rect(0, T - 4, T, 4, WOOD_DARK);
    p.rect(0, 0, 4, T, WOOD_DARK);
    p.line(4, T - 4, T - 4, 4, WOOD_DARK, 3);
    p.rect(0, 0, T, 1, 'rgba(255,235,200,.15)');
  });

  // Cobbles: rounded, and worn with moss and gaps.
  at(TL.PAVE2, (p) => {
    p.rect(0, 0, T, T, '#2e2822');
    for (let y = 4; y < T; y += 8) {
      for (let x = ((y / 8) % 2) * 4 + 4; x < T + 4; x += 8) {
        p.circ(x, y, 3.6, pick(['#5d5448', '#655b4d', '#575045']));
        p.circ(x - 1, y - 1, 1.4, 'rgba(255,235,205,.12)');
      }
    }
  });
  at(TL.PAVE3, (p) => {
    p.rect(0, 0, T, T, '#3a3227');
    for (let y = 0; y < T; y += 8) {
      for (let x = ((y / 8) % 2) * 5; x < T; x += 10) {
        if (r() < 0.18) continue;
        p.rect(x + 1, y + 1, 8, 6, pick(['#544b41', '#5a5147', '#4d453c']));
      }
    }
    for (let k = 0; k < 5; k++) p.rect(r() * T, r() * T, 2, 1, '#55603a');
  });

  // Tilled soil in rows.
  at(TL.SOIL, (p) => {
    p.rect(0, 0, T, T, '#3a2a1c');
    for (let y = 2; y < T; y += 8) {
      p.rect(0, y, T, 4, '#4a3624');
      p.rect(0, y, T, 1, 'rgba(255,220,180,.08)');
    }
    for (let k = 0; k < 20; k++) p.rect(r() * T, r() * T, 1, 1, '#2a1d12');
  });

  // Cut stone for the chapel walls.
  at(TL.ASHLAR, (p) => {
    p.rect(0, 0, T, T, '#3a342d');
    for (let y = 0; y < T; y += 11) {
      for (let x = ((y / 11) % 2) * 8 - 8; x < T; x += 16) {
        p.rect(x + 1, y + 1, 14, 9, pick(['#8f8676', '#988e7d', '#857c6d']));
        p.rect(x + 1, y + 1, 14, 1.5, 'rgba(255,245,225,.2)');
      }
    }
  });

  // The chapel's red runner, with a gold diamond pattern.
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

/** Furniture, stalls, villagers and the rest of the village, in one atlas. */
export function paintTownAtlas(scene: Phaser.Scene): void {
  const A = scene.textures.createCanvas('ln-town', 1024, 1024);
  if (!A) return;
  const c = A.getContext();
  const ar = mulberry32(77);
  let ax = 0;
  let ay = 0;
  let rowH = 0;
  const add = (
    name: string,
    w: number,
    h: number,
    fn: (p: Painter, w: number, h: number) => void,
  ) => {
    if (ax + w > 1024) {
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

  // The square: a mosaic of rings and an eight-pointed star around the Wick.
  add('plaza', 256, 256, (p) => {
    const cx = 128;
    const cy = 128;
    const ring = (r0: number, r1: number, cols: string[], size: number) => {
      for (let rr = r0; rr < r1; rr += size) {
        const n = Math.floor((2 * Math.PI * rr) / size);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          c.save();
          c.translate(x, y);
          c.rotate(a);
          p.rect(
            -size / 2 + 0.6,
            -size / 2 + 0.6,
            size - 1.2,
            size - 1.2,
            cols[k % cols.length] as string,
          );
          c.restore();
        }
      }
    };
    p.circ(cx, cy, 118, '#2a231c');
    ring(106, 118, ['#5f574b', '#6a6155', '#585045'], 6);
    ring(98, 106, ['#b9a985', '#c4b591'], 5);
    ring(46, 98, ['#5c5449', '#655c50', '#544c42'], 6);
    // The star: eight crimson and cream rays.
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const long = k % 2 === 0;
      const len = long ? 96 : 70;
      const half = 0.17;
      p.poly(
        [
          [cx + Math.cos(a - half) * 40, cy + Math.sin(a - half) * 40],
          [cx + Math.cos(a) * len, cy + Math.sin(a) * len],
          [cx + Math.cos(a + half) * 40, cy + Math.sin(a + half) * 40],
        ],
        long ? '#7c2f28' : '#b9a985',
        0.8,
      );
      p.poly(
        [
          [cx + Math.cos(a) * 42, cy + Math.sin(a) * 42],
          [cx + Math.cos(a) * len, cy + Math.sin(a) * len],
          [cx + Math.cos(a + half) * 40, cy + Math.sin(a + half) * 40],
        ],
        'rgba(10,5,3,.22)',
      );
    }
    ring(30, 46, ['#c4b591', '#7c2f28'], 5);
    p.circ(cx, cy, 30, '#2e2720');
    for (let k = 0; k < 600; k++) p.rect(ar() * 256, ar() * 256, 1, 1, 'rgba(15,10,6,.2)');
  });

  add('counter', 64, 30, (p) => {
    shadow(p, 34, 18, 30, 10);
    p.rect(2, 4, 60, 20, WOOD_DARK, 1.4);
    p.rect(4, 6, 56, 6, '#7a5535');
    for (const x of [12, 30, 46]) {
      p.circ(x, 16, 3.4, '#c9c0a8', 1);
      p.circ(x, 16, 2, '#9a6a27');
    }
  });
  add('hearth', 34, 34, (p) => {
    p.rect(2, 2, 30, 30, '#5d5549', 1.4);
    for (let k = 0; k < 10; k++)
      p.rect(3 + (k % 5) * 6, 3 + Math.floor(k / 5) * 26, 5, 4, '#776e60');
    p.rect(7, 8, 20, 20, '#120c08');
    p.line(10, 22, 24, 14, '#4a3020', 3);
    p.line(10, 14, 24, 22, '#3a2618', 3);
    const g = c.createRadialGradient(17, 18, 0, 17, 18, 9);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(0.5, '#ff8a2e');
    g.addColorStop(1, 'rgba(160,40,10,0)');
    c.fillStyle = g;
    c.fillRect(7, 8, 20, 20);
  });
  add('kegs', 30, 30, (p) => {
    shadow(p, 16, 17, 13, 10);
    for (const [x, y] of [
      [10, 10],
      [20, 19],
    ] as const) {
      p.circ(x, y, 8, '#5a3a26', 1.2);
      p.circ(x, y, 6, '#6a4630');
      p.circ(x, y, 1.6, WOOD_DARK);
    }
  });
  add('table', 40, 40, (p) => {
    shadow(p, 22, 23, 15, 13);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * 6.28 + 0.4;
      p.circ(20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15, 4.5, '#4a3322', 1);
    }
    p.circ(20, 20, 11, '#6e4d30', 1.4);
    p.circ(18, 18, 7, 'rgba(255,225,180,.1)');
    p.circ(16, 22, 2.6, '#c9c0a8', 0.8);
    p.circ(23, 17, 1.8, '#f3e6c8');
  });
  add('rugRed', 96, 64, (p) => {
    p.rect(4, 4, 88, 56, CRIMSON, 1.2);
    p.rect(9, 9, 78, 46, 'rgba(0,0,0,0)', 0);
    c.strokeStyle = '#c9a65a';
    c.lineWidth = 2;
    c.strokeRect(9, 9, 78, 46);
    for (let x = 18; x < 84; x += 14) {
      p.poly(
        [
          [x, 32],
          [x + 5, 25],
          [x + 10, 32],
          [x + 5, 39],
        ],
        '#a8583a',
      );
    }
    for (let y = 6; y < 60; y += 3) {
      p.line(1, y, 4, y, '#b8a27a', 1);
      p.line(92, y, 95, y, '#b8a27a', 1);
    }
  });
  add('sign', 28, 24, (p) => {
    p.line(4, 2, 24, 2, '#2a2420', 2);
    p.line(8, 2, 8, 6, '#2a2420', 1);
    p.line(20, 2, 20, 6, '#2a2420', 1);
    p.rect(3, 6, 22, 15, WOOD, 1.2);
    p.rect(12.5, 9, 3, 8, '#e9dcc0');
    p.circ(14, 8, 1.8, '#ffb24a');
  });
  add('ptable', 46, 40, (p) => {
    shadow(p, 24, 22, 20, 16);
    p.rect(3, 4, 40, 6, WOOD_DARK, 1);
    p.rect(3, 30, 40, 6, WOOD_DARK, 1);
    p.rect(5, 12, 36, 16, '#6e4d30', 1.3);
    p.circ(14, 20, 2.6, '#c9c0a8', 0.8);
    p.circ(30, 18, 2.6, '#c9c0a8', 0.8);
    p.rect(22, 16, 4, 6, '#e9dcc0');
  });
  add('flowers', 24, 22, (p) => {
    for (let k = 0; k < 7; k++)
      p.circ(5 + ar() * 14, 5 + ar() * 12, 4 + ar() * 2, ['#2f3a24', '#3a4a2c'][k % 2] as string);
    for (let k = 0; k < 9; k++) {
      p.circ(
        4 + ar() * 16,
        4 + ar() * 14,
        1.6,
        ['#b03a30', '#e9dcc0', '#9a70c8', '#d8a040'][k % 4] as string,
      );
    }
  });
  add('altar', 66, 32, (p) => {
    shadow(p, 35, 19, 31, 11);
    p.rect(3, 5, 60, 20, '#8f8676', 1.4);
    p.rect(8, 5, 50, 20, '#e9e0cc');
    p.rect(8, 5, 50, 3, '#c9a65a');
    p.rect(28, 10, 10, 8, '#5a2420', 0.8);
    for (const x of [12, 18, 48, 54]) {
      p.circ(x, 15, 2.2, '#f3ead6', 0.6);
      p.circ(x, 15, 1, '#ffb24a');
    }
  });
  add('pew', 32, 28, (p) => {
    shadow(p, 17, 16, 14, 10);
    p.rect(2, 4, 28, 6, WOOD_DARK, 1);
    p.rect(2, 10, 28, 12, '#6a4a2e', 1);
    p.rect(3, 11, 26, 2, 'rgba(255,225,180,.12)');
  });
  add('forge', 34, 34, (p) => {
    shadow(p, 18, 19, 15, 13);
    p.rect(2, 2, 30, 30, '#4d463d', 1.4);
    p.circ(17, 17, 10, '#171009', 1);
    const g = c.createRadialGradient(17, 17, 0, 17, 17, 10);
    g.addColorStop(0, '#fff0b0');
    g.addColorStop(0.4, '#ff8a2e');
    g.addColorStop(1, 'rgba(120,30,10,.4)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(17, 17, 9, 0, Math.PI * 2);
    c.fill();
    p.rect(26, 22, 7, 10, '#5a3a26', 1);
  });
  add('anvil', 28, 20, (p) => {
    shadow(p, 15, 12, 12, 7);
    p.poly(
      [
        [2, 6],
        [24, 6],
        [27, 9],
        [20, 10],
        [18, 15],
        [9, 15],
        [8, 10],
        [2, 9],
      ],
      '#3a3836',
      1.2,
    );
    p.rect(5, 7, 16, 1.5, 'rgba(255,255,255,.25)');
  });
  add('rack', 32, 22, (p) => {
    p.rect(2, 8, 28, 4, WOOD_DARK, 1);
    for (const x of [6, 13, 20, 26]) p.line(x, 4, x + 1, 18, '#555', 1.6);
    p.rect(4, 2, 5, 4, '#3a3836');
    p.rect(18, 15, 6, 4, '#3a3836');
  });
  add('crateStack', 30, 30, (p) => {
    shadow(p, 16, 17, 13, 10);
    for (const [x, y, s] of [
      [2, 10, 16],
      [14, 12, 14],
      [6, 2, 13],
    ] as const) {
      p.rect(x, y, s, s, '#5e4429', 1.1);
      p.line(x + 2, y + 2, x + s - 2, y + s - 2, '#3e2c1a', 1.4);
    }
  });
  add('rugRound', 74, 58, (p) => {
    p.ell(37, 29, 34, 25, '#55603a', 1.2);
    p.ell(37, 29, 28, 20, '#b0884a');
    p.ell(37, 29, 20, 14, '#6e2f28');
    p.ell(37, 29, 10, 7, '#cbbd9b');
  });
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
  add('bookcase', 32, 20, (p) => {
    p.rect(1, 2, 30, 16, WOOD_DARK, 1.2);
    for (let x = 3; x < 29; x += 3)
      p.rect(
        x,
        4,
        2.4,
        12,
        ['#7c2f28', '#3a4a5a', '#55603a', '#b0884a', '#5a3a26'][Math.floor(ar() * 5)] as string,
      );
  });
  add('stable', 34, 34, (p) => {
    shadow(p, 18, 19, 14, 12);
    p.rect(3, 13, 7, 8, '#4a3322', 1);
    p.rect(24, 13, 7, 8, '#4a3322', 1);
    p.rect(9, 9, 16, 16, '#6e4d30', 1.3);
    p.circ(17, 17, 2.2, '#f3ead6', 0.6);
  });
  // Market stalls: awning stripes over crates of produce.
  const stall = (stripe: string) => (p: Painter) => {
    shadow(p, 38, 30, 34, 18);
    for (let k = 0; k < 6; k++)
      p.circ(10 + k * 10, 44, 4, ['#a8302a', '#55703a', '#c9a040'][k % 3] as string, 0.6);
    for (let x = 4; x < 68; x += 8) p.rect(x, 4, 8, 32, ((x - 4) / 8) % 2 ? CREAM : stripe);
    p.rect(4, 4, 64, 32, 'rgba(0,0,0,0)', 1.4);
    p.rect(4, 4, 64, 14, 'rgba(10,5,3,.18)');
    for (let x = 4; x < 68; x += 8) {
      c.beginPath();
      c.arc(x + 4, 36, 4, 0, Math.PI);
      c.fillStyle = ((x - 4) / 8) % 2 ? CREAM : stripe;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.stroke();
    }
  };
  add('stallRed', 72, 52, stall('#8a3229'));
  add('stallGreen', 72, 52, stall('#4f6038'));
  add('baskets', 30, 30, (p) => {
    for (const [x, y, col] of [
      [10, 10, '#a8302a'],
      [21, 19, '#c9a040'],
    ] as const) {
      p.circ(x, y, 8, '#8a6a3a', 1.2);
      for (let k = 0; k < 5; k++) p.circ(x - 3 + ar() * 6, y - 3 + ar() * 6, 2.2, col);
    }
  });
  add('cabbage', 16, 16, (p) => {
    p.circ(8, 8, 5.5, '#3e5a2c', 0.8);
    p.circ(7, 7, 3, '#6a8a44');
  });
  add('scarecrow', 36, 36, (p) => {
    shadow(p, 20, 21, 12, 8);
    p.line(4, 16, 32, 16, WOOD_DARK, 3);
    p.rect(11, 10, 14, 14, '#5a4a3a', 1);
    p.line(8, 12, 6, 20, '#a8955a', 1.4);
    p.line(28, 12, 31, 21, '#a8955a', 1.4);
    p.circ(18, 17, 8, '#3a2c20', 1.2);
    p.circ(18, 17, 4, '#a8955a');
  });
  add('bench', 34, 16, (p) => {
    shadow(p, 18, 10, 15, 5);
    p.rect(2, 3, 30, 4, WOOD_DARK, 0.8);
    p.rect(2, 8, 30, 5, '#6a4a2e', 0.8);
  });
  // Watchtower from above: a shingled pyramid on four posts, a torch.
  add('tower', 100, 100, (p) => {
    shadow(p, 56, 56, 42, 42);
    for (const [x, y] of [
      [14, 14],
      [86, 14],
      [14, 86],
      [86, 86],
    ] as const) {
      p.rect(x - 4, y - 4, 8, 8, WOOD_DARK, 1);
    }
    const tri = (pts: P[], col: string) => p.poly(pts, col, 1.6);
    tri(
      [
        [10, 10],
        [90, 10],
        [50, 50],
      ],
      '#4a2a22',
    );
    tri(
      [
        [90, 10],
        [90, 90],
        [50, 50],
      ],
      '#5c3328',
    );
    tri(
      [
        [10, 90],
        [90, 90],
        [50, 50],
      ],
      '#6e3d2e',
    );
    tri(
      [
        [10, 10],
        [10, 90],
        [50, 50],
      ],
      '#7a4634',
    );
    for (let k = 1; k < 6; k++) {
      const d = k * 7;
      c.strokeStyle = 'rgba(15,6,4,.35)';
      c.lineWidth = 1;
      c.strokeRect(10 + d, 10 + d, 80 - 2 * d, 80 - 2 * d);
    }
    p.circ(50, 50, 4, INK);
  });
  add('gatelamp', 16, 16, (p) => {
    p.rect(3, 3, 10, 10, '#2a2420', 1);
    p.rect(5, 5, 6, 6, '#ffd28a');
  });
  // Villagers from above: shawl, head, a basket for some.
  const villager = (shawl: string, head: string, basket: boolean) => (p: Painter) => {
    shadow(p, 15, 16, 10, 8);
    p.ell(12, 14, 8, 10, shawl, 1.2);
    p.ell(10, 14, 4, 8, 'rgba(0,0,0,.2)');
    if (basket) p.circ(22, 21, 4, '#8a6a3a', 1);
    p.circ(15, 14, 5.5, head, 1.2);
  };
  add('villager0', 30, 30, villager('#55603a', '#3a2a1e', false));
  add('villager1', 30, 30, villager('#7c2f28', '#6a5a4a', true));
  add('villager2', 30, 30, villager('#3a4a5a', '#c9b08a', false));
  add('villager3', 30, 30, villager('#8a6a3a', '#2a2018', true));
  add('chicken', 16, 14, (p) => {
    p.ell(7, 7, 5, 4, '#e9e0cc', 0.8);
    p.ell(5, 7, 2.6, 2.4, '#cfc4ac');
    p.circ(12, 7, 2.4, '#e9e0cc', 0.8);
    p.circ(13, 5.5, 1.2, '#b03a30');
    p.poly(
      [
        [14, 6.5],
        [16, 7],
        [14, 7.8],
      ],
      '#d8a040',
    );
  });
  add('chicken2', 16, 14, (p) => {
    p.ell(7, 7, 5, 4, '#8a5a34', 0.8);
    p.ell(5, 7, 2.6, 2.4, '#6a4428');
    p.circ(12, 7, 2.4, '#8a5a34', 0.8);
    p.circ(13, 5.5, 1.2, '#b03a30');
    p.poly(
      [
        [14, 6.5],
        [16, 7],
        [14, 7.8],
      ],
      '#d8a040',
    );
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
    if (b.roof === 'mill') {
      millRoof(c, p, x0 + rw / 2, y0 + rh / 2, Math.min(rw, rh) / 2 - 6);
      tex.refresh();
      return;
    }
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
      slate: ['#3a3a40', '#4d4c52'],
      thatch: ['#7a6236', '#9a7c44'],
      shingle: ['#3e2a1e', '#56392a'],
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
    if (b.roof !== 'slate' && b.roof !== 'tin') {
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
    if (b.roof === 'slate') bellTower(c, p, x0 + rw - 2 * T, y0);
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
  } else if (kind === 'slate') {
    rows(8, (rx, ry, s) => {
      c.strokeStyle = 'rgba(10,10,14,.5)';
      c.lineWidth = 0.8;
      c.strokeRect(rx + 0.5, ry + 0.5, s - 1, s - 1);
      if (r() < 0.2) p.rect(rx + 1, ry + 1, s - 2, s - 2, 'rgba(180,190,210,.08)');
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
  } else if (kind === 'thatch') {
    for (let k = 0; k < (w * h) / 6; k++) {
      const sx = x + r() * w;
      const sy = y + r() * h;
      const len = 4 + r() * 5;
      const col = r() < 0.5 ? 'rgba(40,28,12,.35)' : 'rgba(255,230,160,.18)';
      if (horizontal) p.line(sx, sy, sx + (r() - 0.5), sy + len, col, 0.8);
      else p.line(sx, sy, sx + len, sy + (r() - 0.5), col, 0.8);
    }
  } else {
    rows(9, (rx, ry, s) => {
      c.strokeStyle = 'rgba(15,8,4,.55)';
      c.lineWidth = 0.9;
      c.strokeRect(rx + 0.5, ry + 0.5, s * 0.7, s - 1);
    });
  }
}

/** The windmill's cap from above: a round cone of shingles, lit from the top-left. */
function millRoof(
  c: CanvasRenderingContext2D,
  p: Painter,
  cx: number,
  cy: number,
  r: number,
): void {
  p.circ(cx + 9, cy + 9, r, 'rgba(10,6,4,.35)');
  const n = 16;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    // Faces turned towards the top-left catch the light.
    const lit = (Math.cos((a0 + a1) / 2 + Math.PI * 0.75) + 1) / 2;
    const v = Math.round(48 + lit * 40);
    p.poly(
      [
        [cx, cy],
        [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r],
        [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r],
      ],
      `rgb(${v + 14},${Math.round(v * 0.72)},${Math.round(v * 0.5)})`,
    );
  }
  c.strokeStyle = 'rgba(20,10,6,.4)';
  c.lineWidth = 1;
  for (let rr = 10; rr < r; rr += 9) {
    c.beginPath();
    c.arc(cx, cy, rr, 0, Math.PI * 2);
    c.stroke();
  }
  p.circ(cx, cy, r, 'rgba(0,0,0,0)', 2);
  p.circ(cx, cy, 6, '#3e2c1f', 1.2);
}

/** A square bell tower on the chapel's roof: four-sided spire and a cross. */
function bellTower(c: CanvasRenderingContext2D, p: Painter, x: number, y: number): void {
  const s = 2 * T;
  p.rect(x + 2, y + 2, s, s, 'rgba(10,6,4,.4)');
  const cx = x + s / 2;
  const cy = y + s / 2;
  p.poly(
    [
      [x, y],
      [x + s, y],
      [cx, cy],
    ],
    '#2e2e34',
    1.6,
  );
  p.poly(
    [
      [x + s, y],
      [x + s, y + s],
      [cx, cy],
    ],
    '#3c3b42',
    1.6,
  );
  p.poly(
    [
      [x, y + s],
      [x + s, y + s],
      [cx, cy],
    ],
    '#4d4c54',
    1.6,
  );
  p.poly(
    [
      [x, y],
      [x, y + s],
      [cx, cy],
    ],
    '#5a5962',
    1.6,
  );
  c.strokeStyle = '#c9a65a';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx, cy - 9);
  c.lineTo(cx, cy + 9);
  c.moveTo(cx - 6, cy - 3);
  c.lineTo(cx + 6, cy - 3);
  c.stroke();
}
