import type * as Phaser from 'phaser';
import { INK, painter, type Painter } from './brush';
import { mulberry32 } from './util';

/**
 * The Hollow's enemies and props, all seen from above and facing right
 * like the hero: a wolf, a brigand, a boar, a glass crawler and a shade,
 * the pistol on its stump, a crate of rounds, the brigand's camp.
 */
export function paintFoeAtlas(scene: Phaser.Scene): void {
  const A = scene.textures.createCanvas('ln-foes', 512, 256);
  if (!A) return;
  const c = A.getContext();
  const ar = mulberry32(666);
  let ax = 0;
  let ay = 0;
  let rowH = 0;
  const add = (
    name: string,
    w: number,
    h: number,
    fn: (p: Painter, w: number, h: number) => void,
  ) => {
    if (ax + w > 512) {
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
    p.ell(x, y, rx, ry, 'rgba(10,6,4,.42)');

  // A lean grey wolf, one ear torn, the tail low.
  add('wolf', 46, 26, (p) => {
    shadow(p, 23, 15, 19, 8);
    p.poly(
      [
        [2, 12],
        [10, 10],
        [10, 15],
        [3, 15],
      ],
      '#4b443c',
      1,
    );
    p.ell(21, 13, 13, 7, '#5c554b', 1.3);
    p.ell(19, 11, 9, 3, '#6d665a');
    p.line(12, 13, 29, 13.5, '#443e36', 1.2);
    p.ell(34, 13, 6, 5, '#5c554b', 1.2);
    p.poly(
      [
        [38, 10.5],
        [45, 12.6],
        [45, 13.6],
        [38, 15.5],
      ],
      '#6a6256',
      1,
    );
    p.circ(44.6, 13.1, 1, INK);
    p.poly(
      [
        [31, 8.5],
        [33.5, 4.5],
        [35, 8.6],
      ],
      '#4b443c',
      0.9,
    );
    p.poly(
      [
        [31, 17.5],
        [32.6, 20.4],
        [33.6, 19.6],
        [35, 17.4],
      ],
      '#4b443c',
      0.9,
    );
  });
  // A brigand in a wide hat and a patched coat, a long flintlock held out.
  add('brigand', 40, 36, (p) => {
    const skin = '#c99a74';
    shadow(p, 18, 20, 12, 13);
    p.ell(16, 8, 5, 3, '#4a3a2a', 1.2);
    p.line(17, 8.5, 26, 15.5, INK, 5);
    p.line(17, 8.5, 26, 15.5, '#4a3a2a', 3.4);
    p.line(17, 28, 27, 20.5, INK, 5);
    p.line(17, 28, 27, 20.5, '#4a3a2a', 3.4);
    p.rect(25, 16.6, 13, 2.6, '#2b211a', 0.8);
    p.rect(22.5, 16, 5, 4, '#5a3a22', 0.8);
    p.circ(26.4, 15.8, 2, skin, 1);
    p.circ(27.2, 20.6, 2, skin, 1);
    p.ell(15.5, 18, 7, 11.5, '#54412e', 1.4);
    p.rect(10, 20, 4, 4, '#6a5238');
    p.line(19.6, 9, 20.4, 27, '#3a2c1e', 1);
    p.circ(17, 18, 8.4, '#2e241c', 1.3);
    p.circ(17.4, 18, 5, '#3b2f24', 0.8);
    p.ell(15, 15.6, 3, 1.4, 'rgba(255,255,255,.08)');
  });
  // A big boar: bristles down the spine, a pale scar, tusks forward.
  add('boar', 50, 32, (p) => {
    shadow(p, 25, 18, 22, 11);
    p.ell(22, 16, 17, 10.5, '#3d2c22', 1.4);
    for (let x = 8; x < 36; x += 2.2) {
      p.line(x, 16 + (ar() - 0.5) * 2, x + 1.6, 12 + ar() * 2, '#21160f', 1.2);
    }
    p.line(15, 21, 21, 23.5, '#6d5444', 1);
    p.ell(38, 16, 7.5, 7, '#3d2c22', 1.3);
    p.ell(45.5, 16, 3, 3.6, '#7a5446', 1);
    p.circ(46, 15, 0.7, INK);
    p.circ(46, 17, 0.7, INK);
    p.line(43, 11.5, 47.5, 9.5, '#e4dccb', 1.6);
    p.line(43, 20.5, 47.5, 22, '#e4dccb', 1.6);
    p.poly(
      [
        [35, 9.5],
        [33, 6],
        [37.5, 8.6],
      ],
      '#2a1d15',
      0.8,
    );
    p.poly(
      [
        [35, 22.5],
        [33, 26],
        [37.5, 23.4],
      ],
      '#2a1d15',
      0.8,
    );
    p.line(5, 16, 2, 17.5, '#2a1d15', 1.4);
  });
  // A crawler of black glass: a cracked carapace on six jointed legs.
  add('crawler', 48, 48, (p) => {
    shadow(p, 25, 27, 17, 14);
    c.shadowColor = '#9fd8e6';
    c.shadowBlur = 6;
    for (const [side, dx] of [
      [-1, -8],
      [-1, 0],
      [-1, 8],
      [1, -8],
      [1, 0],
      [1, 9],
    ] as const) {
      const kx = 24 + dx + 3;
      const ky = 24 + side * 15;
      const fx = 24 + dx * 1.6 + 6;
      const fy = 24 + side * 21;
      p.line(24 + dx * 0.6, 24 + side * 5, kx, ky, INK, 3.4);
      p.line(24 + dx * 0.6, 24 + side * 5, kx, ky, '#2a3337', 2);
      p.line(kx, ky, fx, fy, '#1d2427', 1.6);
    }
    p.poly(
      [
        [9, 24],
        [16, 13],
        [30, 12],
        [40, 20],
        [41, 28],
        [30, 36],
        [16, 35],
      ],
      '#20292d',
      1.4,
    );
    c.shadowBlur = 0;
    p.poly(
      [
        [16, 15],
        [29, 14],
        [24, 22],
      ],
      '#3d4e55',
    );
    p.poly(
      [
        [30, 15],
        [38, 21],
        [28, 24],
      ],
      '#2f3c42',
    );
    p.line(14, 30, 24, 23, 'rgba(159,216,230,.55)', 0.8);
    p.line(24, 23, 33, 31, 'rgba(159,216,230,.4)', 0.8);
    p.circ(40, 22, 1.4, '#cfeef4');
    p.circ(40, 26.5, 1.1, '#cfeef4');
  });
  // A shade: a smudge of the dark, frayed at the edges, two pale eyes.
  add('shade', 46, 46, (_p, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 22);
    g.addColorStop(0, 'rgba(2,2,6,.95)');
    g.addColorStop(0.55, 'rgba(8,6,14,.75)');
    g.addColorStop(1, 'rgba(8,6,14,0)');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 15 + ar() * 7 + (Math.cos(a) < -0.5 ? 4 : 0);
      const x = w / 2 + Math.cos(a) * r;
      const y = h / 2 + Math.sin(a) * r;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.fill();
  });
  // The pistol, laid on its side.
  add('pistol', 20, 12, (p) => {
    p.rect(3, 3.5, 14, 3.4, '#2c2f33', 0.9);
    p.poly(
      [
        [4, 6],
        [8, 6],
        [7, 11],
        [3, 11],
      ],
      '#3b3026',
      0.9,
    );
    p.line(5, 4.4, 15, 4.4, 'rgba(255,255,255,.22)', 0.8);
  });
  add('stump', 28, 28, (p) => {
    shadow(p, 15, 16, 11, 9);
    p.circ(13.5, 13.5, 10, '#4a3626', 1.3);
    p.circ(13, 13, 7.4, '#8a6a48');
    for (const r of [5.4, 3.4, 1.4]) {
      c.strokeStyle = 'rgba(70,48,30,.6)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.arc(13.2, 13.2, r, 0, Math.PI * 2);
      c.stroke();
    }
    p.line(13, 13, 19, 7, 'rgba(40,26,16,.7)', 1);
  });
  // A crate of rounds, its lid slid half off.
  add('ammo', 28, 22, (p) => {
    shadow(p, 15, 13, 12, 8);
    p.rect(3, 4, 22, 14, '#4a5236', 1.2);
    p.rect(5, 6, 18, 10, '#2e2a22');
    for (let x = 6.5; x < 21; x += 2.6) {
      for (const y of [8, 12]) p.circ(x, y, 1, '#b08a3c');
    }
    p.rect(12, 2.5, 14, 12, '#56603f', 1.1);
    p.line(14, 8.5, 24, 8.5, 'rgba(0,0,0,.3)', 1);
  });
  add('campfire', 32, 32, (p) => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + ar() * 0.3;
      p.circ(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, 3 + ar(), '#5a554c', 0.9);
    }
    p.circ(16, 16, 8, '#1a120c');
    p.line(10, 12, 22, 20, '#3a281b', 3);
    p.line(10, 20, 21, 11, '#3a281b', 3);
    p.circ(16, 16, 4.5, '#e0602a');
    p.circ(15.4, 15.6, 2.6, '#ffc86a');
  });
  add('bedroll', 36, 18, (p) => {
    shadow(p, 19, 10, 16, 6);
    p.rect(3, 3, 30, 12, '#5a3a2a', 1.2);
    p.rect(3, 3, 7, 12, '#7a5a40', 1);
    p.line(14, 4, 15, 14, 'rgba(0,0,0,.25)', 1);
  });
  add('blood', 26, 22, (p) => {
    p.ell(13, 11, 8, 6, 'rgba(70,10,8,.75)');
    for (let k = 0; k < 6; k++) {
      p.circ(4 + ar() * 18, 3 + ar() * 16, 1 + ar() * 2, 'rgba(70,10,8,.7)');
    }
  });
  // A muzzle flash, pointing right.
  add('flash', 22, 14, (p) => {
    p.poly(
      [
        [0, 7],
        [10, 1],
        [8, 5],
        [21, 7],
        [8, 9],
        [10, 13],
      ],
      '#ffd27a',
    );
    p.ell(5, 7, 4, 3, '#fff6d8');
  });
  A.refresh();
}
