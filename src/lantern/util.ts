/** Shared constants and small helpers for the lantern game. */

/** World pixels per tile. */
export const T = 32;
/** Map size in tiles. */
export const W = 100;
export const H = 80;
/** Seconds in a full day–night cycle. */
export const DAY_LEN = 360;

/** The village inside the palisade: the only safe place. */
export const TOWN = { x0: 38, y0: 31, x1: 61, y1: 48, cx: 50, cy: 40 };
/** Where the worlds touch. */
export const MIRROR = { x: 84, y: 14 };

export const TL = {
  G1: 0,
  G2: 1,
  G3: 2,
  DIRT: 3,
  ROAD: 4,
  ROADC: 5,
  WATER: 6,
  BRIDGE: 7,
  BBRIDGE: 8,
  PAVE: 9,
  FLOOR: 10,
  WALL: 11,
  TWALL: 12,
  GLASS: 13,
  SAND: 14,
  GATE: 15,
  // Village and interiors.
  PLANK: 16,
  PLANK2: 17,
  PARQUET: 18,
  CHECKER: 19,
  FLAG: 20,
  EARTH: 21,
  TIMBER: 22,
  PAVE2: 23,
  PAVE3: 24,
  SOIL: 25,
  ASHLAR: 26,
  CARPET: 27,
} as const;

export interface Pt {
  x: number;
  y: number;
}

/** Seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a wrapping 64×64 lattice. */
export function makeNoise(seed: number): (x: number, y: number) => number {
  const r = mulberry32(seed);
  const N = 64;
  const g = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) g[i] = r();
  const v = (a: number, b: number) => g[(((b % N) + N) % N) * N + (((a % N) + N) % N)] as number;
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = s(x - xi);
    const w = s(y - yi);
    const a = v(xi, yi);
    const b = v(xi + 1, yi);
    const c = v(xi, yi + 1);
    const d = v(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const rint = (a: number, b: number) => Math.floor(rnd(a, b + 1));

/** The river's centre column for a row, and the brook's centre row for a column. */
export const riverX = (y: number) =>
  Math.round(24 + 3 * Math.sin(y * 0.12) + 2 * Math.sin(y * 0.31));
export const brookY = (x: number) =>
  Math.round(66 + 3 * Math.sin(x * 0.13) + 2 * Math.sin(x * 0.29));
