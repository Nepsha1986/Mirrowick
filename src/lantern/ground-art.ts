import type * as Phaser from 'phaser';
import { INK } from './brush';
import { makeNoise, mulberry32, type Pt } from './util';
import type { GroundPatch, ThinWall } from './world';

type Ctx = CanvasRenderingContext2D;

const GRASS = ['#5d7d36', '#668740', '#517030', '#6b8c44'];

/** Points every `step` pixels along a polyline, with the direction there. */
function walk(
  pts: Pt[],
  step: number,
): { x: number; y: number; nx: number; ny: number; s: number }[] {
  const out: { x: number; y: number; nx: number; ny: number; s: number }[] = [];
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i] as Pt;
    const b = pts[i + 1] as Pt;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    for (let d = 0; d < len; d += step, s += step) {
      out.push({ x: a.x + dx * d, y: a.y + dy * d, nx: -dy, ny: dx, s });
    }
  }
  return out;
}

/**
 * Roads, paths and beds painted onto one texture over the grass: ragged
 * edges, ruts and puddles, gravel worn through to the grass in places.
 */
export function paintGround(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  patches: GroundPatch[],
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const main = tex.getContext();
  const r = mulberry32(808);
  const edge = makeNoise(17);
  const pick = (cols: string[]) => cols[Math.floor(r() * cols.length)] as string;

  for (const [n, patch] of patches.entries()) {
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const c = tmp.getContext('2d') as Ctx;
    const line = walk(patch.pts, 2);
    const half = (s: number, side: number) =>
      (patch.width / 2) * (0.9 + 0.22 * edge(s * 0.03 + n * 7, side * 3.1 + n));

    // The shape: a band whose two edges wander independently; a bed is a
    // rough rectangle round its line.
    const base = { road: '#8a7556', gravel: '#9d9486', dirt: '#8a7352', soil: '#4c3826' }[
      patch.kind
    ];
    c.fillStyle = base;
    if (patch.kind === 'soil') {
      const xs = patch.pts.map((p) => p.x);
      const ys = patch.pts.map((p) => p.y);
      const pad = patch.width / 2 - 3;
      const x0 = Math.min(...xs) + 3;
      const x1 = Math.max(...xs) - 3;
      const y0 = Math.min(...ys) - pad;
      const y1 = Math.max(...ys) + pad;
      const j = () => (r() - 0.5) * 4;
      c.beginPath();
      c.moveTo(x0 + j(), y0 + j());
      for (let x = x0 + 8; x < x1; x += 8) c.lineTo(x, y0 + j());
      for (let y = y0; y < y1; y += 8) c.lineTo(x1 + j(), y);
      for (let x = x1; x > x0; x -= 8) c.lineTo(x, y1 + j());
      for (let y = y1; y > y0; y -= 8) c.lineTo(x0 + j(), y);
      c.closePath();
      c.fill();
    } else {
      c.beginPath();
      line.forEach((p, i) => {
        const hw = half(p.s, 1);
        if (i) c.lineTo(p.x + p.nx * hw, p.y + p.ny * hw);
        else c.moveTo(p.x + p.nx * hw, p.y + p.ny * hw);
      });
      for (let i = line.length - 1; i >= 0; i--) {
        const p = line[i] as (typeof line)[number];
        const hw = half(p.s, -1);
        c.lineTo(p.x - p.nx * hw, p.y - p.ny * hw);
      }
      c.closePath();
      c.fill();
      // Round off the ends.
      for (const p of [line[0], line[line.length - 1]]) {
        if (!p) continue;
        c.beginPath();
        c.arc(p.x, p.y, patch.width * 0.32, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Texture, only where the shape is.
    c.globalCompositeOperation = 'source-atop';
    const area = line.length * 2 * patch.width;
    const speck = (cols: string[], density: number, size = 2) => {
      for (let k = 0; k < area * density; k++) {
        const p = line[Math.floor(r() * line.length)] as (typeof line)[number];
        const o = (r() - 0.5) * patch.width * 1.1;
        const a = (r() - 0.5) * patch.width;
        const s = 0.6 + r() * size;
        c.fillStyle = pick(cols);
        // Spread along the line too, so the rounded ends get texture.
        c.fillRect(p.x + p.nx * o + p.ny * a, p.y + p.ny * o - p.nx * a, s, s);
      }
    };
    const blob = (
      x: number,
      y: number,
      rx: number,
      ry: number,
      fill: string,
      rot = r() * Math.PI,
    ) => {
      c.fillStyle = fill;
      c.beginPath();
      c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      c.fill();
    };
    const track = (offset: number, col: string, width: number, broken = 0) => {
      c.strokeStyle = col;
      c.lineWidth = width;
      c.lineCap = 'round';
      c.beginPath();
      let down = false;
      for (const p of line) {
        const o = offset + (edge(p.s * 0.05, offset) - 0.5) * 3;
        const gap = broken && edge(p.s * 0.02 + offset, 9) < broken;
        if (gap) {
          down = false;
          continue;
        }
        if (down) c.lineTo(p.x + p.nx * o, p.y + p.ny * o);
        else c.moveTo(p.x + p.nx * o, p.y + p.ny * o);
        down = true;
      }
      c.stroke();
    };

    if (patch.kind === 'road') {
      speck(['#7c684b', '#9a8565', '#a89a84', '#6f5d43', '#b4a78f'], 0.09);
      // Two ruts with puddles in them, and grass down the middle.
      for (const side of [-1, 1]) track(side * patch.width * 0.24, 'rgba(70,52,34,.35)', 7);
      track(0, 'rgba(98,130,58,.75)', 6, 0.3);
      for (let k = 0; k < 40; k++) {
        const p = line[Math.floor(r() * line.length)] as (typeof line)[number];
        const o = (r() - 0.5) * 6;
        c.strokeStyle = pick(['#6a8a40', '#7a9c4c', '#56752f']);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(p.x + p.nx * o, p.y + p.ny * o);
        c.lineTo(p.x + p.nx * o + (r() - 0.5) * 3, p.y + p.ny * o - 3 - r() * 3);
        c.stroke();
      }
      for (let k = 0; k < 3; k++) {
        const p = line[Math.floor((0.15 + r() * 0.7) * line.length)] as (typeof line)[number];
        const o = (r() < 0.5 ? -1 : 1) * patch.width * 0.24;
        const x = p.x + p.nx * o;
        const y = p.y + p.ny * o;
        // Puddles lie along the ruts.
        const rot = Math.atan2(-p.nx, p.ny) + (r() - 0.5) * 0.3;
        blob(x, y, 10 + r() * 8, 4 + r() * 2, '#566064', rot);
        blob(x - 2, y - 1, 5, 1.5, 'rgba(200,220,230,.35)', rot);
      }
      speck(['#8d877c', '#a29b8f'], 0.004, 4);
    } else if (patch.kind === 'gravel') {
      speck(['#8a8172', '#aaa192', '#7f7768', '#b4ab9b', '#6f685c'], 0.35);
      // Worn through to the grass here and there, and tyre tracks.
      for (let k = 0; k < line.length / 40; k++) {
        const p = line[Math.floor(r() * line.length)] as (typeof line)[number];
        const o = (r() - 0.5) * patch.width * 0.9;
        blob(p.x + p.nx * o, p.y + p.ny * o, 4 + r() * 7, 3 + r() * 4, pick(GRASS));
      }
      if (patch.width > 64) {
        for (const side of [-1, 1]) track(side * patch.width * 0.22, 'rgba(80,70,58,.28)', 6);
      }
    } else if (patch.kind === 'dirt') {
      speck(['#7e6848', '#967e5c', '#735f42', '#a08865'], 0.12);
      track(0, 'rgba(170,148,112,.35)', patch.width * 0.35);
    } else {
      // Furrows along the bed, not quite straight.
      for (let o = -patch.width / 2 + 6; o < patch.width / 2 - 4; o += 9) {
        c.strokeStyle = 'rgba(30,20,12,.45)';
        c.lineWidth = 2;
        c.beginPath();
        for (const [i, p] of line.entries()) {
          const x = p.x + p.nx * o;
          const y = p.y + p.ny * o + (edge(p.s * 0.06, o) - 0.5) * 3;
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.stroke();
      }
      speck(['#3a2a1c', '#5a4430', '#42301f'], 0.1);
    }
    c.globalCompositeOperation = 'source-over';
    main.drawImage(tmp, 0, 0);

    // Grass creeping over the edges.
    if (patch.kind !== 'soil') {
      for (const p of line) {
        if (r() > 0.35) continue;
        for (const side of [-1, 1]) {
          const hw = half(p.s, side) - 1;
          const x = p.x + p.nx * hw * side;
          const y = p.y + p.ny * hw * side;
          main.strokeStyle = pick(['#6a8a40', '#7a9c4c', '#56752f']);
          main.lineWidth = 1;
          main.beginPath();
          main.moveTo(x, y);
          main.lineTo(x + (r() - 0.5) * 4, y - 2 - r() * 4);
          main.stroke();
        }
      }
    }
  }
  tex.refresh();
}

/**
 * Thin walls, posts and fences on one texture: plaster tops with chips and
 * cracks, timber posts, windowpanes, and a picket fence gone a little
 * crooked, with a picket missing here and there.
 */
export function paintWalls(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  walls: ThinWall[],
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const c = tex.getContext();
  const r = mulberry32(919);

  /** A rectangle with slightly wobbly edges. */
  const rough = (x: number, y: number, rw: number, rh: number, grow: number, fill: string) => {
    x -= grow;
    y -= grow;
    rw += grow * 2;
    rh += grow * 2;
    const j = () => (r() - 0.5) * 0.9;
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(x + j(), y + j());
    for (let t = 5; t < rw; t += 5) c.lineTo(x + t, y + j());
    c.lineTo(x + rw + j(), y + j());
    for (let t = 5; t < rh; t += 5) c.lineTo(x + rw + j(), y + t);
    c.lineTo(x + rw + j(), y + rh + j());
    for (let t = rw - 5; t > 0; t -= 5) c.lineTo(x + t, y + rh + j());
    c.lineTo(x + j(), y + rh + j());
    for (let t = rh - 5; t > 0; t -= 5) c.lineTo(x + j(), y + t);
    c.closePath();
    c.fill();
  };

  const masonry = walls.filter((m) => m.kind === 'outer' || m.kind === 'inner');
  // Ink first, then plaster over it, so joints between pieces don't show.
  for (const m of masonry) rough(m.x, m.y, m.w, m.h, 1.3, INK);
  for (const m of masonry) {
    rough(m.x, m.y, m.w, m.h, 0, m.kind === 'outer' ? '#d6c8aa' : '#e4d9c2');
  }
  for (const m of masonry) {
    // Chips, stains and the odd crack.
    for (let k = 0; k < (m.w * m.h) / 30; k++) {
      c.fillStyle = r() < 0.7 ? 'rgba(90,70,45,.25)' : 'rgba(255,250,235,.4)';
      c.fillRect(m.x + r() * m.w, m.y + r() * m.h, 1 + r(), 1);
    }
    if (m.kind === 'outer' && r() < 0.25) {
      const along = m.w > m.h;
      const x = m.x + r() * m.w;
      const y = m.y + r() * m.h;
      c.strokeStyle = 'rgba(60,40,25,.5)';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (along ? 4 : 1.5), y + (along ? 1.5 : 4));
      c.lineTo(x + (along ? 7 : -1), y + (along ? -1 : 7));
      c.stroke();
    }
  }
  for (const m of walls) {
    if (m.kind === 'post') {
      rough(m.x, m.y, m.w, m.h, 1.1, INK);
      rough(m.x, m.y, m.w, m.h, 0, r() < 0.5 ? '#5e4330' : '#54392a');
    } else if (m.kind === 'window') {
      // A pane across the wall, in a wooden frame.
      const along = m.w > m.h;
      c.fillStyle = '#4a3322';
      c.fillRect(m.x, m.y, m.w, m.h);
      c.fillStyle = '#a9cfe0';
      if (along) c.fillRect(m.x + 2, m.y + m.h / 2 - 1.5, m.w - 4, 3);
      else c.fillRect(m.x + m.w / 2 - 1.5, m.y + 2, 3, m.h - 4);
      c.fillStyle = 'rgba(255,255,255,.6)';
      if (along) c.fillRect(m.x + 3, m.y + m.h / 2 - 1.5, 4, 1);
      else c.fillRect(m.x + m.w / 2 - 1.5, m.y + 3, 1, 4);
    }
  }

  // The fence: two rails that sag a little between posts, and pickets.
  for (const f of walls) {
    if (f.kind !== 'fence') continue;
    const along = f.w > f.h;
    const len = along ? f.w : f.h;
    const at = (t: number, o: number): Pt => {
      const sag = Math.sin((t / 96) * Math.PI) * 1.2;
      return along
        ? { x: f.x + t, y: f.y + f.h / 2 + o + sag }
        : { x: f.x + f.w / 2 + o + sag, y: f.y + t };
    };
    for (const o of [-1.6, 1.6]) {
      c.strokeStyle = '#b9b2a2';
      c.lineWidth = 1.4;
      c.beginPath();
      for (let t = 0; t <= len; t += 4) {
        const p = at(t, o);
        if (t) c.lineTo(p.x, p.y);
        else c.moveTo(p.x, p.y);
      }
      c.stroke();
    }
    for (let t = 3; t < len - 2; t += 6.5 + r() * 1.2) {
      if (r() < 0.07) continue; // a picket gone
      const p = at(t, 0);
      const lean = r() < 0.08 ? (r() - 0.5) * 0.45 : (r() - 0.5) * 0.12;
      const shade = r() < 0.15 ? '#c9c2b0' : r() < 0.5 ? '#efebe0' : '#e3ddcf';
      c.save();
      c.translate(p.x, p.y);
      c.rotate(lean + (along ? 0 : Math.PI / 2));
      c.fillStyle = INK;
      c.fillRect(-2.1, -4.6, 4.2, 9.2);
      c.fillStyle = shade;
      c.fillRect(-1.5, -4, 3, 8);
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillRect(-1.5, -4, 1, 3);
      c.restore();
    }
  }
  tex.refresh();
}
