import type * as Phaser from 'phaser';
import { INK, painter, type Painter } from './brush';
import { mulberry32 } from './util';

const CHALK = 'rgba(232,226,210,.8)';
const WOOD = '#5e4330';
const WOOD_DARK = '#3a281b';

/** The mill cellar's things, and the hatch that leads down to it. */
export function paintCellarAtlas(scene: Phaser.Scene): void {
  const A = scene.textures.createCanvas('ln-cellar', 1024, 1024);
  if (!A) return;
  const c = A.getContext();
  const ar = mulberry32(313);
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
    p.ell(x, y, rx, ry, 'rgba(0,0,0,.45)');
  const pick = (cols: string[]) => cols[Math.floor(ar() * cols.length)] as string;
  /** A chalk line that skips and wavers a little, as if drawn by hand. */
  const chalk = (pts: [number, number][], width = 1.6) => {
    c.strokeStyle = CHALK;
    c.lineWidth = width;
    c.lineCap = 'round';
    for (let i = 0; i + 1 < pts.length; i++) {
      if (ar() < 0.04) continue;
      const [x0, y0] = pts[i] as [number, number];
      const [x1, y1] = pts[i + 1] as [number, number];
      c.beginPath();
      c.moveTo(x0 + (ar() - 0.5) * 0.8, y0 + (ar() - 0.5) * 0.8);
      c.lineTo(x1 + (ar() - 0.5) * 0.8, y1 + (ar() - 0.5) * 0.8);
      c.stroke();
    }
  };
  const ring = (cx: number, cy: number, r: number, width = 1.6) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const rr = r + (ar() - 0.5) * 1.2;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    chalk(pts, width);
  };
  const rune = (x: number, y: number, s: number) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 3 + Math.floor(ar() * 3); k++)
      pts.push([x + (ar() - 0.5) * s, y + (ar() - 0.5) * s]);
    chalk(pts, 1.1);
  };

  // A trapdoor thrown open on stone steps going down into the dark.
  add('hatch', 56, 56, (p) => {
    p.rect(6, 6, 44, 44, '#2a211a', 1.6);
    for (let k = 0; k < 4; k++) {
      const v = 70 - k * 16;
      p.rect(9, 9 + k * 9, 38, 8, `rgb(${v},${v - 6},${v - 12})`);
    }
    p.rect(9, 45, 38, 4, '#050404');
    // The lid, flung back against the floor.
    p.rect(6, 0, 44, 6, WOOD, 1.2);
    p.line(8, 3, 48, 3, WOOD_DARK, 1);
    p.circ(28, 3, 1.6, '#8a8a8a');
  });
  // The cellar stairs: worn steps rising to the west, lit from the top.
  add('stairs', 132, 70, (p) => {
    p.rect(0, 0, 132, 70, '#1a1614');
    for (let k = 0; k < 8; k++) {
      const v = 120 - k * 11;
      const x = k * 16;
      p.rect(x, 3, 17, 64, `rgb(${v},${v - 8},${v - 16})`);
      p.rect(x + 15, 3, 2, 64, 'rgba(0,0,0,.45)');
      p.rect(x + 1, 3, 3, 64, 'rgba(255,240,220,.08)');
      if (ar() < 0.5) p.rect(x + 4 + ar() * 8, 10 + ar() * 44, 4, 2, 'rgba(0,0,0,.35)');
    }
  });
  add('ritual', 320, 320, () => {
    const cx = 160;
    const cy = 160;
    ring(cx, cy, 150, 2.2);
    ring(cx, cy, 138, 1.4);
    ring(cx, cy, 72, 1.6);
    // Runes between the outer rings.
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      rune(cx + Math.cos(a) * 144, cy + Math.sin(a) * 144, 8);
    }
    // A seven-pointed star.
    const pts: [number, number][] = [];
    for (let k = 0; k <= 7; k++) {
      const a = ((k * 3) % 7) * ((Math.PI * 2) / 7) - Math.PI / 2;
      pts.push([cx + Math.cos(a) * 136, cy + Math.sin(a) * 136]);
    }
    chalk(pts, 1.8);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 - Math.PI / 2;
      ring(cx + Math.cos(a) * 112, cy + Math.sin(a) * 112, 7, 1.2);
    }
    // Smudges where feet have scuffed the chalk.
    for (let k = 0; k < 40; k++) {
      c.fillStyle = 'rgba(40,34,30,.5)';
      c.beginPath();
      c.ellipse(20 + ar() * 280, 20 + ar() * 280, 3 + ar() * 6, 2 + ar() * 3, ar() * 3, 0, 7);
      c.fill();
    }
  });
  add('dais', 128, 128, (p) => {
    shadow(p, 68, 70, 58, 56);
    p.circ(64, 64, 58, '#4a4440', 1.8);
    p.circ(64, 64, 50, '#5a534c', 1.2);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      p.line(
        64 + Math.cos(a) * 50,
        64 + Math.sin(a) * 50,
        64 + Math.cos(a) * 58,
        64 + Math.sin(a) * 58,
        INK,
        1,
      );
    }
    p.circ(64, 64, 42, '#3a3532', 1);
    for (let k = 0; k < 7; k++)
      p.circ(20 + ar() * 88, 20 + ar() * 88, 2 + ar() * 3, 'rgba(0,0,0,.25)');
  });
  add('candle', 14, 18, (p) => {
    p.ell(7, 13, 5, 3, 'rgba(240,230,200,.5)');
    p.rect(4, 6, 6, 9, '#e8dcc0', 0.8);
    p.circ(7, 4, 2.4, '#ffd27a');
    p.circ(7, 4, 1, '#fff6d0');
  });
  add('wax', 14, 10, (p) => {
    p.ell(7, 5, 6, 4, 'rgba(232,222,196,.75)');
    p.ell(6, 4, 3, 2, 'rgba(250,244,230,.6)');
  });
  add('pillar', 52, 52, (p) => {
    shadow(p, 30, 30, 22, 20);
    p.circ(26, 26, 22, '#5a534c', 1.8);
    p.circ(26, 26, 17, '#6b645b', 1.2);
    p.circ(22, 22, 8, 'rgba(255,245,225,.12)');
    for (let k = 0; k < 5; k++) p.circ(12 + ar() * 28, 12 + ar() * 28, 1.5, 'rgba(0,0,0,.3)');
  });
  add('shelf', 66, 24, (p) => {
    p.rect(1, 1, 64, 22, WOOD_DARK, 1.4);
    for (let x = 4; x < 62;) {
      if (ar() < 0.12) {
        x += 6; // a gap where a book was taken
        continue;
      }
      const w = 2.5 + ar() * 2.5;
      p.rect(
        x,
        4 + ar() * 2,
        w,
        15,
        pick(['#5a2420', '#2a3a3a', '#3e4a2a', '#6b5a3a', '#4a2a3a', '#7a6a50']),
      );
      x += w + 0.6;
    }
    // One book lying flat on top.
    p.rect(40, 2, 12, 5, '#5a2420', 0.6);
  });
  add('lectern', 40, 34, (p) => {
    shadow(p, 22, 20, 16, 12);
    p.rect(6, 6, 28, 22, WOOD, 1.3);
    p.rect(8, 8, 12, 17, '#e4d8bc', 0.8);
    p.rect(20, 8, 12, 17, '#ddd0b2', 0.8);
    for (let y = 11; y < 23; y += 2.5) {
      p.line(10, y, 18, y, 'rgba(60,40,30,.5)', 0.6);
      p.line(22, y, 30, y, 'rgba(60,40,30,.5)', 0.6);
    }
    p.line(20, 8, 20, 25, '#7a5a3a', 1);
    p.line(14, 25, 16, 33, '#7c2f28', 1.4);
  });
  // The same lectern with the book gone: a clean square in the dust, a tag.
  add('lecternBare', 40, 34, (p) => {
    shadow(p, 22, 20, 16, 12);
    p.rect(6, 6, 28, 22, WOOD, 1.3);
    p.rect(8, 8, 24, 17, 'rgba(120,96,70,.55)');
    p.rect(9, 9, 22, 15, 'rgba(70,50,36,.6)');
    p.rect(22, 15, 9, 6, '#d8a92e', 0.6);
    p.line(23.5, 18, 29, 18, '#1a1a18', 0.8);
  });
  add('longtable', 48, 124, (p) => {
    shadow(p, 27, 64, 22, 58);
    p.rect(4, 4, 40, 116, WOOD, 1.6);
    for (let y = 8; y < 118; y += 14) p.line(6, y, 42, y, 'rgba(30,18,10,.4)', 0.8);
    // Flasks, a mortar, papers, a skull and a candle.
    for (const [x, y, col] of [
      [14, 20, '#7aff9a'],
      [30, 26, '#c86aff'],
      [18, 44, '#ffb04a'],
      [33, 92, '#7ad8ff'],
    ] as const) {
      p.circ(x, y, 5, 'rgba(220,240,255,.35)', 0.8);
      p.circ(x, y, 3, col);
    }
    p.circ(30, 52, 6, '#8a8276', 1);
    p.circ(30, 52, 3, '#3a3532');
    p.rect(10, 62, 16, 20, '#ddd0b2', 0.6);
    p.rect(14, 66, 16, 20, '#e8dcc0', 0.6);
    p.circ(22, 104, 6, '#e8e0c8', 1);
    p.circ(20, 103, 1.4, INK);
    p.circ(24, 103, 1.4, INK);
    p.rect(34, 108, 5, 7, '#e8dcc0', 0.6);
  });
  add('cauldron', 48, 48, (p) => {
    shadow(p, 26, 27, 20, 18);
    p.circ(24, 24, 19, '#1e1e20', 1.8);
    p.circ(24, 24, 14, '#2f4a2a');
    p.circ(20, 21, 4, 'rgba(160,255,170,.45)');
    p.circ(28, 27, 2.5, 'rgba(160,255,170,.35)');
    for (const a of [0.4, 2.5, 4.6])
      p.circ(24 + Math.cos(a) * 21, 24 + Math.sin(a) * 21, 3, '#1e1e20', 1);
  });
  add('chest', 46, 32, (p) => {
    shadow(p, 25, 18, 21, 13);
    p.rect(3, 4, 40, 24, '#5a3a22', 1.4);
    p.rect(3, 4, 40, 4, '#6e4a2c');
    for (const x of [10, 36]) p.rect(x - 2, 4, 4, 24, '#3a3532', 0.6);
    p.rect(20, 13, 6, 6, '#b08a40', 0.8);
  });
  add('skull', 16, 16, (p) => {
    p.circ(8, 7, 5.5, '#e8e0c8', 1);
    p.rect(5.5, 11, 5, 3, '#ddd4bc', 0.6);
    p.circ(6, 7, 1.4, INK);
    p.circ(10, 7, 1.4, INK);
  });
  for (let k = 0; k < 3; k++) {
    add(`sigil${k}`, 40, 40, () => {
      ring(20, 20, 15, 1.2);
      for (let n = 0; n < 3; n++) rune(20, 20, 18);
    });
  }
  add('cobweb', 48, 48, () => {
    c.strokeStyle = 'rgba(220,220,215,.45)';
    c.lineWidth = 0.6;
    for (let k = 0; k < 6; k++) {
      const a = (k / 5) * (Math.PI / 2);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
      c.stroke();
    }
    for (let r = 8; r < 46; r += 7) {
      c.beginPath();
      c.arc(0, 0, r + (ar() - 0.5) * 2, 0, Math.PI / 2);
      c.stroke();
    }
  });
  add('sconce', 18, 18, (p) => {
    p.rect(5, 9, 8, 7, '#2a2420', 1);
    p.circ(9, 7, 4.5, '#ffb24a');
    p.circ(9, 6, 2, '#fff2c0');
  });
  A.refresh();
}
