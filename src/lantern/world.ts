import type { FoeSpawn } from './combat';
import type { Fact } from './items';
import type { Hoard } from './memory';
import type { Pt } from './util';

/**
 * The two worlds and the cellar between them: the Lower World is the
 * Facility on the far side of the mirror, level −1 underground and the
 * yard up on the surface.
 */
export type Realm = 'lower' | 'yard' | 'upper' | 'cellar';

export interface WorldObject extends Pt {
  /** Texture key; defaults to the main atlas. */
  key?: string;
  frame: string;
  /** Sort depth; defaults to y. */
  depth?: number;
  angle?: number;
  scale?: number;
  alpha?: number;
  /** Drawn as in a looking-glass. */
  flipX?: boolean;
}

/**
 * A thin wall, fence or post drawn over the ground, with collision of its
 * own instead of a whole tile's (world pixels).
 */
export interface ThinWall {
  x: number;
  y: number;
  w: number;
  h: number;
  kind:
    | 'outer'
    | 'inner'
    | 'window'
    | 'post'
    | 'fence'
    | 'stone'
    | 'boards'
    /** The Facility's poured concrete. */
    | 'concrete'
    /** Steel bars, a cage's front. */
    | 'bars'
    /** Chain-link with barbed wire along the top. */
    | 'mesh';
}

/**
 * A road, path, bed or cracked asphalt painted onto the ground along a
 * line, with ragged edges; a round floor of flagstones or a square patio
 * of slabs (paving) centred on its first point, `width` across and
 * `height` tall; or long grass in clumps, one round each point, `width`
 * across.
 */
export interface GroundPatch {
  pts: Pt[];
  width: number;
  height?: number;
  kind: 'road' | 'gravel' | 'dirt' | 'soil' | 'asphalt' | 'flagstones' | 'paving' | 'meadow';
}

export interface Light extends Pt {
  radius: number;
  /** Flicker amount. */
  flicker: number;
  /** Slow breathing instead of a flame's flicker. */
  slow?: boolean;
  /** Lights a room: shines only while that building's roof is lifted. */
  room?: number;
  color: number;
}

/**
 * Something in the world you can walk up to and use. You pick it up, look
 * in it, read it or look at it, or the scene does something of its own
 * with it, found by `id`.
 */
export interface Thing extends Pt {
  id: string;
  key: string;
  frame: string;
  depth?: number;
  scale?: number;
  angle?: number;
  /** The prompt. */
  label: string;
  /** You pick it up: it goes into your pockets and is gone from the world. */
  take?: boolean;
  /** You look in: a drawer of odds and ends, see `Memory`. */
  hoard?: Hoard;
  /** You read it: an id in `PAPERS`. */
  read?: string;
  /** You look at it, and the hero thinks this. */
  says?: string;
  /**
   * A door: shut, it blocks these tiles; open, it shows `open` and lets you
   * through, and stays open. Locked, it works like a portal's lock.
   */
  door?: { tiles: [number, number][]; open: string; lock?: Lock };
}

/**
 * A lock: trying it teaches the hero `fact`; with the key he unlocks it
 * (the prompt `unlock`) and learns `open`, and it stays open from then on.
 */
export interface Lock {
  key: string;
  fact: Fact;
  says: string;
  open: Fact;
  unlock: string;
}

/** A footprint on the ground (world pixels), facing `angle`, from the left foot or the right. */
export interface Print extends Pt {
  angle: number;
  left: boolean;
}

/** A way through to another place (world pixels). */
export interface Portal extends Pt {
  to: Realm;
  /** Where you come out on the other side. */
  exit: Pt;
  label: string;
  /** A flash of the Mirror's light, or a plain fade (stairs). */
  fade: 'glint' | 'dark';
  /** Locked, until the hero has the key. */
  lock?: Lock;
  /**
   * A band this big across the way (centred on it): walk onto it and you
   * go through, with nothing to press.
   */
  step?: { w: number; h: number };
}

export type RoofKind = 'tiles' | 'tin';

/** A building you can walk into: its roof fades while you're inside. */
export interface Building {
  name: string;
  x0: number;
  y0: number;
  w: number;
  h: number;
  roof: RoofKind;
  /** Chimney positions in tiles, relative to the building (for smoke). */
  chimneys: Pt[];
  /** A lit porch canopy over the front door: the door's middle, in tiles from x0, on the south wall. */
  porch?: number;
}

export interface World {
  realm: Realm;
  /** Map size in tiles. */
  w: number;
  h: number;
  ground: Uint8Array;
  /** 0 walkable, 1 solid, 2 water. */
  block: Uint8Array;
  objects: WorldObject[];
  decals: WorldObject[];
  lights: Light[];
  spawn: Pt;
  /** Buildings whose roofs lift while you're inside. */
  buildings: Building[];
  portals: Portal[];
  walls: ThinWall[];
  patches: GroundPatch[];
  things: Thing[];
  /** Enemies, where they live. */
  foes?: FoeSpawn[];
  /**
   * Footprints left by someone who had been to the other side: they carry
   * its light, so they glow, but only in the flashlight's beam after dark.
   */
  trail?: Print[];
  /**
   * Tree crowns that hang over the hero and thin out while he walks under
   * them; the trunk below is an ordinary object.
   */
  crowns?: WorldObject[];
  /** Tiles of long grass (1), knee-high: it slows you and rustles. */
  tall?: Uint8Array;
  /**
   * Tiles under a roof with no windows (1): there it is as dark as night
   * at any hour, and only lamps and your own light show the way.
   */
  indoors?: Uint8Array;
}

/** Grey daylight, where the Facility's ramp comes up to the surface. */
export const DAYLIGHT = 0xd6d8d2;

/** The cold light of the mirrors and of whatever comes through them. */
export const GLASS = 0x9fd8e6;
