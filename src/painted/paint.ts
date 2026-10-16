import type { House, PropKind, VillageLayout } from './layout';
import { MAP_H, MAP_W, T, distToRoad } from './layout';
import { Rng } from './rng';

type Ctx = CanvasRenderingContext2D;
export type Pt = { x: number; y: number };

/** Canvases are painted at this many pixels per world pixel, for crisp zoom. */
export const RES = 2;

export const INK = '#1c130d';
const PAL = {
  ground: '#4b4830',
  patches: ['#423f28', '#57502f', '#5e5634', '#3a3925', '#625b3b', '#4f4a2c'],
  road: '#77603f',
  roadDark: '#4d3c27',
  roadLight: '#8d7450',
  cobble: ['#7a7064', '#6c6357', '#857a6b', '#615a50'],
  grass: ['#6f6d3d', '#5b5e33', '#7f7746', '#4d5230'],
  leaves: ['#8a4a2a', '#7a3a22', '#9a6a34', '#6e2f22'],
  roof: ['#7c2f28', '#86392b', '#6f2c27', '#7a3a2c'],
  plaster: ['#b9a27c', '#ad9572', '#c2ac86'],
  timber: '#3b2a1d',
  stone: ['#8a8174', '#7b7367', '#958b7c'],
  slate: ['#4c4440', '#433c39', '#554c47'],
  wood: '#5e4330',
  woodDark: '#3e2c1f',
  iron: '#2a2622',
  glass: '#f4b85f',
  glassDark: '#1f1711',
  canopy: [
    ['#27321f', '#34422a', '#4b5735'],
    ['#2f3320', '#41452a', '#5d5b36'],
    ['#3a2a1c', '#5a3a22', '#7d5530'],
    ['#2a3424', '#384733', '#506148'],
  ],
  pine: ['#1f2a20', '#2b3a2b', '#3d4f3a'],
  bark: '#3a2a1e',
  shadow: 'rgba(16, 10, 6, 0.38)',
};

// --- Brushwork -----------------------------------------------------------------------

/** A hand-drawn path: every segment gets a slight wobble. */
function wobble(ctx: Ctx, pts: Pt[], rng: Rng, j = 0.7, close = true): void {
  ctx.beginPath();
  const all = close ? [...pts, pts[0] as Pt] : pts;
  all.forEach((p, i) => {
    if (i === 0) {
      ctx.moveTo(p.x, p.y);
      return;
    }
    const a = all[i - 1] as Pt;
    const steps = Math.max(1, Math.round(Math.hypot(p.x - a.x, p.y - a.y) / 7));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const last = s === steps;
      ctx.lineTo(
        a.x + (p.x - a.x) * t + (last ? 0 : rng.range(-j, j)),
        a.y + (p.y - a.y) * t + (last ? 0 : rng.range(-j, j)),
      );
    }
  });
  if (close) ctx.closePath();
}

function shape(ctx: Ctx, pts: Pt[], rng: Rng, fill: string, line = 1.2, j = 0.6): void {
  wobble(ctx, pts, rng, j);
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = line;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function rect(x: number, y: number, w: number, h: number): Pt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function line(ctx: Ctx, rng: Rng, a: Pt, b: Pt, color = INK, width = 1, j = 0.5): void {
  wobble(ctx, [a, b], rng, j, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// --- Ground --------------------------------------------------------------------------

/** One big painting of everything flat: earth, roads, the square, grass, shadows. */
export function paintGround(ctx: Ctx, layout: VillageLayout): void {
  const rng = new Rng(11);
  const W = MAP_W * T;
  const H = MAP_H * T;
  ctx.fillStyle = PAL.ground;
  ctx.fillRect(0, 0, W, H);

  // Washes of colour, like watercolour pooling on paper.
  for (let i = 0; i < 700; i++) {
    ctx.globalAlpha = rng.range(0.12, 0.3);
    ellipse(
      ctx,
      rng.range(0, W),
      rng.range(0, H),
      rng.range(8, 60),
      rng.range(6, 40),
      rng.pick(PAL.patches),
    );
  }
  ctx.globalAlpha = 1;

  // Graveyard earth is darker and barer.
  const g = layout.graveyard;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 60; i++) {
    ellipse(
      ctx,
      rng.range(g.c0, g.c1 + 1) * T,
      rng.range(g.r0, g.r1 + 1) * T,
      rng.range(8, 26),
      rng.range(6, 16),
      '#2f2a1f',
    );
  }
  ctx.globalAlpha = 1;

  paintRoads(ctx, layout, rng);
  paintSquare(ctx, layout, rng);

  const onRoad = (x: number, y: number) =>
    layout.roads.some((r) => distToRoad(x / T, y / T, r.points) < r.width / 2 + 0.1) ||
    Math.hypot(x / T - layout.square.c, y / T - layout.square.r) < layout.square.radius;

  // Grass tufts, dry and leaning the same way.
  for (let i = 0; i < 2600; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, H);
    if (onRoad(x, y) && rng.chance(0.9)) continue;
    ctx.strokeStyle = rng.pick(PAL.grass);
    ctx.lineWidth = 0.8;
    const blades = rng.int(3, 6);
    for (let b = 0; b < blades; b++) {
      const bx = x + rng.range(-2.5, 2.5);
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.quadraticCurveTo(bx + 0.5, y - 3, bx + rng.range(-1, 3), y - rng.range(3, 7));
      ctx.stroke();
    }
  }
  // Fallen leaves and pebbles.
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = rng.range(0.5, 0.9);
    ellipse(
      ctx,
      rng.range(0, W),
      rng.range(0, H),
      rng.range(0.8, 1.8),
      rng.range(0.6, 1.2),
      rng.pick(PAL.leaves),
    );
  }
  for (let i = 0; i < 240; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, H);
    ctx.globalAlpha = 0.9;
    ellipse(ctx, x + 0.6, y + 0.8, 2.2, 1.4, 'rgba(20,12,8,0.5)');
    ellipse(ctx, x, y, 2, 1.3, rng.pick(PAL.stone));
    ellipse(ctx, x - 0.6, y - 0.4, 0.8, 0.5, '#b2a898');
  }
  ctx.globalAlpha = 1;

  paintShadows(ctx, layout);

  // Paper grain over everything.
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,240,210,0.05)' : 'rgba(10,6,4,0.08)';
    ctx.fillRect(rng.range(0, W), rng.range(0, H), 1, 1);
  }
}

function roadPath(ctx: Ctx, pts: [number, number][], rng: Rng, dx = 0, dy = 0): void {
  ctx.beginPath();
  pts.forEach(([c, r], i) => {
    const x = c * T + dx + (i ? rng.range(-1, 1) : 0);
    const y = r * T + dy + (i ? rng.range(-1, 1) : 0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

function paintRoads(ctx: Ctx, layout: VillageLayout, rng: Rng): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const passes: [string, number, number][] = [
    [PAL.roadDark, 10, 0.7],
    [PAL.road, 0, 1],
    [PAL.roadLight, -10, 0.35],
  ];
  for (const [color, extra, alpha] of passes) {
    for (const road of layout.roads) {
      roadPath(ctx, road.points, rng);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = road.width * T + extra;
      ctx.stroke();
    }
  }
  // Ruts and puddles.
  ctx.globalAlpha = 0.45;
  for (const road of layout.roads) {
    if (road.width < 1.2) continue;
    for (const off of [-0.22, 0.22]) {
      roadPath(ctx, road.points, rng, off * T, 0);
      ctx.strokeStyle = PAL.roadDark;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const road of layout.roads) {
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ac, ar] = road.points[i] as [number, number];
      const [bc, br] = road.points[i + 1] as [number, number];
      const n = Math.round(Math.hypot(bc - ac, br - ar) * 7);
      for (let k = 0; k < n; k++) {
        const t = rng.next();
        const x = (ac + (bc - ac) * t) * T + rng.range(-road.width, road.width) * T * 0.45;
        const y = (ar + (br - ar) * t) * T + rng.range(-road.width, road.width) * T * 0.3;
        ellipse(
          ctx,
          x,
          y,
          rng.range(0.6, 1.6),
          rng.range(0.5, 1),
          rng.chance(0.5) ? '#5a4632' : '#9a8462',
        );
      }
      if (road.width > 1.2 && rng.chance(0.7)) {
        const t = rng.next();
        const x = (ac + (bc - ac) * t) * T;
        const y = (ar + (br - ar) * t) * T;
        ellipse(ctx, x, y, rng.range(6, 10), rng.range(3, 5), '#3b3023');
        ellipse(ctx, x - 1, y - 1, rng.range(4, 7), rng.range(2, 3), '#5b6066');
      }
    }
  }
}

function paintSquare(ctx: Ctx, layout: VillageLayout, rng: Rng): void {
  const { c, r, radius } = layout.square;
  const cx = c * T;
  const cy = r * T;
  const R = radius * T;
  ctx.globalAlpha = 0.8;
  ellipse(ctx, cx, cy, R + 4, R * 0.92 + 4, PAL.roadDark);
  ctx.globalAlpha = 1;
  ellipse(ctx, cx, cy, R, R * 0.92, '#3c342b');
  // Cobbles in rows, missing more often towards the rim.
  for (let y = cy - R; y < cy + R; y += 7) {
    const shift = (Math.round((y - cy) / 7) % 2) * 4;
    for (let x = cx - R + shift; x < cx + R; x += 8) {
      const d = Math.hypot((x - cx) / R, (y - cy) / (R * 0.92));
      if (d > 0.97 || rng.chance(Math.max(0, d - 0.55))) continue;
      const w = rng.range(5.5, 7.2);
      const h = rng.range(4.5, 5.8);
      ctx.beginPath();
      ctx.roundRect(x + rng.range(-0.6, 0.6), y + rng.range(-0.6, 0.6), w, h, 2);
      ctx.fillStyle = rng.pick(PAL.cobble);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,215,0.12)';
      ctx.fillRect(x + 1, y + 0.6, w - 2.5, 1.2);
    }
  }
}

function paintShadows(ctx: Ctx, layout: VillageLayout): void {
  ctx.fillStyle = PAL.shadow;
  for (const h of layout.houses) {
    const x = h.c * T;
    const y = h.r * T;
    const w = h.w * T;
    const d = h.h * T;
    ctx.beginPath();
    ctx.moveTo(x + w, y - T * 0.4);
    ctx.lineTo(x + w + 18, y + 6);
    ctx.lineTo(x + w + 18, y + d + 8);
    ctx.lineTo(x + 10, y + d + 8);
    ctx.lineTo(x + 4, y + d);
    ctx.closePath();
    ctx.fill();
  }
  for (const p of layout.props) {
    const x = p.c * T + T / 2;
    const y = p.r * T + T * 0.8;
    if (p.kind === 'tree' || p.kind === 'pine') ellipse(ctx, x + 12, y - 4, 30, 16, PAL.shadow);
    else if (p.kind === 'dead') ellipse(ctx, x + 10, y - 2, 18, 8, 'rgba(16,10,6,0.22)');
  }
}

// --- Buildings ---------------------------------------------------------------------

export interface PaintedPiece {
  /** Canvas size in world pixels. */
  w: number;
  h: number;
  /** Where the canvas' top-left goes, relative to the anchor cell's top-left. */
  ox: number;
  oy: number;
  /** Window glows and chimney tops, in canvas world pixels. */
  lights: Pt[];
  smoke?: Pt;
  draw: (ctx: Ctx) => void;
}

const OVERHANG = 6;

export function paintHouse(house: House): PaintedPiece {
  const chapel = house.kind === 'chapel';
  const tower = chapel ? 2.6 * T : 0;
  const W = house.w * T + OVERHANG * 2;
  const H = (house.h + 1) * T + tower + 4;
  const lights: Pt[] = [];
  let smoke: Pt | undefined;

  const draw = (ctx: Ctx) => {
    lights.length = 0;
    const rng = new Rng(house.seed);
    const wallH = chapel ? T * 1.7 : T * 1.3;
    const bottom = H - 4;
    const wallTop = bottom - wallH;
    const roofTop = 2 + tower;
    const ridge = roofTop + (wallTop - roofTop) * 0.4;
    const x0 = OVERHANG;
    const x1 = W - OVERHANG;

    // Wall.
    const wallColor = chapel ? rng.pick(PAL.stone) : rng.pick(PAL.plaster);
    shape(ctx, rect(x0, wallTop, x1 - x0, wallH), rng, wallColor, 1.4);
    const grime = ctx.createLinearGradient(0, wallTop, 0, bottom);
    grime.addColorStop(0, 'rgba(30,20,12,0.35)');
    grime.addColorStop(0.3, 'rgba(30,20,12,0)');
    grime.addColorStop(0.8, 'rgba(40,30,18,0.1)');
    grime.addColorStop(1, 'rgba(40,30,18,0.45)');
    ctx.fillStyle = grime;
    ctx.fillRect(x0, wallTop, x1 - x0, wallH);

    if (chapel) {
      // Stone blocks.
      for (let y = wallTop + 4; y < bottom - 2; y += 6) {
        const shift = Math.round(y) % 12 < 6 ? 0 : 5;
        for (let x = x0 + shift; x < x1 - 2; x += 10) {
          ctx.strokeStyle = 'rgba(28,19,13,0.35)';
          ctx.lineWidth = 0.7;
          ctx.strokeRect(x + rng.range(-0.4, 0.4), y, 10, 6);
        }
      }
    } else {
      // Half-timbering: sill, beam, posts and braces.
      const posts: number[] = [];
      for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / Math.round((x1 - x0) / 26)) posts.push(x);
      const beam = wallTop + wallH * 0.42;
      line(ctx, rng, { x: x0, y: beam }, { x: x1, y: beam }, PAL.timber, 2.6);
      posts.forEach((x, i) => {
        line(ctx, rng, { x, y: wallTop + 1 }, { x, y: bottom - 3 }, PAL.timber, 2.6);
        const next = posts[i + 1];
        if (next !== undefined && i % 2 === 0) {
          line(ctx, rng, { x: x + 1, y: beam }, { x: next - 1, y: wallTop + 2 }, PAL.timber, 2);
        }
      });
      // Flaking plaster shows the lath underneath.
      for (let i = 0; i < 3; i++) {
        const px = rng.range(x0 + 4, x1 - 12);
        const py = rng.range(beam + 3, bottom - 10);
        shape(
          ctx,
          [
            { x: px, y: py },
            { x: px + rng.range(5, 10), y: py + rng.range(-2, 1) },
            { x: px + rng.range(4, 9), y: py + rng.range(3, 6) },
            { x: px - 1, y: py + rng.range(2, 5) },
          ],
          rng,
          '#7d6a50',
          0.6,
        );
      }
    }
    // Stone footing.
    for (let x = x0; x < x1; x += rng.range(5, 8)) {
      ctx.fillStyle = rng.pick(PAL.stone);
      ctx.beginPath();
      ctx.roundRect(x, bottom - 4, rng.range(4, 7), 4, 1.5);
      ctx.fill();
    }
    line(ctx, rng, { x: x0, y: bottom }, { x: x1, y: bottom }, INK, 1.4);

    // Openings: windows spread along the wall, a door near the middle.
    const n = Math.max(2, Math.round((x1 - x0) / 34));
    const slots = Array.from({ length: n + 1 }, (_, i) => x0 + ((i + 0.5) * (x1 - x0)) / (n + 1));
    const doorAt = chapel ? Math.floor(slots.length / 2) : rng.int(1, slots.length - 2);
    let windowIndex = 0;
    slots.forEach((sx, i) => {
      if (i === doorAt) {
        const dw = chapel ? 16 : 12;
        const dh = chapel ? 26 : 20;
        const dy = bottom - dh;
        ctx.beginPath();
        ctx.moveTo(sx - dw / 2, bottom);
        ctx.lineTo(sx - dw / 2, dy + dw / 2);
        ctx.arc(sx, dy + dw / 2, dw / 2, Math.PI, 0);
        ctx.lineTo(sx + dw / 2, bottom);
        ctx.closePath();
        ctx.fillStyle = house.broken ? '#140d08' : PAL.woodDark;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        if (!house.broken) {
          for (let px = sx - dw / 2 + 3; px < sx + dw / 2; px += 3) {
            line(
              ctx,
              rng,
              { x: px, y: dy + 3 },
              { x: px, y: bottom - 1 },
              'rgba(10,6,4,0.6)',
              0.6,
              0.2,
            );
          }
          ellipse(ctx, sx + dw / 2 - 3, bottom - dh / 2, 1, 1, '#b08a4a');
        }
        ellipse(ctx, sx, bottom + 2, dw / 2 + 3, 2.5, '#6e665b');
        return;
      }
      const lit = house.lit.includes(windowIndex++);
      const ww = chapel ? 8 : 10;
      const wh = chapel ? 18 : 10;
      const wy = chapel ? wallTop + 10 : wallTop + wallH * 0.55;
      ctx.beginPath();
      if (chapel) {
        ctx.moveTo(sx - ww / 2, wy + wh);
        ctx.lineTo(sx - ww / 2, wy + ww / 2);
        ctx.arc(sx, wy + ww / 2, ww / 2, Math.PI, 0);
        ctx.lineTo(sx + ww / 2, wy + wh);
        ctx.closePath();
      } else {
        ctx.rect(sx - ww / 2, wy, ww, wh);
      }
      ctx.fillStyle = lit ? PAL.glass : PAL.glassDark;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, wy);
      ctx.lineTo(sx, wy + wh);
      ctx.moveTo(sx - ww / 2, wy + wh / 2);
      ctx.lineTo(sx + ww / 2, wy + wh / 2);
      ctx.strokeStyle = lit ? '#5a2d14' : '#3a2a1e';
      ctx.stroke();
      if (lit) lights.push({ x: sx, y: wy + wh / 2 });
      if (!chapel) {
        // Shutters; one of them always hangs off a hinge somewhere.
        const crooked = rng.chance(0.3);
        shape(ctx, rect(sx - ww / 2 - 5, wy - 1, 4, wh + 2), rng, PAL.wood, 0.8);
        const sh = rect(sx + ww / 2 + 1, wy - 1, 4, wh + 2);
        if (crooked) sh.forEach((p) => (p.y += (p.x - sx) * 0.35 + 2));
        shape(ctx, sh, rng, PAL.wood, 0.8);
      }
    });

    // Roof: back slope, front slope, ridge.
    const roofColor = chapel ? rng.pick(PAL.slate) : rng.pick(PAL.roof);
    shape(ctx, rect(1, roofTop, W - 2, ridge - roofTop + 1), rng, shade(roofColor, -0.28), 1.4);
    const front = rect(0, ridge, W, wallTop - ridge + 5);
    shape(ctx, front, rng, roofColor, 1.6);
    // Shingle rows.
    for (let y = ridge + 5; y < wallTop + 3; y += 5) {
      wobble(
        ctx,
        [
          { x: 2, y },
          { x: W - 2, y },
        ],
        rng,
        0.5,
        false,
      );
      ctx.strokeStyle = 'rgba(20,10,6,0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      const off = Math.round(y) % 10 < 5 ? 0 : 3;
      for (let x = 2 + off; x < W - 2; x += 6) {
        ctx.fillStyle = `rgba(${rng.chance(0.5) ? '255,220,190,0.07' : '10,5,3,0.12'})`;
        ctx.fillRect(x, y - 5, 5.5, 4.5);
        line(ctx, rng, { x, y: y - 4.5 }, { x, y }, 'rgba(20,10,6,0.35)', 0.6, 0.2);
      }
    }
    for (let y = roofTop + 4; y < ridge; y += 5) {
      line(ctx, rng, { x: 3, y }, { x: W - 3, y }, 'rgba(10,5,3,0.35)', 0.7, 0.4);
    }
    // Moss.
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.35;
      ellipse(
        ctx,
        rng.range(6, W - 6),
        rng.range(ridge + 4, wallTop),
        rng.range(3, 9),
        rng.range(2, 4),
        '#4b5530',
      );
    }
    ctx.globalAlpha = 1;
    // Light on the upper edge of the front slope, shadow under the eave.
    const g = ctx.createLinearGradient(0, ridge, 0, wallTop + 5);
    g.addColorStop(0, 'rgba(255,225,190,0.16)');
    g.addColorStop(1, 'rgba(10,5,3,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(1, ridge, W - 2, wallTop - ridge + 4);
    line(ctx, rng, { x: 0, y: ridge }, { x: W, y: ridge }, INK, 2.2, 0.4);
    line(
      ctx,
      rng,
      { x: 2, y: ridge - 1.5 },
      { x: W - 2, y: ridge - 1.5 },
      shade(roofColor, 0.15),
      1.2,
      0.4,
    );

    if (house.broken) {
      // A caved-in patch: dark hole, bare rafters.
      const hx = rng.range(W * 0.25, W * 0.6);
      const hy = ridge + 4;
      const hw = rng.range(14, 22);
      const hh = (wallTop - ridge) * 0.7;
      const hole: Pt[] = [];
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        hole.push({
          x: hx + hw / 2 + Math.cos(a) * (hw / 2) * rng.range(0.7, 1.1),
          y: hy + hh / 2 + Math.sin(a) * (hh / 2) * rng.range(0.7, 1.1),
        });
      }
      shape(ctx, hole, rng, '#120b07', 1.4, 1);
      for (let x = hx + 3; x < hx + hw; x += 6) {
        line(ctx, rng, { x, y: hy - 1 }, { x: x + 1, y: hy + hh + 1 }, '#4a3424', 1.8);
      }
    }

    if (chapel) {
      // Bell tower over the left end, pyramid roof, iron cross.
      const tx = OVERHANG + 6;
      const tw = T * 1.6;
      const ty = 2;
      const tb = ridge + 6;
      shape(ctx, rect(tx, ty + tw * 0.55, tw, tb - ty - tw * 0.55), rng, rng.pick(PAL.stone), 1.4);
      ctx.beginPath();
      ctx.ellipse(tx + tw / 2, ty + tw * 0.55 + 14, 4, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#120b07';
      ctx.fill();
      const apex = { x: tx + tw / 2, y: ty };
      shape(
        ctx,
        [apex, { x: tx - 3, y: ty + tw * 0.6 }, { x: tx + tw / 2, y: ty + tw * 0.7 }],
        rng,
        shade(roofColor, -0.25),
        1.4,
      );
      shape(
        ctx,
        [apex, { x: tx + tw / 2, y: ty + tw * 0.7 }, { x: tx + tw + 3, y: ty + tw * 0.6 }],
        rng,
        shade(roofColor, 0.12),
        1.4,
      );
      line(
        ctx,
        rng,
        { x: apex.x, y: apex.y + 2 },
        { x: apex.x, y: apex.y - 8 },
        PAL.iron,
        1.6,
        0.1,
      );
      line(
        ctx,
        rng,
        { x: apex.x - 3, y: apex.y - 5 },
        { x: apex.x + 3, y: apex.y - 5 },
        PAL.iron,
        1.4,
        0.1,
      );
    } else {
      // Chimney on the back slope.
      const cx = rng.range(W * 0.55, W * 0.82);
      const cy = roofTop - 4;
      shape(ctx, rect(cx, cy, 8, ridge - cy), rng, rng.pick(PAL.stone), 1.2);
      ctx.fillStyle = '#120b07';
      ctx.fillRect(cx + 1.5, cy + 1, 5, 2.5);
      if (house.lit.length) smoke = { x: cx + 4, y: cy };
    }
  };

  // A bit of the canvas is spent above the footprint for the roof and tower.
  draw(dummyCtx());
  return { w: W, h: H, ox: -OVERHANG, oy: house.h * T - H + 4, lights, smoke, draw };
}

/** Runs the painter once to collect light positions before the real paint. */
let dummy: Ctx | undefined;
function dummyCtx(): Ctx {
  dummy ??= document.createElement('canvas').getContext('2d') as Ctx;
  return dummy;
}

/** Lighten (amount > 0) or darken a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) =>
    Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

// --- Props ----------------------------------------------------------------------------

/** Sizes of prop canvases; the ground contact point is centre-bottom minus FOOT. */
export const PROP_SIZE: Record<PropKind, [number, number]> = {
  tree: [96, 112],
  pine: [72, 112],
  dead: [80, 96],
  grave: [24, 32],
  cross: [24, 36],
  fenceH: [34, 30],
  fenceV: [12, 40],
  lamp: [22, 60],
  lampOff: [22, 60],
  well: [48, 56],
  fire: [36, 26],
  cart: [64, 42],
  crates: [36, 40],
  barrel: [22, 28],
  hay: [40, 30],
};
export const FOOT = 6;

/** Where a prop's light (lamp flame) sits, relative to its ground point. */
export const PROP_LIGHT: Partial<Record<PropKind, Pt>> = {
  lamp: { x: 0, y: -46 },
  fire: { x: 0, y: -6 },
};

export function paintProp(ctx: Ctx, kind: PropKind, variant: number): void {
  const [w, h] = PROP_SIZE[kind];
  const rng = new Rng(variant * 97 + kind.length * 13 + 5);
  const x = w / 2;
  const y = h - FOOT;
  switch (kind) {
    case 'tree':
      return paintTree(ctx, rng, x, y, variant);
    case 'pine':
      return paintPine(ctx, rng, x, y);
    case 'dead':
      ellipse(ctx, x, y, 7, 3, 'rgba(16,10,6,0.4)');
      branch(ctx, rng, x, y, -Math.PI / 2 + rng.range(-0.15, 0.15), 30, 5, 0);
      return;
    case 'grave': {
      ellipse(ctx, x, y - 1, 10, 4, '#3b3024');
      ctx.save();
      ctx.translate(x, y - 2);
      ctx.rotate(rng.range(-0.15, 0.15));
      const sw = 12;
      const sh = 16;
      ctx.beginPath();
      ctx.moveTo(-sw / 2, 0);
      ctx.lineTo(-sw / 2, -sh + sw / 2);
      ctx.arc(0, -sh + sw / 2, sw / 2, Math.PI, 0);
      ctx.lineTo(sw / 2, 0);
      ctx.closePath();
      ctx.fillStyle = rng.pick(PAL.stone);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,12,8,0.3)';
      ctx.fillRect(sw / 2 - 3, -sh + 2, 3, sh - 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      line(ctx, rng, { x: -3, y: -sh + 6 }, { x: 3, y: -sh + 6 }, 'rgba(20,12,8,0.6)', 0.8);
      line(ctx, rng, { x: -3, y: -sh + 9 }, { x: 2, y: -sh + 9 }, 'rgba(20,12,8,0.6)', 0.8);
      ctx.globalAlpha = 0.6;
      ellipse(ctx, rng.range(-4, 3), -2, 3, 1.5, '#4b5530');
      ctx.restore();
      return;
    }
    case 'cross': {
      ellipse(ctx, x, y - 1, 9, 3.5, '#3b3024');
      ctx.save();
      ctx.translate(x, y - 2);
      ctx.rotate(rng.range(-0.2, 0.2));
      shape(ctx, rect(-2, -24, 4, 24), rng, PAL.wood, 1.1, 0.3);
      shape(ctx, rect(-7, -19, 14, 4), rng, PAL.wood, 1.1, 0.3);
      ctx.restore();
      return;
    }
    case 'fenceH': {
      const broken = variant === 9;
      line(ctx, rng, { x: 0, y: y - 16 }, { x: w, y: y - 16 }, PAL.iron, 1.6, 0.3);
      line(ctx, rng, { x: 0, y: y - 4 }, { x: w, y: y - 4 }, PAL.iron, 1.6, 0.3);
      for (let px = 3; px < w; px += 5) {
        if (broken && rng.chance(0.5)) continue;
        const lean = rng.range(-1.2, 1.2);
        line(ctx, rng, { x: px, y }, { x: px + lean, y: y - 20 }, PAL.iron, 1.3, 0.1);
        shape(
          ctx,
          [
            { x: px + lean, y: y - 24 },
            { x: px + lean - 1.6, y: y - 20 },
            { x: px + lean + 1.6, y: y - 20 },
          ],
          rng,
          PAL.iron,
          0,
          0,
        );
      }
      return;
    }
    case 'fenceV': {
      // Seen end-on: a column of spear-topped bars along a thin rail.
      line(ctx, rng, { x, y: 10 }, { x, y }, PAL.iron, 1.4, 0.3);
      for (let py = 14; py <= y; py += 6) {
        line(
          ctx,
          rng,
          { x, y: py },
          { x: x + rng.range(-0.6, 0.6), y: py - 12 },
          PAL.iron,
          1.3,
          0.1,
        );
        shape(
          ctx,
          [
            { x, y: py - 16 },
            { x: x - 1.6, y: py - 12 },
            { x: x + 1.6, y: py - 12 },
          ],
          rng,
          PAL.iron,
          0,
          0,
        );
      }
      return;
    }
    case 'lamp':
    case 'lampOff': {
      ellipse(ctx, x, y, 6, 2.5, 'rgba(16,10,6,0.45)');
      shape(ctx, rect(x - 3, y - 4, 6, 4), rng, '#2f2b27', 1);
      line(ctx, rng, { x, y: y - 3 }, { x, y: y - 42 }, PAL.iron, 2.4, 0.2);
      line(ctx, rng, { x: x - 6, y: y - 52 }, { x: x + 6, y: y - 52 }, PAL.iron, 1.6, 0.2);
      shape(
        ctx,
        rect(x - 5, y - 51, 10, 11),
        rng,
        kind === 'lamp' ? '#ffd58a' : '#2a221b',
        1.2,
        0.2,
      );
      line(ctx, rng, { x, y: y - 51 }, { x, y: y - 40 }, PAL.iron, 0.8, 0.1);
      shape(
        ctx,
        [
          { x: x - 7, y: y - 51 },
          { x, y: y - 57 },
          { x: x + 7, y: y - 51 },
        ],
        rng,
        PAL.iron,
        1,
        0.2,
      );
      return;
    }
    case 'well': {
      ellipse(ctx, x, y - 6, 20, 11, 'rgba(16,10,6,0.4)');
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
        const sx = x + Math.cos(a) * 16;
        const sy = y - 10 + Math.sin(a) * 9;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 5, 4, a, 0, Math.PI * 2);
        ctx.fillStyle = rng.pick(PAL.stone);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      ellipse(ctx, x, y - 10, 11, 5.5, '#0f0a07');
      line(ctx, rng, { x: x - 17, y: y - 8 }, { x: x - 17, y: y - 40 }, PAL.wood, 3);
      line(ctx, rng, { x: x + 17, y: y - 8 }, { x: x + 17, y: y - 40 }, PAL.wood, 3);
      line(ctx, rng, { x: x - 20, y: y - 38 }, { x: x + 20, y: y - 38 }, PAL.woodDark, 3);
      line(ctx, rng, { x: x + 2, y: y - 38 }, { x: x + 2, y: y - 22 }, '#8a7860', 0.8);
      shape(ctx, rect(x - 2, y - 23, 8, 6), rng, PAL.wood, 1);
      return;
    }
    case 'fire': {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        ellipse(ctx, x + Math.cos(a) * 11, y - 5 + Math.sin(a) * 5, 3.4, 2.6, rng.pick(PAL.stone));
      }
      ellipse(ctx, x, y - 5, 8, 4, '#1a100a');
      line(ctx, rng, { x: x - 8, y: y - 3 }, { x: x + 7, y: y - 8 }, '#3a2618', 3);
      line(ctx, rng, { x: x - 6, y: y - 8 }, { x: x + 8, y: y - 3 }, '#4a3020', 3);
      ellipse(ctx, x, y - 6, 4, 2, '#e0642c');
      return;
    }
    case 'cart': {
      ellipse(ctx, x, y - 4, 28, 7, 'rgba(16,10,6,0.4)');
      ctx.save();
      ctx.translate(x, y - 14);
      ctx.rotate(-0.08);
      shape(ctx, rect(-24, -12, 40, 18), rng, PAL.wood, 1.4);
      for (let px = -20; px < 16; px += 6)
        line(ctx, rng, { x: px, y: -11 }, { x: px, y: 5 }, PAL.woodDark, 0.8);
      shape(ctx, rect(-24, -16, 40, 5), rng, shade(PAL.wood, 0.12), 1.2);
      line(ctx, rng, { x: 16, y: -2 }, { x: 30, y: 2 }, PAL.woodDark, 2.2);
      line(ctx, rng, { x: 16, y: 4 }, { x: 30, y: 6 }, PAL.woodDark, 2.2);
      ctx.restore();
      for (const wx of [x - 16, x + 6]) {
        ctx.beginPath();
        ctx.arc(wx, y - 6, 8, 0, Math.PI * 2);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = PAL.wood;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        for (let a = 0; a < Math.PI; a += Math.PI / 3) {
          line(
            ctx,
            rng,
            { x: wx - Math.cos(a) * 7, y: y - 6 - Math.sin(a) * 7 },
            { x: wx + Math.cos(a) * 7, y: y - 6 + Math.sin(a) * 7 },
            PAL.woodDark,
            1,
            0.1,
          );
        }
      }
      return;
    }
    case 'crates': {
      ellipse(ctx, x + 2, y - 2, 16, 5, 'rgba(16,10,6,0.4)');
      crate(ctx, rng, x - 13, y - 16, 16);
      crate(ctx, rng, x + 1, y - 14, 14);
      crate(ctx, rng, x - 9, y - 30, 14);
      return;
    }
    case 'barrel': {
      ellipse(ctx, x + 1, y - 1, 9, 3.5, 'rgba(16,10,6,0.45)');
      shape(
        ctx,
        [
          { x: x - 7, y: y - 2 },
          { x: x - 8, y: y - 10 },
          { x: x - 7, y: y - 18 },
          { x: x + 7, y: y - 18 },
          { x: x + 8, y: y - 10 },
          { x: x + 7, y: y - 2 },
        ],
        rng,
        PAL.wood,
        1.2,
      );
      line(ctx, rng, { x: x - 8, y: y - 6 }, { x: x + 8, y: y - 6 }, PAL.iron, 1.2, 0.2);
      line(ctx, rng, { x: x - 8, y: y - 14 }, { x: x + 8, y: y - 14 }, PAL.iron, 1.2, 0.2);
      ellipse(ctx, x, y - 18, 7, 2.6, shade(PAL.wood, 0.15));
      return;
    }
    case 'hay': {
      ellipse(ctx, x + 2, y - 2, 18, 6, 'rgba(16,10,6,0.4)');
      shape(
        ctx,
        [
          { x: x - 17, y: y - 2 },
          { x: x - 13, y: y - 14 },
          { x: x - 2, y: y - 20 },
          { x: x + 11, y: y - 16 },
          { x: x + 17, y: y - 3 },
        ],
        rng,
        '#8c7a45',
        1.2,
        1.2,
      );
      for (let i = 0; i < 40; i++) {
        const sx = x + rng.range(-14, 14);
        const sy = y - rng.range(3, 16);
        line(
          ctx,
          rng,
          { x: sx, y: sy },
          { x: sx + rng.range(-3, 3), y: sy - rng.range(2, 4) },
          rng.chance(0.5) ? '#a8955a' : '#6a5a30',
          0.7,
          0.1,
        );
      }
      return;
    }
  }
}

function crate(ctx: Ctx, rng: Rng, x: number, y: number, s: number): void {
  shape(ctx, rect(x, y, s, s), rng, PAL.wood, 1.2, 0.3);
  line(ctx, rng, { x: x + 1, y: y + 1 }, { x: x + s - 1, y: y + s - 1 }, PAL.woodDark, 1.2);
  line(ctx, rng, { x: x + s - 1, y: y + 1 }, { x: x + 1, y: y + s - 1 }, PAL.woodDark, 1.2);
  ctx.fillStyle = 'rgba(255,230,200,0.1)';
  ctx.fillRect(x + 1, y + 1, s - 2, 2);
}

function paintTree(ctx: Ctx, rng: Rng, x: number, y: number, variant: number): void {
  const [dark, mid, light] = PAL.canopy[variant % PAL.canopy.length] as [string, string, string];
  // Trunk and roots.
  shape(
    ctx,
    [
      { x: x - 4, y },
      { x: x - 3, y: y - 34 },
      { x: x + 3, y: y - 34 },
      { x: x + 4, y },
    ],
    rng,
    PAL.bark,
    1.2,
  );
  line(ctx, rng, { x: x - 3, y: y - 1 }, { x: x - 9, y: y + 1 }, PAL.bark, 2);
  line(ctx, rng, { x: x + 3, y: y - 1 }, { x: x + 8, y: y + 2 }, PAL.bark, 2);
  // Canopy: clustered blobs, inked outline first, then three tones lit from top-left.
  const cx = x;
  const cy = y - 58;
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next());
    blobs.push([cx + Math.cos(a) * d * 26, cy + Math.sin(a) * d * 22, rng.range(10, 16)]);
  }
  for (const [bx, by, r] of blobs) ellipse(ctx, bx, by, r + 1.6, r + 1.6, INK);
  for (const [bx, by, r] of blobs) ellipse(ctx, bx, by, r, r, dark);
  for (const [bx, by, r] of blobs) {
    if (bx - cx + by - cy < 8) ellipse(ctx, bx - 2, by - 3, r * 0.75, r * 0.7, mid);
  }
  for (const [bx, by, r] of blobs) {
    if (bx - cx + by - cy < -12) ellipse(ctx, bx - 3, by - 5, r * 0.4, r * 0.35, light);
  }
  // Leaf flecks.
  for (let i = 0; i < 70; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * 30;
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(10,8,4,0.35)' : 'rgba(255,240,190,0.1)';
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 1.5, 1.5);
  }
}

function paintPine(ctx: Ctx, rng: Rng, x: number, y: number): void {
  const [dark, mid, light] = PAL.pine as [string, string, string];
  shape(ctx, rect(x - 3, y - 14, 6, 14), rng, PAL.bark, 1);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const base = y - 10 - i * 20;
    const half = 30 - i * 6;
    const top = base - 34;
    shape(
      ctx,
      [
        { x, y: top },
        { x: x - half, y: base },
        { x: x + half, y: base + 2 },
      ],
      rng,
      dark,
      1.4,
      1,
    );
    shape(
      ctx,
      [
        { x, y: top + 2 },
        { x: x - half + 4, y: base - 2 },
        { x: x + 2, y: base - 1 },
      ],
      rng,
      mid,
      0,
      1,
    );
    shape(
      ctx,
      [
        { x: x - 1, y: top + 6 },
        { x: x - half * 0.55, y: base - 6 },
        { x: x - 3, y: base - 5 },
      ],
      rng,
      light,
      0,
      0.8,
    );
  }
}

function branch(
  ctx: Ctx,
  rng: Rng,
  x: number,
  y: number,
  a: number,
  len: number,
  w: number,
  depth: number,
): void {
  const ex = x + Math.cos(a) * len;
  const ey = y + Math.sin(a) * len;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + ex) / 2 + rng.range(-4, 4), (y + ey) / 2, ex, ey);
  ctx.strokeStyle = '#241912';
  ctx.lineWidth = w + 1.4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#4a3828';
  ctx.lineWidth = w;
  ctx.stroke();
  if (depth > 4 || w < 1) return;
  const kids = depth === 0 ? 3 : rng.int(1, 3);
  for (let i = 0; i < kids; i++) {
    branch(
      ctx,
      rng,
      ex,
      ey,
      a + rng.range(-0.8, 0.8),
      len * rng.range(0.55, 0.8),
      w * 0.62,
      depth + 1,
    );
  }
}

// --- Hero --------------------------------------------------------------------------

export const HERO_W = 26;
export const HERO_H = 40;
export const HERO_FACINGS = ['down', 'left', 'right', 'up'] as const;
export type HeroFacing = (typeof HERO_FACINGS)[number];
/** Where the lantern hangs, relative to the hero's feet, per facing. */
export const LANTERN: Record<HeroFacing, Pt> = {
  down: { x: 8, y: -12 },
  left: { x: -9, y: -12 },
  right: { x: 9, y: -12 },
  up: { x: -8, y: -12 },
};

/**
 * A hooded wanderer with a lantern: 4 facings × 3 frames (stand, step, step),
 * laid out in a row-per-facing sheet.
 */
export function paintHero(ctx: Ctx): void {
  HERO_FACINGS.forEach((facing, row) => {
    for (let f = 0; f < 3; f++) {
      ctx.save();
      ctx.translate(f * HERO_W + HERO_W / 2, row * HERO_H + HERO_H - 4);
      heroFrame(ctx, new Rng(row * 3 + f + 1), facing, f === 0 ? 0 : f === 1 ? 1 : -1);
      ctx.restore();
    }
  });
}

function heroFrame(ctx: Ctx, rng: Rng, facing: HeroFacing, step: number): void {
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  ellipse(ctx, 0, 0, 8, 3, 'rgba(10,6,4,0.5)');
  // Boots.
  const legs = side
    ? [[-1 + step * 3, 0]]
    : [
        [-3, step * 1.5],
        [3, -step * 1.5],
      ];
  for (const [lx, ly] of legs as [number, number][]) {
    shape(ctx, rect(lx - 2, -6 + ly, 4, 6), rng, '#20160f', 0.8, 0.1);
  }
  // Cloak.
  const cloak: Pt[] = [
    { x: -6, y: -24 },
    { x: 6, y: -24 },
    { x: 8 + side, y: -5 },
    { x: 2, y: -4 + step * 0.5 },
    { x: -2, y: -4 - step * 0.5 },
    { x: -8 + side, y: -5 },
  ];
  shape(ctx, cloak, rng, '#4a3526', 1.2, 0.3);
  ctx.fillStyle = 'rgba(10,6,4,0.35)';
  ctx.fillRect(side >= 0 ? 1 : -7, -23, 6, 18);
  line(ctx, rng, { x: 0, y: -22 }, { x: side * 2, y: -6 }, 'rgba(10,6,4,0.4)', 0.8, 0.2);
  // Scarf — the one bit of colour, in the roofs' crimson.
  shape(ctx, rect(-6, -26, 12, 4), rng, '#8a3a2c', 0.9, 0.2);
  if (facing !== 'up') {
    line(
      ctx,
      rng,
      { x: 2 * (side || 1), y: -23 },
      { x: 3 * (side || 1), y: -15 },
      '#8a3a2c',
      2,
      0.2,
    );
  }
  // Hood.
  ellipse(ctx, side * 0.5, -31, 7.4, 7.6, INK);
  ellipse(ctx, side * 0.5, -31, 6.2, 6.4, '#3d2c20');
  if (facing === 'down') {
    ellipse(ctx, 0, -29.5, 4, 4, '#140d08');
    ellipse(ctx, 0, -28.6, 2.2, 1.8, '#c79a74');
  } else if (side) {
    ellipse(ctx, side * 3.2, -30, 2.4, 3.6, '#140d08');
    ellipse(ctx, side * 4, -29.3, 1.1, 1.6, '#c79a74');
  } else {
    line(ctx, rng, { x: 0, y: -37 }, { x: 0, y: -26 }, 'rgba(10,6,4,0.45)', 0.8, 0.2);
  }
  // Lantern.
  const l = LANTERN[facing];
  const lx = l.x;
  const ly = l.y + Math.abs(step) * 0.8;
  if (facing === 'up') return; // carried in front, out of sight
  line(ctx, rng, { x: lx * 0.6, y: -16 }, { x: lx, y: ly - 4 }, '#2a2420', 0.9, 0.1);
  shape(ctx, rect(lx - 2.5, ly - 4, 5, 6), rng, '#ffd58a', 0.9, 0.1);
  ctx.fillStyle = INK;
  ctx.fillRect(lx - 3, ly - 5, 6, 1.2);
}

/** The whole world map size in world pixels. */
export const WORLD_W = MAP_W * T;
export const WORLD_H = MAP_H * T;
