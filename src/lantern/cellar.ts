import { t } from '../i18n';
import { layHall } from './hall';
import { cellarMirror, cellarStairs, labMirror, upperHatch, wallTiles } from './ways';
import { CH, CW, T, TL, mulberry32, type Pt } from './util';
import type { GroundPatch, Light, Thing, ThinWall, World, WorldObject } from './world';

/**
 * The cellar under Victor's shed: a great vaulted hall dug far wider than
 * the shed above, where someone once kept a mirror in a chalk circle.
 * Shelves of old books, a lectern with a tome you can read, an alchemist's
 * table, a cauldron, candles, sigils on the floor — and stairs back up to
 * the hatch in the shed.
 */
export function generateCellar(): World {
  const N = CW * CH;
  const ground = new Uint8Array(N).fill(TL.ROCK);
  const block = new Uint8Array(N).fill(1);
  const objects: WorldObject[] = [];
  const decals: WorldObject[] = [];
  const lights: Light[] = [];
  const walls: ThinWall[] = [];
  const patches: GroundPatch[] = [];
  const I = (x: number, y: number) => y * CW + x;
  const mid = cellarMirror();
  const P = (x: number, y: number): Pt => ({ x: x * T, y: y * T });
  const hall = layHall({
    mid,
    flip: false,
    R: mulberry32(6660),
    floor: (x, y) => (block[I(x, y)] = 0),
    solid: (x, y) => (block[I(x, y)] = 1),
    objects,
    decals,
    lights,
    walls,
    patches,
  });
  wallTiles(walls, (x, y) => (block[I(x, y)] = 1));
  const foot = cellarStairs();

  // The tome lies open on the lectern, with a slip of paper in it.
  const things: Thing[] = [
    {
      id: 'tome',
      key: 'ln-cellar',
      frame: 'lectern',
      ...hall.lectern,
      label: t().use.tome,
      read: 'tome',
    },
  ];

  return {
    realm: 'cellar',
    w: CW,
    h: CH,
    ground,
    block,
    objects,
    decals,
    lights,
    spawn: foot,
    buildings: [],
    portals: [
      {
        ...P(5.5, 13),
        to: 'upper',
        exit: upperHatch(),
        label: t().use.shedUp,
        fade: 'dark',
      },
      {
        ...mid,
        to: 'lower',
        exit: labMirror(),
        label: t().use.mirror,
        fade: 'glint',
      },
    ],
    walls,
    patches,
    things,
  };
}
