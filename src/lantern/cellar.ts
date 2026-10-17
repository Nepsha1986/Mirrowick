import { cellarMirror, cellarStairs, lowerMirror, upperHatch, wallTiles } from './mill';
import { CH, CW, T, TL, mulberry32, type Pt } from './util';
import {
  GLASS,
  type Light,
  type Thing,
  type ThinWall,
  type World,
  type WorldObject,
} from './world';

const CANDLE = 0xffb050;
/** The hall: an ellipse round the mirror, its wall's middle line (tiles). */
const RX = 13.6;
const RY = 9;

/**
 * The cellar under Victor's shed: a great vaulted hall dug far wider than
 * the shed above, where someone once kept a mirror in a chalk circle.
 * Shelves of old books, a lectern with a tome you can read, an alchemist's
 * table, a cauldron, candles, sigils on the floor — and stairs back up to
 * the hatch in the shed.
 */
export function generateCellar(): World {
  const R = mulberry32(6660);
  const N = CW * CH;
  const ground = new Uint8Array(N).fill(TL.ROCK);
  const block = new Uint8Array(N).fill(1);
  const objects: WorldObject[] = [];
  const decals: WorldObject[] = [];
  const lights: Light[] = [];
  const walls: ThinWall[] = [];
  const I = (x: number, y: number) => y * CW + x;
  const mid = cellarMirror();
  const P = (x: number, y: number): Pt => ({ x: x * T, y: y * T });
  const up = (frame: string, p: Pt, o: Partial<WorldObject> = {}) =>
    objects.push({ key: 'ln-cellar', frame, ...p, ...o });
  const decal = (frame: string, p: Pt, o: Partial<WorldObject> = {}) =>
    decals.push({ key: 'ln-cellar', frame, ...p, depth: -48, alpha: 0.9, ...o });
  const solidAt = (p: Pt) => (block[I(Math.floor(p.x / T), Math.floor(p.y / T))] = 1);
  const light = (p: Pt, radius: number, color: number, o: Partial<Light> = {}) =>
    lights.push({ ...p, radius, color, flicker: 0.12, ...o });
  /** A point on the hall's wall line, `k` of the way round (0…1 from the east). */
  const rim = (a: number, inset = 0): Pt => ({
    x: mid.x + Math.cos(a) * (RX * T - inset),
    y: mid.y + Math.sin(a) * (RY * T - inset),
  });

  // The hall floor: every tile whose middle is inside the wall.
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const dx = ((x + 0.5) * T - mid.x) / (RX * T);
      const dy = ((y + 0.5) * T - mid.y) / (RY * T);
      if (dx * dx + dy * dy < 1) block[I(x, y)] = 0;
    }
  }
  // The stair passage out to the west.
  for (let y = 12; y <= 13; y++) for (let x = 2; x <= 5; x++) block[I(x, y)] = 0;

  // The wall: rough stone all round, open where the passage leaves.
  const stone = (p: Pt, size = 16) =>
    walls.push({ kind: 'stone', x: p.x - size / 2, y: p.y - size / 2, w: size, h: size });
  const steps = Math.ceil((2 * Math.PI * RX * T) / 6);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    if (Math.abs(a - Math.PI) < 0.15) continue;
    stone(rim(a));
  }
  for (let x = 1.6; x <= 5.2; x += 0.2) {
    stone(P(x, 11.9));
    stone(P(x, 14.1));
  }
  for (let y = 11.9; y <= 14.1; y += 0.2) stone(P(1.6, y));
  wallTiles(walls, (x, y) => (block[I(x, y)] = 1));

  // Flagstones under it all, and the stairs.
  const patches = [
    {
      kind: 'flagstones' as const,
      pts: [mid],
      width: (RX + 0.4) * 2 * T,
      height: (RY + 0.4) * 2 * T,
    },
    { kind: 'flagstones' as const, pts: [P(3.6, 13)], width: 4.4 * T, height: 2.4 * T },
  ];
  decal('stairs', P(3.5, 13), { depth: -46, alpha: 1 });
  const foot = cellarStairs();

  // The circle: chalk rings and a seven-pointed star, a stone dais, the mirror.
  decal('ritual', mid, { depth: -47, alpha: 0.85 });
  decal('dais', mid, { depth: -46, alpha: 1 });
  decals.push({ key: 'ln-up', frame: 'mirror', ...mid, depth: -45, scale: 1.25 });
  light(mid, 90, GLASS, { slow: true, flicker: 0.18 });
  light(mid, 200, 0x8a5cff, { slow: true, flicker: 0.25 });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 - Math.PI / 2;
    const p = { x: mid.x + Math.cos(a) * 4.3 * T, y: mid.y + Math.sin(a) * 3.6 * T };
    up('candle', p, { scale: 1 + R() * 0.3 });
    light({ x: p.x, y: p.y - 3 }, 64, CANDLE);
  }

  // Four pillars hold up the vault.
  for (const [x, y] of [
    [9, 8],
    [27, 8],
    [9, 18],
    [27, 18],
  ] as const) {
    up('pillar', P(x + 0.5, y + 0.5), { depth: (y + 1) * T });
    block[I(x, y)] = 1;
  }

  // Along the north wall: shelves of old books, and a lectern with a tome.
  for (const x of [15, 17, 21, 23]) {
    up('shelf', P(x, 5.75), { angle: (R() - 0.5) * 3 });
    block[I(x - 1, 5)] = 1;
    block[I(x, 5)] = 1;
  }
  // The tome lies open on the lectern, with a slip of paper in it.
  const things: Thing[] = [
    {
      id: 'tome',
      key: 'ln-cellar',
      frame: 'lectern',
      ...P(19, 6.6),
      label: 'Read the open book',
      read: 'tome',
    },
  ];
  solidAt(P(19, 6.6));
  light(P(19, 6.2), 46, CANDLE);

  // The alchemist's corner to the east: a long table, a cauldron, crates.
  up('longtable', P(29, 13), { depth: 14.6 * T });
  for (let y = 11; y <= 14; y++) block[I(28, y)] = 1;
  light(P(28.8, 11.8), 50, CANDLE);
  light(P(29.2, 13.6), 40, 0x7aff9a, { flicker: 0.3 });
  up('cauldron', P(25.5, 17.5));
  solidAt(P(25.5, 17.5));
  light(P(25.5, 17.5), 60, 0x7aff9a, { slow: true, flicker: 0.3 });
  for (const [x, y, f] of [
    [26.5, 9.5, 'crate'],
    [25.6, 9.2, 'barrel'],
    [10.5, 10.5, 'crate'],
  ] as const) {
    objects.push({ frame: f, x: x * T, y: y * T, angle: R() * 360 });
    solidAt(P(x, y));
  }
  // Chests by the stairs, and one by the shelves.
  for (const [x, y, a] of [
    [9.5, 12.2, 4],
    [12.3, 6.4, -8],
  ] as const) {
    up('chest', P(x, y), { angle: a });
    solidAt(P(x, y));
  }

  // Sconces on the wall, chalk sigils, skulls and bones, cobwebs, wax.
  for (const a of [0.35, 1.2, 1.95, 2.6, 3.7, 4.4, 5.1, 5.85]) {
    const p = rim(a, 18);
    up('sconce', p, { angle: (a * 180) / Math.PI + 90 });
    light(p, 96, 0xff9a40, { flicker: 0.16 });
  }
  for (let k = 0; k < 9; k++) {
    const a = R() * Math.PI * 2;
    const d = 0.45 + R() * 0.4;
    decal(`sigil${k % 3}`, rim(a, (1 - d) * RY * T), { angle: R() * 360, alpha: 0.6 });
  }
  for (const [x, y] of [
    [12, 16],
    [24, 7.5],
    [21.5, 19],
  ] as const) {
    decal('skull', P(x, y), { angle: R() * 360 });
  }
  for (let k = 0; k < 6; k++) {
    const p = rim(R() * Math.PI * 2, 40 + R() * 60);
    decals.push({ frame: 'bones', ...p, angle: R() * 360, depth: -48 });
  }
  for (const a of [0.7, 2.3, 3.95, 5.5]) {
    decal('cobweb', rim(a, 22), { angle: (a * 180) / Math.PI + 135, alpha: 0.7 });
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + R() * 0.3;
    const p = { x: mid.x + Math.cos(a) * 5.4 * T, y: mid.y + Math.sin(a) * 4.5 * T };
    decal('wax', p, { angle: R() * 360 });
  }

  return {
    realm: 'cellar',
    w: CW,
    h: CH,
    ground,
    block,
    town: new Uint8Array(N),
    objects,
    decals,
    lights,
    spawn: foot,
    life: { buildings: [], festoons: [], spots: [] },
    portals: [
      {
        ...P(5.5, 13),
        to: 'upper',
        exit: upperHatch(),
        label: 'Climb up to the shed',
        fade: 'dark',
      },
      {
        ...mid,
        to: 'lower',
        exit: lowerMirror(),
        label: 'Step into the mirror',
        fade: 'glint',
      },
    ],
    sails: [],
    walls,
    patches,
    things,
  };
}
