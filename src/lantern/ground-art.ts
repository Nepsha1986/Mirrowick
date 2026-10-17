import type * as Phaser from 'phaser';
import { INK } from './brush';
import { makeNoise, mulberry32, type Pt } from './util';
import type { GroundPatch, ThinWall } from './world';

type Ctx = CanvasRenderingContext2D;

const GRASS = ['#5d7d36', '#668740', '#517030', '#6b8c44'];

const pick = (r: () => number, cols: string[]) => cols[Math.floor(r() * cols.length)] as string;

/** A round floor: boards that don't quite match, or flagstones. */
function paintFloor(
  c: Ctx,
  patch: GroundPatch,
  r: () => number,
  pickCol: (cols: string[]) => string,
): void {
  const centre = patch.pts[0] as Pt;
  const rx = patch.width / 2;
  const ry = (patch.height ?? patch.width) / 2;
  // A slightly uneven ellipse.
  c.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const j = 1 + (r() - 0.5) * 0.02;
    const x = centre.x + Math.cos(a) * rx * j;
    const y = centre.y + Math.sin(a) * ry * j;
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.closePath();
  c.fillStyle = patch.kind === 'planks' ? '#2a1c12' : '#2c2620';
  c.fill();
  c.globalCompositeOperation = 'source-atop';
  const x0 = centre.x - rx;
  const y0 = centre.y - ry;
  if (patch.kind === 'planks') {
    for (let y = y0; y < centre.y + ry; y += 8) {
      for (let x = x0 - r() * 40; x < centre.x + rx;) {
        const len = 30 + r() * 50;
        c.fillStyle = pickCol(['#6e4d30', '#765335', '#68472b', '#7d5a3a', '#5e4128']);
        c.fillRect(x + 0.5, y + 0.5, len - 1, 7);
        c.fillStyle = 'rgba(40,24,12,.3)';
        c.fillRect(x + 2, y + 2 + r() * 4, len - 4, 0.6);
        c.fillStyle = '#2a1c12';
        c.fillRect(x + 2, y + 3.5, 1, 1);
        x += len;
      }
    }
  } else {
    // Flagstones in rough rows, each its own shape and shade.
    for (let y = y0; y < centre.y + ry; y += 20) {
      for (let x = x0 - r() * 20; x < centre.x + rx;) {
        const w = 18 + r() * 14;
        const h = 18 + (r() - 0.5) * 4;
        const j = () => (r() - 0.5) * 3;
        c.fillStyle = pickCol(['#4e4a46', '#57524c', '#47433f', '#5d5852']);
        c.beginPath();
        c.moveTo(x + 1 + j(), y + 1 + j());
        c.lineTo(x + w - 1 + j(), y + 1 + j());
        c.lineTo(x + w - 1 + j(), y + h - 1 + j());
        c.lineTo(x + 1 + j(), y + h - 1 + j());
        c.closePath();
        c.fill();
        if (r() < 0.25) {
          c.strokeStyle = 'rgba(20,15,10,.5)';
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(x + r() * w, y + 2);
          c.lineTo(x + r() * w, y + h - 2);
          c.stroke();
        }
        x += w;
      }
    }
  }
  c.globalCompositeOperation = 'source-over';
}

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
 * A patio of square slabs laid by hand, not by a machine: the whole of it a
 * little off square, each row shifted a touch, slabs not quite level or the
 * same shade, a couple cracked or sunk, one gone and grass come up in its
 * place, moss and grass in the joints, and the edge slabs at a corner never
 * laid.
 */
function paintPaving(
  c: Ctx,
  patch: GroundPatch,
  r: () => number,
  pickCol: (cols: string[]) => string,
): void {
  const centre = patch.pts[0] as Pt;
  const w = patch.width;
  const h = patch.height ?? patch.width;
  const SLAB = 24;
  const cols = Math.round(w / SLAB);
  const rows = Math.round(h / SLAB);
  const j = (a = 1) => (r() - 0.5) * a * 2;
  c.save();
  c.translate(centre.x, centre.y);
  c.rotate(-0.03);
  c.translate(-(cols * SLAB) / 2, -(rows * SLAB) / 2);
  for (let row = 0; row < rows; row++) {
    const shift = j(2);
    for (let col = 0; col < cols; col++) {
      // A corner left short, and one slab gone.
      const corner = row === rows - 1 && col >= cols - 1;
      if (corner || r() < 0.03) continue;
      const x = col * SLAB + shift;
      const y = row * SLAB;
      c.fillStyle = '#7d7568';
      c.fillRect(x - 0.5, y - 0.5, SLAB + 1, SLAB + 1);
      const sunk = r() < 0.07;
      c.fillStyle = sunk
        ? '#9e9381'
        : pickCol(['#c9bfae', '#bdb29f', '#d0c6b4', '#c2b7a3', '#b5aa96']);
      c.beginPath();
      c.moveTo(x + 1.2 + j(), y + 1.2 + j());
      c.lineTo(x + SLAB - 1.2 + j(), y + 1.2 + j());
      c.lineTo(x + SLAB - 1.2 + j(), y + SLAB - 1.2 + j());
      c.lineTo(x + 1.2 + j(), y + SLAB - 1.2 + j());
      c.closePath();
      c.fill();
      // Weathering: a lighter worn patch, or a stain.
      c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.1)' : 'rgba(70,60,45,.12)';
      c.beginPath();
      c.ellipse(x + 5 + r() * 14, y + 5 + r() * 14, 3 + r() * 4, 2 + r() * 3, r() * 3, 0, 6.3);
      c.fill();
      if (r() < 0.1) {
        c.strokeStyle = 'rgba(60,50,40,.5)';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x + 2 + r() * 6, y + 2);
        c.lineTo(x + 8 + r() * 8, y + 10 + r() * 4);
        c.lineTo(x + SLAB - 2, y + SLAB - 3 - r() * 6);
        c.stroke();
      }
      // Moss or a few blades of grass in the joints.
      for (let k = 0; k < 2; k++) {
        if (r() > 0.25) continue;
        c.fillStyle = r() < 0.5 ? 'rgba(90,120,50,.75)' : 'rgba(110,140,60,.7)';
        if (r() < 0.5) c.fillRect(x + SLAB - 1.2, y + 2 + r() * 16, 1.8, 3 + r() * 5);
        else c.fillRect(x + 2 + r() * 16, y + SLAB - 1.2, 3 + r() * 5, 1.8);
      }
    }
  }
  c.restore();
}

/**
 * Long grass: a darker, shaggier green round each point, and clumps of
 * blades on it, a few gone to seed. Clumps spill past their tile, so the
 * edge of the meadow is ragged.
 */
function paintMeadow(c: Ctx, patch: GroundPatch, r: () => number): void {
  const rad = patch.width / 2;
  c.fillStyle = 'rgba(52,78,26,.32)';
  for (const p of patch.pts) {
    c.beginPath();
    c.ellipse(p.x, p.y, rad * (1 + r() * 0.3), rad * (0.9 + r() * 0.3), r() * 3, 0, Math.PI * 2);
    c.fill();
  }
  // Blades and seed heads, gathered into one path per colour: thousands of
  // strokes, but only a handful of draws.
  const blades = ['#4a6828', '#577a30', '#66883a', '#7d8f44', '#3f5c22'].map((col) => ({
    col,
    path: new Path2D(),
  }));
  const seeds = ['#c8b874', '#b8a462', '#d4c88a'].map((col) => ({ col, path: new Path2D() }));
  for (const p of patch.pts) {
    for (let k = 0; k < 4; k++) {
      const x = p.x + (r() - 0.5) * patch.width;
      const y = p.y + (r() - 0.5) * patch.width;
      for (let b = 0; b < 9; b++) {
        const a = r() * Math.PI * 2;
        const len = 5 + r() * 6;
        const path = (blades[Math.floor(r() * blades.length)] as (typeof blades)[number]).path;
        path.moveTo(x, y);
        path.quadraticCurveTo(
          x + Math.cos(a) * len * 0.6 + (r() - 0.5) * 3,
          y + Math.sin(a) * len * 0.6 + (r() - 0.5) * 3,
          x + Math.cos(a) * len,
          y + Math.sin(a) * len,
        );
      }
      if (r() < 0.35) {
        const path = (seeds[Math.floor(r() * seeds.length)] as (typeof seeds)[number]).path;
        const sx = x + (r() - 0.5) * 10;
        const sy = y + (r() - 0.5) * 10;
        path.moveTo(sx + 2, sy);
        path.ellipse(sx, sy, 2, 1, r() * 3, 0, Math.PI * 2);
      }
    }
  }
  c.lineCap = 'round';
  c.lineWidth = 1.2;
  for (const { col, path } of blades) {
    c.strokeStyle = col;
    c.stroke(path);
  }
  for (const { col, path } of seeds) {
    c.fillStyle = col;
    c.fill(path);
  }
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROUND = new Set<GroundPatch['kind']>(['planks', 'flagstones', 'paving']);

/** The area a layer needs, so its texture covers that and not the whole map. */
function bounds(boxes: Box[], margin: number): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  const x = Math.floor(x0 - margin);
  const y = Math.floor(y0 - margin);
  return { x, y, w: Math.ceil(x1 + margin) - x, h: Math.ceil(y1 + margin) - y };
}

/** Where a texture painted by `paintGround` goes. */
export function groundBox(patches: GroundPatch[]): Box {
  return bounds(
    patches.flatMap((p) => {
      const rx = p.width / 2;
      const ry = (p.height ?? p.width) / 2;
      return p.pts.map((q) =>
        ROUND.has(p.kind)
          ? { x: q.x - rx, y: q.y - ry, w: rx * 2, h: ry * 2 }
          : { x: q.x - p.width, y: q.y - p.width, w: p.width * 2, h: p.width * 2 },
      );
    }),
    8,
  );
}

/** Where a texture painted by `paintWalls` goes. */
export function wallsBox(walls: ThinWall[]): Box {
  return bounds(walls, 8);
}

/**
 * Roads, paths, beds, round floors and long grass painted onto one texture
 * over the ground: ragged edges, ruts and puddles, gravel worn through to
 * the grass in places, boards and flagstones no two alike.
 */
export function paintGround(scene: Phaser.Scene, key: string, patches: GroundPatch[]): void {
  if (scene.textures.exists(key)) return;
  const box = groundBox(patches);
  const tex = scene.textures.createCanvas(key, box.w, box.h);
  if (!tex) return;
  const main = tex.getContext();
  main.translate(-box.x, -box.y);
  const r = mulberry32(808);
  const edge = makeNoise(17);
  const pick = (cols: string[]) => cols[Math.floor(r() * cols.length)] as string;

  for (const [n, patch] of patches.entries()) {
    if (patch.kind === 'meadow') {
      paintMeadow(main, patch, r);
      continue;
    }
    // Each patch is shaped on a scratch canvas of its own size, then laid down.
    const own = groundBox([patch]);
    const tmp = document.createElement('canvas');
    tmp.width = own.w;
    tmp.height = own.h;
    const c = tmp.getContext('2d') as Ctx;
    c.translate(-own.x, -own.y);
    if (ROUND.has(patch.kind)) {
      if (patch.kind === 'paving') paintPaving(c, patch, r, pick);
      else paintFloor(c, patch, r, pick);
      main.drawImage(tmp, own.x, own.y);
      continue;
    }
    const line = walk(patch.pts, 2);
    const half = (s: number, side: number) =>
      (patch.width / 2) * (0.9 + 0.22 * edge(s * 0.03 + n * 7, side * 3.1 + n));

    // The shape: a band whose two edges wander independently; a bed is a
    // rough rectangle round its line.
    const base: Record<string, string> = {
      road: '#8a7556',
      gravel: '#9d9486',
      dirt: '#8a7352',
      soil: '#4c3826',
    };
    c.fillStyle = base[patch.kind] ?? '#8a7352';
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
    main.drawImage(tmp, own.x, own.y);

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
export function paintWalls(scene: Phaser.Scene, key: string, walls: ThinWall[]): void {
  if (scene.textures.exists(key)) return;
  const box = wallsBox(walls);
  const tex = scene.textures.createCanvas(key, box.w, box.h);
  if (!tex) return;
  const c = tex.getContext();
  c.translate(-box.x, -box.y);
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

  // Rough stone blocks, ink first, each a slightly different grey.
  const stones = walls.filter((m) => m.kind === 'stone');
  for (const m of stones) rough(m.x, m.y, m.w, m.h, 1.4, INK);
  for (const m of stones) {
    rough(m.x, m.y, m.w, m.h, 0, pick(r, ['#7d766b', '#6f685e', '#8a8276', '#766e62']));
    if (r() < 0.3) {
      c.fillStyle = 'rgba(255,250,235,.18)';
      c.fillRect(m.x + 2, m.y + 2, m.w / 3, 2);
    }
    if (r() < 0.12) {
      c.fillStyle = 'rgba(80,100,50,.45)';
      c.fillRect(m.x + r() * m.w * 0.6, m.y + r() * m.h * 0.6, 4, 3);
    }
  }

  // Weathered boards: a shed's walls, grey-brown, the odd plank darker or split.
  const boards = walls.filter((m) => m.kind === 'boards');
  for (const m of boards) rough(m.x, m.y, m.w, m.h, 1.3, INK);
  for (const m of boards) {
    rough(m.x, m.y, m.w, m.h, 0, '#6b5a47');
    const along = m.w > m.h;
    const len = along ? m.w : m.h;
    for (let t = 0; t < len; t += 6 + r() * 3) {
      c.fillStyle = pick(r, ['#5d4d3c', '#77654f', '#655441', '#4f4133']);
      if (along) c.fillRect(m.x + t, m.y + 1, 5, m.h - 2);
      else c.fillRect(m.x + 1, m.y + t, m.w - 2, 5);
    }
    if (r() < 0.3) {
      c.fillStyle = 'rgba(20,14,8,.6)';
      if (along) c.fillRect(m.x + r() * m.w, m.y + m.h / 2 - 0.4, 6, 0.8);
      else c.fillRect(m.x + m.w / 2 - 0.4, m.y + r() * m.h, 0.8, 6);
    }
  }

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
