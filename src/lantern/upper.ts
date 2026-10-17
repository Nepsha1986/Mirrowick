import {
  MILL_FLOOR,
  MILL_HALF,
  cellarStairs,
  millCentre,
  millTiles,
  millWall,
  upperHatch,
  wallTiles,
} from './mill';
import type { Building } from './town';
import { T, TL, UH, UPPER_MILL, UW, makeNoise, mulberry32, type Pt } from './util';
import {
  GLASS,
  type GroundPatch,
  type Light,
  type Thing,
  type ThinWall,
  type World,
  type WorldObject,
} from './world';

const WARM = 0xffc070;
const LAMP = 0xfff0c8;
/** Wall thickness in pixels: the house's outer walls and its partitions. */
const OUTER = 11;
const INNER = 6;

/**
 * The Upper World, for now one homestead on a country road: Uncle Victor's house
 * with a kitchen, a living room, a bedroom, a hall and a bathroom, a car in
 * the drive, a garden — and up the lane the old windmill, long fallen in.
 * In its floor lies a cracked mirror that leads down to the Lower World.
 */
export function generateUpperWorld(): World {
  const R = mulberry32(4242);
  const n1 = makeNoise(21);
  const n2 = makeNoise(63);
  const N = UW * UH;
  const ground = new Uint8Array(N);
  const block = new Uint8Array(N);
  const clear = new Uint8Array(N);
  const objects: WorldObject[] = [];
  const decals: WorldObject[] = [];
  const lights: Light[] = [];
  const I = (x: number, y: number) => y * UW + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < UW && y < UH;
  const C = (x: number, y: number): Pt => ({ x: (x + 0.5) * T, y: (y + 0.5) * T });
  const set = (x: number, y: number, tile: number, solid = 0) => {
    ground[I(x, y)] = tile;
    block[I(x, y)] = solid;
    clear[I(x, y)] = 1;
  };
  const solid = (x: number, y: number) => {
    block[I(x, y)] = 1;
    clear[I(x, y)] = 1;
  };
  const obj = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) =>
    objects.push({ key: 'ln-up', frame, ...C(x, y), ...o });
  const decal = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) =>
    decals.push({ key: 'ln-up', frame, ...C(x, y), depth: -45, ...o });
  const light = (p: Pt, radius: number, color = WARM, o: Partial<Light> = {}) =>
    lights.push({ ...p, radius, color, flicker: 0.02, ...o });
  const walls: ThinWall[] = [];
  const things: Thing[] = [];
  const patches: GroundPatch[] = [];
  const P = (x: number, y: number): Pt => ({ x: x * T, y: y * T });
  /** Keeps trees off a rectangle of tiles without changing the ground. */
  const keep = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) clear[I(x, y)] = 1;
  };

  // A green meadow.
  for (let y = 0; y < UH; y++) {
    for (let x = 0; x < UW; x++) {
      const v = n1(x * 0.12, y * 0.12) + 0.4 * n2(x * 0.3, y * 0.3);
      ground[I(x, y)] = v < 0.6 ? TL.UG1 : v < 0.95 ? TL.UG2 : TL.UG3;
    }
  }

  // A country road of packed earth and gravel along the south edge, a gravel
  // walk and drive, a dirt lane up to the mill and a footpath out the back.
  // They are painted over the grass, so their edges wander.
  keep(0, 26, UW - 1, 27);
  patches.push({ kind: 'gravel', width: 2.7 * T, pts: [P(25, 26.3), P(25.1, 21), P(24.9, 15.5)] });
  keep(24, 15, 26, 25);
  patches.push({
    kind: 'gravel',
    width: 1.5 * T,
    pts: [P(17, 19.3), P(16.95, 22.5), P(17.05, 26.3)],
  });
  keep(16, 19, 17, 25);
  patches.push({
    kind: 'dirt',
    width: 0.95 * T,
    pts: [P(26.3, 15.6), P(28.4, 15.4), P(30.5, 14.7), P(31.45, 13.4), P(31.5, 11.8)],
  });
  keep(27, 15, UPPER_MILL.x, 15);
  keep(UPPER_MILL.x, UPPER_MILL.y + MILL_HALF + 1, UPPER_MILL.x, 15);

  /**
   * Turns a building's wall tiles into thin walls along their middles, with
   * the floor on either side laid up to them, timber posts at the corners and
   * windows. A wall stops at a doorway's edge.
   */
  const thinWalls = (b: Building, wallT: Uint8Array, doors: readonly (readonly number[])[]) => {
    const bx1 = b.x0 + b.w - 1;
    const by1 = b.y0 + b.h - 1;
    const rimRow = (y: number) => y === b.y0 || y === by1;
    const rimCol = (x: number) => x === b.x0 || x === bx1;
    const isWall = (x: number, y: number) => inb(x, y) && wallT[I(x, y)] === 1;
    const isDoor = (x: number, y: number) => doors.some(([dx, dy]) => dx === x && dy === y);
    for (let y = b.y0; y <= by1; y++) {
      for (let x = b.x0; x <= bx1; x++) {
        if (!isWall(x, y)) continue;
        const cx = (x + 0.5) * T;
        const cy = (y + 0.5) * T;
        // The floor runs up to the wall from each side: each quarter of the
        // tile takes the floor next to it.
        for (const qx of [0, 1]) {
          for (const qy of [0, 1]) {
            const dx = qx ? 1 : -1;
            const dy = qy ? 1 : -1;
            const from = [
              [x + dx, y],
              [x, y + dy],
              [x + dx, y + dy],
            ].find(([fx = 0, fy = 0]) => !isWall(fx, fy) && !isDoor(fx, fy)) ?? [x, y];
            const tile = ground[I(from[0] as number, from[1] as number)] as number;
            if (tile === ground[I(x, y)]) continue;
            decals.push({
              key: 'ln-tiles',
              frame: `q${tile}-${qx}${qy}`,
              x: x * T + qx * 16 + 8,
              y: y * T + qy * 16 + 8,
              depth: -99,
              alpha: 1,
            });
          }
        }
        const around = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([dx, dy]) => isWall(x + (dx as number), y + (dy as number)));
        const t = rimRow(y) || rimCol(x) ? OUTER : INNER;
        walls.push({
          kind: t === OUTER ? 'outer' : 'inner',
          x: cx - t / 2,
          y: cy - t / 2,
          w: t,
          h: t,
        });
        // Timber posts where walls meet or turn.
        // Two walls in a straight line cancel out; a corner doesn't.
        let sx = 0;
        let sy = 0;
        for (const [dx = 0, dy = 0] of around) {
          sx += dx;
          sy += dy;
        }
        const straight = around.length === 2 && sx === 0 && sy === 0;
        if (around.length > 2 || (around.length === 2 && !straight)) {
          walls.push({ kind: 'post', x: cx - 7, y: cy - 7, w: 14, h: 14 });
        }
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          const horiz = dy === 0;
          const st = horiz ? (rimRow(y) ? OUTER : INNER) : rimCol(x) ? OUTER : INNER;
          const kind = st === OUTER ? 'outer' : 'inner';
          // To the next wall's middle (east and south only, so once), or to a door's edge.
          let len = 0;
          if (isWall(nx, ny) && (dx > 0 || dy > 0)) len = T;
          else if (isDoor(nx, ny)) len = T / 2;
          if (!len) continue;
          if (horiz) {
            const x0 = dx > 0 ? cx : cx - len;
            walls.push({ kind, x: x0, y: cy - st / 2, w: len, h: st });
          } else {
            const y0 = dy > 0 ? cy : cy - len;
            walls.push({ kind, x: cx - st / 2, y: y0, w: st, h: len });
          }
        }
      }
    }
  };

  /** A doorway in a thin wall: each half takes the floor of the room on its side. */
  const doorFloors = (doors: readonly (readonly number[])[], wallT: Uint8Array) => {
    for (const [x = 0, y = 0] of doors) {
      const vertical = wallT[I(x, y - 1)] === 1 || wallT[I(x, y + 1)] === 1;
      for (const qx of [0, 1]) {
        for (const qy of [0, 1]) {
          const [fx, fy] = vertical ? [x + (qx ? 1 : -1), y] : [x, y + (qy ? 1 : -1)];
          const tile = ground[I(fx, fy)] as number;
          if (tile === ground[I(x, y)]) continue;
          decals.push({
            key: 'ln-tiles',
            frame: `q${tile}-${qx}${qy}`,
            x: x * T + qx * 16 + 8,
            y: y * T + qy * 16 + 8,
            depth: -99,
            alpha: 1,
          });
        }
      }
    }
  };

  // --- The house -----------------------------------------------------------------------
  const house: Building = {
    name: 'Home',
    x0: 8,
    y0: 8,
    w: 15,
    h: 11,
    roof: 'tiles',
    chimneys: [{ x: 4.5, y: 1.4 }],
    porch: 9,
  };
  const floor = (x: number, y: number): number => {
    if (x <= 13 && y <= 12) return TL.CHECKER; // kitchen
    if (x <= 13) return TL.PLANK2; // bedroom
    if (y <= 13) return TL.PARQUET; // living room
    if (x >= 20) return TL.TILEW; // bathroom
    return TL.PLANK; // hall
  };
  const wallT = new Uint8Array(N);
  const x1 = house.x0 + house.w - 1;
  const y1 = house.y0 + house.h - 1;
  for (let y = house.y0; y <= y1; y++) {
    for (let x = house.x0; x <= x1; x++) {
      const rim = x === house.x0 || x === x1 || y === house.y0 || y === y1;
      const inner =
        x === 14 || (y === 13 && x <= 14) || (y === 14 && x >= 14) || (x === 19 && y >= 14);
      const wall = rim || inner;
      if (wall) {
        solid(x, y);
        wallT[I(x, y)] = 1;
      } else set(x, y, floor(x, y));
    }
  }
  // Doors: kitchen–living, bedroom–hall, living–hall, hall–bath, back and front.
  const doors = [
    [14, 10, TL.PARQUET],
    [14, 16, TL.PLANK],
    [17, 14, TL.PLANK],
    [19, 16, TL.TILEW],
    [11, 8, TL.CHECKER],
    [16, 18, TL.PLANK],
    [17, 18, TL.PLANK],
  ] as const;
  for (const [x, y, f] of doors) {
    set(x, y, f);
    wallT[I(x, y)] = 0;
  }
  thinWalls(house, wallT, doors);
  doorFloors(doors, wallT);
  const room = 0;
  const lamp = (p: Pt, radius: number, color = WARM) => light(p, radius, color, { room });

  // Kitchen: worktop and sink, cooker, fridge, a table for four.
  obj('kcounter', 9.5, 9);
  solid(9, 9);
  solid(10, 9);
  obj('stove', 12, 9);
  solid(12, 9);
  obj('fridge', 13, 9);
  solid(13, 9);
  obj('ktable', 11, 11);
  solid(11, 11);
  lamp(C(11, 10.5), 110);

  // Living room: sofa facing the telly, a rug, the computer in the corner.
  decal('rugBlue', 18, 10.6);
  obj('sofa', 18, 12);
  for (const x of [17, 18, 19]) solid(x, 12);
  things.push({
    id: 'tv',
    key: 'ln-up',
    frame: 'tv',
    ...C(18, 9),
    label: 'Turn on the TV',
    on: { frame: 'tvOn', label: 'Turn off the TV' },
  });
  for (const x of [17, 18, 19]) solid(x, 9);
  obj('desk', 21, 10.5, { y: 11 * T });
  solid(21, 10);
  solid(21, 11);
  obj('chair', 20, 10.5, { y: 11 * T, depth: 11 * T - 4 });
  obj('plant', 15, 9);
  solid(15, 9);
  obj('floorlamp', 21, 13);
  solid(21, 13);
  lamp(C(18, 11), 150);
  light(C(18, 9.8), 90, 0x8ab8ff, { room, thing: 'tv', flicker: 0.16 });
  lamp(C(20.6, 10.5), 40, 0xa8d8ff);

  // Hall: a mat at the door, Victor's coat still on the stand, a plant.
  // The front door stands ajar, as Pete found it.
  decal('doormat', 16.5, 17);
  obj('frontdoor', 16, 18, { x: 16 * T + 15, y: 18.5 * T - 24, angle: -62 });
  things.push({
    id: 'coat',
    key: 'ln-up',
    frame: 'coatrack',
    ...C(15, 15),
    label: "Check Victor's coat",
    hoard: {
      place: 'In the coat pockets',
      items: [],
      junk: ['a bus ticket', 'a handkerchief', 'some loose change'],
    },
  });
  solid(15, 15);
  obj('plant', 15, 17);
  solid(15, 17);
  lamp(C(16.5, 16), 80);

  // Bathroom: tub, basin, loo.
  obj('bathtub', 21, 16);
  for (const y of [15, 16, 17]) solid(21, y);
  obj('bsink', 20, 15);
  solid(20, 15);
  obj('toilet', 20, 17);
  solid(20, 17);
  lamp(C(20.5, 16), 60, 0xf0f4ff);

  // Bedroom: bed, bedside table, wardrobe, a rug.
  decal('rugBed', 11.5, 16);
  objects.push({ key: 'ln-town', frame: 'bed', x: 9.5 * T, y: 16 * T });
  solid(9, 15);
  solid(9, 16);
  solid(9, 14);
  // Victor's bedside table: a drawer of odds and ends, the flashlight and
  // the key to the mill's hatch among them. You leave them until you need them.
  things.push({
    id: 'nightstand',
    key: 'ln-town',
    frame: 'stable',
    ...C(9, 14),
    scale: 0.7,
    label: 'Look in the bedside table',
    hoard: {
      place: 'In the drawer',
      items: ['flashlight', 'cellar-key'],
      junk: ['a tangle of chargers', 'old receipts', 'a dead watch', 'reading glasses'],
    },
  });
  things.push({
    id: 'wardrobe',
    key: 'ln-up',
    frame: 'wardrobe',
    ...C(12, 14),
    x: 12 * T,
    label: 'Look in the wardrobe',
    hoard: {
      place: 'In the wardrobe',
      items: [],
      junk: ['shirts', 'a moth-eaten jumper', 'a box of old bills'],
    },
  });
  solid(11, 14);
  solid(12, 14);
  lamp(C(11, 15.5), 100);
  lamp(C(9, 14), 40);

  // Light from the windows at night and a lamp over the front door.
  for (const [x, y] of [
    [11, 19.5],
    [20.5, 19.5],
    [18, 6.5],
    [6.5, 10.5],
    [6.5, 15.5],
    [23.5, 11],
  ] as const) {
    light(C(x, y), 40, WARM);
  }
  for (const [x, y] of [
    [11, 18],
    [20, 18],
    [10, 8],
    [18, 8],
    [8, 10],
    [8, 15],
    [22, 11],
  ] as const) {
    const along = y === 8 || y === 18;
    const cx = (x + 0.5) * T;
    const cy = (y + 0.5) * T;
    walls.push(
      along
        ? { kind: 'window', x: cx - 11, y: cy - OUTER / 2, w: 22, h: OUTER }
        : { kind: 'window', x: cx - OUTER / 2, y: cy - 11, w: OUTER, h: 22 },
    );
  }
  // The front door: a step, a lamp on a green porch canopy (painted with the
  // roof) and a mat on the gravel, so you can tell the way in from the road.
  decal('step', 16.5, 18.9);
  decal('porchmat', 16.5, 19.7, { angle: 3, alpha: 1 });
  light({ x: 17 * T, y: 19.9 * T }, 60, LAMP);

  // --- The yard ------------------------------------------------------------------------
  // Your car in the drive, parked a little askew.
  objects.push({ key: 'ln-up', frame: 'car', x: 25.15 * T, y: 19 * T, angle: -6, depth: 20.8 * T });
  for (let y = 17; y <= 20; y++) for (const x of [24, 25]) solid(x, y);

  // A picket fence along the road, with gaps for the walk and the drive.
  for (const [a, b] of [
    [3, 15],
    [18, 23],
    [27, 29],
  ] as const) {
    const y = 24.5 * T;
    walls.push({ kind: 'fence', x: a * T + 4, y: y - 3, w: (b - a + 1) * T - 8, h: 6 });
    for (let x = a; x <= b; x++) solid(x, 24);
    for (let x = a; x <= b + 1; x += 3) {
      const px = Math.min(x, b + 1) * T + (x === a ? 4 : x > b ? -4 : 0);
      walls.push({ kind: 'post', x: px - 3.5, y: y - 3.5, w: 7, h: 7 });
    }
    walls.push({ kind: 'post', x: (b + 1) * T - 7.5, y: y - 3.5, w: 7, h: 7 });
  }
  things.push({
    id: 'mailbox',
    key: 'ln-up',
    frame: 'mailbox',
    ...C(18, 25),
    label: 'Open the mailbox',
  });
  solid(18, 25);
  for (const x of [12, 29]) {
    obj('streetlamp', x, 25);
    solid(x, 25);
    light(C(x, 25), 140, LAMP, { flicker: 0.01 });
  }

  // Flowers under the front windows; vegetable beds and a bench out the back.
  for (const x of [9, 10, 11, 12, 13, 19, 20, 21]) {
    if (x === 12) continue;
    obj('flowerbed', x + (R() - 0.5) * 0.15, 19 + (R() - 0.3) * 0.2, {
      depth: 19 * T,
      angle: (R() - 0.5) * 8,
    });
    solid(x, 19);
  }
  for (const x0 of [8, 12]) {
    patches.push({ kind: 'soil', width: 3 * T, pts: [P(x0, 4.5), P(x0 + 3, 4.5)] });
  }
  patches.push({ kind: 'dirt', width: 0.85 * T, pts: [P(11.5, 7.9), P(11.45, 6.4), P(11.6, 2.6)] });
  keep(8, 2, 14, 7);
  for (let x = 8; x <= 14; x++) {
    for (let y = 3; y <= 5; y++) {
      if (x === 11 || R() < 0.12) continue;
      decals.push({
        key: 'ln-town',
        frame: 'cabbage',
        x: (x + 0.5) * T + (R() - 0.5) * 7,
        y: (y + 0.5) * T + (R() - 0.5) * 7,
        scale: 0.8 + R() * 0.4,
        angle: R() * 360,
        depth: -45,
      });
    }
  }
  objects.push({ key: 'ln-town', frame: 'bench', ...C(16, 4) });
  solid(16, 4);
  for (const [x, y] of [
    [4, 5],
    [20, 3],
    [4, 13],
    [36, 19],
    [33, 21],
    [19, 22],
  ] as const) {
    obj('appletree', x, y, { depth: (y + 1) * T, angle: R() * 360 });
    solid(x, y);
  }

  // The road goes on last, over the ends of the walk and the drive.
  const road: Pt[] = [];
  for (let x = -1; x <= UW + 1; x += 2) road.push(P(x, 27 + Math.sin(x * 0.21) * 0.18));
  patches.push({ kind: 'road', width: 2.3 * T, pts: road });
  keep(0, 26, UW - 1, 27);

  // --- The old mill --------------------------------------------------------------------
  // A round tower of tumbled stone open to the sky, its flagstones broken
  // through to the grass; the sails lie broken outside. A hatch in the floor
  // leads down to the cellar.
  const mc = UPPER_MILL;
  millTiles(mc, (x, y) => keep(x, y, x, y));
  const ruin = millWall(mc, (stretch) => stretch % 5 === 2 || stretch % 7 === 4);
  walls.push(...ruin);
  wallTiles(ruin, solid);
  patches.push({ kind: 'ruin', pts: [millCentre(mc)], width: MILL_FLOOR });
  for (let k = 0; k < 8; k++) {
    const a = R() * Math.PI * 2;
    const d = (2.6 + R() * 0.8) * T;
    const c = millCentre(mc);
    decals.push({
      frame: 'debris',
      x: c.x + Math.cos(a) * d,
      y: c.y + Math.sin(a) * d,
      angle: R() * 360,
    });
  }
  obj('millstoneBroken', mc.x, mc.y);
  solid(mc.x, mc.y);
  const hatch = upperHatch();
  decals.push({ key: 'ln-cellar', frame: 'hatch', ...hatch, depth: -44 });
  // The mirror's cold light seeps up from below.
  light(hatch, 50, GLASS, { flicker: 0.15, slow: true });
  for (const [x, y, a] of [
    [mc.x + 4.6, mc.y + 3.8, 28],
    [mc.x - 4.4, mc.y - 4, -112],
    [mc.x + 4.8, mc.y - 3.4, 196],
  ] as const) {
    decal('sailBroken', x, y, { angle: a, depth: -42 });
  }
  for (const [x, y] of [
    [mc.x - 4, mc.y + 2],
    [mc.x + 4, mc.y],
    [mc.x - 1, mc.y + 5],
  ] as const) {
    obj('rubble', x, y, { angle: R() * 360 });
    solid(x, y);
  }

  // Trees and bushes everywhere nothing was built, thickest round the edges.
  const near = new Uint8Array(N);
  for (let y = 0; y < UH; y++) {
    for (let x = 0; x < UW; x++) {
      if (!clear[I(x, y)]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) if (inb(x + dx, y + dy)) near[I(x + dx, y + dy)] = 1;
      }
    }
  }
  for (let y = 0; y < UH; y++) {
    for (let x = 0; x < UW; x++) {
      const i = I(x, y);
      if (block[i] || near[i] || y >= 25) continue;
      const edge = Math.min(x, y, UW - 1 - x);
      const p = edge < 2 ? 0.55 : n2(x * 0.15 + 9, y * 0.15) > 0.62 ? 0.18 : 0.03;
      const r = R();
      if (r < p) {
        block[i] = 1;
        objects.push({
          key: 'ln-up',
          frame: R() < 0.5 ? 'utree' : 'utree2',
          x: (x + 0.5) * T + (R() - 0.5) * 6,
          y: (y + 0.5) * T + (R() - 0.5) * 6,
          angle: R() * 360,
          scale: 0.85 + R() * 0.35,
          depth: (y + 0.5) * T + 14,
        });
      } else if (r < p + 0.03) {
        block[i] = 1;
        obj('bush', x, y, { angle: R() * 360 });
      } else if (r < p + 0.12) {
        decal('daisies', x, y, { angle: R() * 360 });
      }
    }
  }

  return {
    realm: 'upper',
    w: UW,
    h: UH,
    ground,
    block,
    town: new Uint8Array(N),
    objects,
    decals,
    lights,
    // A new game starts by the car: you've just driven up.
    spawn: C(26.4, 19),
    life: { buildings: [house], festoons: [], spots: [] },
    walls,
    patches,
    things,
    portals: [
      {
        ...hatch,
        to: 'cellar',
        exit: cellarStairs(),
        label: 'Go down to the cellar',
        fade: 'dark',
        lock: { key: 'cellar-key', fact: 'cellar-lock', says: 'Padlocked. I need the key.' },
      },
    ],
    sails: [],
  };
}
