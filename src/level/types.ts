import type { Facing } from '../core/direction';
import type { Cell } from '../core/iso';

/**
 * Which edge of its cell a thin piece (wall, fence) stands on, in grid terms:
 * N = front-left (towards r+1), W = front-right (towards c+1),
 * E = back-left (towards c-1), S = back-right (towards r-1).
 * The names follow the dungeon pack's sprite suffixes.
 */
export type Side = 'N' | 'E' | 'S' | 'W';

export const SIDE_STEP: Record<Side, readonly [number, number]> = {
  N: [0, 1],
  W: [1, 0],
  E: [-1, 0],
  S: [0, -1],
};

export interface ItemDef {
  id: string;
  name: string;
  description: string;
}

export interface Interaction {
  /** Shown on hover and in the log. */
  name: string;
  /** Lines printed on each use, cycling; the last one repeats. */
  lines: string[];
  /** Picked up into the inventory on first use (the prop disappears). */
  pickup?: ItemDef;
  /** Given on first use without removing the prop (e.g. found in a chest). */
  gives?: ItemDef;
  /** Swapped in after first use, e.g. an opened chest. */
  usedFrame?: string;
  /** Needs an item first; `missing` is printed until the player has it. */
  requires?: { item: string; missing: string[] };
}

export interface Light {
  radius: number;
  color: number;
  intensity: number;
  /** Height of the flame above the footprint, in world pixels. */
  height: number;
  flicker?: boolean;
}

export interface Prop {
  frame: string;
  c: number;
  r: number;
  /** Thin piece on a cell edge: blocks that edge instead of the whole cell. */
  edge?: Side;
  /** Whole-cell blocker. Defaults to true for props without `edge`. */
  solid?: boolean;
  interact?: Interaction;
  light?: Light;
}

export interface LevelDef {
  id: string;
  title: string;
  /** Rows of ground glyphs; see GROUND_FRAMES. A space is the void. */
  ground: string[];
  spawn: Cell;
  spawnFacing: Facing;
  props: Prop[];
  intro: string[];
}

/** Ground glyph → atlas frame(s); several frames are picked per cell for variety. */
export const GROUND_FRAMES: Record<string, readonly string[]> = {
  '.': ['dirt'],
  d: ['dirt'],
  t: ['dirtTiles'],
  s: ['stone'],
  u: ['stoneUneven', 'stoneUneven', 'stoneTile'],
  m: ['stoneMissingTiles'],
  p: ['planks'],
  h: ['planksHole'],
};

/**
 * Multiplicative tints per glyph, picked per cell. Overgrown earth is the
 * dungeon pack's dirt pushed towards dead olive so it reads as wild ground.
 */
export const GROUND_TINTS: Record<string, readonly number[]> = {
  '.': [0x8f8f6a, 0x989470, 0x85866a, 0x9a9171],
  d: [0xffffff, 0xf4ece0],
};
