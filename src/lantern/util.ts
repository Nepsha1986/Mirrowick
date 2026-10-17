/** Shared constants and small helpers for the lantern game. */

/** World pixels per tile. */
export const T = 32;
/** Seconds in a full day–night cycle. */
export const DAY_LEN = 360;

/**
 * The Lower World: the Facility, a vast complex built round the mirror.
 * Level −1, underground, is a map this many tiles across; a long tunnel
 * leads up from it to the yard, in front of level 0, on a map of its own.
 */
export const LW = 126;
export const LH = 108;
export const YW = 106;
export const YH = 50;
/** Where the tunnel goes over from level −1 to the yard, on either map (tiles). */
export const LAB_RAMP = { x: 30, y: 106.4 };
export const YARD_RAMP = { x: 20, y: 2.6 };
/** Chamber 7, built round the mirror's hall, and the mirror in it (tiles). */
export const CHAMBER = { x0: 38, y0: 12, w: 40, h: 29 };
export const LAB_MIRROR = { x: 57.5, y: 26 };
/** The Upper World map, in tiles. */
export const UW = 60;
export const UH = 44;
/** The hatch in the floor of Victor's shed, down to the cellar (tiles). */
export const SHED_HATCH = { x: 47.5, y: 8.7 };
/** The cellar under Victor's shed: map size, the foot of its stairs, its mirror (tiles). */
export const CW = 36;
export const CH = 26;
export const CELLAR_STAIRS = { x: 6.4, y: 13 };
export const CELLAR_MIRROR = { x: 18.5, y: 13 };

export const TL = {
  // The Upper World.
  UG1: 0,
  UG2: 1,
  UG3: 2,
  TILEW: 3,
  // Indoor floors.
  PLANK: 4,
  PLANK2: 5,
  PARQUET: 6,
  CHECKER: 7,
  CARPET: 8,
  // The cellar.
  ROCK: 9,
  // The Facility.
  CONCRETE: 10,
  LINO: 11,
  GRATE: 12,
  ASH: 13,
  ROOFTOP: 14,
  /** Packed earth and stones: what level −1 is dug into. */
  EARTH: 15,
} as const;

/** Slots in the ground sheet. */
export const TILE_SLOTS = 16;

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
