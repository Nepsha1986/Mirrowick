import type * as Phaser from 'phaser';
import { INK, painter, type Painter } from './brush';
import { T, TL, mulberry32 } from './util';

type At = (i: number, fn: (p: Painter) => void) => void;

const STEEL = '#6f7579';
const STEEL_DARK = '#3c4044';
const PAINT = '#c9cbc4';
const YELLOW = '#d8a92e';
const RED = '#c4392b';
const SCREEN = '#7affc8';

// --- Ground ------------------------------------------------------------------------------

/**
 * The Facility's floors and the ground round it: poured concrete, scuffed
 * vinyl, steel grating, dead ash outside and the flat gravel roof.
 */
export function paintLabTiles(at: At, r: () => number): void {
  const pick = (cols: string[]) => cols[Math.floor(r() * cols.length)] as string;
  const speck = (p: Painter, base: string, cols: string[], n: number, sz = 2) => {
    p.rect(0, 0, T, T, base);
    for (let k = 0; k < n; k++) {
      const s = 1 + Math.floor(r() * sz);
      p.rect(Math.floor(r() * T), Math.floor(r() * T), s, s, pick(cols));
    }
  };
  // Poured concrete in big slabs: a seam on one edge, stains, grit.
  at(TL.CONCRETE, (p) => {
    speck(p, '#5c5e5b', ['#565855', '#626461', '#535552', '#686a66'], 60, 2);
    p.rect(0, 0, T, 1, 'rgba(20,20,20,.35)');
    p.ell(8 + r() * 16, 8 + r() * 16, 6 + r() * 5, 3 + r() * 3, 'rgba(40,36,30,.12)');
    for (let k = 0; k < 4; k++) p.rect(r() * T, r() * T, 1, 1, 'rgba(230,230,220,.15)');
  });
  // Vinyl tiles, once pale green-grey, scuffed by trolleys.
  at(TL.LINO, (p) => {
    p.rect(0, 0, T, T, '#3f4642');
    for (const [x, y] of [
      [0, 0],
      [16, 0],
      [0, 16],
      [16, 16],
    ] as const) {
      p.rect(x + 0.5, y + 0.5, 15, 15, pick(['#7d8a82', '#76837b', '#828f86', '#717e76']));
    }
    for (let k = 0; k < 3; k++) {
      const x = r() * T;
      const y = r() * T;
      p.line(x, y, x + 4 + r() * 8, y + (r() - 0.5) * 2, 'rgba(30,34,32,.35)', 0.8);
    }
    p.rect(r() * T, r() * T, 3, 2, 'rgba(30,34,32,.25)');
  });
  // Steel grating over a drain: dark below, a lattice on top, rust here and there.
  at(TL.GRATE, (p) => {
    p.rect(0, 0, T, T, '#141516');
    for (let k = 0; k <= T; k += 4) {
      p.rect(k, 0, 1.4, T, '#585e62');
      p.rect(0, k, T, 1, '#4a4f53');
    }
    p.rect(0, 0, T, 1, 'rgba(255,255,255,.12)');
    for (let k = 0; k < 2; k++) p.ell(r() * T, r() * T, 3 + r() * 3, 2, 'rgba(120,60,30,.35)');
  });
  // Dead ground: grey-brown earth under ash, cinders, a bleached stalk.
  at(TL.ASH, (p) => {
    speck(p, '#4a463f', ['#423e38', '#55514a', '#5e5a52', '#3a3631', '#6a665d'], 90, 2);
    for (let k = 0; k < 3; k++) p.ell(r() * T, r() * T, 3 + r() * 4, 2, 'rgba(150,146,138,.18)');
    if (r() < 0.6) {
      const x = r() * T;
      const y = r() * T;
      p.line(x, y, x + (r() - 0.5) * 4, y - 3 - r() * 3, '#6e6650', 1);
    }
  });
  // Underground: packed earth, stones in it, a root that came a long way down.
  at(TL.EARTH, (p) => {
    speck(p, '#2b2520', ['#332c26', '#241f1b', '#3a332b', '#2f2924'], 80, 2);
    for (let k = 0; k < 2; k++) p.ell(r() * T, r() * T, 2 + r() * 3, 1.5 + r() * 2, '#4a443c', 0.6);
    if (r() < 0.2) {
      const x = r() * T;
      p.line(x, 0, x + (r() - 0.5) * 10, T, 'rgba(70,52,36,.6)', 1);
    }
  });
  // The flat roof: tar and gravel, darker where water stands.
  at(TL.ROOFTOP, (p) => {
    speck(p, '#2a2b2c', ['#323334', '#252627', '#38393a', '#2e2f30'], 110, 1);
    if (r() < 0.3) p.ell(r() * T, r() * T, 6 + r() * 6, 3 + r() * 3, 'rgba(10,12,14,.3)');
  });
}

// --- Objects -----------------------------------------------------------------------------

/**
 * Everything in the Facility and its yard, seen from above: the mirror's
 * ring, consoles and racks, doors, cages, the checkpoint, burnt cars.
 * Nothing new or square: chipped paint, dents, rust, one of everything
 * broken.
 */
export function paintLabAtlas(scene: Phaser.Scene): void {
  const A = scene.textures.createCanvas('ln-lab', 1024, 1024);
  if (!A) return;
  const c = A.getContext();
  const ar = mulberry32(7171);
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
    p.ell(x, y, rx, ry, 'rgba(6,6,8,.42)');
  /** Diagonal warning stripes across a rectangle. */
  const stripes = (x: number, y: number, w: number, h: number, a = 1) => {
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.fillStyle = `rgba(216,169,46,${a})`;
    c.fillRect(x, y, w, h);
    c.fillStyle = `rgba(24,22,20,${a})`;
    for (let k = -h; k < w; k += 10) {
      c.beginPath();
      c.moveTo(x + k, y + h);
      c.lineTo(x + k + 5, y + h);
      c.lineTo(x + k + 5 + h, y);
      c.lineTo(x + k + h, y);
      c.closePath();
      c.fill();
    }
    c.restore();
  };
  /** Chips and scratches over paint. */
  const wear = (x: number, y: number, w: number, h: number, n: number) => {
    for (let k = 0; k < n; k++) {
      c.fillStyle = ar() < 0.5 ? 'rgba(20,18,16,.3)' : 'rgba(255,255,255,.12)';
      c.fillRect(x + ar() * w, y + ar() * h, 1 + ar() * 2, 1);
    }
  };

  // --- Chamber 7 ---
  // Warning stripes in a ring round the mirror's platform, worn through in places.
  add('hazardRing', 224, 224, (_p, w) => {
    const m = w / 2;
    c.save();
    c.beginPath();
    c.arc(m, m, 108, 0, Math.PI * 2);
    c.arc(m, m, 94, 0, Math.PI * 2, true);
    c.clip();
    stripes(0, 0, w, w, 0.75);
    c.restore();
    for (let k = 0; k < 14; k++) {
      const a = ar() * Math.PI * 2;
      c.fillStyle = 'rgba(80,82,78,.8)';
      c.beginPath();
      c.ellipse(m + Math.cos(a) * 101, m + Math.sin(a) * 101, 4 + ar() * 6, 3, a, 0, Math.PI * 2);
      c.fill();
    }
  });
  // The platform: a raised steel disc, bolted plates, a rim of conduit.
  add('pad', 176, 176, (p, w) => {
    const m = w / 2;
    p.circ(m + 4, m + 5, 84, 'rgba(6,6,8,.4)');
    p.circ(m, m, 84, '#4a4e52', 2);
    p.circ(m, m, 76, '#5a5f63', 1);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      p.line(
        m + Math.cos(a) * 44,
        m + Math.sin(a) * 44,
        m + Math.cos(a) * 76,
        m + Math.sin(a) * 76,
        'rgba(20,22,24,.5)',
        1,
      );
      p.circ(m + Math.cos(a + 0.26) * 70, m + Math.sin(a + 0.26) * 70, 2, '#2c2f32', 0.6);
    }
    p.circ(m, m, 44, '#33373a', 1.4);
    c.strokeStyle = 'rgba(159,216,230,.35)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(m, m, 80, 0, Math.PI * 2);
    c.stroke();
    wear(m - 76, m - 76, 152, 152, 60);
    // A scorch where something burnt through the plating.
    p.ell(m + 48, m - 30, 14, 8, 'rgba(10,8,6,.5)');
  });
  add('clamp', 26, 14, (p) => {
    p.rect(2, 3, 22, 8, STEEL_DARK, 1);
    p.rect(4, 4.5, 6, 5, STEEL);
    p.circ(19, 7, 2.2, '#8a8f93', 0.6);
  });
  // A thick cable, curving a little, its sheath split once.
  add('cable', 112, 18, (p) => {
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(4, 9);
    c.bezierCurveTo(36, 2, 70, 16, 108, 8);
    c.stroke();
    c.strokeStyle = '#2a2c2e';
    c.lineWidth = 4;
    c.stroke();
    p.line(60, 10, 66, 11, '#b07a2a', 1.4);
  });
  // The observation console: a long desk, three screens, one smashed.
  add('console', 132, 44, (p) => {
    shadow(p, 68, 26, 62, 18);
    p.rect(3, 14, 126, 26, '#4a4f53', 1.4);
    p.rect(3, 14, 126, 4, '#5c6266');
    for (const [x, broke] of [
      [10, false],
      [50, true],
      [92, false],
    ] as const) {
      p.rect(x, 3, 30, 14, '#1d2022', 1.2);
      p.rect(x + 2, 5, 26, 10, broke ? '#0d0f10' : '#16191b');
      if (broke) {
        p.line(x + 6, 6, x + 16, 13, 'rgba(200,220,230,.5)', 0.7);
        p.line(x + 16, 13, x + 24, 7, 'rgba(200,220,230,.4)', 0.6);
      }
    }
    for (let x = 8; x < 124; x += 5) p.rect(x, 26 + (x % 3), 3, 2, x % 4 ? '#2b2e30' : '#5a2a22');
    wear(3, 14, 126, 26, 40);
  });
  // The one screen that still works: lines of text scrolling for nobody.
  add('screenOn', 30, 16, (p) => {
    p.rect(1, 1, 28, 14, '#1d2022', 1.2);
    p.rect(3, 3, 24, 10, '#0c2a22');
    for (let y = 4; y < 12; y += 2) p.rect(4, y, 6 + ar() * 16, 1, SCREEN);
    p.rect(4, 11, 3, 1.4, '#ffffff');
  });
  add('screenOff', 30, 16, (p) => {
    p.rect(1, 1, 28, 14, '#1d2022', 1.2);
    p.rect(3, 3, 24, 10, '#111416');
    p.line(6, 5, 12, 6, 'rgba(255,255,255,.12)', 1);
  });
  // A logbook left open, its pages curling.
  add('logbook', 26, 20, (p) => {
    shadow(p, 14, 12, 11, 8);
    p.rect(2, 2, 22, 16, '#2a3a5a', 1);
    p.rect(3.5, 3, 9, 14, '#e8e2d0');
    p.rect(13.5, 3, 9, 14, '#ded8c4');
    for (let y = 5; y < 16; y += 2) {
      p.line(5, y, 11, y, 'rgba(40,40,60,.45)', 0.6);
      p.line(15, y, 21 - (y % 4), y, 'rgba(40,40,60,.45)', 0.6);
    }
  });
  // An office chair on its side, one castor gone.
  add('chairDown', 36, 30, (p) => {
    shadow(p, 19, 17, 15, 10);
    p.rect(4, 8, 14, 14, '#2c2f33', 1.2);
    p.rect(17, 6, 7, 18, '#33373b', 1.1);
    p.line(24, 15, 32, 15, '#4a4f53', 2);
    for (const [x, y] of [
      [32, 9],
      [33, 20],
      [29, 25],
    ] as const) {
      p.line(32, 15, x, y, '#4a4f53', 1.6);
      p.circ(x, y, 1.6, '#1a1c1e');
    }
  });
  add('chairLab', 26, 26, (p) => {
    shadow(p, 14, 14, 10, 9);
    p.circ(13, 13, 9, '#2c2f33', 1.2);
    p.rect(4, 7, 4, 12, '#33373b', 1);
    p.circ(13, 13, 4, '#3a3f44');
  });
  // Loose papers: a sheet, a fanned handful, a folder spilt open.
  add('papers0', 18, 22, (p) => {
    p.rect(2, 2, 13, 17, '#d8d2c0', 0.6);
    for (let y = 5; y < 16; y += 2) p.line(4, y, 12, y, 'rgba(50,50,60,.35)', 0.5);
  });
  add('papers1', 30, 24, (p) => {
    for (const [x, y, a] of [
      [4, 4, -0.2],
      [10, 3, 0.15],
      [14, 6, 0.4],
    ] as const) {
      c.save();
      c.translate(x + 6, y + 8);
      c.rotate(a);
      p.rect(-6, -8, 12, 16, '#ddd7c6', 0.6);
      p.line(-4, -4, 4, -4, 'rgba(50,50,60,.35)', 0.5);
      p.line(-4, -1, 3, -1, 'rgba(50,50,60,.35)', 0.5);
      c.restore();
    }
  });
  add('papers2', 30, 22, (p) => {
    p.rect(2, 3, 16, 16, '#a8863e', 0.8);
    p.rect(14, 4, 13, 15, '#e0dac8', 0.6);
    p.rect(16, 8, 8, 5, 'rgba(160,40,30,.35)');
  });
  // A lab desk with one drawer: a monitor face down, a mug.
  add('labDesk', 64, 34, (p) => {
    shadow(p, 33, 19, 29, 14);
    p.rect(2, 3, 60, 28, '#8c8f88', 1.3);
    p.rect(2, 3, 60, 3, '#a2a59d');
    p.rect(40, 8, 18, 12, '#26292b', 1);
    p.circ(12, 14, 3.4, '#e8e2d4', 0.8);
    p.circ(12, 14, 2, '#3a2a1e');
    p.rect(8, 22, 22, 7, '#7a7d76', 0.8);
    p.rect(17, 25, 4, 1.4, '#3a3d3a');
    wear(2, 3, 60, 28, 30);
  });
  add('stool', 18, 18, (p) => {
    shadow(p, 10, 10, 7, 6);
    p.circ(9, 9, 6.5, '#3c4044', 1.1);
    p.circ(9, 9, 3, '#55595d');
  });
  // A server rack from above: a tall cabinet, its lid vented, LEDs down the front.
  add('rack', 50, 26, (p) => {
    shadow(p, 26, 15, 23, 11);
    p.rect(2, 2, 46, 22, '#24272a', 1.3);
    for (let x = 6; x < 44; x += 4) p.rect(x, 5, 2, 10, '#16181a');
    for (let x = 6; x < 44; x += 5) {
      p.circ(x, 20, 1, ar() < 0.3 ? '#6aff8a' : ar() < 0.2 ? '#ff5a3a' : '#2e3234');
    }
  });
  add('shelfLab', 64, 22, (p) => {
    shadow(p, 33, 13, 30, 9);
    p.rect(2, 2, 60, 18, STEEL, 1.2);
    const cols = ['#c9d6dc', '#8aa4b0', '#d4c08a', '#a8b0a0', '#e0e0e0'];
    for (let x = 6; x < 58; x += 7) {
      if (ar() < 0.25) continue; // a gap where something was taken
      p.rect(x, 5, 5, 11, cols[Math.floor(ar() * cols.length)] as string, 0.6);
    }
    p.ell(48, 14, 5, 2.4, 'rgba(120,200,160,.35)');
  });
  // A sample fridge, its door hanging open, the light inside long dead.
  add('fridgeLab', 34, 34, (p) => {
    shadow(p, 18, 18, 15, 14);
    p.rect(3, 3, 26, 26, '#d4d6d0', 1.3);
    p.rect(6, 6, 20, 20, '#9ea39f');
    for (let y = 9; y < 25; y += 5) p.rect(7, y, 18, 1.4, '#b6bbb7');
    p.poly(
      [
        [29, 3],
        [33, 8],
        [33, 31],
        [29, 29],
      ],
      '#e0e2dc',
      1,
    );
  });
  // The rotating alarm lamp: a red dome in a wire cage.
  add('alarmLamp', 18, 18, (p) => {
    p.circ(9, 9, 7.5, STEEL_DARK, 1);
    p.circ(9, 9, 5.5, RED, 0.6);
    p.circ(7.5, 7.5, 2, 'rgba(255,220,200,.6)');
    p.line(2, 9, 16, 9, '#202224', 0.8);
    p.line(9, 2, 9, 16, '#202224', 0.8);
  });
  add('lampEmergency', 20, 10, (p) => {
    p.rect(1, 1, 18, 8, STEEL_DARK, 1);
    p.rect(3, 3, 14, 4, '#ff8a5a');
  });
  add('lampExit', 26, 10, (p) => {
    p.rect(1, 1, 24, 8, '#1d2a20', 1);
    p.rect(3, 3, 20, 4, '#4adf7a');
    p.rect(6, 4, 6, 2, '#eafff0');
  });
  // A painted stencil on the floor: a big 7, chipped.
  add('stencil7', 40, 40, () => {
    c.font = 'bold 34px sans-serif';
    c.fillStyle = 'rgba(216,169,46,.6)';
    c.fillText('7', 10, 34);
    for (let k = 0; k < 18; k++) {
      c.fillStyle = 'rgba(92,94,91,.9)';
      c.fillRect(8 + ar() * 24, 8 + ar() * 26, 2 + ar() * 3, 1.5);
    }
  });
  add('crack', 60, 40, () => {
    c.strokeStyle = 'rgba(14,14,14,.6)';
    c.lineWidth = 1;
    c.beginPath();
    let x = 4;
    let y = 20;
    c.moveTo(x, y);
    while (x < 56) {
      x += 4 + ar() * 6;
      y += (ar() - 0.5) * 8;
      c.lineTo(x, y);
      if (ar() < 0.25) {
        c.moveTo(x, y);
        c.lineTo(x + 6, y + (ar() - 0.5) * 14);
        c.moveTo(x, y);
      }
    }
    c.stroke();
  });
  add('stain', 44, 30, (p) => {
    p.ell(22, 15, 18, 10, 'rgba(40,30,20,.35)');
    p.ell(16, 12, 8, 5, 'rgba(40,30,20,.25)');
  });
  add('puddle', 48, 30, (p) => {
    p.ell(24, 15, 20, 11, 'rgba(30,38,44,.75)');
    p.ell(20, 12, 8, 3, 'rgba(180,200,215,.18)');
  });
  add('ash', 40, 28, (p) => {
    p.ell(20, 14, 17, 10, 'rgba(130,126,118,.4)');
    for (let k = 0; k < 8; k++) p.rect(6 + ar() * 28, 6 + ar() * 16, 1.5, 1.5, 'rgba(30,26,22,.6)');
  });

  // --- Doors ---
  // A heavy sliding door in its frame: shut, with a card reader glowing red.
  const door = (open: boolean, sealed: boolean) => (p: Painter) => {
    p.rect(0, 2, 72, 14, '#2a2d30', 1.2);
    if (open) {
      // Slid into the wall: only its edge shows at one side.
      p.rect(2, 4, 8, 10, '#5e6468', 1);
      p.rect(10, 5, 60, 8, '#1a1c1e');
    } else {
      p.rect(4, 4, 64, 10, sealed ? '#5c5f58' : '#707679', 1);
      p.rect(4, 4, 64, 2, 'rgba(255,255,255,.12)');
      stripes(28, 6, 16, 6, 0.6);
      wear(4, 4, 64, 10, 18);
    }
    p.rect(66, 0, 6, 6, '#1d2022', 0.8);
    p.circ(69, 3, 1.6, open ? '#4adf7a' : RED);
  };
  add('labDoor', 72, 18, door(false, false));
  add('labDoorOpen', 72, 18, door(true, false));
  add('sealedDoor', 72, 18, door(false, true));
  // The blast doors to the yard: a thick slab, stuck halfway.
  add('blastDoor', 52, 30, (p) => {
    shadow(p, 28, 18, 24, 12);
    p.rect(2, 4, 48, 22, '#55595b', 1.6);
    stripes(4, 6, 44, 6, 0.7);
    for (let x = 8; x < 48; x += 10) p.circ(x, 20, 1.6, '#2a2d30');
    p.rect(44, 4, 6, 22, '#3c4044', 1);
    wear(2, 4, 48, 22, 40);
  });
  add('hazard', 64, 14, () => stripes(1, 1, 62, 12, 0.7));
  add('arrows', 64, 20, (p) => {
    for (const x of [6, 26, 46]) {
      p.poly(
        [
          [x, 4],
          [x + 10, 10],
          [x, 16],
          [x + 4, 10],
        ],
        'rgba(230,230,220,.6)',
      );
    }
  });
  // Signs on the wall: white letters, a pictogram.
  const sign = (bg: string, fn: () => void) => (p: Painter) => {
    p.rect(1, 1, 46, 14, bg, 1);
    fn();
  };
  add(
    'signVivarium',
    48,
    16,
    sign('#2a3a4a', () => {
      c.fillStyle = '#e8eef0';
      c.font = 'bold 9px sans-serif';
      c.fillText('V–1·5', 6, 11.5);
      c.fillStyle = YELLOW;
      c.fillRect(38, 4, 6, 8);
    }),
  );
  add(
    'signExit',
    48,
    16,
    sign('#1d4a2a', () => {
      c.fillStyle = '#eafff0';
      c.font = 'bold 9px sans-serif';
      c.fillText('EXIT ↓', 6, 11.5);
    }),
  );
  // The ceiling come down: slabs, rebar, dust.
  add('rubble', 104, 104, (p) => {
    shadow(p, 54, 56, 46, 44);
    for (let k = 0; k < 16; k++) {
      const x = 14 + ar() * 76;
      const y = 14 + ar() * 76;
      const s = 10 + ar() * 16;
      const a = ar() * Math.PI;
      c.save();
      c.translate(x, y);
      c.rotate(a);
      p.poly(
        [
          [-s, -s * 0.6],
          [s * 0.8, -s * 0.7],
          [s, s * 0.5],
          [-s * 0.7, s * 0.6],
        ],
        ['#6a6c69', '#5c5e5b', '#787a76', '#535552'][k % 4] as string,
        1.2,
      );
      c.restore();
    }
    for (let k = 0; k < 5; k++) {
      p.line(10 + ar() * 84, 10 + ar() * 84, 10 + ar() * 84, 10 + ar() * 84, '#6a3a24', 1.6);
    }
  });
  add('trolley', 46, 30, (p) => {
    shadow(p, 24, 17, 20, 12);
    p.rect(3, 4, 38, 22, STEEL, 1.2);
    p.rect(6, 7, 32, 16, '#5a5f63');
    p.rect(41, 6, 3, 18, STEEL_DARK, 0.8);
    p.rect(10, 10, 9, 7, '#c9d6dc', 0.6);
  });
  add('extinguisher', 14, 22, (p) => {
    p.ell(7, 12, 5, 8, RED, 1);
    p.rect(4, 2, 6, 4, '#202224', 0.6);
  });

  // --- Round the circle ---
  // A numbered marker, as left by whoever went over the hall inch by inch.
  add('tag', 14, 12, (p) => {
    p.poly(
      [
        [1, 11],
        [7, 1],
        [13, 11],
      ],
      YELLOW,
      0.8,
    );
    p.line(5, 8, 9, 8, '#1a1a18', 1.2);
  });
  // A work light on a tripod: the legs, the head, a cable off to somewhere.
  const worklight = (down: boolean) => (p: Painter) => {
    if (!down) {
      for (const a of [0.5, 2.6, 4.7])
        p.line(18, 18, 18 + Math.cos(a) * 14, 18 + Math.sin(a) * 14, STEEL_DARK, 1.6);
    } else {
      for (const k of [-3, 0, 3]) p.line(6, 18 + k, 28, 18 + k * 0.4, STEEL_DARK, 1.6);
    }
    p.rect(12, 12, 13, 12, '#2a2c2e', 1);
    p.rect(14, 14, 9, 8, down ? '#5a5c58' : '#fff6dc');
    p.line(18, 24, 22, 34, INK, 1.4);
  };
  add('worklight', 36, 36, worklight(false));
  add('worklightDown', 36, 36, worklight(true));
  // Concrete stairs going up north, to level 0: worn nosings, a rail.
  add('flight', 132, 132, (p) => {
    p.rect(0, 0, 132, 132, '#1c1d1c');
    for (let k = 0; k < 8; k++) {
      const v = 70 + k * 9;
      const y = 132 - (k + 1) * 16;
      p.rect(4, y, 124, 17, `rgb(${v},${v + 1},${v - 2})`);
      p.rect(4, y, 124, 2, 'rgba(216,169,46,.45)');
      p.rect(4, y + 15, 124, 2, 'rgba(0,0,0,.4)');
      if (ar() < 0.6) p.rect(10 + ar() * 100, y + 4 + ar() * 8, 6, 2, 'rgba(0,0,0,.3)');
    }
    p.rect(0, 0, 4, 132, STEEL_DARK);
    p.rect(128, 0, 4, 132, STEEL_DARK);
  });
  // A steel roller shutter, down: slats, a dent, a padlocked bar.
  add('shutter', 136, 20, (p) => {
    p.rect(2, 3, 132, 14, '#5d6266', 1.2);
    for (let x = 6; x < 132; x += 6) p.line(x, 4, x, 16, 'rgba(20,22,24,.45)', 1);
    p.ell(80, 10, 9, 4, 'rgba(10,10,12,.35)');
    p.rect(60, 14, 16, 4, YELLOW, 0.8);
    wear(2, 3, 132, 14, 30);
  });
  // A freight lift's doors, shut, and its button panel, dark.
  add('liftDoor', 76, 22, (p) => {
    p.rect(1, 2, 74, 16, '#2a2d30', 1.2);
    p.rect(4, 4, 33, 12, '#7a7f82', 1);
    p.rect(39, 4, 33, 12, '#73787b', 1);
    p.line(38, 4, 38, 16, INK, 1.2);
    stripes(4, 13, 68, 3, 0.6);
    wear(4, 4, 68, 12, 20);
    p.rect(66, 17, 8, 5, '#1d2022', 0.8);
  });
  // A painted level number on the floor: −1, chipped.
  add('stencilLevel', 64, 40, () => {
    c.font = 'bold 32px sans-serif';
    c.fillStyle = 'rgba(216,169,46,.6)';
    c.fillText('−1', 6, 33);
    for (let k = 0; k < 22; k++) {
      c.fillStyle = 'rgba(92,94,91,.9)';
      c.fillRect(6 + ar() * 50, 8 + ar() * 26, 2 + ar() * 3, 1.5);
    }
  });
  // An electric utility cart, stopped where its battery died.
  add('cart', 44, 72, (p) => {
    shadow(p, 23, 38, 20, 32);
    p.rect(4, 6, 36, 60, '#a8a49a', 1.4);
    p.rect(7, 8, 30, 14, '#3a4a5a', 1);
    p.rect(7, 26, 30, 4, '#7c786f');
    p.rect(7, 34, 30, 28, '#5a5f63', 1);
    p.rect(10, 38, 12, 9, '#6a5a3a', 0.8);
    for (const [x, y] of [
      [2, 12],
      [38, 12],
      [2, 54],
      [38, 54],
    ] as const)
      p.rect(x, y, 4, 9, '#1a1b1c');
    wear(4, 6, 36, 60, 30);
  });

  // --- The vivarium ---
  // Bars bent outward, in a cage that held something.
  add('barsBent', 64, 30, (p) => {
    for (let k = 0; k < 6; k++) {
      const x = 6 + k * 10;
      const bend = (k - 2.5) * 5;
      c.strokeStyle = INK;
      c.lineWidth = 4.6;
      c.beginPath();
      c.moveTo(x, 18);
      c.quadraticCurveTo(x + bend * 0.4, 8, x + bend, 2);
      c.stroke();
      c.strokeStyle = '#7e868a';
      c.lineWidth = 2.6;
      c.stroke();
    }
    p.ell(32, 22, 22, 4, 'rgba(10,8,6,.25)');
  });
  add('scratches', 50, 40, () => {
    c.strokeStyle = 'rgba(18,16,14,.55)';
    c.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(6 + k * 9, 4);
      c.lineTo(14 + k * 9 + ar() * 4, 36);
      c.stroke();
    }
  });
  add('drain', 22, 22, (p) => {
    p.circ(11, 11, 9, '#1a1b1c', 1);
    for (let k = -6; k <= 6; k += 3) p.line(5, 11 + k, 17, 11 + k, '#4a4f53', 1);
  });
  add('bowl', 16, 16, (p) => {
    p.circ(8, 8, 6.5, '#8a8f93', 1);
    p.circ(8, 8, 4, '#3a2a20');
  });
  add('plaque', 34, 14, (p) => {
    p.rect(1, 2, 32, 10, '#c9cbc4', 1);
    p.rect(3, 4, 6, 6, YELLOW, 0.5);
    p.line(12, 5, 29, 5, '#2a2c2e', 0.8);
    p.line(12, 8, 24, 8, '#2a2c2e', 0.8);
  });
  add('bucket', 18, 18, (p) => {
    p.circ(9, 9, 7, '#5a7a8a', 1);
    p.circ(9, 9, 5, '#2a3a42');
  });
  add('hose', 80, 40, () => {
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(4, 30);
    c.bezierCurveTo(20, 4, 40, 40, 58, 18);
    c.bezierCurveTo(66, 8, 76, 14, 76, 24);
    c.stroke();
    c.strokeStyle = '#3e6a3a';
    c.lineWidth = 2.4;
    c.stroke();
  });

  // --- The checkpoint ---
  add('guardDesk', 104, 34, (p) => {
    shadow(p, 54, 19, 48, 14);
    p.rect(2, 4, 100, 26, '#4a4f53', 1.4);
    p.rect(2, 4, 100, 4, '#5c6266');
    p.rect(70, 12, 22, 12, '#2e3236', 0.8);
    for (let x = 74; x < 90; x += 4) p.rect(x, 15, 2, 6, '#1a1c1e');
    wear(2, 4, 100, 26, 40);
  });
  // The weapons locker, its door open, an empty rack inside.
  add('gunLocker', 40, 30, (p) => {
    shadow(p, 21, 17, 17, 12);
    p.rect(3, 3, 30, 24, '#3d4a3c', 1.3);
    p.rect(6, 6, 24, 18, '#1e221d');
    for (let x = 9; x < 28; x += 5) p.line(x, 8, x, 22, '#5a5f63', 1.2);
    p.poly(
      [
        [33, 3],
        [38, 7],
        [38, 30],
        [33, 27],
      ],
      '#4b5a49',
      1,
    );
    p.circ(31, 15, 1.4, YELLOW);
  });
  const locker = (open: boolean) => (p: Painter) => {
    p.rect(2, 2, 24, 18, '#5a6a72', 1.2);
    for (let y = 5; y < 18; y += 3) p.line(5, y, 12, y, '#46545b', 0.8);
    p.rect(18, 9, 3, 4, '#2a2c2e');
    if (open) {
      p.rect(4, 4, 20, 14, '#1c2024');
      p.poly(
        [
          [2, 20],
          [-2, 26],
          [22, 26],
          [26, 20],
        ],
        '#667880',
        1,
      );
    }
  };
  add('locker', 28, 22, locker(false));
  add('lockerOpen', 28, 28, locker(true));
  add('turnstile', 32, 32, (p) => {
    p.rect(6, 4, 20, 24, '#4a4f53', 1.2);
    p.circ(16, 16, 5, '#2a2c2e', 1);
    for (const a of [0, 2.1, 4.2])
      p.line(16, 16, 16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, '#9aa0a4', 2);
  });
  add('barrierPost', 14, 14, (p) => {
    p.circ(7, 7, 5, '#3c4044', 1);
    p.circ(7, 7, 2.6, YELLOW);
  });

  // --- The yard ---
  // A car burnt to the frame: no paint left, glass gone, tyres melted to the rims.
  add('carBurnt', 90, 46, (p) => {
    shadow(p, 47, 26, 42, 18);
    for (const [x, y] of [
      [18, 6],
      [70, 6],
      [18, 40],
      [70, 40],
    ] as const) {
      p.ell(x, y, 8, 3.4, '#141414', 1);
      p.circ(x, y, 2, '#4a4a48');
    }
    p.rect(6, 7, 78, 32, '#3a3430', 1.6);
    p.rect(26, 10, 36, 26, '#1c1a19', 1.2);
    p.rect(10, 10, 14, 26, '#4a3f36');
    for (let k = 0; k < 18; k++) {
      p.ell(
        8 + ar() * 74,
        9 + ar() * 28,
        2 + ar() * 5,
        1 + ar() * 3,
        ar() < 0.5 ? 'rgba(120,60,30,.55)' : 'rgba(20,18,16,.5)',
      );
    }
    p.line(30, 12, 58, 34, '#2a2522', 1.4);
  });
  add('barrier', 120, 14, (p) => {
    p.rect(2, 4, 116, 6, '#d6d0c0', 1);
    for (let x = 10; x < 116; x += 20) p.rect(x, 4, 10, 6, RED);
    p.circ(6, 7, 5, '#3c4044', 1);
  });
  add('sandbags', 48, 26, (p) => {
    shadow(p, 25, 15, 22, 10);
    for (const [x, y] of [
      [10, 8],
      [24, 7],
      [38, 9],
      [16, 17],
      [31, 18],
    ] as const) {
      p.ell(x, y, 8, 5.4, ar() < 0.5 ? '#8a7a58' : '#7a6c4c', 1);
    }
  });
  add('fireBarrel', 24, 24, (p) => {
    shadow(p, 13, 14, 10, 8);
    p.circ(12, 12, 10, '#5a3a26', 1.3);
    p.circ(12, 12, 8, '#1a120c');
    p.circ(12, 12, 5.5, '#e0602a');
    p.circ(11, 11, 3, '#ffc86a');
  });
  add('mattress', 60, 32, (p) => {
    p.rect(3, 3, 54, 26, '#7a6a52', 1.2);
    p.rect(6, 6, 14, 8, '#9a8a6a', 0.8);
    p.ell(36, 18, 10, 6, 'rgba(40,30,20,.35)');
    p.rect(22, 20, 30, 7, '#4a5a3a', 0.8);
  });
  add('floodlight', 30, 16, (p) => {
    p.rect(4, 1, 22, 10, STEEL_DARK, 1);
    p.rect(6, 3, 18, 6, '#fff2d0');
    p.line(15, 11, 15, 15, STEEL_DARK, 2);
  });
  add('lampPost', 20, 20, (p) => {
    shadow(p, 11, 11, 6, 5);
    p.circ(10, 10, 4, STEEL_DARK, 1);
    p.line(10, 10, 18, 4, STEEL_DARK, 2);
    p.rect(14, 1, 6, 5, '#2a2c2e', 0.8);
  });
  // On the roof: a vent, a humming unit, a little lit by nothing.
  add('vent', 36, 36, (p) => {
    p.rect(4, 4, 28, 28, '#3c3f42', 1.2);
    p.circ(18, 18, 10, '#26292b', 1);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      p.line(18, 18, 18 + Math.cos(a) * 9, 18 + Math.sin(a) * 9, '#4a4e52', 1.4);
    }
  });
  add('roofUnit', 56, 40, (p) => {
    shadow(p, 30, 22, 25, 17);
    p.rect(3, 3, 50, 34, '#4a4e52', 1.3);
    p.circ(18, 20, 12, '#2a2d30', 1);
    p.circ(40, 20, 9, '#2a2d30', 1);
    wear(3, 3, 50, 34, 30);
  });
  // A keycard on a clip: the Facility's mark, a magnetic strip.
  add('keycard', 22, 16, (p) => {
    p.rect(2, 2, 18, 12, PAINT, 1);
    p.rect(2, 9, 18, 3, '#2a2c2e');
    p.rect(4, 4, 5, 4, '#3a6a9a');
    p.line(11, 5, 17, 5, '#5a5c58', 0.8);
  });
  A.refresh();
}
