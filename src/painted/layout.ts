import { NavGrid } from '../core/grid';
import type { Cell } from '../core/iso';
import { Rng } from './rng';

/** World pixels per grid cell. */
export const T = 32;
export const MAP_W = 36;
export const MAP_H = 26;

export type HouseKind = 'house' | 'chapel';
export interface House extends Cell {
  kind: HouseKind;
  w: number;
  h: number;
  /** Indices of front-wall windows that glow at night. */
  lit: number[];
  broken?: boolean;
  seed: number;
}

export type PropKind =
  | 'tree'
  | 'pine'
  | 'dead'
  | 'grave'
  | 'cross'
  | 'fenceH'
  | 'fenceV'
  | 'lamp'
  | 'lampOff'
  | 'well'
  | 'fire'
  | 'cart'
  | 'crates'
  | 'barrel'
  | 'hay';

export interface PropSpot extends Cell {
  kind: PropKind;
  variant: number;
  /** Walkable props (broken fence gaps, grass) don't block their cell. */
  solid: boolean;
}

export interface VillageLayout {
  /** Road centre lines, in cells. */
  roads: { points: [number, number][]; width: number }[];
  square: { c: number; r: number; radius: number };
  houses: House[];
  props: PropSpot[];
  graveyard: { c0: number; r0: number; c1: number; r1: number };
  spawn: Cell;
  nav: NavGrid;
}

const ROADS: VillageLayout['roads'] = [
  {
    points: [
      [18, 26],
      [18.4, 21],
      [17.6, 17],
      [18, 13],
    ],
    width: 1.6,
  },
  {
    points: [
      [18, 12.5],
      [13, 12.2],
      [9, 10.6],
      [7.5, 9.4],
    ],
    width: 1.3,
  },
  {
    points: [
      [18, 12.5],
      [23, 12.4],
      [27, 10.6],
      [28.5, 8.6],
    ],
    width: 1.3,
  },
  {
    points: [
      [18, 12],
      [17.4, 8],
      [15, 6.6],
    ],
    width: 1,
  },
  {
    points: [
      [17.8, 17],
      [14, 18.6],
      [12.5, 18.4],
    ],
    width: 0.9,
  },
  {
    points: [
      [18.2, 18],
      [22, 19.4],
      [24.5, 20.4],
    ],
    width: 0.9,
  },
  {
    points: [
      [11, 11.2],
      [8.5, 13.5],
      [9.2, 18],
      [6.5, 22],
    ],
    width: 0.8,
  },
];

const HOUSES: Omit<House, 'seed'>[] = [
  { kind: 'house', c: 5, r: 5, w: 5, h: 4, lit: [1] },
  { kind: 'house', c: 13, r: 3, w: 4, h: 3, lit: [] },
  { kind: 'house', c: 10, r: 15, w: 4, h: 3, lit: [], broken: true },
  { kind: 'house', c: 22, r: 17, w: 5, h: 3, lit: [0, 2] },
  { kind: 'house', c: 4, r: 18, w: 4, h: 3, lit: [], broken: true },
  { kind: 'house', c: 19, r: 3, w: 3, h: 3, lit: [] },
  { kind: 'chapel', c: 25, r: 2, w: 6, h: 6, lit: [0] },
];

/** Distance from a point to a polyline, in cells. */
export function distToRoad(x: number, y: number, pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i] as [number, number];
    const [bx, by] = pts[i + 1] as [number, number];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
  }
  return best;
}

/**
 * The village plan: roads, houses, the chapel and its graveyard, a ring of
 * forest and a scatter of props. Hand-placed landmarks plus seeded filler, so
 * it is the same every run.
 */
export function buildLayout(seed = 7): VillageLayout {
  const rng = new Rng(seed);
  const nav = new NavGrid(MAP_W, MAP_H);
  const taken = new Set<number>();
  const key = (c: number, r: number) => r * MAP_W + c;
  const props: PropSpot[] = [];
  const square = { c: 18, r: 12.5, radius: 3.2 };
  const graveyard = { c0: 30, r0: 10, c1: 34, r1: 17 };

  const nearRoad = (c: number, r: number, margin: number) =>
    ROADS.some((rd) => distToRoad(c + 0.5, r + 0.5, rd.points) < rd.width / 2 + margin) ||
    Math.hypot(c + 0.5 - square.c, r + 0.5 - square.r) < square.radius + margin;

  const houses: House[] = HOUSES.map((h) => ({ ...h, seed: rng.int(1, 1e6) }));
  for (const h of houses) {
    for (let r = h.r; r < h.r + h.h; r++) {
      for (let c = h.c; c < h.c + h.w; c++) {
        nav.blockCell(c, r);
        taken.add(key(c, r));
      }
    }
    // Keep a ring of air around buildings so the forest doesn't hug the walls.
    for (let r = h.r - 1; r <= h.r + h.h; r++) {
      for (let c = h.c - 1; c <= h.c + h.w; c++) taken.add(key(c, r));
    }
  }

  const put = (kind: PropKind, c: number, r: number, solid = true, variant = rng.int(0, 7)) => {
    props.push({ kind, c, r, variant, solid });
    taken.add(key(c, r));
    if (solid) nav.blockCell(c, r);
  };
  /** Village props keep the trees at arm's length. */
  const clear = () => {
    for (const p of props) {
      for (let dr = -1; dr <= 2; dr++) {
        for (let dc = -1; dc <= 1; dc++) taken.add(key(p.c + dc, p.r + dr));
      }
    }
  };

  // The square: a dry well, a fire someone lit not long ago, lamps.
  put('well', 18, 11);
  put('fire', 20, 14);
  put('lamp', 15, 10);
  put('lamp', 21, 10);
  put('lampOff', 16, 20);
  put('lamp', 20, 22);
  put('lamp', 27, 12);
  put('cart', 13, 13);
  put('crates', 10, 9);
  put('barrel', 11, 9);
  put('crates', 27, 20);
  put('hay', 15, 15);
  put('barrel', 21, 16);

  // Graveyard: a fence with a gate facing the road, crooked stones inside.
  const g = graveyard;
  for (let c = g.c0; c <= g.c1; c++) {
    put('fenceH', c, g.r0, true, c === g.c0 + 2 ? 9 : rng.int(0, 7));
    put('fenceH', c, g.r1);
  }
  for (let r = g.r0 + 1; r < g.r1; r++) {
    if (r === 13 || r === 14) {
      taken.add(key(g.c0, r)); // the gate
    } else {
      put('fenceV', g.c0, r);
    }
    put('fenceV', g.c1, r);
  }
  for (let r = g.r0 + 2; r < g.r1 - 1; r += 2) {
    for (let c = g.c0 + 2; c < g.c1; c++) {
      if (rng.chance(0.8)) put(rng.chance(0.25) ? 'cross' : 'grave', c, r);
    }
  }
  put('dead', g.c1 - 1, g.r0 + 1);
  put('dead', g.c0 + 1, g.r1 - 1);

  clear();

  // Forest: dense at the edges, thinning inwards; never on roads.
  for (let r = 0; r < MAP_H; r++) {
    for (let c = 0; c < MAP_W; c++) {
      if (taken.has(key(c, r)) || nearRoad(c, r, 0.7)) continue;
      const edge = Math.min(c, r, MAP_W - 1 - c, MAP_H - 1 - r);
      const p = edge < 2 ? 0.85 : edge < 3 ? 0.45 : 0.06;
      if (!rng.chance(p)) continue;
      // Trees take a 2×2 block so canopies don't stack in a wall.
      if (taken.has(key(c - 1, r)) && rng.chance(0.6)) continue;
      const kind = rng.chance(0.12) ? 'dead' : rng.chance(edge < 2 ? 0.5 : 0.3) ? 'pine' : 'tree';
      put(kind, c, r);
    }
  }

  return {
    roads: ROADS,
    square,
    houses,
    props,
    graveyard,
    spawn: { c: 18, r: 24 },
    nav,
  };
}
