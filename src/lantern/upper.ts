import { t } from '../i18n';
import { cellarStairs, upperHatch } from './mill';
import type { Building } from './town';
import { T, TL, UH, UW, makeNoise, mulberry32, type Pt } from './util';
import {
  GLASS,
  type GroundPatch,
  type Light,
  type Print,
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
 * The Upper World, for now one homestead on a country road: Uncle Victor's
 * house with a kitchen, a living room, a bedroom, a hall and a bathroom; his
 * car and yours in the drive; a back garden — and at the bottom of it an
 * ordinary shed, with a hatch in its floor down to the cellar and the mirror.
 */
export function generateUpperWorld(): World {
  const R = mulberry32(4242);
  const n1 = makeNoise(21);
  const n2 = makeNoise(63);
  const N = UW * UH;
  // The odds and ends in drawers and pockets, in the current language.
  const { junk } = t().hoard;
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

  const crowns: WorldObject[] = [];
  const trunks: Pt[] = [];
  /**
   * A tree on a tile: a solid trunk, its shade on the grass and a big crown
   * over it, turned a little and mirrored so no two look alike while the
   * light still falls from the top left.
   */
  const tree = (frame: string, x: number, y: number, scale: number) => {
    const at = { x: (x + 0.5) * T + (R() - 0.5) * 6, y: (y + 0.5) * T + (R() - 0.5) * 6 };
    const flip = R() < 0.5 ? -1 : 1;
    objects.push({ key: 'ln-trees', frame: 'trunk', ...at, angle: R() * 360, depth: at.y + 4 });
    decals.push({
      key: 'ln-trees',
      frame: 'crownShade',
      x: at.x + 10 * scale,
      y: at.y + 12 * scale,
      scale,
      depth: -40,
      alpha: 1,
    });
    crowns.push({ key: 'ln-trees', frame, ...at, scale: scale * flip, angle: (R() - 0.5) * 30 });
    trunks.push({ x, y });
    solid(x, y);
  };

  // A green meadow.
  for (let y = 0; y < UH; y++) {
    for (let x = 0; x < UW; x++) {
      const v = n1(x * 0.12, y * 0.12) + 0.4 * n2(x * 0.3, y * 0.3);
      ground[I(x, y)] = v < 0.6 ? TL.UG1 : v < 0.95 ? TL.UG2 : TL.UG3;
    }
  }
  // Victor's lawn, front and back, kept clear of trees.
  const LAWN = { x0: 5, y0: 11, x1: 40, y1: 38 };
  keep(LAWN.x0, LAWN.y0, LAWN.x1, LAWN.y1);

  /** Tiles a path runs over: no long grass there. */
  const trod = new Uint8Array(N);
  /** Keeps trees off the tiles along a line. */
  const keepAlong = (pts: Pt[]) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i] as Pt;
      const b = pts[i + 1] as Pt;
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
      for (let k = 0; k <= n; k++) {
        const x = Math.floor((a.x + ((b.x - a.x) * k) / n) / T);
        const y = Math.floor((a.y + ((b.y - a.y) * k) / n) / T);
        keep(x, y, x, y);
        if (inb(x, y)) trod[I(x, y)] = 1;
      }
    }
  };

  // A country road of packed earth and gravel along the south edge; a gravel
  // drive that turns in off it through the gate and swings up to the house,
  // widening where the cars stand; a walk from the front door to the road,
  // with a branch to the drive; and a footpath out the back, across the
  // garden to the shed. They are painted over the grass, so their edges wander.
  keep(0, 40, UW - 1, 41);
  const drive = [
    P(36.6, 40.3),
    P(36.5, 38.6),
    P(35.9, 36.7),
    P(34.6, 35.1),
    P(32.8, 33.6),
    P(31.6, 31.6),
    P(31.2, 28.5),
    P(31.1, 24.4),
  ];
  patches.push({ kind: 'gravel', width: 2.6 * T, pts: drive });
  patches.push({ kind: 'gravel', width: 3.3 * T, pts: [P(31.15, 25), P(31.3, 31.4)] });
  keepAlong(drive);
  keep(30, 23, 32, 33);
  patches.push({
    kind: 'gravel',
    width: 1.5 * T,
    pts: [P(23, 33.3), P(22.95, 36.5), P(23.05, 40.3)],
  });
  keep(22, 33, 23, 39);
  const branch = [P(23.4, 34.9), P(26.4, 35.4), P(29.4, 35.2), P(31.9, 34.5)];
  patches.push({ kind: 'gravel', width: 1.1 * T, pts: branch });
  keepAlong(branch);
  // And a narrow one round the house's west end, past the barbecue, to the
  // back door and the garden.
  const round = [
    P(22.6, 34.9),
    P(18.5, 35.15),
    P(14.6, 34.8),
    P(13.15, 33.4),
    P(12.95, 29.8),
    P(13.05, 24.5),
    P(13.7, 21.6),
    P(15.6, 21.05),
    P(17.4, 21.3),
  ];
  patches.push({ kind: 'gravel', width: 1 * T, pts: round });
  keepAlong(round);
  const footpath = [
    P(17.5, 21.9),
    P(17.6, 19.6),
    P(18.5, 17.4),
    P(22, 16.4),
    P(30, 15.8),
    P(37, 14.7),
    P(42, 13.5),
    P(45.6, 12.7),
    P(47.5, 12),
  ];
  patches.push({ kind: 'dirt', width: 0.85 * T, pts: footpath });
  keepAlong(footpath);

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
    x0: 14,
    y0: 22,
    w: 15,
    h: 11,
    roof: 'tiles',
    chimneys: [{ x: 4.5, y: 1.4 }],
    porch: 9,
  };
  const floor = (x: number, y: number): number => {
    if (x <= 19 && y <= 26) return TL.CHECKER; // kitchen
    if (x <= 19) return TL.PLANK2; // bedroom
    if (y <= 27) return TL.PARQUET; // living room
    if (x >= 26) return TL.TILEW; // bathroom
    return TL.PLANK; // hall
  };
  const wallT = new Uint8Array(N);
  const x1 = house.x0 + house.w - 1;
  const y1 = house.y0 + house.h - 1;
  for (let y = house.y0; y <= y1; y++) {
    for (let x = house.x0; x <= x1; x++) {
      const rim = x === house.x0 || x === x1 || y === house.y0 || y === y1;
      const inner =
        x === 20 || (y === 27 && x <= 20) || (y === 28 && x >= 20) || (x === 25 && y >= 28);
      const wall = rim || inner;
      if (wall) {
        solid(x, y);
        wallT[I(x, y)] = 1;
      } else set(x, y, floor(x, y));
    }
  }
  // Doors: kitchen–living, bedroom–hall, living–hall, hall–bath, back and front.
  const doors = [
    [20, 24, TL.PARQUET],
    [20, 30, TL.PLANK],
    [23, 28, TL.PLANK],
    [25, 30, TL.TILEW],
    [17, 22, TL.CHECKER],
    [22, 32, TL.PLANK],
    [23, 32, TL.PLANK],
  ] as const;
  for (const [x, y, f] of doors) {
    set(x, y, f);
    wallT[I(x, y)] = 0;
  }
  thinWalls(house, wallT, doors);
  doorFloors(doors, wallT);
  const room = 0;
  const lamp = (p: Pt, radius: number, color = WARM) => light(p, radius, color, { room });

  // Kitchen: worktop and sink, cooker, fridge with a list on it, a table for four.
  obj('kcounter', 15.5, 23);
  solid(15, 23);
  solid(16, 23);
  obj('stove', 18, 23);
  solid(18, 23);
  obj('fridge', 19, 23);
  solid(19, 23);
  things.push({
    id: 'fridge-note',
    key: 'ln-up',
    frame: 'note',
    ...C(19, 23),
    x: 19.6 * T,
    depth: 24 * T,
    label: t().use.fridgeNote,
    read: 'fridge-note',
  });
  obj('ktable', 17, 25);
  solid(17, 25);
  lamp(C(17, 24.5), 110);

  // Living room: sofa facing the telly, a rug, the computer in the corner.
  decal('rugBlue', 24, 24.6);
  obj('sofa', 24, 26);
  for (const x of [23, 24, 25]) solid(x, 26);
  things.push({
    id: 'tv',
    key: 'ln-up',
    frame: 'tv',
    ...C(24, 23),
    label: t().use.tvOn,
    on: { frame: 'tvOn', label: t().use.tvOff },
  });
  for (const x of [23, 24, 25]) solid(x, 23);
  obj('desk', 27, 24.5, { y: 25 * T });
  solid(27, 24);
  solid(27, 25);
  obj('chair', 26, 24.5, { y: 25 * T, depth: 25 * T - 4 });
  obj('plant', 21, 23);
  solid(21, 23);
  obj('floorlamp', 27, 27);
  solid(27, 27);
  lamp(C(24, 25), 150);
  light(C(24, 23.8), 90, 0x8ab8ff, { room, thing: 'tv', flicker: 0.16 });
  lamp(C(26.6, 24.5), 40, 0xa8d8ff);

  // Hall: a mat at the door, Victor's coat still on the stand, a plant.
  // The front door stands ajar, as Pete found it. His phone is still in the
  // coat's inside pocket, where the police never looked: you read it there.
  decal('doormat', 22.5, 31);
  obj('frontdoor', 22, 32, { x: 22 * T + 15, y: 32.5 * T - 24, angle: -62 });
  things.push({
    id: 'coat',
    key: 'ln-up',
    frame: 'coatrack',
    ...C(21, 29),
    label: t().use.coat,
    read: 'phone',
  });
  solid(21, 29);
  obj('plant', 21, 31);
  solid(21, 31);
  lamp(C(22.5, 30), 80);

  // Bathroom: tub, basin, loo.
  obj('bathtub', 27, 30);
  for (const y of [29, 30, 31]) solid(27, y);
  obj('bsink', 26, 29);
  solid(26, 29);
  obj('toilet', 26, 31);
  solid(26, 31);
  lamp(C(26.5, 30), 60, 0xf0f4ff);

  // Bedroom: bed, bedside table, wardrobe, a rug.
  decal('rugBed', 17.5, 30);
  objects.push({ key: 'ln-town', frame: 'bed', x: 15.5 * T, y: 30 * T });
  solid(15, 29);
  solid(15, 30);
  solid(15, 28);
  // Victor's bedside table: a drawer of odds and ends, the flashlight and
  // the key to the shed's hatch among them. You leave them until you need them.
  things.push({
    id: 'nightstand',
    key: 'ln-town',
    frame: 'stable',
    ...C(15, 28),
    scale: 0.7,
    label: t().use.nightstand,
    hoard: {
      place: t().hoard.drawer,
      items: ['flashlight', 'cellar-key'],
      junk: [junk.chargers, junk.receipts, junk.watch, junk.glasses],
    },
  });
  things.push({
    id: 'wardrobe',
    key: 'ln-up',
    frame: 'wardrobe',
    ...C(18, 28),
    x: 18 * T,
    label: t().use.wardrobe,
    hoard: {
      place: t().hoard.wardrobe,
      items: [],
      junk: [junk.shirts, junk.jumper, junk.bills],
    },
  });
  solid(17, 28);
  solid(18, 28);
  lamp(C(17, 29.5), 100);
  lamp(C(15, 28), 40);

  // Light from the windows at night and a lamp over the front door.
  for (const [x, y] of [
    [17, 33.5],
    [26.5, 33.5],
    [24, 20.5],
    [12.5, 24.5],
    [12.5, 29.5],
    [29.5, 25],
  ] as const) {
    light(C(x, y), 40, WARM);
  }
  for (const [x, y] of [
    [17, 32],
    [26, 32],
    [16, 22],
    [24, 22],
    [14, 24],
    [14, 29],
    [28, 25],
  ] as const) {
    const along = y === house.y0 || y === y1;
    const cx = (x + 0.5) * T;
    const cy = (y + 0.5) * T;
    walls.push(
      along
        ? { kind: 'window', x: cx - 11, y: cy - OUTER / 2, w: 22, h: OUTER }
        : { kind: 'window', x: cx - OUTER / 2, y: cy - 11, w: OUTER, h: 22 },
    );
  }
  // The front door: a step, a green porch canopy (painted with the roof) with
  // a lamp under it that lights the step, and a mat on the gravel, so you can
  // tell the way in from the road.
  decal('step', 22.5, 32.9);
  decal('porchmat', 22.5, 33.7, { angle: 3, alpha: 1 });
  light({ x: 23 * T, y: 33.7 * T }, 72, LAMP);

  // --- The front yard ------------------------------------------------------------------
  // Victor's car at the top of the drive, where it has stood for days; yours
  // pulled up behind it, both a little askew.
  things.push({
    id: 'victor-car',
    key: 'ln-up',
    frame: 'carVictor',
    x: 31.3 * T,
    y: 26.6 * T,
    angle: 3,
    depth: 28.6 * T,
    label: t().use.car,
    says: t().thoughts.car,
  });
  for (let y = 24; y <= 28; y++) for (const x of [30, 31]) solid(x, y);
  objects.push({
    key: 'ln-up',
    frame: 'car',
    x: 31.3 * T,
    y: 31.7 * T,
    angle: -4,
    depth: 33.5 * T,
  });
  for (let y = 30; y <= 33; y++) for (const x of [30, 31]) solid(x, y);

  // A picket fence along the road, with gaps for the walk and the drive's gate.
  for (const [a, b] of [
    [3, 21],
    [24, 34],
    [39, 44],
  ] as const) {
    const y = 38.5 * T;
    walls.push({ kind: 'fence', x: a * T + 4, y: y - 3, w: (b - a + 1) * T - 8, h: 6 });
    for (let x = a; x <= b; x++) solid(x, 38);
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
    ...C(24, 39),
    label: t().use.mailbox,
  });
  solid(24, 39);
  for (const x of [18, 40]) {
    obj('streetlamp', x, 39);
    solid(x, 39);
    light(C(x, 39), 140, LAMP, { flicker: 0.01 });
  }

  // Flowering shrubs along the inside of the fence, a few, not a hedge:
  // lilac, hydrangea, an old rose either side of the gate.
  for (const [frame, x, y] of [
    ['shrubLilac', 4.6, 37.3],
    ['shrubHydrangea', 9.2, 37.5],
    ['shrubRose', 13.8, 37.4],
    ['shrubLilac', 20.6, 37.2],
    ['shrubHydrangea', 25.2, 37.4],
    ['shrubRose', 33.6, 37.5],
    ['shrubRose', 39.6, 37.4],
    ['shrubLilac', 43.3, 37.2],
  ] as const) {
    obj(frame, x, y, { angle: R() * 360, scale: 0.9 + R() * 0.25 });
    solid(Math.floor(x), Math.floor(y));
  }

  // The barbecue corner beside the house, off the kitchen's end: a patio of
  // slabs laid by hand, a brick grill against its back edge (cold), a round table
  // with four chairs, one pushed back as someone got up.
  patches.push({ kind: 'paving', pts: [P(10.1, 27.3)], width: 4.5 * T, height: 3.75 * T });
  obj('grill', 8.3, 25.5, { angle: -1.5 });
  solid(8, 25);
  solid(9, 25);
  obj('bbqtable', 9.6, 26.8);
  solid(10, 27);
  for (const [x, y, a] of [
    [9.5, 25.85, -9],
    [10.7, 26.95, 112],
    [9.85, 27.95, 158],
    [8.6, 26.7, -71],
  ] as const) {
    obj('gardenchair', x, y, { angle: a });
  }

  // Flowers under the front windows.
  for (const x of [15, 16, 17, 18, 19, 25, 26, 27]) {
    if (x === 18) continue;
    obj('flowerbed', x + (R() - 0.5) * 0.15, 33 + (R() - 0.3) * 0.2, {
      depth: 33 * T,
      angle: (R() - 0.5) * 8,
    });
    solid(x, 33);
  }

  // --- The back garden -----------------------------------------------------------------
  // Vegetable beds and a bench by the path, logs stacked under the eaves, a
  // chopping block, washing on the line, the compost heap and a wheelbarrow
  // left where Victor last used it.
  // Six beds in two columns, none quite square to the others, each with
  // its own crop in rows: cabbages, lettuces, carrots, beans up their poles;
  // one bed half picked, one dug over and empty with the fork left in it.
  // A crop is the frame of each plant in its rows; beans grow up poles
  // instead, and the dug bed has no rows at all.
  type Crop = 'vegCabbage' | 'vegLettuce' | 'vegCarrot' | 'beans' | 'dug';
  const beds: [x0: number, x1: number, y: number, crop: Crop, rows: number, gaps: number][] = [
    [7.5, 11.3, 16.9, 'vegCabbage', 2, 0.08],
    [12.4, 16.1, 16.95, 'vegLettuce', 3, 0.1],
    [7.45, 11.25, 18.55, 'vegCarrot', 3, 0.05],
    [12.35, 16.05, 18.5, 'beans', 0, 0],
    [7.55, 11.35, 20.15, 'dug', 0, 0],
    [12.45, 16.1, 20.1, 'vegCabbage', 2, 0.45],
  ];
  for (const [x0, x1, y, crop, rows, gaps] of beds) {
    const tilt = (R() - 0.5) * 0.12;
    patches.push({ kind: 'soil', width: 1.25 * T, pts: [P(x0, y - tilt), P(x1, y + tilt)] });
    const step = crop === 'vegCabbage' ? 0.62 : crop === 'vegCarrot' ? 0.32 : 0.45;
    for (let row = 0; row < rows; row++) {
      const dy = rows === 1 ? 0 : (row / (rows - 1) - 0.5) * 0.62;
      for (let x = x0 + 0.35; x < x1 - 0.25; x += step) {
        if (R() < gaps) continue;
        const along = (x - x0) / (x1 - x0);
        decals.push({
          key: 'ln-up',
          frame: crop,
          x: x * T + (R() - 0.5) * 3,
          y: (y + dy - tilt + along * tilt * 2) * T + (R() - 0.5) * 3,
          scale: 0.85 + R() * 0.3,
          angle: R() * 360,
          depth: -44,
          alpha: 1,
        });
      }
    }
    if (crop === 'beans') {
      for (const x of [x0 + 0.7, (x0 + x1) / 2, x1 - 0.7]) {
        objects.push({ key: 'ln-up', frame: 'beanpoles', x: x * T, y: y * T, angle: R() * 360 });
        solid(Math.floor(x), Math.floor(y));
      }
    }
  }
  decals.push({
    key: 'ln-up',
    frame: 'gardenfork',
    ...P(10.4, 19.9),
    angle: 8,
    depth: -43,
    alpha: 1,
  });
  obj('wateringcan', 11.6, 19.1, { angle: -20 });

  objects.push({ key: 'ln-town', frame: 'bench', ...C(20, 18.6), angle: 2 });
  solid(20, 19);
  obj('woodpile', 24, 21, { x: 24.5 * T, angle: -1.5 });
  for (const x of [23, 24, 25]) solid(x, 21);
  obj('chopblock', 22, 20, { angle: 20 });
  solid(22, 20);
  // Three washing lines side by side, not quite parallel.
  for (const [frame, x0, x1, y0, y1] of [
    ['clothesline2', 22.1, 28.3, 11.9, 11.8],
    ['clothesline', 21.5, 28.6, 13.2, 13.2],
    ['clothesline3', 21.7, 28.5, 14.5, 14.65],
  ] as const) {
    walls.push({ kind: 'post', x: x0 * T - 5, y: y0 * T - 5, w: 10, h: 10 });
    walls.push({ kind: 'post', x: x1 * T - 5, y: y1 * T - 5, w: 10, h: 10 });
    solid(Math.floor(x0), Math.floor(y0));
    solid(Math.floor(x1), Math.floor(y1));
    objects.push({
      key: 'ln-up',
      frame,
      x: ((x0 + x1) / 2) * T,
      y: ((y0 + y1) / 2) * T + 15,
      angle: (Math.atan2((y1 - y0) * T, (x1 - x0) * T) * 180) / Math.PI,
      depth: 40_000,
    });
  }

  obj('compost', 9, 12, { angle: 4 });
  solid(9, 12);
  obj('wheelbarrow', 12, 13, { x: 12.3 * T });
  solid(12, 13);
  for (const [x, y] of [
    [6, 13],
    [33, 19],
    [37, 11],
    [13, 9],
    [10, 35],
    [38, 35],
  ] as const) {
    tree('crownApple', x, y, 0.8 + R() * 0.15);
  }

  // --- The shed ------------------------------------------------------------------------
  // Out at the bottom of the garden, past the washing line: an ordinary shed
  // of weathered boards under a rusty tin roof. Inside, the bench, the mower,
  // the bike, the tins of paint — and under the boards a padlocked hatch.
  const shed: Building = { name: 'Shed', x0: 44, y0: 6, w: 7, h: 6, roof: 'tin', chimneys: [] };
  const shedT = new Uint8Array(N);
  for (let y = shed.y0; y < shed.y0 + shed.h; y++) {
    for (let x = shed.x0; x < shed.x0 + shed.w; x++) {
      const rim =
        x === shed.x0 || y === shed.y0 || x === shed.x0 + shed.w - 1 || y === shed.y0 + shed.h - 1;
      if (rim) {
        solid(x, y);
        shedT[I(x, y)] = 1;
      } else set(x, y, TL.PLANK2);
    }
  }
  const shedDoor = [[47, 11, TL.PLANK2]] as const;
  for (const [x, y, f] of shedDoor) {
    set(x, y, f);
    shedT[I(x, y)] = 0;
  }
  keep(shed.x0 - 1, shed.y0 - 1, shed.x0 + shed.w, shed.y0 + shed.h);
  const before = walls.length;
  thinWalls(shed, shedT, shedDoor);
  doorFloors(shedDoor, shedT);
  for (const w of walls.slice(before)) if (w.kind === 'outer') w.kind = 'boards';
  const shedRoom = 1;
  obj('workbench', 45.6, 7, { angle: -1 });
  solid(45, 7);
  solid(46, 7);
  obj('tins', 49, 7, { angle: 3 });
  for (const y of [7, 8, 9, 10]) solid(49, y);
  obj('bike', 49, 9, { angle: 5 });
  obj('mower', 45, 10, { angle: -8 });
  solid(45, 10);
  obj('tools', 44, 8.3, { x: 44.97 * T });
  const hatch = upperHatch();
  decals.push({ key: 'ln-cellar', frame: 'hatch', ...hatch, angle: 2, depth: -44 });
  // A bare bulb; and at night a cold light seeps up round the hatch.
  light(C(47, 8.2), 110, WARM, { room: shedRoom });
  light(hatch, 44, GLASS, { room: shedRoom, flicker: 0.15, slow: true });

  // Victor's footprints, trodden round the shed door and inside about the
  // hatch: he came and went here many times. He had been through the mirror,
  // so they glow: only the beam shows them, after dark.
  const trail: Print[] = [];
  let left = false;
  const print = (x: number, y: number, angle: number) => {
    left = !left;
    trail.push({ x, y, angle: angle + (R() - 0.5) * 0.25, left });
  };
  const walk = (...pts: [number, number][]) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = P(...(pts[i] as [number, number]));
      const b = P(...(pts[i + 1] as [number, number]));
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      for (let d = 0; d < len; d += 15) {
        // A little to one side, then the other; some have worn away.
        const s = (left ? 4 : -4) + Math.sin(trail.length * 0.7) * 2;
        if (R() < 0.1) {
          left = !left;
          continue;
        }
        print(
          a.x + Math.cos(angle) * d - Math.sin(angle) * s,
          a.y + Math.sin(angle) * d + Math.cos(angle) * s,
          angle,
        );
      }
    }
  };
  // In and out of the door, and back and forth in front of it.
  walk([46.1, 14.3], [47.3, 12.5], [47.45, 11], [47.5, 9.5]);
  walk([47.7, 9.7], [47.65, 11], [48.5, 12.8], [49.7, 13.7]);
  walk([45.3, 12.7], [47, 13.3], [48.7, 12.5]);
  walk([48.9, 13.5], [47.3, 12.9], [46, 13.7]);
  // Round the hatch, and over to the bench.
  walk([47.3, 10.3], [46.5, 9.3], [46.8, 8.1], [48.2, 8.1], [48.3, 9.4], [47.6, 10.3]);
  walk([47.9, 10.1], [46.4, 8.4]);
  // And stray prints where he stood and turned.
  for (let k = 0; k < 16; k++) {
    const a = R() * Math.PI * 2;
    const d = (0.6 + R() * 1.6) * T;
    print(47.5 * T + Math.cos(a) * d * 1.3, 13 * T + Math.abs(Math.sin(a)) * d, R() * 6.28);
  }
  for (let k = 0; k < 6; k++) {
    const at = P(46.5 + R() * 2, 8 + R() * 2.2);
    print(at.x, at.y, R() * 6.28);
  }

  // The road goes on last, over the ends of the walk and the drive.
  const road: Pt[] = [];
  for (let x = -1; x <= UW + 1; x += 2) road.push(P(x, 41 + Math.sin(x * 0.21) * 0.18));
  patches.push({ kind: 'road', width: 2.3 * T, pts: road });

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
      if (block[i] || near[i] || y >= 39) continue;
      const edge = Math.min(x, y, UW - 1 - x);
      const p = edge < 2 ? 0.55 : n2(x * 0.15 + 9, y * 0.15) > 0.62 ? 0.18 : 0.03;
      const r = R();
      // Crowns are wide, so trunks keep their distance; under and between
      // them grow bushes.
      const room = trunks.every((t) => Math.hypot(t.x - x, t.y - y) > 2.8);
      if (r < p && room) {
        tree(`crown${Math.floor(R() * 3)}`, x, y, 0.85 + R() * 0.3);
      } else if (r < p ? R() < 0.25 : r < p + 0.03) {
        block[i] = 1;
        obj('bush', x, y, { angle: R() * 360 });
      } else if (r < p + 0.12) {
        decal('daisies', x, y, { angle: R() * 360 });
      }
    }
  }

  // Long grass, knee-high, where nobody mows: round the edges of the lawn
  // and on into the trees, in drifts rather than a band, spilling a little
  // over the lawn's edge here and there.
  const tall = new Uint8Array(N);
  const meadow: Pt[] = [];
  for (let y = 0; y < 38; y++) {
    for (let x = 0; x < UW; x++) {
      const i = I(x, y);
      if (block[i]) continue;
      const v = n1(x * 0.35 + 40, y * 0.35);
      const inLawn = x >= LAWN.x0 && x <= LAWN.x1 && y >= LAWN.y0;
      const rim = inLawn && !trod[i] && (x === LAWN.x0 || x === LAWN.x1 || y === LAWN.y0);
      const wild = !clear[i] && v > 0.22;
      if (!wild && !(rim && v > 0.55)) continue;
      tall[i] = 1;
      meadow.push({ x: (x + 0.5) * T + (R() - 0.5) * 8, y: (y + 0.5) * T + (R() - 0.5) * 8 });
    }
  }
  // Under everything else on the ground.
  patches.unshift({ kind: 'meadow', width: T * 1.2, pts: meadow });

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
    spawn: C(32.8, 31.8),
    life: { buildings: [house, shed], festoons: [], spots: [] },
    walls,
    patches,
    things,
    portals: [
      {
        ...hatch,
        to: 'cellar',
        exit: cellarStairs(),
        label: t().use.cellarDown,
        fade: 'dark',
        lock: {
          key: 'cellar-key',
          fact: 'cellar-lock',
          says: t().thoughts.padlocked,
          open: 'cellar-open',
          unlock: t().use.unlock,
        },
      },
    ],
    sails: [],
    trail,
    crowns,
    tall,
  };
}
