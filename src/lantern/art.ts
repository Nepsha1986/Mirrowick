import type * as Phaser from 'phaser';
import { INK, painter, type Painter } from './brush';
import { paintTownAtlas, paintTownTiles } from './town-art';
import { paintUpperAtlas, paintUpperTiles } from './upper-art';
import { T, TILE_SLOTS, TL, mulberry32 } from './util';

/**
 * Paints the whole look at start-up: a ground sheet, an atlas of
 * objects and the light masks. Nothing is loaded from disk.
 */
export function createLanternTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('ln-tiles')) return;
  paintTiles(scene);
  paintAtlas(scene);
  paintTownAtlas(scene);
  paintUpperAtlas(scene);
  paintLights(scene);
}

function paintTiles(scene: Phaser.Scene): void {
  const tt = scene.textures.createCanvas('ln-tiles', T * TILE_SLOTS, T);
  if (!tt) return;
  const c = tt.getContext();
  const r = mulberry32(42);
  const pick = (cols: string[]) => cols[Math.floor(r() * cols.length)] as string;
  const at = (i: number, fn: (p: Painter) => void) => {
    c.save();
    c.translate(i * T, 0);
    c.beginPath();
    c.rect(0, 0, T, T);
    c.clip();
    fn(painter(c));
    c.restore();
  };
  const speck = (p: Painter, base: string, cols: string[], n: number, sz = 2) => {
    p.rect(0, 0, T, T, base);
    for (let k = 0; k < n; k++) {
      const s = 1 + Math.floor(r() * sz);
      p.rect(Math.floor(r() * T), Math.floor(r() * T), s, s, pick(cols));
    }
  };
  const blades = (p: Painter, col: string, n: number) => {
    for (let k = 0; k < n; k++) {
      const x = r() * T;
      const y = r() * T;
      p.line(x, y, x + (r() - 0.5) * 3, y - 2 - r() * 3, col, 1);
    }
  };
  // Dry olive-sepia grass in three shades, with fallen rust leaves.
  const grass = (p: Painter, base: string, cols: string[], blade: string) => {
    speck(p, base, cols, 80);
    blades(p, blade, 10);
    for (let k = 0; k < 2; k++) p.rect(r() * T, r() * T, 2, 1, pick(['#7a3a22', '#8a4a2a']));
  };
  at(TL.G1, (p) => grass(p, '#3a3826', ['#323020', '#423f2b', '#47432e', '#2d2b1d'], '#555235'));
  at(TL.G2, (p) => grass(p, '#423d29', ['#3a3523', '#4a4430', '#4f4832', '#353022'], '#615a3c'));
  at(TL.G3, (p) => grass(p, '#4c432e', ['#433b28', '#574d35', '#5d5239', '#3d3524'], '#6e6343'));
  at(TL.DIRT, (p) => speck(p, '#4d3e2c', ['#433626', '#584835', '#3c3022', '#5f4e39'], 90));
  // Cart roads: packed earth with ruts.
  const road = (p: Painter) => {
    speck(p, '#5a4733', ['#4f3e2c', '#65513b', '#4a3a29', '#6b5740'], 110, 1);
    p.rect(7, 0, 3, T, 'rgba(30,20,12,.28)');
    p.rect(22, 0, 3, T, 'rgba(30,20,12,.28)');
  };
  at(TL.ROAD, road);
  at(TL.ROADC, (p) => {
    road(p);
    p.ell(16, 18, 7, 4, '#2e2a26');
    p.ell(15, 17, 5, 2.4, '#4d5357');
  });
  const water = (p: Painter) => {
    p.rect(0, 0, T, T, '#1d2826');
    for (let k = 0; k < 6; k++) {
      const x = r() * T;
      const y = r() * T;
      p.line(x, y, x + 6 + r() * 6, y, 'rgba(190,200,170,.12)', 1.2);
    }
    for (let k = 0; k < 20; k++) p.rect(r() * T, r() * T, 1, 1, '#25312e');
  };
  at(TL.WATER, water);
  at(TL.BRIDGE, (p) => {
    p.rect(0, 0, T, T, '#3a2a1e');
    for (let x = 0; x < T; x += 6) {
      p.rect(x, 0, 5, T, x % 12 ? '#5e4430' : '#674b35');
      p.rect(x + 2, 4 + ((x * 7) % 20), 1, 1, '#2a1f16');
    }
    p.rect(0, 0, T, 2, INK);
    p.rect(0, T - 2, T, 2, INK);
  });
  at(TL.BBRIDGE, (p) => {
    water(p);
    p.rect(2, 4, 5, 10, '#4a3828', 1);
    p.rect(22, 18, 5, 8, '#4a3828', 1);
  });
  // Village cobbles.
  at(TL.PAVE, (p) => {
    p.rect(0, 0, T, T, '#3b342c');
    for (let y = 0; y < T; y += 8) {
      for (let x = ((y / 8) % 2) * 5; x < T; x += 10) {
        p.rect(x + 1, y + 1, 8, 6, pick(['#5a5147', '#615749', '#544b41']));
        p.rect(x + 2, y + 1.5, 5, 1, 'rgba(255,235,205,.08)');
      }
    }
  });
  at(TL.FLOOR, (p) => {
    p.rect(0, 0, T, T, '#2e241c');
    for (let y = 0; y < T; y += 6) p.rect(0, y, T, 5, y % 12 ? '#3c2f24' : '#372b21');
    for (let k = 0; k < 10; k++) p.rect(r() * T, r() * T, 2, 1, '#241b14');
  });
  at(TL.WALL, (p) => {
    p.rect(0, 0, T, T, '#3e342c');
    for (let y = 0; y < T; y += 6) {
      for (let x = ((y / 6) % 2) * 5; x < T; x += 10) {
        p.rect(x + 1, y + 1, 8, 4, pick(['#6b6052', '#73675a', '#62584b']));
      }
    }
    p.rect(0, T - 4, T, 4, 'rgba(0,0,0,.35)');
    p.rect(0, 0, T, 2, 'rgba(255,230,200,.1)');
  });
  // The palisade: sharpened stakes lashed with rope.
  at(TL.TWALL, (p) => {
    p.rect(0, 0, T, T, '#1f1812');
    for (let x = 0; x < T; x += 8) {
      p.rect(x + 1, 1, 6, T - 2, pick(['#5a4330', '#634a35', '#513c2b']));
      p.rect(x + 1, 1, 2, T - 2, 'rgba(255,225,190,.1)');
      p.circ(x + 4, 5, 2, '#2a2018');
    }
    p.rect(0, 14, T, 3, '#8a6e48');
  });
  // The Mirror: black glass with cold glints.
  at(TL.GLASS, (p) => {
    p.rect(0, 0, T, T, '#121619');
    for (let k = 0; k < 4; k++) {
      const x = r() * T;
      const y = r() * T;
      p.line(x, y, x + (r() - 0.5) * 14, y + (r() - 0.5) * 14, 'rgba(159,216,230,.22)', 1);
    }
    for (let k = 0; k < 3; k++) p.rect(r() * T, r() * T, 2, 2, '#9fd8e6');
  });
  at(TL.SAND, (p) => speck(p, '#5a5038', ['#514730', '#655a40', '#6b5f44', '#4a412c'], 90, 1));
  at(TL.GATE, (p) => {
    p.rect(0, 0, T, T, '#3b342c');
    for (let x = -T; x < T; x += 10) {
      p.poly(
        [
          [x, 0],
          [x + 5, 0],
          [x + 5 + T, T],
          [x + T, T],
        ],
        'rgba(232,103,58,.14)',
      );
    }
  });
  paintTownTiles(at, r);
  paintUpperTiles(at, r);
  // Quarter tiles, to lay floor right up to a thin wall from either side.
  for (let i = 0; i < TILE_SLOTS; i++) {
    for (const qx of [0, 1])
      for (const qy of [0, 1]) tt.add(`q${i}-${qx}${qy}`, 0, i * T + qx * 16, qy * 16, 16, 16);
  }
  tt.refresh();
}

function paintAtlas(scene: Phaser.Scene): void {
  const A = scene.textures.createCanvas('ln-atlas', 1024, 512);
  if (!A) return;
  const a = A.getContext();
  const ar = mulberry32(9);
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
    a.save();
    a.translate(ax, ay);
    a.beginPath();
    a.rect(0, 0, w, h);
    a.clip();
    fn(painter(a), w, h);
    a.restore();
    A.add(name, 0, ax, ay, w, h);
    ax += w + 2;
    rowH = Math.max(rowH, h);
  };
  const shadow = (p: Painter, x: number, y: number, rx: number, ry: number) =>
    p.ell(x, y, rx, ry, 'rgba(10,6,4,.42)');

  // Canopies from above: inked blobs, lit from the top-left.
  const tree = (cols: [string, string, string]) => (p: Painter, w: number, h: number) => {
    shadow(p, w / 2 + 4, h / 2 + 5, w / 2 - 6, h / 2 - 8);
    const cx = w / 2;
    const cy = h / 2;
    const blobs: [number, number, number][] = [];
    for (let k = 0; k < 9; k++) {
      const ang = ar() * 6.28;
      const d = ar() * 10;
      blobs.push([cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, 10 + ar() * 6]);
    }
    for (const [x, y, r] of blobs) p.circ(x, y, r + 1.4, INK);
    for (const [x, y, r] of blobs) p.circ(x, y, r, cols[0]);
    for (let k = 0; k < 8; k++) {
      const ang = ar() * 6.28;
      const d = ar() * 9;
      p.circ(cx + Math.cos(ang) * d - 2, cy + Math.sin(ang) * d - 2, 6 + ar() * 5, cols[1]);
    }
    for (let k = 0; k < 6; k++) {
      const ang = ar() * 6.28;
      const d = ar() * 8;
      p.circ(cx + Math.cos(ang) * d - 4, cy + Math.sin(ang) * d - 4, 3 + ar() * 3, cols[2]);
    }
  };
  add('tree', 58, 58, tree(['#24301f', '#313f27', '#475535']));
  add('tree2', 58, 58, tree(['#3a281b', '#563623', '#7a5230']));
  add('dead', 50, 50, (p, w, h) => {
    shadow(p, w / 2 + 3, h / 2 + 4, 14, 11);
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * 6.28 + ar() * 0.4;
      const l = 14 + ar() * 8;
      p.line(w / 2, h / 2, w / 2 + Math.cos(ang) * l, h / 2 + Math.sin(ang) * l, INK, 3.6);
      p.line(w / 2, h / 2, w / 2 + Math.cos(ang) * l, h / 2 + Math.sin(ang) * l, '#4a3a2c', 2.2);
      p.line(
        w / 2 + Math.cos(ang) * l * 0.6,
        h / 2 + Math.sin(ang) * l * 0.6,
        w / 2 + Math.cos(ang + 0.5) * l * 0.9,
        h / 2 + Math.sin(ang + 0.5) * l * 0.9,
        '#3e3026',
        1.4,
      );
    }
    p.circ(w / 2, h / 2, 5, '#3a2c22', 1.2);
  });
  add('rock', 34, 30, (p) => {
    shadow(p, 19, 18, 13, 9);
    p.poly(
      [
        [5, 16],
        [9, 6],
        [20, 3],
        [29, 9],
        [30, 20],
        [20, 26],
        [9, 24],
      ],
      '#5a554c',
      1.3,
    );
    p.poly(
      [
        [9, 7],
        [20, 4],
        [27, 9],
        [18, 12],
        [10, 13],
      ],
      '#787166',
    );
  });
  add('rock2', 26, 24, (p) => {
    shadow(p, 14, 14, 10, 7);
    p.poly(
      [
        [3, 13],
        [7, 4],
        [16, 3],
        [23, 9],
        [21, 19],
        [10, 20],
      ],
      '#5f594f',
      1.2,
    );
    p.poly(
      [
        [7, 5],
        [16, 4],
        [20, 8],
        [12, 10],
      ],
      '#7c7569',
    );
  });
  // A standing shard of the Mirror.
  add('shard', 26, 40, (p) => {
    a.shadowColor = '#9fd8e6';
    a.shadowBlur = 8;
    p.poly(
      [
        [13, 2],
        [19, 18],
        [13, 37],
        [7, 18],
      ],
      '#20292d',
      1.2,
    );
    a.shadowBlur = 0;
    p.poly(
      [
        [13, 2],
        [19, 18],
        [13, 22],
      ],
      '#cfeef4',
    );
    p.poly(
      [
        [4, 16],
        [8, 22],
        [6, 34],
        [2, 24],
      ],
      '#2b373c',
      1,
    );
    p.line(10, 12, 15, 28, 'rgba(159,216,230,.7)', 1);
  });
  add('well', 34, 34, (p) => {
    shadow(p, 19, 20, 15, 12);
    p.circ(17, 17, 14, '#6b6052', 1.4);
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * 6.28;
      p.line(
        17 + Math.cos(ang) * 10,
        17 + Math.sin(ang) * 10,
        17 + Math.cos(ang) * 14,
        17 + Math.sin(ang) * 14,
        INK,
        1,
      );
    }
    p.circ(17, 17, 9, '#0f0c0a', 1);
    p.line(3, 17, 31, 17, '#5e4330', 3);
  });
  add('logs', 46, 28, (p) => {
    shadow(p, 24, 16, 20, 10);
    for (let k = 0; k < 3; k++) {
      const y = 5 + k * 7;
      p.rect(6, y, 34, 7, ['#5e4128', '#53391f', '#68482b'][k] as string, 1);
      p.circ(6, y + 3.5, 3.5, '#9a7550', 1);
    }
  });
  add('wheel', 34, 34, (p) => {
    p.circ(17, 17, 15, '#3d2e22', 1.4);
    p.circ(17, 17, 12, '#2b2119');
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * 6.28;
      p.line(17, 17, 17 + Math.cos(ang) * 13, 17 + Math.sin(ang) * 13, '#5e4733', 2.5);
    }
    p.circ(17, 17, 3, '#6b6b6b', 1);
  });
  // Village roofs from above: crimson tiles, ridge, chimney.
  const roof = (c1: string, c2: string) => (p: Painter, w: number, h: number) => {
    shadow(p, w / 2 + 8, h / 2 + 9, w / 2 - 4, h / 2 - 4);
    p.rect(3, 3, w - 6, h / 2 - 3, c1, 2);
    p.rect(3, h / 2, w - 6, h / 2 - 3, c2, 2);
    for (let y = 9; y < h - 4; y += 7) {
      p.rect(4, y, w - 8, 1, 'rgba(15,6,4,.3)');
      for (let x = 4 + (y % 14 ? 0 : 4); x < w - 6; x += 8)
        p.rect(x, y - 6, 1, 6, 'rgba(15,6,4,.18)');
    }
    p.rect(3, h / 2 - 2, w - 6, 4, INK);
    p.rect(84, 14, 12, 12, '#5a5147', 1.4);
    p.rect(87, 17, 6, 6, '#0f0c0a');
    for (let k = 0; k < 5; k++)
      p.ell(10 + ar() * (w - 20), h / 2 + 8 + ar() * 40, 4 + ar() * 6, 3, 'rgba(70,80,45,.35)');
  };
  add('roofA', 128, 128, roof('#5c2420', '#7c2f28'));
  add('roofB', 128, 128, roof('#542a22', '#6f3a2c'));
  // The Wick: a great candle on a stone plinth.
  add('wick', 64, 64, (p) => {
    shadow(p, 34, 36, 26, 22);
    p.rect(6, 6, 52, 52, '#4a4238', 1.6);
    p.rect(10, 10, 44, 44, '#5d5447');
    p.circ(32, 32, 16, '#e9dcc0', 1.6);
    p.circ(32, 32, 12, '#d6c7a6');
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * 6.28;
      p.ell(32 + Math.cos(ang) * 15, 32 + Math.sin(ang) * 15, 3, 2.5, '#efe4cc', 0.8);
    }
    p.circ(32, 32, 4, INK);
  });
  add('lamp', 16, 16, (p) => {
    p.circ(8, 8, 6, '#2a2420', 1);
    p.circ(8, 8, 3.5, '#ffd28a');
  });
  add('barrel', 18, 18, (p) => {
    shadow(p, 10, 11, 8, 6);
    p.circ(9, 9, 8, '#5a3a26', 1.2);
    p.circ(9, 9, 6, '#4a2f1f');
    p.circ(9, 9, 2, '#2a1a10');
  });
  add('crate', 24, 24, (p) => {
    shadow(p, 13, 14, 11, 9);
    p.rect(2, 2, 20, 20, '#5e4429', 1.2);
    p.rect(2, 2, 20, 3, '#705233');
    p.line(4, 4, 20, 20, '#3e2c1a', 2);
    p.line(20, 4, 4, 20, '#3e2c1a', 2);
  });
  // An overturned cart, seen from above.
  add('cart', 62, 34, (p) => {
    shadow(p, 32, 20, 28, 13);
    p.rect(8, 5, 44, 24, '#5e4330', 1.4);
    for (let x = 12; x < 50; x += 6) p.rect(x, 6, 1, 22, '#3e2c1f');
    p.line(52, 12, 61, 10, '#3e2c1f', 2.5);
    p.line(52, 22, 61, 24, '#3e2c1f', 2.5);
    for (const [x, y] of [
      [16, 2],
      [16, 32],
      [42, 2],
      [42, 32],
    ] as const) {
      p.rect(x - 6, y - 2, 12, 4, '#2a2018', 1);
    }
  });
  add('tuft', 16, 14, (p) => {
    for (let k = 0; k < 6; k++) {
      const x = 4 + ar() * 8;
      p.line(
        x,
        12,
        x + (ar() - 0.5) * 8,
        2 + ar() * 4,
        ['#57553a', '#636043', '#4a4831'][k % 3] as string,
        1.3,
      );
    }
  });
  add('bones', 18, 14, (p) => {
    p.line(3, 4, 14, 10, '#b7ad98', 2);
    p.line(5, 11, 13, 3, '#a99f8a', 1.6);
    p.circ(14, 10, 2, '#c4baa5');
  });
  add('debris', 20, 16, (p) => {
    p.poly(
      [
        [2, 8],
        [8, 3],
        [12, 7],
        [6, 13],
      ],
      '#5a4b42',
      0.8,
    );
    p.poly(
      [
        [11, 10],
        [17, 6],
        [19, 12],
        [13, 14],
      ],
      '#4a3f37',
      0.8,
    );
  });
  // The lantern-bearer, from above, facing right: hood, crimson scarf, lantern.
  add('hero', 36, 36, (p) => {
    shadow(p, 19, 21, 13, 10);
    p.ell(15, 18, 10, 11, '#4a3526', 1.4);
    p.ell(13, 18, 6, 9, '#3a2a1e');
    p.rect(17, 9, 5, 18, '#8a3a2c', 1);
    p.line(24, 24, 29, 27, '#2a2420', 1.4);
    p.rect(27, 25, 6, 6, '#ffd58a', 1);
    p.circ(18, 18, 6.5, '#3d2c20', 1.4);
    p.circ(20, 18, 3, '#140d08');
  });
  add('dot', 8, 8, (p) => p.circ(4, 4, 3.5, '#ffffff'));
  A.refresh();
}

function paintLights(scene: Phaser.Scene): void {
  // A soft round glow, tinted per light and added on top of the world.
  const Gl = scene.textures.createCanvas('glow', 256, 256);
  if (Gl) {
    const gc = Gl.getContext();
    const g = gc.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    gc.fillStyle = g;
    gc.fillRect(0, 0, 256, 256);
    Gl.refresh();
  }
  const L = scene.textures.createCanvas('ln-light', 256, 256);
  if (L) {
    const lc = L.getContext();
    const g = lc.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    lc.fillStyle = g;
    lc.fillRect(0, 0, 256, 256);
    L.refresh();
  }
  // The lantern's beam: a soft wedge from the left edge.
  const Co = scene.textures.createCanvas('ln-cone', 256, 256);
  if (Co) {
    const cc = Co.getContext();
    const g = cc.createRadialGradient(8, 128, 0, 8, 128, 240);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cc.filter = 'blur(7px)';
    cc.fillStyle = g;
    cc.beginPath();
    cc.moveTo(8, 128);
    cc.arc(8, 128, 236, -0.42, 0.42);
    cc.closePath();
    cc.fill();
    Co.refresh();
  }
}
