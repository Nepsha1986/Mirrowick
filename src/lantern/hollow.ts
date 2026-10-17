import { tr } from '../i18n';
import type { FoeId } from './combat';
import { T, TL, makeNoise, mulberry32, type Pt } from './util';
import type { Light, Thing, WorldObject } from './world';

/** Where an enemy lives, and comes back to (world pixels). */
export interface FoeSpawn extends Pt {
  kind: FoeId;
}

interface Grid {
  ground: Uint8Array;
  block: Uint8Array;
  /** Cleared ground: kept free of trees. */
  clear: Uint8Array;
  objects: WorldObject[];
  decals: WorldObject[];
  lights: Light[];
}

const W = 100;
/** The Hollow's middle and its half-size, in tiles. */
export const HOLLOW = { x: 9, y: 26, rx: 7.5, ry: 9.5 };

/**
 * The Hollow: a clearing in the woods across the river, west of the
 * village, where the fighting is tried out. A track leads up from the west
 * road to a stump with a pistol on it and a crate of rounds; around the
 * clearing live five enemies, each in a corner of its own — a wolf by its
 * den, a brigand at his campfire, a boar in its wallow, a glass crawler
 * among shards of the Mirror, and a shade under dead trees.
 */
export function buildHollow(g: Grid): { foes: FoeSpawn[]; things: Thing[] } {
  const R = mulberry32(4242);
  const n = makeNoise(77);
  const I = (x: number, y: number) => y * W + x;
  const C = (x: number, y: number): Pt => ({ x: (x + 0.5) * T, y: (y + 0.5) * T });
  const grass = (i: number) => (g.ground[i] as number) <= TL.G3;

  // A ragged oval of open grass.
  for (let y = HOLLOW.y - 11; y <= HOLLOW.y + 11; y++) {
    for (let x = 1; x <= HOLLOW.x + 9; x++) {
      const d = Math.hypot((x - HOLLOW.x) / HOLLOW.rx, (y - HOLLOW.y) / HOLLOW.ry);
      if (d + (n(x * 0.35, y * 0.35) - 0.5) * 0.35 > 1) continue;
      const i = I(x, y);
      if (!grass(i) || g.block[i]) continue;
      g.clear[i] = 1;
    }
  }
  // A worn track up from the road, not quite straight.
  for (let y = 38; y >= HOLLOW.y + 7; y--) {
    const x = 10 + Math.round(Math.sin(y * 0.7) * 0.6);
    for (const i of [I(x, y), I(x + 1, y)]) {
      g.ground[i] = TL.DIRT;
      g.clear[i] = 1;
    }
  }

  const solid = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) => {
    g.block[I(Math.floor(x), Math.floor(y))] = 1;
    g.objects.push({ frame, x: x * T, y: y * T, ...o });
  };
  const decal = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) =>
    g.decals.push({ frame, x: x * T, y: y * T, angle: R() * 360, ...o });

  // Where you come in: the pistol left on a stump, a crate of rounds beside it.
  solid('stump', 8.5, 33.6, { key: 'ln-foes', angle: 20 });
  const things: Thing[] = [
    {
      id: 'pistol',
      key: 'ln-foes',
      frame: 'pistol',
      x: 8.5 * T,
      y: 33.5 * T,
      depth: 33.6 * T + 6,
      label: tr('Take the pistol', 'Взять пистолет'),
      take: true,
    },
    {
      id: 'ammo',
      key: 'ln-foes',
      frame: 'ammo',
      x: 12.5 * T,
      y: 33.5 * T,
      label: tr('Take rounds', 'Взять патроны'),
    },
  ];
  g.block[I(12, 33)] = 1;

  // The wolf's den: tumbled rocks, gnawed bones.
  solid('rock', 3.4, 18.6, { angle: 30 });
  solid('rock2', 5.6, 17.8, { angle: 200 });
  solid('rock', 2.5, 21, { angle: 110, scale: 0.8 });
  for (let k = 0; k < 4; k++) decal('bones', 3 + R() * 4, 19.5 + R() * 3);

  // The brigand's camp: a fire, a bedroll, a crate of loot.
  solid('campfire', 14.5, 19.5, { key: 'ln-foes', depth: -20 });
  g.lights.push({ ...C(14, 19), radius: 120, flicker: 0.18, color: 0xff9a40 });
  decal('bedroll', 15.6, 17.6, { key: 'ln-foes', angle: -14, alpha: 1 });
  solid('crate', 12.4, 18, { angle: 8 });

  // The boar's wallow: churned mud, trampled grass.
  for (let y = 27; y <= 31; y++) {
    for (let x = 2; x <= 6; x++) {
      if (Math.hypot((x - 4) / 2.4, (y - 29) / 2) + R() * 0.3 > 1.1) continue;
      g.ground[I(x, y)] = TL.EARTH;
    }
  }
  for (let k = 0; k < 3; k++) decal('tuft', 2 + R() * 5, 26 + R() * 6);

  // Where the crawler came out: shards of black glass standing in the grass.
  for (const [x, y, s] of [
    [16.2, 26.4, 0.7],
    [15.4, 29.8, 0.9],
    [12.6, 28.4, 0.6],
  ] as const) {
    solid('shard', x, y, { y: y * T - 6, depth: y * T + 8, scale: s, angle: (R() - 0.5) * 20 });
    g.lights.push({
      x: x * T,
      y: y * T,
      radius: 60 * s,
      flicker: 0.15,
      slow: true,
      color: 0x9fd8e6,
    });
  }

  // The shade's corner: dead trees and no light at all.
  solid('dead', 6.5, 17.5, { angle: 40, depth: 17.5 * T + 14 });
  solid('dead', 10.5, 16.6, { angle: 170, scale: 0.9, depth: 16.6 * T + 14 });

  const foes: FoeSpawn[] = [
    { kind: 'wolf', ...C(5, 21) },
    { kind: 'brigand', ...C(13, 21) },
    { kind: 'boar', ...C(4, 29) },
    { kind: 'crawler', ...C(14, 28) },
    { kind: 'shade', ...C(8, 18) },
  ];
  return { foes, things };
}
