import type * as Phaser from 'phaser';
import { INK, painter, type Painter } from './brush';
import { paintHouseAtlas, paintHouseTiles } from './house-art';
import { paintLabAtlas, paintLabTiles } from './lab-art';
import { paintCellarAtlas } from './cellar-art';
import { paintFoeAtlas } from './foe-art';
import { paintUpperAtlas, paintUpperTiles, paintUpperTrees } from './upper-art';
import { T, TILE_SLOTS, mulberry32 } from './util';

/**
 * Paints the whole look at start-up: a ground sheet, an atlas of
 * objects and the light masks. Nothing is loaded from disk.
 */
export function createLanternTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('ln-tiles')) return;
  paintTiles(scene);
  paintAtlas(scene);
  paintHouseAtlas(scene);
  paintLabAtlas(scene);
  paintUpperAtlas(scene);
  paintUpperTrees(scene);
  paintCellarAtlas(scene);
  paintFoeAtlas(scene);
  paintLights(scene);
}

function paintTiles(scene: Phaser.Scene): void {
  const tt = scene.textures.createCanvas('ln-tiles', T * TILE_SLOTS, T);
  if (!tt) return;
  const c = tt.getContext();
  const r = mulberry32(42);
  const at = (i: number, fn: (p: Painter) => void) => {
    c.save();
    c.translate(i * T, 0);
    c.beginPath();
    c.rect(0, 0, T, T);
    c.clip();
    fn(painter(c));
    c.restore();
  };
  paintHouseTiles(at, r);
  paintUpperTiles(at, r);
  paintLabTiles(at, r);
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
  // The hero from above, facing right: an ordinary person in an open
  // jacket over a grey hoodie. 'heroLit' holds the flashlight out ahead;
  // with 'Gun' the pistol is drawn in the other hand. `step` (-1..1) puts
  // one foot forward from under the jacket and swings the free arms against
  // it; the left shoe is a touch more worn and turned out.
  const hero = (p: Painter, lit: boolean, gun = false, step = 0) => {
    const skin = '#d9a77f';
    const sleeve = '#33475b';
    shadow(p, 18, 20, 12, 13);
    if (step) {
      const shoe = (x: number, y: number, tilt: number, col: string) => {
        p.ell(x, y, 3.6, 2.2, INK);
        p.ell(x, y + tilt, 2.9, 1.6, col);
      };
      shoe(16 + step * 7.4, 12.8, -0.3, '#3d352d');
      shoe(16 - step * 7, 23.4, 0.2, '#453b31');
    }
    const swing = -step * 2.4;
    if (gun) {
      p.line(17, 8.6, 27, 11, INK, 6.2);
      p.line(17, 8.6, 27, 11, sleeve, 4);
      p.rect(27, 10, 8.4, 2.6, '#2c2f33', 0.8);
      p.circ(27.4, 11.2, 2.1, skin, 1);
    } else {
      p.ell(16.5 + swing, 7.6, 5, 2.9, sleeve, 1.2);
      p.circ(21.2 + swing * 1.4, 7.4, 2.1, skin, 1);
    }
    if (lit) {
      p.line(17, 27.4, 27, 25.6, INK, 6.2);
      p.line(17, 27.4, 27, 25.6, sleeve, 4);
      p.rect(27.5, 24, 6, 3, '#3a3d42', 0.8);
      p.rect(32.6, 23.5, 2, 4, '#fff0b8', 0.8);
      p.circ(27.6, 25.6, 2.1, skin, 1);
    } else {
      p.ell(16.8 + step * 2.4, 28.6, 5, 2.9, sleeve, 1.2);
      p.circ(21.4 + step * 3.4, 29, 2.1, skin, 1);
    }
    p.ell(16, 18, 6.6, 11.2, '#3d556c', 1.4);
    p.ell(11.4, 18.4, 2.6, 5.2, '#8d9196', 0.8);
    p.line(20.6, 10.5, 21.4, 25.5, '#26333f', 1);
    p.ell(21.9, 18.3, 2.5, 3.5, skin, 1);
    p.circ(18.6, 18.1, 5.6, '#4b3222', 1.3);
    p.ell(17, 16.4, 2.2, 1.2, 'rgba(255,255,255,.12)');
  };
  // Each pose standing, and mid-stride on either foot ('Step1', 'Step2').
  for (const [name, lit, gun] of [
    ['hero', false, false],
    ['heroLit', true, false],
    ['heroGun', false, true],
    ['heroLitGun', true, true],
  ] as const) {
    add(name, 36, 36, (p) => hero(p, lit, gun));
    add(`${name}Step1`, 36, 36, (p) => hero(p, lit, gun, 1));
    add(`${name}Step2`, 36, 36, (p) => hero(p, lit, gun, -1));
  }
  add('dot', 8, 8, (p) => p.circ(4, 4, 3.5, '#ffffff'));
  // Prints left on the ground, toes to the right; flipped for the other
  // foot. A shoe's sole and heel with a worn tread, a wolf's pad and toes,
  // a boar's split hoof, the three scratches of a crawler's glass foot.
  const PRINT = 'rgba(18,12,8,.85)';
  add('printShoe', 12, 6, (p) => {
    p.ell(7.6, 3, 3.6, 2.2, PRINT);
    p.ell(1.9, 3.1, 1.7, 1.8, PRINT);
    p.line(6, 1.6, 6, 4.4, 'rgba(18,12,8,.4)', 0.6);
    p.line(8.4, 1.4, 8.4, 4.6, 'rgba(18,12,8,.4)', 0.6);
  });
  add('printPaw', 8, 7, (p) => {
    p.ell(2.6, 3.5, 1.8, 2, PRINT);
    for (const [x, y] of [
      [5.4, 1.2],
      [6.6, 2.8],
      [6.6, 4.3],
      [5.4, 5.8],
    ] as const)
      p.circ(x, y, 0.85, PRINT);
  });
  add('printHoof', 8, 7, (p) => {
    p.ell(4.3, 2.1, 2.9, 1.25, PRINT);
    p.ell(4, 4.9, 2.7, 1.25, PRINT);
  });
  add('printClaw', 8, 7, (p) => {
    p.line(1, 1.4, 6.6, 2.2, PRINT, 0.8);
    p.line(1.4, 3.6, 7, 3.5, PRINT, 0.8);
    p.line(1, 5.8, 6, 5, PRINT, 0.7);
  });
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
