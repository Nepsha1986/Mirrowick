import type * as Phaser from 'phaser';
import { INK, painter, type Painter } from './brush';
import { T, TL, mulberry32 } from './util';

type At = (i: number, fn: (p: Painter) => void) => void;

const WOOD = '#8a6440';
const WOOD_DARK = '#4a3322';
const WHITE = '#ece8dc';

// --- Ground ------------------------------------------------------------------------------

/** The Upper World's ground: fresh grass and bathroom tiles; paths are painted over it. */
export function paintUpperTiles(at: At, r: () => number): void {
  const pick = (cols: string[]) => cols[Math.floor(r() * cols.length)] as string;
  const speck = (p: Painter, base: string, cols: string[], n: number, sz = 2) => {
    p.rect(0, 0, T, T, base);
    for (let k = 0; k < n; k++) {
      const s = 1 + Math.floor(r() * sz);
      p.rect(Math.floor(r() * T), Math.floor(r() * T), s, s, pick(cols));
    }
  };
  const grass = (base: string, cols: string[], blade: string) => (p: Painter) => {
    speck(p, base, cols, 70);
    for (let k = 0; k < 12; k++) {
      const x = r() * T;
      const y = r() * T;
      p.line(x, y, x + (r() - 0.5) * 3, y - 2 - r() * 3, blade, 1);
    }
  };
  at(TL.UG1, grass('#5d7d36', ['#56752f', '#668740', '#517030', '#6b8c44'], '#7a9c4c'));
  at(TL.UG2, grass('#678a3c', ['#5f8235', '#729546', '#5a7b33', '#7a9d4c'], '#86a955'));
  at(TL.UG3, grass('#729640', ['#6a8d39', '#7da04a', '#668836', '#86a952'], '#93b45c'));
  // Cellar rock: dark, damp, a few glints.
  at(TL.ROCK, (p) => {
    speck(p, '#1c1918', ['#24201e', '#161312', '#2a2522', '#1f1b19'], 90, 3);
    for (let k = 0; k < 3; k++) p.rect(r() * T, r() * T, 1, 1, 'rgba(160,180,190,.25)');
  });
  at(TL.TILEW, (p) => {
    p.rect(0, 0, T, T, '#a9b0b2');
    for (let y = 0; y < T; y += 8) {
      for (let x = 0; x < T; x += 8) {
        p.rect(x + 0.5, y + 0.5, 7, 7, pick(['#e4e8e6', '#dde2e0', '#e8ecea']));
        p.rect(x + 1, y + 1, 4, 1, 'rgba(255,255,255,.6)');
      }
    }
  });
}

// --- Trees -------------------------------------------------------------------------------

/** The size of a crown's frame; at scale 1 it is a little over four tiles across. */
export const CROWN = 144;

/**
 * The Upper World's trees, in their own sheet: big crowns that hang over the
 * hero (`crown0`…`crown2`, `crownApple`), the trunk under them, and the
 * shade a crown casts on the grass. A few shared crowns, turned and scaled
 * per tree, keep start-up cheap.
 */
export function paintUpperTrees(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas('ln-trees', 6 * (CROWN + 2), CROWN);
  if (!tex) return;
  const c = tex.getContext();
  const r = mulberry32(808);
  let ax = 0;
  const add = (name: string, w: number, fn: (p: Painter) => void) => {
    c.save();
    c.translate(ax, 0);
    c.beginPath();
    c.rect(0, 0, w, CROWN);
    c.clip();
    fn(painter(c));
    c.restore();
    tex.add(name, 0, ax, 0, w, CROWN);
    ax += w + 2;
  };
  const m = CROWN / 2;
  /**
   * A crown from above: lobes of leaves round a ragged ring, lit from the
   * top left, one lobe missing so a bough shows through, and darker clumps
   * on the shaded side.
   */
  const crown = (cols: [string, string, string], fruit?: string) => (p: Painter) => {
    const lobes: [number, number, number][] = [];
    const gap = Math.floor(r() * 11);
    for (let k = 0; k < 11; k++) {
      if (k === gap) continue;
      const a = (k / 11) * Math.PI * 2 + (r() - 0.5) * 0.4;
      const d = 38 + r() * 9;
      lobes.push([m + Math.cos(a) * d, m + Math.sin(a) * d, 17 + r() * 8]);
    }
    lobes.push([m, m, 44]);
    // Boughs from the trunk, seen only through the gap.
    for (let k = 0; k < 5; k++) {
      const a = ((gap + k * 2.2) / 11) * Math.PI * 2;
      p.line(m, m, m + Math.cos(a) * 52, m + Math.sin(a) * 52, '#4a3524', 3.2 - k * 0.3);
    }
    for (const [x, y, rad] of lobes) p.circ(x, y, rad + 1.6, INK);
    for (const [x, y, rad] of lobes) p.circ(x, y, rad, cols[0]);
    for (const [x, y, rad] of lobes) p.circ(x - 4, y - 4, rad * 0.72, cols[1]);
    for (let k = 0; k < 14; k++) {
      const a = r() * Math.PI * 2;
      const d = r() * 40;
      p.circ(m - 10 + Math.cos(a) * d, m - 10 + Math.sin(a) * d, 4 + r() * 6, cols[2]);
    }
    // Leaves: light flecks and the shade between clumps.
    for (let k = 0; k < 160; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 50;
      const x = m + Math.cos(a) * d;
      const y = m + Math.sin(a) * d;
      const lit = x + y < 2 * m - 10;
      p.circ(x, y, 1.2 + r() * 1.4, lit ? 'rgba(220,240,160,.22)' : 'rgba(10,30,5,.2)');
    }
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * 0.25 + (r() - 0.5) * 1.4;
      const d = 22 + r() * 22;
      p.circ(m + Math.cos(a) * d, m + Math.sin(a) * d, 8 + r() * 6, 'rgba(10,30,5,.18)');
    }
    if (fruit) {
      for (let k = 0; k < 22; k++) {
        const a = r() * Math.PI * 2;
        const d = 8 + r() * 40;
        p.circ(m + Math.cos(a) * d, m + Math.sin(a) * d, 2.6, fruit, 0.6);
      }
    }
  };
  add('crown0', CROWN, crown(['#335e25', '#44772f', '#62953f']));
  add('crown1', CROWN, crown(['#3e6a29', '#548636', '#77a64a']));
  add('crown2', CROWN, crown(['#2f5824', '#3f6e2c', '#5a8a3a']));
  add('crownApple', CROWN, crown(['#3b6a2a', '#4f8234', '#6ea044'], '#c8362c'));
  // The shade under a crown: soft, darkest near the trunk.
  add('crownShade', CROWN, () => {
    const g = c.createRadialGradient(m, m, 8, m, m, m - 2);
    g.addColorStop(0, 'rgba(12,28,6,.42)');
    g.addColorStop(0.7, 'rgba(12,28,6,.26)');
    g.addColorStop(1, 'rgba(12,28,6,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, CROWN, CROWN);
  });
  // The trunk: bark, a few roots into the grass.
  add('trunk', 40, (p) => {
    const y = m;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r() * 0.8;
      p.line(
        20,
        y,
        20 + Math.cos(a) * (13 + r() * 5),
        y + Math.sin(a) * (13 + r() * 5),
        '#5a4130',
        3,
      );
    }
    p.circ(20, y, 10, '#5e4532', 1.4);
    p.circ(18.5, y - 1.5, 6, '#72563f');
    p.line(15, y + 3, 24, y - 4, 'rgba(30,20,12,.5)', 1);
  });
  tex.refresh();
}

// --- Objects -----------------------------------------------------------------------------

/** The Upper World's things, and the Lower World windmill's insides, in one atlas. */
export function paintUpperAtlas(scene: Phaser.Scene): void {
  const A = scene.textures.createCanvas('ln-up', 1024, 1024);
  if (!A) return;
  const c = A.getContext();
  const ar = mulberry32(555);
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
    p.ell(x, y, rx, ry, 'rgba(20,30,10,.3)');
  const rrect = (x: number, y: number, w: number, h: number, rad: number) => {
    c.beginPath();
    c.roundRect(x, y, w, h, rad);
  };
  const fillInk = (fill: string, ink = 1.2) => {
    c.fillStyle = fill;
    c.fill();
    if (ink) {
      c.strokeStyle = INK;
      c.lineWidth = ink;
      c.stroke();
    }
  };

  // A small blue hatchback from above, nose to the south.
  add('car', 60, 116, (p) => {
    shadow(p, 33, 62, 28, 54);
    rrect(5, 5, 50, 106, 14);
    fillInk('#3d6f8e', 1.6);
    // Bonnet and boot shading, roof, glass.
    rrect(8, 76, 44, 30, 10);
    fillInk('#467d9e', 0);
    rrect(9, 30, 42, 52, 6);
    fillInk('#2a3a44', 1);
    rrect(12, 38, 36, 36, 4);
    fillInk('#4a85a8', 0);
    p.rect(13, 40, 34, 3, 'rgba(255,255,255,.18)');
    // Windscreen and rear window.
    p.poly(
      [
        [11, 76],
        [49, 76],
        [45, 84],
        [15, 84],
      ],
      '#9fc4d6',
      1,
    );
    p.poly(
      [
        [13, 24],
        [47, 24],
        [49, 30],
        [11, 30],
      ],
      '#7fa6ba',
      1,
    );
    // Mirrors, lights, wheels peeking out.
    p.rect(1, 70, 5, 6, '#2a3a44', 1);
    p.rect(54, 70, 5, 6, '#2a3a44', 1);
    p.rect(10, 104, 10, 4, '#fff2c0', 0.8);
    p.rect(40, 104, 10, 4, '#fff2c0', 0.8);
    p.rect(10, 7, 9, 3, '#c0392b', 0.8);
    p.rect(41, 7, 9, 3, '#c0392b', 0.8);
    for (const [x, y] of [
      [3, 22],
      [53, 22],
      [3, 88],
      [53, 88],
    ] as const) {
      p.rect(x, y, 4, 14, '#1d1f22');
    }
  });

  add('bush', 30, 30, (p) => {
    shadow(p, 17, 18, 12, 9);
    for (let k = 0; k < 6; k++)
      p.circ(
        9 + ar() * 12,
        9 + ar() * 12,
        6 + ar() * 3,
        ['#3f6c2b', '#507f35'][k % 2] as string,
        0.8,
      );
    for (let k = 0; k < 4; k++) p.circ(9 + ar() * 10, 8 + ar() * 10, 2.5, '#6c9d45');
  });
  add('daisies', 16, 16, (p) => {
    for (let k = 0; k < 4; k++) {
      const x = 3 + ar() * 10;
      const y = 3 + ar() * 10;
      p.circ(x, y, 1.6, k % 3 ? '#f4f0e4' : '#e8c840');
      p.circ(x, y, 0.6, '#d8a020');
    }
  });
  add('flowerbed', 32, 24, (p) => {
    p.rect(1, 3, 30, 18, '#5a3f28', 1);
    for (let k = 0; k < 10; k++) p.circ(4 + ar() * 24, 6 + ar() * 12, 3, '#3f6c2b');
    for (let k = 0; k < 12; k++) {
      p.circ(
        4 + ar() * 24,
        6 + ar() * 12,
        1.8,
        ['#e04a60', '#f4d040', '#f4f0e4', '#9a70e0'][k % 4] as string,
      );
    }
  });
  add('mailbox', 18, 18, (p) => {
    shadow(p, 10, 11, 7, 5);
    rrect(3, 4, 12, 9, 3);
    fillInk('#c0392b', 1);
    p.rect(13, 2, 2, 5, '#f4d040');
  });
  // A black flashlight lying a little askew, its lens catching the light.
  add('flashlight', 22, 14, (p) => {
    c.translate(11, 7);
    c.rotate(-0.3);
    p.ell(1, 2, 8, 3, 'rgba(20,30,10,.3)');
    p.rect(-8, -2, 11, 4, '#2c2f33', 1);
    p.rect(3, -3, 4, 6, '#3a3d42', 1);
    p.rect(6.5, -2.6, 1.4, 5.2, '#fff0b8', 0.6);
    p.rect(-3, -2, 2, 1.2, '#9a2a24');
    p.line(-7, -1, 2, -1, 'rgba(255,255,255,.18)', 0.8);
  });
  // A small brass key, worn bright where the fingers hold it, for the bag.
  add('key', 22, 14, (p) => {
    c.translate(11, 7);
    c.rotate(0.2);
    p.circ(-5, 0, 3.6, '#b08a3a', 1);
    p.circ(-5, 0, 1.4, '#3a2a14');
    p.rect(-2, -1, 10, 2, '#b08a3a', 0.8);
    p.rect(5, 1, 1.6, 2.4, '#a07c32');
    p.rect(2.6, 1, 1.4, 1.6, '#a07c32');
    p.line(-7, -1.6, -3.6, -2.6, 'rgba(255,240,190,.5)', 0.8);
  });
  add('streetlamp', 20, 20, (p) => {
    shadow(p, 11, 11, 7, 6);
    p.circ(10, 10, 7, '#3a3e42', 1.2);
    p.circ(10, 10, 4, '#fff6d8');
  });
  add('step', 44, 14, (p) => {
    p.rect(2, 2, 40, 10, '#a39a8a', 1);
    p.rect(3, 3, 38, 2, 'rgba(255,255,255,.25)');
  });
  // A coir mat outside the front door, a corner frayed and the middle worn pale.
  add('porchmat', 50, 28, (p) => {
    p.rect(3, 3, 44, 22, '#7a3a26', 1);
    p.rect(7, 7, 36, 14, '#a5603a');
    p.ell(25, 14, 12, 5, 'rgba(230,200,150,.25)');
    for (let x = 9; x < 42; x += 3) p.line(x, 8, x + 0.5, 20, 'rgba(60,24,12,.3)', 1);
    p.line(44, 3, 47, 1, '#7a3a26', 1);
    p.line(46, 6, 49, 5, '#7a3a26', 1);
  });
  // The front door from above: a green-painted leaf, its paint worn at the edge.
  add('frontdoor', 56, 10, (p) => {
    p.rect(2, 2, 52, 6, '#3f6a44', 1);
    p.rect(3, 2.5, 50, 1.4, 'rgba(255,255,255,.18)');
    p.rect(50, 2, 4, 6, '#5a7a58');
    p.circ(46, 5, 1.5, '#d8b860');
  });
  // A footprint that glows: a pale sole in a soft halo, tinted cold when drawn.
  add('printGlow', 20, 14, (p) => {
    const g = c.createRadialGradient(10, 7, 0, 10, 7, 9);
    g.addColorStop(0, 'rgba(255,255,255,.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 20, 14);
    p.ell(12, 7, 3.8, 2.3, 'rgba(255,255,255,.9)');
    p.ell(5.6, 7.1, 1.8, 1.9, 'rgba(255,255,255,.85)');
  });
  // A four-point glint on something worth a look.
  add('glint', 24, 24, (p) => {
    const g = c.createRadialGradient(12, 12, 0, 12, 12, 11);
    g.addColorStop(0, 'rgba(255,250,220,.9)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 24, 24);
    p.line(12, 1, 12, 23, 'rgba(255,255,240,.9)', 1.4);
    p.line(1, 12, 23, 12, 'rgba(255,255,240,.9)', 1.4);
    p.circ(12, 12, 2.2, '#ffffff');
  });

  // Indoors.
  add('sofa', 100, 40, (p) => {
    shadow(p, 52, 22, 48, 16);
    rrect(2, 4, 96, 32, 8);
    fillInk('#6b7f9a', 1.4);
    rrect(2, 26, 96, 10, 5);
    fillInk('#55667e', 0);
    for (const x of [8, 37, 66]) {
      rrect(x, 6, 27, 20, 5);
      fillInk('#7d93b0', 0.8);
    }
    p.rect(2, 4, 8, 32, '#55667e', 1);
    p.rect(90, 4, 8, 32, '#55667e', 1);
  });
  const tv = (on: boolean) => (p: Painter) => {
    p.rect(8, 10, 80, 12, WOOD, 1.2);
    p.rect(14, 2, 68, 9, '#141619', 1.2);
    if (on) {
      // The screen's glow spills onto the stand.
      p.rect(16, 3, 64, 7, '#bfe4ff');
      p.rect(16, 3, 64, 2, '#ffffff');
      p.rect(16, 11, 64, 4, 'rgba(160,210,255,.35)');
    } else p.rect(16, 3, 64, 3, '#3a5a7a');
    p.circ(82, 16, 2, on ? '#e04a3a' : '#8a8a8a');
  };
  add('tv', 96, 24, tv(false));
  add('tvOn', 96, 24, tv(true));
  add('desk', 34, 64, (p) => {
    shadow(p, 18, 34, 15, 30);
    p.rect(4, 2, 28, 60, WOOD, 1.3);
    p.rect(24, 14, 6, 36, '#1b1d20', 1);
    p.rect(25, 16, 3, 32, '#5a9ad0');
    p.rect(12, 22, 7, 20, '#d8d8d4', 0.8);
    p.circ(14, 50, 2.4, '#d8d8d4', 0.6);
    p.circ(10, 10, 4, '#e8e0c8', 0.8);
  });
  add('chair', 26, 26, (p) => {
    shadow(p, 14, 15, 10, 9);
    p.circ(13, 13, 9, '#2c2f33', 1.2);
    p.rect(3, 6, 4, 14, '#1d1f22', 0.8);
  });
  add('plant', 26, 26, (p) => {
    p.circ(13, 13, 8, '#b06a40', 1.2);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.28;
      p.ell(13 + Math.cos(a) * 6, 13 + Math.sin(a) * 6, 5, 3, '#4f8a34', 0.6);
    }
    p.circ(13, 13, 3, '#6aa848');
  });
  add('floorlamp', 22, 22, (p) => {
    p.circ(11, 11, 9, '#e8d8b0', 1.2);
    p.circ(11, 11, 4, '#fff4d0');
  });
  add('kcounter', 64, 30, (p) => {
    shadow(p, 33, 17, 30, 10);
    p.rect(2, 2, 60, 26, '#d4d0c4', 1.4);
    p.rect(4, 4, 56, 4, '#efebe0');
    p.rect(30, 9, 22, 15, '#9aa4a8', 1);
    p.rect(32, 11, 18, 11, '#c4ccd0');
    p.circ(41, 8, 2, '#7a8488');
    p.rect(8, 12, 12, 10, '#7a5a3a', 0.8);
  });
  add('stove', 32, 30, (p) => {
    p.rect(2, 2, 28, 26, '#e8e6e0', 1.3);
    for (const [x, y] of [
      [10, 10],
      [22, 10],
      [10, 21],
      [22, 21],
    ] as const) {
      p.circ(x, y, 4.5, '#2a2c30', 0.8);
      p.circ(x, y, 2, '#4a4c50');
    }
  });
  add('fridge', 32, 32, (p) => {
    shadow(p, 17, 18, 14, 13);
    p.rect(2, 2, 28, 28, '#f2f0ea', 1.4);
    p.rect(4, 4, 24, 4, '#ffffff');
    p.rect(24, 12, 2, 12, '#9aa4a8');
  });
  add('ktable', 52, 52, (p) => {
    shadow(p, 28, 28, 20, 18);
    for (const [x, y] of [
      [26, 5],
      [26, 47],
      [5, 26],
      [47, 26],
    ] as const) {
      rrect(x - 7, y - 5, 14, 10, 3);
      fillInk('#6a4a2e', 1);
    }
    p.rect(10, 10, 32, 32, WOOD, 1.4);
    p.rect(12, 12, 28, 4, 'rgba(255,240,210,.18)');
    p.circ(20, 24, 4, WHITE, 0.8);
    p.circ(33, 30, 3, '#c8362c', 0.6);
  });
  add('coatrack', 24, 24, (p) => {
    p.circ(12, 12, 6, WOOD_DARK, 1);
    p.ell(7, 9, 6, 4, '#7c2f28', 0.8);
    p.ell(16, 15, 6, 4, '#3a5a7a', 0.8);
    p.circ(12, 12, 2, '#c9a65a');
  });
  add('doormat', 52, 26, (p) => {
    p.rect(2, 2, 48, 22, '#8a6a3a', 1);
    for (let x = 6; x < 48; x += 4) p.rect(x, 4, 2, 18, 'rgba(60,40,20,.35)');
  });
  add('bathtub', 32, 92, (p) => {
    shadow(p, 17, 48, 15, 44);
    rrect(2, 2, 28, 88, 12);
    fillInk('#f4f2ec', 1.4);
    rrect(6, 8, 20, 76, 9);
    fillInk('#a8d4e4', 0.8);
    p.ell(16, 30, 6, 10, 'rgba(255,255,255,.4)');
    p.circ(16, 7, 2, '#9aa4a8');
  });
  add('toilet', 26, 30, (p) => {
    p.rect(4, 22, 18, 7, '#f4f2ec', 1);
    p.ell(13, 13, 9, 11, '#f4f2ec', 1.2);
    p.ell(13, 13, 5, 7, '#cfe4ec');
  });
  add('bsink', 30, 24, (p) => {
    p.rect(2, 2, 26, 4, '#d4d0c4', 0.8);
    p.ell(15, 12, 11, 9, '#f4f2ec', 1.2);
    p.ell(15, 12, 7, 5, '#cfe4ec');
    p.circ(15, 5, 1.6, '#9aa4a8');
  });
  add('wardrobe', 62, 28, (p) => {
    shadow(p, 33, 16, 30, 10);
    p.rect(2, 2, 58, 24, '#7a5a3a', 1.4);
    p.line(31, 4, 31, 24, WOOD_DARK, 1.2);
    p.rect(26, 12, 2, 6, '#c9a65a');
    p.rect(34, 12, 2, 6, '#c9a65a');
  });
  add('rugBlue', 110, 70, (p) => {
    rrect(3, 3, 104, 64, 10);
    fillInk('#3e5a7c', 1);
    c.strokeStyle = '#d8c8a0';
    c.lineWidth = 2;
    c.strokeRect(12, 12, 86, 46);
    p.ell(55, 35, 18, 11, '#8a6a3a');
  });
  add('rugBed', 80, 60, (p) => {
    p.ell(40, 30, 37, 27, '#c9a07a', 1);
    p.ell(40, 30, 28, 20, '#e8d8b8');
  });

  // The Lower World windmill's insides.
  const stone = (p: Painter, cx: number, cy: number, r: number) => {
    p.circ(cx, cy, r, '#8f877a', 1.6);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 6.28;
      p.line(
        cx + Math.cos(a) * 6,
        cy + Math.sin(a) * 6,
        cx + Math.cos(a) * (r - 2),
        cy + Math.sin(a) * (r - 2),
        'rgba(40,30,20,.4)',
        1,
      );
    }
    p.circ(cx, cy, 5, '#2a2018', 1);
  };
  add('millstone', 64, 64, (p) => {
    shadow(p, 35, 36, 28, 26);
    p.circ(32, 32, 30, '#5e4330', 1.6);
    stone(p, 32, 32, 24);
    p.line(32, 2, 32, 62, WOOD_DARK, 4);
    p.rect(26, 26, 12, 12, '#6a4a2e', 1);
  });
  // The mirror set in the floor: the same black glass as the Lower World's lake.
  add('mirror', 56, 56, (p) => {
    p.circ(28, 28, 26, '#5d5549', 1.6);
    p.circ(28, 28, 21, '#121619', 1.2);
    c.save();
    c.shadowColor = '#9fd8e6';
    c.shadowBlur = 10;
    p.line(18, 16, 26, 12, 'rgba(159,216,230,.7)', 1.4);
    c.restore();
    p.ell(22, 20, 8, 4, 'rgba(207,238,244,.22)');
    for (let k = 0; k < 5; k++) p.rect(10 + ar() * 34, 10 + ar() * 34, 2, 2, '#9fd8e6');
  });
  add('sacks', 32, 32, (p) => {
    shadow(p, 17, 18, 13, 11);
    for (const [x, y] of [
      [11, 12],
      [21, 19],
    ] as const) {
      p.ell(x, y, 9, 8, '#c8b48a', 1.1);
      p.circ(x - 2, y - 3, 2, 'rgba(255,250,235,.4)');
    }
  });
  // Sails: four lattice blades round a hub.
  const blade = (p: Painter, len: number) => {
    p.rect(-2, 0, 4, len, '#5e4330', 1);
    for (let y = 10; y < len; y += 9) {
      p.rect(2, y, 14, 2, '#6a4a2e');
    }
    p.rect(16, 8, 2, len - 8, '#5e4330', 0.6);
    p.rect(3, 10, 13, len - 14, 'rgba(232,222,196,.55)');
  };
  add('sails', 240, 240, (p) => {
    for (let k = 0; k < 4; k++) {
      c.save();
      c.translate(120, 120);
      c.rotate((k * Math.PI) / 2);
      blade(p, 112);
      c.restore();
    }
    p.circ(120, 120, 9, '#3e2c1f', 1.4);
    p.circ(120, 120, 3, '#8a8a8a');
  });

  // --- Victor's place ------------------------------------------------------------------
  // Victor's old estate car from above, nose to the south: boxy, maroon, its
  // paint gone dull on the roof. Dust on the glass and leaves on the roof and
  // bonnet: it hasn't moved in days. A dent in the rear wing, one hubcap gone.
  add('carVictor', 64, 128, (p) => {
    shadow(p, 35, 67, 29, 58);
    rrect(5, 5, 54, 118, 9);
    fillInk('#6a2a28', 1.6);
    // Bonnet, a long flat roof with rails, and the tailgate.
    rrect(8, 92, 48, 27, 7);
    fillInk('#7a3330', 0);
    rrect(9, 16, 46, 72, 5);
    fillInk('#2b2422', 1);
    rrect(12, 24, 40, 60, 3);
    fillInk('#5e2725', 0);
    p.rect(13, 26, 38, 4, 'rgba(255,230,220,.1)');
    for (const x of [14, 49]) p.rect(x, 22, 1.6, 64, '#9a9692');
    // Windscreen and rear window, filmed with dust.
    p.poly(
      [
        [10, 88],
        [54, 88],
        [50, 97],
        [14, 97],
      ],
      '#93a9b1',
      1,
    );
    p.poly(
      [
        [12, 9],
        [52, 9],
        [53, 16],
        [11, 16],
      ],
      '#7f949c',
      1,
    );
    p.rect(11, 89, 42, 7, 'rgba(200,185,160,.45)');
    p.rect(12, 10, 40, 5, 'rgba(200,185,160,.4)');
    // A dent in the rear wing.
    p.ell(55, 22, 2.5, 5, 'rgba(30,10,10,.45)');
    // Fallen leaves on the roof and the bonnet.
    for (let k = 0; k < 11; k++) {
      const x = 14 + ar() * 36;
      const y = (k < 7 ? 28 : 98) + ar() * (k < 7 ? 50 : 16);
      c.save();
      c.translate(x, y);
      c.rotate(ar() * 6.28);
      p.ell(0, 0, 3, 1.7, ['#c88a2a', '#a8582a', '#d8b040', '#8a6a2a'][k % 4] as string);
      c.restore();
    }
    // Mirrors, lights, wheels; the front right one bare without its hubcap.
    p.rect(1, 84, 5, 7, '#2a2422', 1);
    p.rect(58, 84, 5, 7, '#2a2422', 1);
    p.rect(9, 118, 11, 4, '#e8dcb0', 0.8);
    p.rect(44, 118, 11, 4, '#e8dcb0', 0.8);
    p.rect(9, 6, 10, 3, '#a8322a', 0.8);
    p.rect(45, 6, 10, 3, '#a8322a', 0.8);
    for (const [x, y, bare] of [
      [3, 20, false],
      [57, 20, false],
      [3, 96, false],
      [57, 96, true],
    ] as const) {
      p.rect(x, y, 4, 16, '#1d1f22');
      if (!bare) p.rect(x + 1, y + 5, 2, 6, '#8a8c8e');
    }
  });

  // A shopping list held to the fridge by a magnet, one corner curling.
  add('note', 16, 18, (p) => {
    c.translate(8, 9);
    c.rotate(0.12);
    p.poly(
      [
        [-6, -7],
        [6, -7],
        [6, 5],
        [3.5, 7.5],
        [-6, 7],
      ],
      '#f4efe0',
      0.8,
    );
    for (let y = -4; y <= 4; y += 2.2) p.line(-4, y, 2 + ar() * 3, y, 'rgba(40,50,110,.55)', 0.6);
    p.circ(0, -6.5, 1.8, '#c8362c', 0.5);
  });

  // Victor's notebook on the desk: a worn brown cover, a pencil across it.
  add('notebook', 22, 24, (p) => {
    c.translate(11, 12);
    c.rotate(-0.18);
    p.rect(-7, -9, 14, 18, '#6a4428', 1);
    p.rect(-7, -9, 2, 18, '#4a2e1a');
    p.rect(-4.5, -9, 1.2, 18, '#222');
    p.rect(-6.5, 7, 13, 1.4, '#ece4d0');
    p.line(-8, 5, 8, -3, '#d8a83a', 1.6);
    p.line(7, -2.5, 8.6, -3.3, '#2a2a2a', 1.2);
  });

  // The shed's things: a workbench with a vice and tools left out, tins of
  // paint on a shelf, an old bike against the wall, a push mower, garden
  // tools on hooks.
  add('workbench', 72, 30, (p) => {
    shadow(p, 37, 17, 34, 11);
    p.rect(2, 3, 68, 24, '#8a6644', 1.4);
    for (let y = 6; y < 26; y += 6) p.line(3, y, 69, y + (ar() - 0.5), 'rgba(60,40,20,.35)', 0.8);
    // A vice at one end, a saw and a hammer, a mug's ring, sawdust.
    p.rect(4, 10, 10, 10, '#4a5a6a', 1);
    p.rect(6, 8, 6, 3, '#7a8a9a', 0.6);
    p.poly(
      [
        [22, 8],
        [44, 11],
        [44, 15],
        [22, 13],
      ],
      '#b8bcc0',
      0.8,
    );
    p.rect(44, 10, 7, 6, '#7a4a2a', 0.8);
    p.line(54, 20, 64, 15, '#6a4a2a', 2);
    p.rect(62, 12, 5, 6, '#4a4c50', 0.6);
    c.strokeStyle = 'rgba(70,40,20,.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(30, 21, 3.5, 0, 6);
    c.stroke();
    for (let k = 0; k < 14; k++) p.rect(16 + ar() * 30, 16 + ar() * 9, 1, 1, '#d8b88a');
  });
  add('tins', 32, 30, (p) => {
    shadow(p, 17, 16, 14, 12);
    p.rect(2, 2, 28, 26, '#6e5a44', 1.2);
    for (const [x, y, lid, drip] of [
      [9, 9, '#e8e4d8', '#e8e4d8'],
      [21, 8, '#4a6a8a', '#4a6a8a'],
      [9, 21, '#a8a49a', ''],
      [22, 20, '#8a3a2a', '#8a3a2a'],
    ] as const) {
      p.circ(x, y, 5.5, '#9a9c9e', 1);
      p.circ(x, y, 4.2, lid);
      if (drip) p.rect(x + 3, y - 1, 1.4, 4, drip);
    }
  });
  add('bike', 28, 64, (p) => {
    c.translate(14, 32);
    c.rotate(0.08);
    p.ell(1, 2, 7, 28, 'rgba(20,30,10,.25)');
    p.rect(-1.5, -29, 3, 20, '#1d1f22');
    p.rect(-1.5, 9, 3, 20, '#1d1f22');
    p.line(0, -18, 0, 16, '#2a6a4a', 2.4);
    p.line(-9, -20, 9, -21, '#5a5c5e', 2);
    p.ell(0, 10, 3, 5, '#2a2422', 0.8);
    p.rect(-5, 18, 10, 6, '#4a4c4e', 0.6);
  });
  add('mower', 32, 44, (p) => {
    shadow(p, 17, 16, 13, 12);
    rrect(4, 2, 24, 24, 6);
    fillInk('#3e6a32', 1.2);
    p.circ(16, 14, 6, '#2a4a24', 0.8);
    p.rect(2, 4, 3, 6, '#1d1f22');
    p.rect(27, 4, 3, 6, '#1d1f22');
    p.rect(2, 18, 3, 6, '#1d1f22');
    p.rect(27, 18, 3, 6, '#1d1f22');
    p.line(8, 26, 7, 42, '#5a5c5e', 1.6);
    p.line(24, 26, 25, 42, '#5a5c5e', 1.6);
    p.line(6, 41, 26, 42, '#1d1f22', 2.4);
  });
  add('tools', 18, 64, (p) => {
    p.rect(7, 2, 4, 60, '#5e4330', 0.8);
    // A rake, a spade, a fork; the fork hangs crooked.
    p.line(4, 8, 4, 22, '#8a6a44', 1.4);
    p.line(1, 8, 7, 8, '#7a7c7e', 1.6);
    p.line(14, 24, 14, 38, '#8a6a44', 1.4);
    p.rect(11.5, 36, 5, 7, '#8a8c8e', 0.6);
    c.save();
    c.translate(4, 46);
    c.rotate(0.25);
    p.line(0, -6, 0, 8, '#8a6a44', 1.4);
    for (const x of [-2, 0, 2]) p.line(x, 8, x, 13, '#7a7c7e', 0.8);
    c.restore();
  });

  // The back garden: a log pile under the eaves, a chopping block with an
  // axe left in it, a compost heap, a wheelbarrow left askew, washing on a line.
  add('woodpile', 72, 30, (p) => {
    shadow(p, 37, 17, 34, 11);
    for (let row = 0; row < 3; row++) {
      for (let x = 4 + (row % 2) * 4; x < 66; x += 8) {
        const y = 7 + row * 8 + (ar() - 0.5) * 1.5;
        p.circ(x, y, 4.4, '#6a4a2e', 0.9);
        p.circ(x, y, 3, ['#c8a070', '#b8905e', '#d4ae7c'][Math.floor(ar() * 3)] as string);
        p.circ(x, y, 1, 'rgba(90,60,30,.6)');
      }
    }
  });
  add('chopblock', 30, 30, (p) => {
    shadow(p, 16, 17, 11, 9);
    p.circ(14, 14, 10, '#6a4a2e', 1.2);
    p.circ(14, 14, 7.5, '#c49a68');
    for (const r of [2.5, 5]) {
      c.strokeStyle = 'rgba(110,70,35,.45)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.arc(14, 14, r, 0, 6.28);
      c.stroke();
    }
    p.line(14, 14, 27, 6, '#7a5a3a', 2.2);
    p.rect(10, 11.5, 7, 5, '#5a5c5e', 0.8);
  });
  add('compost', 44, 44, (p) => {
    shadow(p, 23, 24, 20, 19);
    p.rect(3, 3, 38, 38, '#7a5e40', 1.4);
    p.rect(7, 7, 30, 30, '#3a2a1a');
    for (let k = 0; k < 16; k++) {
      p.ell(
        9 + ar() * 26,
        9 + ar() * 26,
        2 + ar() * 2,
        1.2,
        ['#6a8a3a', '#a8782a', '#5a4a2a', '#c8a050'][k % 4] as string,
      );
    }
    for (const y of [3, 15, 27]) p.line(3, y + 0.5, 41, y + 0.5 + (ar() - 0.5), INK, 0.6);
  });
  add('wheelbarrow', 34, 50, (p) => {
    c.translate(17, 25);
    c.rotate(-0.35);
    p.ell(1, 2, 12, 18, 'rgba(20,30,10,.25)');
    p.line(-6, 10, -7, 22, '#6a4a2e', 2);
    p.line(6, 10, 7, 22, '#6a4a2e', 2);
    p.poly(
      [
        [-11, -12],
        [11, -12],
        [8, 11],
        [-8, 11],
      ],
      '#4a7a5a',
      1.2,
    );
    p.poly(
      [
        [-8, -9],
        [8, -9],
        [6, 8],
        [-6, 8],
      ],
      '#3a5e46',
    );
    p.rect(-2, -18, 4, 7, '#1d1f22', 0.6);
    p.ell(3, 0, 3, 2, 'rgba(160,110,60,.6)');
  });
  // The washing line, sagging between its poles: a shirt, a towel, two socks.
  add('clothesline', 230, 34, (p) => {
    const at = (x: number) => 6 + Math.sin((x / 230) * Math.PI) * 7;
    c.strokeStyle = '#d8d4c8';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= 230; x += 5) {
      if (x) c.lineTo(x, at(x));
      else c.moveTo(x, at(x));
    }
    c.stroke();
    for (const [x, w, h, col] of [
      [40, 26, 22, '#c8d4e4'],
      [92, 30, 18, '#e0a8a0'],
      [138, 8, 12, '#3a3a40'],
      [150, 8, 11, '#4a4a52'],
      [180, 22, 20, '#e8e0c8'],
    ] as const) {
      const y = at(x + w / 2) - 1;
      c.save();
      c.translate(x + w / 2, y);
      c.rotate((ar() - 0.5) * 0.12);
      p.rect(-w / 2, 0, w, h, col, 0.9);
      p.rect(-w / 2, 0, w, 2, 'rgba(255,255,255,.3)');
      p.rect(-w / 2 + 3, -1.5, 2, 3, '#b8905e');
      p.rect(w / 2 - 5, -1.5, 2, 3, '#b8905e');
      c.restore();
    }
  });
  A.refresh();
}
