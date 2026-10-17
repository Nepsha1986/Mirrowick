import { t } from '../i18n';
import type { FoeSpawn } from './combat';
import { RAMP_BAND, labRampExit, wallTiles, yardRamp, yardRampExit } from './ways';
import { T, TL, YH, YW, mulberry32, type Pt } from './util';
import {
  DAYLIGHT,
  type GroundPatch,
  type Light,
  type Thing,
  type ThinWall,
  type World,
  type WorldObject,
} from './world';

/** The Facility's walls, and the fence. */
const WALL = 12;
const MESH = 5;
const EMERGENCY = 0xff6a3a;
const FIRE = 0xff9a40;
/** North of this row the ramp is still under the ground. */
const SURFACE = 8;
/** Level 0, the side of it that faces the yard: all roof for now (tiles, inclusive). */
const LEVEL0 = { x0: 32, y0: 0, x1: 101, y1: 17 };
/** The yard in front of it, fenced in (tiles, inclusive). */
const YARD = { x0: 4, y0: 18, x1: 100, y1: 46 };
/** The top of the ramp, coming up out of the ground (tiles, inclusive). */
const TUNNEL = { x0: 17, y0: 2, x1: 22, y1: 17 };

/**
 * The Facility's yard, up on the surface: the last stretch of the ramp
 * from level −1, open to the sky between retaining walls, the front of
 * level 0, its doors shut fast, and the fenced yard before it, where a
 * marauder has made his camp. Walk back down the ramp and you are on
 * level −1 again (`lab.ts`).
 */
export function generateYard(): World {
  const R = mulberry32(7117);
  const N = YW * YH;
  const ground = new Uint8Array(N).fill(TL.ASH);
  const block = new Uint8Array(N).fill(1);
  const indoors = new Uint8Array(N);
  const objects: WorldObject[] = [];
  const decals: WorldObject[] = [];
  const lights: Light[] = [];
  const walls: ThinWall[] = [];
  const things: Thing[] = [];
  const patches: GroundPatch[] = [];
  const foes: FoeSpawn[] = [];
  const I = (x: number, y: number) => y * YW + x;
  const P = (x: number, y: number): Pt => ({ x: x * T, y: y * T });
  const solidAt = (x: number, y: number) => (block[I(Math.floor(x), Math.floor(y))] = 1);
  const obj = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) =>
    objects.push({ key: 'ln-lab', frame, ...P(x, y), ...o });
  const decal = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) =>
    decals.push({ key: 'ln-lab', frame, ...P(x, y), depth: -48, alpha: 0.9, ...o });
  const light = (x: number, y: number, radius: number, color: number, o: Partial<Light> = {}) =>
    lights.push({ ...P(x, y), radius, color, flicker: 0.04, ...o });
  const tilt = (n = 4) => (R() - 0.5) * n;
  /** Carves out floor, free to walk (tiles, inclusive). */
  const room = (x0: number, y0: number, x1: number, y1: number, floor: number) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        ground[I(x, y)] = floor;
        block[I(x, y)] = 0;
      }
    }
  };

  // Still under the ground at the top of the map, and level 0's roof.
  for (let y = 0; y < SURFACE; y++) {
    for (let x = 0; x < YW; x++) {
      ground[I(x, y)] = TL.EARTH;
      indoors[I(x, y)] = 1;
    }
  }
  for (let y = LEVEL0.y0; y <= LEVEL0.y1; y++) {
    for (let x = LEVEL0.x0; x <= LEVEL0.x1; x++) {
      ground[I(x, y)] = TL.ROOFTOP;
      indoors[I(x, y)] = 1;
    }
  }

  // --- The top of the ramp --------------------------------------------------------------------
  // Out of the dark into the grey: one lamp left under the roof, cables
  // along the wall, then the sky, between retaining walls.
  const { x0: tx0, x1: tx1, y0: ty0, y1: ty1 } = TUNNEL;
  room(tx0, ty0, tx1, ty1, TL.CONCRETE);
  walls.push({
    kind: 'concrete',
    x: tx0 * T - WALL,
    y: ty0 * T - WALL,
    w: (tx1 + 1 - tx0) * T + 2 * WALL,
    h: WALL,
  });
  walls.push({ kind: 'concrete', x: tx0 * T - WALL, y: ty0 * T, w: WALL, h: (ty1 + 1 - ty0) * T });
  walls.push({ kind: 'concrete', x: (tx1 + 1) * T, y: ty0 * T, w: WALL, h: (ty1 + 1 - ty0) * T });
  patches.push({ kind: 'asphalt', width: 5.2 * T, pts: [P(20, ty0), P(20.1, ty1 + 0.6)] });
  obj('lampEmergency', tx1 + 0.75, 5, { angle: 90 });
  light(tx1 + 0.2, 5, 80, EMERGENCY, { flicker: 0.05 });
  for (const y of [3.2, 6.6]) decal('cable', tx1 + 0.55, y, { angle: 90 + tilt(6), depth: -44 });
  decal('arrows', 20, 5, { angle: 90, alpha: 0.5 });
  // Where the ramp goes back down, the way glows, as at its foot.
  const ramp = yardRamp();
  light(ramp.x / T, ramp.y / T - 0.2, 110, DAYLIGHT, { slow: true, flicker: 0.12 });
  // Where the roof ends and the sky begins.
  decal('hazard', 18.5, SURFACE - 0.3, { depth: -49, alpha: 0.7 });
  decal('hazard', 21, SURFACE - 0.3, { depth: -49, alpha: 0.7, angle: 180 });

  // --- Level 0, from outside ------------------------------------------------------------------
  // The front of the ground floor along the yard, its doors shut fast. Not
  // a way in, yet.
  const front = LEVEL0.y1 + 1;
  walls.push({
    kind: 'concrete',
    x: LEVEL0.x0 * T - WALL,
    y: LEVEL0.y0 * T,
    w: WALL,
    h: (front - LEVEL0.y0) * T,
  });
  walls.push({
    kind: 'concrete',
    x: LEVEL0.x0 * T - WALL,
    y: front * T - WALL,
    w: (YARD.x1 + 1 - LEVEL0.x0) * T + WALL,
    h: WALL,
  });
  // The retaining wall either side of the tunnel's mouth.
  walls.push({
    kind: 'concrete',
    x: YARD.x0 * T,
    y: front * T - WALL,
    w: (tx0 - YARD.x0) * T,
    h: WALL,
  });
  walls.push({
    kind: 'concrete',
    x: (tx1 + 1) * T,
    y: front * T - WALL,
    w: (LEVEL0.x0 - tx1 - 1) * T - WALL,
    h: WALL,
  });
  things.push({
    id: 'level0-door',
    key: 'ln-lab',
    frame: 'sealedDoor',
    ...P(66, front + 0.15),
    angle: 180,
    label: t().use.sealed,
    says: t().thoughts.entrance,
  });
  obj('floodlight', 70.4, front + 0.35);
  for (const [x, a] of [
    [62.6, 4],
    [69.6, -7],
  ] as const) {
    obj('sandbags', x, front + 1.1, { angle: a });
    solidAt(x, front + 1.1);
  }
  // On the roof: vents and units, here and there over the dark.
  for (let k = 0; k < 18; k++) {
    const x = LEVEL0.x0 + 1 + Math.floor(R() * (LEVEL0.x1 - LEVEL0.x0 - 2));
    const y = LEVEL0.y0 + 1 + Math.floor(R() * (LEVEL0.y1 - LEVEL0.y0 - 2));
    obj(R() < 0.6 ? 'vent' : 'roofUnit', x + 1, y + 1, {
      angle: Math.floor(R() * 4) * 90 + tilt(3),
    });
  }

  // --- The yard -------------------------------------------------------------------------------
  // Cracked asphalt over dead ground, ash in drifts; two cars burnt out
  // where they stood; a fallen barrier at the gate. One floodlight over
  // the tunnel still works. The marauder keeps a fire going in a drum.
  room(YARD.x0, YARD.y0, YARD.x1, YARD.y1, TL.ASH);
  const yx0 = YARD.x0 * T;
  const yx1 = (YARD.x1 + 1) * T;
  const yy1 = (YARD.y1 + 1) * T;
  walls.push({ kind: 'mesh', x: yx0, y: YARD.y0 * T - WALL, w: MESH, h: yy1 - YARD.y0 * T + WALL });
  walls.push({
    kind: 'mesh',
    x: yx1 - MESH,
    y: YARD.y0 * T - WALL,
    w: MESH,
    h: yy1 - YARD.y0 * T + WALL,
  });
  walls.push({ kind: 'mesh', x: yx0, y: yy1 - MESH, w: yx1 - yx0, h: MESH });
  patches.push({
    kind: 'asphalt',
    width: 3.4 * T,
    pts: [P(20.1, YARD.y0 - 0.4), P(20.4, 24), P(21.6, 28.6), P(50, 29.2), P(100.6, 28.8)],
  });
  patches.push({ kind: 'asphalt', width: 5 * T, pts: [P(35, 23.2), P(56, 23.4)] });
  patches.push({ kind: 'asphalt', width: 4 * T, pts: [P(66, front + 0.4), P(66.4, 28.6)] });
  obj('carBurnt', 41.2, 23.2, { angle: 7 });
  for (let y = 22; y <= 23; y++) for (let x = 40; x <= 42; x++) solidAt(x, y);
  obj('carBurnt', 48.4, 23.6, { angle: 184, scale: 0.97 });
  for (let y = 23; y <= 24; y++) for (let x = 47; x <= 49; x++) solidAt(x, y);
  obj('barrier', 98.4, 28.6, { angle: 68 });
  obj('barrierPost', 99.6, 27.2);
  solidAt(99, 27);
  for (const [x, y, a] of [
    [32.4, 28.2, -8],
    [34.6, 27.1, 14],
    [60.2, 25.6, 82],
  ] as const) {
    obj('sandbags', x, y, { angle: a });
    solidAt(x, y);
  }
  // The marauder's fire, in an oil drum, and where he sleeps.
  obj('fireBarrel', 56.5, 26.5);
  solidAt(56.5, 26.5);
  light(56.5, 26.2, 120, FIRE, { flicker: 0.2 });
  decal('mattress', 58.8, 25.4, { angle: -12, depth: -46, alpha: 1 });
  foes.push({ kind: 'marauder', ...P(57.5, 28.5) });
  objects.push({ frame: 'crate', ...P(54.6, 25.2), angle: 12 });
  solidAt(54.6, 25.2);
  // The floodlight over the tunnel, and the dead lamps along the road.
  obj('floodlight', 24.6, front + 0.35);
  light(21.5, front + 2.5, 210, 0xfff2d0, { flicker: 0.02 });
  for (const x of [38, 62, 80, 94]) {
    obj('lampPost', x, 31.6);
    solidAt(x, 31.6);
  }
  // Dead trees, ash, rubbish.
  for (const [x, y] of [
    [10.5, 21.5],
    [14.5, 35.5],
    [37.5, 36.5],
    [76.5, 21.5],
    [83.5, 36.5],
    [88.5, 24.5],
    [11.5, 29.5],
    [66.5, 35.5],
    [50.5, 41.5],
    [94.5, 42.5],
    [26.5, 43.5],
  ] as const) {
    objects.push({
      frame: 'dead',
      ...P(x, y),
      angle: R() * 360,
      scale: 0.9 + R() * 0.35,
      depth: y * T + 14,
    });
    solidAt(x, y);
  }
  for (let k = 0; k < 110; k++) {
    const x = YARD.x0 + 0.5 + R() * (YARD.x1 - YARD.x0);
    const y = YARD.y0 + 1 + R() * (YARD.y1 - YARD.y0 - 1);
    const v = R();
    if (v < 0.45) decals.push({ frame: 'tuft', ...P(x, y), angle: R() * 360, alpha: 0.6 });
    else if (v < 0.75) decal('ash', x, y, { angle: R() * 360, alpha: 0.7 });
    else if (v < 0.9) decals.push({ frame: 'debris', ...P(x, y), angle: R() * 360 });
    else decal('puddle', x, y, { angle: R() * 360, alpha: 0.6 });
  }
  for (const [x, y] of [
    [28, 23],
    [45, 30.4],
    [70, 29.4],
    [85, 38],
  ] as const) {
    decal('crack', x, y, { angle: R() * 360, alpha: 0.8, depth: -90 });
  }

  wallTiles(walls, (x, y) => (block[I(x, y)] = 1));
  // The tunnel's mouth stays open through the retaining wall.
  for (let x = tx0; x <= tx1; x++) block[I(x, ty1)] = 0;

  return {
    realm: 'yard',
    w: YW,
    h: YH,
    ground,
    block,
    indoors,
    objects,
    decals,
    lights,
    // Just up out of the ramp: where you come to after a fall out here.
    spawn: yardRampExit(),
    buildings: [],
    portals: [
      {
        ...ramp,
        to: 'lower',
        exit: labRampExit(),
        label: t().use.rampDown,
        fade: 'dark',
        step: RAMP_BAND,
      },
    ],
    walls,
    patches,
    things,
    foes,
  };
}
