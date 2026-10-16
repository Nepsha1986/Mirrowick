import { buildTown, type TownLife } from './town';
import { H, MIRROR, T, TL, TOWN, W, brookY, makeNoise, mulberry32, riverX, type Pt } from './util';

export interface WorldObject extends Pt {
  /** Texture key; defaults to the main atlas. */
  key?: string;
  frame: string;
  /** Sort depth; defaults to y. */
  depth?: number;
  angle?: number;
  scale?: number;
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

export interface World {
  ground: Uint8Array;
  /** 0 walkable, 1 solid, 2 water. */
  block: Uint8Array;
  town: Uint8Array;
  objects: WorldObject[];
  decals: WorldObject[];
  lights: Light[];
  /** The Wick: the great candle in the middle of the village. */
  wick: Pt;
  spawn: Pt;
  life: TownLife;
}

const GLASS = 0x9fd8e6;

/**
 * The Lower World around Mirrowick, generated from a fixed seed: the village
 * behind its palisade, roads, a river and a brook, ruined hamlets, the
 * forest, and the Mirror — a lake of black glass where the worlds touch.
 */
export function generateWorld(): World {
  const R = mulberry32(1337);
  const n1 = makeNoise(7);
  const n2 = makeNoise(99);
  const n3 = makeNoise(512);
  const N = W * H;
  const ground = new Uint8Array(N);
  const block = new Uint8Array(N);
  const town = new Uint8Array(N);
  const clear = new Uint8Array(N);
  const objects: WorldObject[] = [];
  const decals: WorldObject[] = [];
  const lights: Light[] = [];
  const I = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const C = (x: number, y: number) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T });
  const isRoad = (i: number) => ground[i] === TL.ROAD || ground[i] === TL.ROADC;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = n1(x * 0.08, y * 0.08) + 0.5 * n2(x * 0.2, y * 0.2);
      ground[I(x, y)] = v < 0.6 ? TL.G1 : v < 0.95 ? TL.G2 : TL.G3;
    }
  }

  // The village: cobbles inside a palisade with four gates.
  for (let y = TOWN.y0; y <= TOWN.y1; y++) {
    for (let x = TOWN.x0; x <= TOWN.x1; x++) {
      const i = I(x, y);
      town[i] = 1;
      clear[i] = 1;
      const edge = x === TOWN.x0 || x === TOWN.x1 || y === TOWN.y0 || y === TOWN.y1;
      ground[i] = edge ? TL.TWALL : TL.PAVE;
      block[i] = edge ? 1 : 0;
    }
  }
  for (const [x, y] of [
    [49, TOWN.y0],
    [50, TOWN.y0],
    [49, TOWN.y1],
    [50, TOWN.y1],
    [TOWN.x0, 39],
    [TOWN.x0, 40],
    [TOWN.x1, 39],
    [TOWN.x1, 40],
  ] as const) {
    ground[I(x, y)] = TL.GATE;
    block[I(x, y)] = 0;
  }
  for (let y = TOWN.y0 - 3; y <= TOWN.y1 + 3; y++) {
    for (let x = TOWN.x0 - 3; x <= TOWN.x1 + 3; x++) if (inb(x, y)) clear[I(x, y)] = 1;
  }

  // Cart roads out of every gate, and footpaths.
  const road = (x: number, y: number) => {
    if (!inb(x, y) || town[I(x, y)]) return;
    const i = I(x, y);
    ground[i] = R() < 0.2 ? TL.ROADC : TL.ROAD;
    clear[i] = 1;
    block[i] = 0;
  };
  for (let y = 0; y < TOWN.y0; y++) {
    road(49, y);
    road(50, y);
  }
  for (let y = TOWN.y1 + 1; y < H; y++) {
    road(49, y);
    road(50, y);
  }
  for (let x = 0; x < TOWN.x0; x++) {
    road(x, 39);
    road(x, 40);
  }
  for (let x = TOWN.x1 + 1; x < W; x++) {
    road(x, 39);
    road(x, 40);
  }
  const path = (x0: number, y0: number, x1: number, y1: number) => {
    let x = x0;
    let y = y0;
    const step = () => {
      const i = I(x, y);
      if (!isRoad(i)) ground[i] = TL.DIRT;
      clear[i] = 1;
    };
    step();
    while (x !== x1) {
      x += Math.sign(x1 - x);
      step();
    }
    while (y !== y1) {
      y += Math.sign(y1 - y);
      step();
    }
  };
  path(9, 41, 9, 44);
  path(78, 41, 78, 43);
  path(73, 41, 73, 49);
  path(51, 13, 52, 13);
  path(31, 40, 31, 53);

  // A river runs north–south, a brook joins it from the east.
  const water = (x: number, y: number) => {
    if (!inb(x, y) || town[I(x, y)]) return;
    const i = I(x, y);
    if (isRoad(i) || ground[i] === TL.BRIDGE) {
      ground[i] = TL.BRIDGE;
      block[i] = 0;
    } else {
      ground[i] = TL.WATER;
      block[i] = 2;
    }
    clear[i] = 1;
  };
  for (let y = 0; y < H; y++) {
    const a = riverX(y);
    const b = y ? riverX(y - 1) : a;
    for (let x = Math.min(a, b) - 1; x <= Math.max(a, b) + 1; x++) water(x, y);
  }
  for (let x = riverX(66); x < W; x++) {
    const a = brookY(x);
    const b = brookY(x - 1);
    for (let y = Math.min(a, b) - 1; y <= Math.max(a, b) + 1; y++) water(x, y);
  }
  const bridgeRow = (y: number, broken: boolean) => {
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (ground[i] === TL.WATER) {
        ground[i] = TL.BRIDGE;
        block[i] = 0;
      }
    }
    if (broken) {
      const bx = riverX(y);
      for (const x of [bx, bx + 1]) {
        ground[I(x, y)] = TL.BBRIDGE;
        block[I(x, y)] = 2;
      }
    }
  };
  bridgeRow(56, false);
  bridgeRow(57, false);
  bridgeRow(14, true);
  bridgeRow(15, true);
  for (let y = 55; y < H; y++) {
    for (const x of [86, 87]) {
      const i = I(x, y);
      if (ground[i] === TL.WATER) {
        ground[i] = TL.BRIDGE;
        block[i] = 0;
      }
    }
  }
  // Pale sand along the banks.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ground[I(x, y)] !== TL.WATER) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (inb(nx, ny) && (ground[I(nx, ny)] as number) <= TL.G3) ground[I(nx, ny)] = TL.SAND;
        }
      }
    }
  }

  // The Mirror: a ragged disc of black glass with shards standing in it.
  const { x: MX, y: MY } = MIRROR;
  for (let y = MY - 11; y <= MY + 11; y++) {
    for (let x = MX - 11; x <= MX + 11; x++) {
      if (!inb(x, y)) continue;
      const d = Math.hypot(x - MX, y - MY) + n3(x * 0.4, y * 0.4) * 2.2;
      const i = I(x, y);
      if (d < 9.5 && block[i] === 0 && !isRoad(i)) {
        ground[i] = TL.GLASS;
        clear[i] = 1;
      }
    }
  }
  const freeT = (x: number, y: number) =>
    inb(x, y) && block[I(x, y)] === 0 && !isRoad(I(x, y)) && !town[I(x, y)];
  for (let n = 0, tries = 0; n < 18 && tries < 400; tries++) {
    const a = R() * 6.28;
    const d = 2 + R() * 8;
    const x = Math.round(MX + Math.cos(a) * d);
    const y = Math.round(MY + Math.sin(a) * d);
    if (!freeT(x, y)) continue;
    block[I(x, y)] = 1;
    const s = 0.8 + R() * 0.6;
    const p = C(x, y);
    objects.push({ frame: 'shard', x: p.x, y: p.y - 6, depth: p.y + 8, scale: s });
    lights.push({ ...p, radius: 70 * s, flicker: 0.15, slow: true, color: GLASS });
    n++;
  }

  // Ruined houses: broken stone walls around a plank floor.
  const house = (x0: number, y0: number, w: number, h: number, broken = 0.22) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = I(x, y);
        clear[i] = 1;
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        if (edge && R() >= broken) {
          ground[i] = TL.WALL;
          block[i] = 1;
        } else {
          ground[i] = TL.FLOOR;
          block[i] = 0;
          if (edge && R() < 0.7) decals.push({ frame: 'debris', ...C(x, y), angle: R() * 360 });
        }
      }
    }
    const dx = x0 + Math.floor(w / 2);
    const dy = y0 + h - 1;
    ground[I(dx, dy)] = TL.FLOOR;
    block[I(dx, dy)] = 0;
    for (let n = 0; n < 2; n++) {
      const x = x0 + 1 + Math.floor(R() * (w - 2));
      const y = y0 + 1 + Math.floor(R() * (h - 2));
      if (block[I(x, y)] || (x === dx && y === dy - 1)) continue;
      block[I(x, y)] = 1;
      objects.push({ frame: R() < 0.5 ? 'crate' : 'barrel', ...C(x, y) });
    }
    for (let n = 0; n < 2; n++) {
      if (R() < 0.5) {
        decals.push({
          frame: R() < 0.5 ? 'debris' : 'bones',
          x: (x0 + R() * w) * T,
          y: (y0 + h + R() * 1.5) * T,
          angle: R() * 360,
        });
      }
    }
  };
  house(3, 41, 6, 5);
  house(10, 42, 4, 4);
  house(4, 47, 8, 4, 0.4);
  house(53, 9, 6, 4);
  house(73, 42, 6, 5);
  house(81, 43, 4, 4);
  house(65, 50, 5, 4);
  house(71, 48, 5, 5);
  house(78, 49, 6, 4);
  house(67, 55, 4, 4);
  house(75, 55, 5, 4, 0.45);
  house(28, 52, 5, 5);

  // Landmarks: the coaching inn's well, the charcoal burners' logs, the mill wheel.
  const solid = (frame: string, x: number, y: number, extra: Partial<WorldObject> = {}) => {
    if (block[I(x, y)]) return;
    block[I(x, y)] = 1;
    clear[I(x, y)] = 1;
    objects.push({ frame, ...C(x, y), ...extra });
  };
  solid('well', 55, 15);
  for (const [x, y] of [
    [80, 41],
    [84, 48],
    [72, 47],
  ] as const) {
    solid('logs', x, y, { angle: R() < 0.5 ? 0 : 90 });
  }
  solid('wheel', 26, 54);

  // Inside the palisade: the village and the Wick in its square.
  const life = buildTown({ ground, block, objects, decals, lights });
  const wick = { x: 50 * T, y: 40 * T };
  objects.push({ frame: 'wick', ...wick });
  lights.push({ ...wick, radius: 230, flicker: 0.1, color: 0xff9a40 });

  // Keep vegetation off cleared ground.
  const near = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!clear[I(x, y)]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) if (inb(x + dx, y + dy)) near[I(x + dx, y + dy)] = 1;
      }
    }
  }
  // Abandoned carts along the roads.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (!isRoad(i) || R() >= 0.022) continue;
      if (Math.hypot(x - TOWN.cx, y - TOWN.cy) < 18) continue;
      block[i] = 1;
      const vertical = x === 49 || x === 50;
      objects.push({ frame: 'cart', ...C(x, y), angle: (vertical ? 90 : 0) + (R() - 0.5) * 30 });
    }
  }
  // Forest, rocks, grass, bones.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (block[i] || near[i] || (ground[i] as number) > TL.G3) continue;
      const d = n2(x * 0.06 + 50, y * 0.06 + 20) + 0.25 * n1(x * 0.3, y * 0.3);
      const p = d > 0.6 ? 0.42 : d > 0.48 ? 0.12 : 0.02;
      if (R() < p) {
        block[i] = 1;
        const dead = R() < 0.2;
        objects.push({
          frame: dead ? 'dead' : R() < 0.5 ? 'tree' : 'tree2',
          x: (x + 0.5) * T + (R() - 0.5) * 6,
          y: (y + 0.5) * T + (R() - 0.5) * 6,
          angle: R() * 360,
          scale: 0.85 + R() * 0.35,
          depth: (y + 0.5) * T + 14,
        });
        continue;
      }
      if (R() < 0.012) {
        block[i] = 1;
        objects.push({ frame: R() < 0.5 ? 'rock' : 'rock2', ...C(x, y), angle: R() * 360 });
        continue;
      }
      if (R() < 0.05) decals.push({ frame: 'tuft', ...C(x, y), angle: R() * 360 });
      else if (R() < 0.004) decals.push({ frame: 'bones', ...C(x, y), angle: R() * 360 });
    }
  }

  return {
    ground,
    block,
    town,
    objects,
    decals,
    lights,
    wick,
    spawn: { x: 50 * T, y: 43.5 * T },
    life,
  };
}
