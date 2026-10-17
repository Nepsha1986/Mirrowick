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

// --- Objects -----------------------------------------------------------------------------

/** The Upper World's things, and both windmills' insides, in one atlas. */
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

  // Bright summer canopies, and an apple tree.
  const tree =
    (cols: [string, string, string], fruit?: string) => (p: Painter, w: number, h: number) => {
      shadow(p, w / 2 + 5, h / 2 + 6, w / 2 - 6, h / 2 - 8);
      const cx = w / 2;
      const cy = h / 2;
      const blobs: [number, number, number][] = [];
      for (let k = 0; k < 9; k++) {
        const a = ar() * 6.28;
        const d = ar() * 10;
        blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, 11 + ar() * 6]);
      }
      for (const [x, y, r] of blobs) p.circ(x, y, r + 1.4, INK);
      for (const [x, y, r] of blobs) p.circ(x, y, r, cols[0]);
      for (let k = 0; k < 8; k++) {
        const a = ar() * 6.28;
        const d = ar() * 9;
        p.circ(cx + Math.cos(a) * d - 2, cy + Math.sin(a) * d - 2, 6 + ar() * 5, cols[1]);
      }
      for (let k = 0; k < 6; k++) {
        const a = ar() * 6.28;
        const d = ar() * 8;
        p.circ(cx + Math.cos(a) * d - 4, cy + Math.sin(a) * d - 4, 3 + ar() * 3, cols[2]);
      }
      if (fruit) {
        for (let k = 0; k < 9; k++) {
          const a = ar() * 6.28;
          const d = 4 + ar() * 12;
          p.circ(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.2, fruit, 0.6);
        }
      }
    };
  add('utree', 62, 62, tree(['#3b6a2a', '#4f8234', '#6ea044']));
  add('utree2', 62, 62, tree(['#46732c', '#5d8f38', '#82b04e']));
  add('appletree', 62, 62, tree(['#41702c', '#568a36', '#76a648'], '#c8362c'));
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

  // The windmill's insides: the whole mill below, the ruin above.
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
  add('millstoneBroken', 64, 64, (p) => {
    shadow(p, 35, 36, 26, 24);
    c.save();
    c.beginPath();
    c.moveTo(32, 32);
    c.arc(32, 32, 30, 0.4, 4.4);
    c.closePath();
    c.clip();
    stone(p, 32, 32, 24);
    c.restore();
    p.poly(
      [
        [40, 34],
        [56, 30],
        [54, 44],
        [42, 46],
      ],
      '#8f877a',
      1.2,
    );
    p.line(18, 14, 30, 30, 'rgba(30,20,12,.7)', 1.2);
    for (let k = 0; k < 6; k++) p.circ(10 + ar() * 44, 8 + ar() * 48, 2.5, '#6f685c', 0.6);
  });
  // The mirror set in the floor: the same black glass as the Lower World's lake.
  const glass = (p: Painter, cracked: boolean) => {
    p.circ(28, 28, 26, '#5d5549', 1.6);
    p.circ(28, 28, 21, '#121619', 1.2);
    c.save();
    c.shadowColor = '#9fd8e6';
    c.shadowBlur = 10;
    p.line(18, 16, 26, 12, 'rgba(159,216,230,.7)', 1.4);
    c.restore();
    p.ell(22, 20, 8, 4, 'rgba(207,238,244,.22)');
    if (cracked) {
      for (const [a, l] of [
        [0.3, 19],
        [1.9, 17],
        [3.4, 20],
        [4.6, 15],
      ] as const) {
        p.line(31, 31, 31 + Math.cos(a) * l, 31 + Math.sin(a) * l, 'rgba(207,238,244,.65)', 1);
      }
      for (let k = 0; k < 8; k++) p.circ(8 + ar() * 40, 8 + ar() * 40, 1.6, 'rgba(120,110,95,.6)');
    } else {
      p.circ(28, 28, 21, 'rgba(0,0,0,0)', 0);
      for (let k = 0; k < 5; k++) p.rect(10 + ar() * 34, 10 + ar() * 34, 2, 2, '#9fd8e6');
    }
  };
  add('mirror', 56, 56, (p) => glass(p, false));
  add('mirrorCracked', 56, 56, (p) => glass(p, true));
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
  add('rubble', 30, 26, (p) => {
    shadow(p, 16, 15, 12, 8);
    for (const [x, y, r] of [
      [10, 12, 7],
      [19, 10, 6],
      [16, 18, 6],
    ] as const) {
      p.circ(x, y, r, '#7f776a', 1.1);
      p.circ(x - 2, y - 2, r / 2.5, '#9a9284');
    }
  });
  // Sails: four lattice blades round a hub; and one blade, fallen and broken.
  const blade = (p: Painter, len: number, broken: boolean) => {
    p.rect(-2, 0, 4, len, '#5e4330', 1);
    for (let y = 10; y < len; y += 9) {
      if (broken && ar() < 0.3) continue;
      p.rect(2, y, 14, 2, '#6a4a2e');
    }
    p.rect(16, 8, 2, len - 8, '#5e4330', 0.6);
    if (!broken) p.rect(3, 10, 13, len - 14, 'rgba(232,222,196,.55)');
  };
  add('sails', 240, 240, (p) => {
    for (let k = 0; k < 4; k++) {
      c.save();
      c.translate(120, 120);
      c.rotate((k * Math.PI) / 2);
      blade(p, 112, false);
      c.restore();
    }
    p.circ(120, 120, 9, '#3e2c1f', 1.4);
    p.circ(120, 120, 3, '#8a8a8a');
  });
  add('sailBroken', 30, 96, (p) => {
    c.save();
    c.translate(6, 2);
    blade(p, 90, true);
    c.restore();
  });
  A.refresh();
}
