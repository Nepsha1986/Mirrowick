import { T, TL, TOWN, mulberry32, type Pt } from './util';
import type { Light, WorldObject } from './world';

export type RoofKind = 'tiles' | 'slate' | 'thatch' | 'shingle' | 'mill';

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
}

/** A string of little lights hung between two points (world pixels). */
export interface Festoon {
  a: Pt;
  b: Pt;
}

export interface TownLife {
  buildings: Building[];
  festoons: Festoon[];
  /** Where villagers like to stand about (world pixels). */
  spots: Pt[];
  /** The chicken run (tiles). */
  coop?: { x0: number; y0: number; x1: number; y1: number };
  /** Spark and smoke sources (world pixels). */
  forge?: Pt;
}

interface Grid {
  ground: Uint8Array;
  block: Uint8Array;
  objects: WorldObject[];
  decals: WorldObject[];
  lights: Light[];
}

const WARM = 0xffb860;
const W = 100;

/**
 * Mirrowick inside the palisade: a tavern, a chapel, a smithy and a house
 * you can walk into, a mosaic square around the Wick, market stalls, a beer
 * garden under strings of lights, a vegetable plot, watchtowers and gate
 * lanterns.
 */
export function buildTown(g: Grid): TownLife {
  const R = mulberry32(2024);
  const I = (x: number, y: number) => y * W + x;
  const C = (x: number, y: number): Pt => ({ x: (x + 0.5) * T, y: (y + 0.5) * T });
  const set = (x: number, y: number, tile: number, solid = 0) => {
    g.ground[I(x, y)] = tile;
    g.block[I(x, y)] = solid;
  };
  const obj = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) => {
    g.objects.push({ key: 'ln-town', frame, ...C(x, y), ...o });
  };
  const decal = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) => {
    g.decals.push({ key: 'ln-town', frame, ...C(x, y), ...o });
  };
  const solid = (x: number, y: number) => (g.block[I(x, y)] = 1);
  const light = (p: Pt, radius: number, color = WARM, flicker = 0.06) =>
    g.lights.push({ ...p, radius, color, flicker });

  // Ground: packed earth yards, cobbled streets in three wears, a round square.
  const pave = () => [TL.PAVE, TL.PAVE2, TL.PAVE3][Math.floor(R() * 3)] as number;
  for (let y = TOWN.y0 + 1; y < TOWN.y1; y++) {
    for (let x = TOWN.x0 + 1; x < TOWN.x1; x++) {
      const street = x === 49 || x === 50 || y === 39 || y === 40;
      const square = Math.hypot(x + 0.5 - 50, y + 0.5 - 40) < 3.7;
      set(x, y, street || square ? pave() : TL.EARTH);
    }
  }
  decal('plaza', 49.5, 39.5, { depth: -60 });
  for (let x = 40; x <= 46; x++) for (let y = 37; y <= 38; y++) set(x, y, TL.FLAG);
  for (let x = 51; x <= 53; x++) for (let y = 32; y <= 37; y++) set(x, y, TL.G2);
  for (let x = 56; x <= 60; x++) for (let y = 38; y <= 38; y++) set(x, y, TL.G1);
  for (let x = 39; x <= 39; x++) for (let y = 41; y <= 47; y++) set(x, y, TL.G1);

  // Buildings: walls on the rim, a floor inside, door gaps.
  const buildings: Building[] = [];
  const building = (
    b: Building,
    wall: number,
    floor: (x: number, y: number) => number,
    doors: [number, number][],
  ) => {
    for (let y = b.y0; y < b.y0 + b.h; y++) {
      for (let x = b.x0; x < b.x0 + b.w; x++) {
        const rim = x === b.x0 || y === b.y0 || x === b.x0 + b.w - 1 || y === b.y0 + b.h - 1;
        set(x, y, rim ? wall : floor(x, y), rim ? 1 : 0);
      }
    }
    for (const [x, y] of doors) set(x, y, floor(x, y));
    buildings.push(b);
    // The room's own light, shown when you step inside.
    g.lights.push({
      x: (b.x0 + b.w / 2) * T,
      y: (b.y0 + b.h / 2) * T,
      radius: Math.max(b.w, b.h) * T * 0.75,
      color: b.roof === 'slate' ? 0xd8c8ff : WARM,
      flicker: 0.03,
      room: buildings.length - 1,
    });
  };

  // The tavern, the Crooked Wick: wide planks, a bar, a hearth, a rug.
  building(
    {
      name: 'The Crooked Wick',
      x0: 40,
      y0: 32,
      w: 7,
      h: 5,
      roof: 'tiles',
      chimneys: [{ x: 5.4, y: 1 }],
    },
    TL.TIMBER,
    (_x, y) => (y % 2 ? TL.PLANK : TL.PLANK2),
    [[43, 36]],
  );
  obj('counter', 41.5, 33, { depth: 33.9 * T });
  solid(41, 33);
  solid(42, 33);
  obj('hearth', 45, 33);
  solid(45, 33);
  light(C(45, 33.3), 120, 0xff8a3a, 0.14);
  decal('rugRed', 43, 34.2, { depth: -45 });
  for (const x of [41, 45]) {
    obj('table', x, 35);
    solid(x, 35);
    light(C(x, 35), 42, WARM, 0.1);
  }
  obj('kegs', 44, 33);
  solid(44, 33);
  obj('sign', 43.6, 37.1, { depth: 37.6 * T });
  for (const x of [41.5, 45.5]) light({ x: x * T, y: 37 * T + 2 }, 64);

  // The beer garden outside it, under a string of lights.
  for (const x of [41, 44]) {
    obj('ptable', x, 38);
    solid(x, 38);
  }
  obj('flowers', 46, 38);
  const festoons: Festoon[] = [
    { a: { x: 40 * T + 4, y: 37 * T + 2 }, b: { x: 47 * T - 4, y: 37 * T + 2 } },
    { a: { x: 47 * T, y: 32.4 * T }, b: { x: 54 * T, y: 32.4 * T } },
  ];

  // The chapel: chequered stone, pews, a red runner, an altar of candles.
  building(
    { name: 'Chapel of St Ives', x0: 54, y0: 32, w: 6, h: 6, roof: 'slate', chimneys: [] },
    TL.ASHLAR,
    (x, y) => (x >= 56 && x <= 57 && y >= 34 ? TL.CARPET : TL.CHECKER),
    [
      [56, 37],
      [57, 37],
    ],
  );
  obj('altar', 56.5, 33);
  solid(56, 33);
  solid(57, 33);
  for (const x of [55.5, 57.5]) light(C(x, 33), 46, 0xffd28a, 0.12);
  for (const [x, y] of [
    [55, 34],
    [58, 34],
    [55, 35],
    [58, 35],
  ] as const) {
    obj('pew', x, y);
    solid(x, y);
  }
  // Stained glass throws coloured light on the floor.
  light(C(55, 34.5), 52, 0xa070ff, 0.04);
  light(C(58, 34.5), 52, 0x6ca0ff, 0.04);
  light(C(56.5, 36), 46, 0xff6a5a, 0.04);

  // The chapel garden: a well, a tree, flowers, a bench.
  g.objects.push({ frame: 'well', ...C(52, 34) });
  solid(52, 34);
  g.objects.push({ frame: 'tree', ...C(51, 32), scale: 0.8, depth: 33 * T });
  solid(51, 32);
  for (const [x, y] of [
    [53, 32],
    [51, 36],
    [53, 36],
  ] as const) {
    obj('flowers', x, y);
  }

  // The smithy: flagstones, forge, anvil, a rack of tools; open to the east.
  building(
    { name: 'Smithy', x0: 40, y0: 43, w: 5, h: 4, roof: 'thatch', chimneys: [{ x: 1.5, y: 1.4 }] },
    TL.WALL,
    () => TL.FLAG,
    [
      [44, 44],
      [44, 45],
    ],
  );
  obj('forge', 41, 44);
  solid(41, 44);
  light(C(41, 44), 110, 0xff7a2a, 0.18);
  obj('anvil', 42, 45);
  solid(42, 45);
  obj('rack', 43, 44);
  solid(43, 44);
  obj('crateStack', 45, 47);
  solid(45, 47);

  // A house: herringbone parquet, a bed, a bookcase, a table, a rug.
  building(
    { name: 'House', x0: 55, y0: 43, w: 5, h: 4, roof: 'shingle', chimneys: [{ x: 4, y: 0.9 }] },
    TL.TIMBER,
    () => TL.PARQUET,
    [[57, 43]],
  );
  decal('rugRound', 57, 44.6, { depth: -45 });
  obj('bed', 58, 44.5);
  solid(58, 44);
  solid(58, 45);
  obj('bookcase', 56, 44);
  solid(56, 44);
  obj('stable', 56, 45);
  solid(56, 45);
  light(C(56, 45), 48, WARM, 0.1);
  light({ x: 55 * T - 2, y: 44.5 * T }, 60);

  // The market: two stalls with striped awnings.
  obj('stallRed', 52.5, 43);
  obj('stallGreen', 52.5, 45.2);
  for (const [x, y] of [
    [52, 43],
    [53, 43],
    [52, 45],
    [53, 45],
  ] as const) {
    solid(x, y);
  }
  obj('baskets', 54, 44);
  solid(54, 44);

  // The vegetable plot and its scarecrow, next to the chicken run.
  for (let x = 45; x <= 47; x++) for (let y = 44; y <= 46; y++) set(x, y, TL.SOIL);
  for (let x = 45; x <= 47; x++) {
    for (const y of [44, 45, 46])
      if (!(x === 46 && y === 45)) decal('cabbage', x, y, { depth: -45 });
  }
  obj('scarecrow', 46, 45);
  solid(46, 45);

  // The square: the Wick, benches, lamps.
  solid(49, 39);
  solid(50, 39);
  solid(49, 40);
  solid(50, 40);
  for (const [x, y] of [
    [48, 36],
    [51, 36],
    [48, 43],
    [51, 43],
  ] as const) {
    obj('bench', x, y);
    solid(x, y);
  }
  for (const [x, y] of [
    [47, 37],
    [52, 37],
    [47, 42],
    [52, 41],
  ] as const) {
    g.objects.push({ frame: 'lamp', ...C(x, y) });
    solid(x, y);
    light(C(x, y), 120, WARM, 0.05);
  }

  // Trees in the yards; barrels and crates where people work.
  for (const [x, y] of [
    [39, 42],
    [60, 41],
    [60, 34],
    [39, 35],
  ] as const) {
    g.objects.push({
      frame: R() < 0.5 ? 'tree' : 'tree2',
      ...C(x, y),
      scale: 0.75,
      depth: (y + 1) * T,
    });
    solid(x, y);
  }
  for (const [x, y, f] of [
    [40, 47, 'barrel'],
    [41, 47, 'barrel'],
    [60, 47, 'crate'],
    [47, 33, 'barrel'],
  ] as const) {
    g.objects.push({ frame: f, ...C(x, y), angle: R() * 360 });
    solid(x, y);
  }

  // The palisade: watchtowers on the corners, lanterns at every gate.
  for (const [x, y] of [
    [TOWN.x0, TOWN.y0],
    [TOWN.x1, TOWN.y0],
    [TOWN.x0, TOWN.y1],
    [TOWN.x1, TOWN.y1],
  ] as const) {
    obj('tower', x, y, { depth: 50_000 });
    light(C(x, y), 90, 0xffa050, 0.12);
  }
  for (const [x, y] of [
    [48, TOWN.y0],
    [51, TOWN.y0],
    [48, TOWN.y1],
    [51, TOWN.y1],
    [TOWN.x0, 38],
    [TOWN.x0, 41],
    [TOWN.x1, 38],
    [TOWN.x1, 41],
  ] as const) {
    obj('gatelamp', x, y, { depth: 40_000 });
    light(C(x, y), 80, WARM, 0.08);
  }

  return {
    buildings,
    festoons,
    spots: [C(47, 39), C(52, 40), C(43, 38), C(55, 39), C(50, 44), C(45, 41), C(53, 42), C(50, 35)],
    coop: { x0: 44, y0: 41, x1: 48, y1: 43 },
    forge: C(41, 44),
  };
}
