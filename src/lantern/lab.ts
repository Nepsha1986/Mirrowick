import { t } from '../i18n';
import type { FoeSpawn } from './combat';
import { layHall } from './hall';
import { cellarMirror, labMirror, wallTiles } from './ways';
import { CHAMBER, LH, LW, T, TL, mulberry32, type Pt } from './util';
import {
  type GroundPatch,
  type Light,
  type Thing,
  type ThinWall,
  type World,
  type WorldObject,
} from './world';

/** The Facility's walls, and the bars and fence. */
const WALL = 12;
const BARS = 9;
const MESH = 5;
/** Emergency lighting, a dying fluorescent panel, screens, the cages' lamps. */
const ALARM = 0xff3a2a;
const EMERGENCY = 0xff6a3a;
const PANEL = 0xdfe8ff;
const SCREEN = 0x7affc8;
const CAGE = 0xbfd8ff;
const FIRE = 0xff9a40;
/** Level −1 is dug in under everything north of this row; south of it is the surface. */
const SURFACE = 108;
/** Level 0, the side of it that faces the yard: all roof for now (tiles, inclusive). */
const LEVEL0 = { x0: 42, y0: 100, x1: 111, y1: 117 };
/** The yard in front of it, fenced in (tiles, inclusive). */
const YARD = { x0: 14, y0: 118, x1: 110, y1: 146 };
/** The corridor on level −1 that everything opens off (tiles, inclusive). */
const HALLWAY = { x0: 14, y0: 45, x1: 112, y1: 47 };
/** The tunnel up from the checkpoint to the yard (tiles, inclusive). */
const TUNNEL = { x0: 27, y0: 66, x1: 32, y1: 117 };
/** The five cages along the vivarium's south wall: left edge of each, and their rows. */
const CAGES = [71, 77, 83, 89, 95];
const CAGE_W = 5;
const CAGE_Y0 = 59;
const CAGE_Y1 = 66;

/**
 * The Lower World: the Facility, a vast research complex built round the
 * mirror and abandoned in a hurry. Level −1 is underground: Chamber 7,
 * poured round the very hall that lies under Victor's shed, the corridor
 * past sealed doors and the stairs up to level 0, the vivarium, and the
 * checkpoint with the guards' weapons locker. From the checkpoint a long
 * tunnel climbs to the surface, to the fenced yard in front of level 0,
 * where a marauder has made his camp. Level 0 itself is still shut.
 */
export function generateLab(): World {
  const R = mulberry32(7007);
  const N = LW * LH;
  const ground = new Uint8Array(N).fill(TL.EARTH);
  const block = new Uint8Array(N).fill(1);
  const indoors = new Uint8Array(N);
  const objects: WorldObject[] = [];
  const decals: WorldObject[] = [];
  const lights: Light[] = [];
  const walls: ThinWall[] = [];
  const things: Thing[] = [];
  const patches: GroundPatch[] = [];
  const I = (x: number, y: number) => y * LW + x;
  const P = (x: number, y: number): Pt => ({ x: x * T, y: y * T });
  const set = (x: number, y: number, floor: number) => {
    ground[I(x, y)] = floor;
    block[I(x, y)] = 0;
  };
  const solidAt = (x: number, y: number) => (block[I(Math.floor(x), Math.floor(y))] = 1);
  const obj = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) =>
    objects.push({ key: 'ln-lab', frame, ...P(x, y), ...o });
  const decal = (frame: string, x: number, y: number, o: Partial<WorldObject> = {}) =>
    decals.push({ key: 'ln-lab', frame, ...P(x, y), depth: -48, alpha: 0.9, ...o });
  const light = (x: number, y: number, radius: number, color: number, o: Partial<Light> = {}) =>
    lights.push({ ...P(x, y), radius, color, flicker: 0.04, ...o });
  /** A little off true: nothing here was set down square, or stayed that way. */
  const tilt = (n = 4) => (R() - 0.5) * n;
  /** Something to look at: the hero thinks `says`. */
  const look = (
    id: string,
    frame: string,
    x: number,
    y: number,
    label: string,
    says: string,
    o: Partial<Thing> = {},
  ) => things.push({ id, key: 'ln-lab', frame, ...P(x, y), label, says, ...o });

  // Underground it is dark at any hour; on the surface, earth and ash, and level 0's roof.
  for (let y = 0; y < LH; y++) {
    for (let x = 0; x < LW; x++) {
      if (y < SURFACE) indoors[I(x, y)] = 1;
      else ground[I(x, y)] = TL.ASH;
    }
  }
  for (let y = LEVEL0.y0; y <= LEVEL0.y1; y++) {
    for (let x = LEVEL0.x0; x <= LEVEL0.x1; x++) {
      ground[I(x, y)] = TL.ROOFTOP;
      indoors[I(x, y)] = 1;
    }
  }
  /** Carves a room out of the ground: floor, and free to walk (tiles, inclusive). */
  const room = (x0: number, y0: number, x1: number, y1: number, floor: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, floor);
  };
  /**
   * A wall along the line between two rows (`y` in tiles), from x0 to x1,
   * with doorways left open. It stands just outside the room: in the row
   * above the line for a room below it (`side` -1), or below it (+1).
   */
  const hwall = (
    y: number,
    x0: number,
    x1: number,
    side: 1 | -1,
    gaps: [number, number][] = [],
  ) => {
    let from = x0 * T - WALL;
    for (const [a, b] of [...gaps, [x1 + 1, x1 + 1] as [number, number]]) {
      const to = Math.min(a * T, (x1 + 1) * T + WALL);
      const top = side < 0 ? y * T - WALL : y * T;
      if (to > from) walls.push({ kind: 'concrete', x: from, y: top, w: to - from, h: WALL });
      from = (b + 1) * T;
    }
  };
  /** The same down the line between two columns: left of it (-1) or right of it (+1). */
  const vwall = (x: number, y0: number, y1: number, side: 1 | -1) => {
    const left = side < 0 ? x * T - WALL : x * T;
    walls.push({ kind: 'concrete', x: left, y: y0 * T, w: WALL, h: (y1 + 1 - y0) * T });
  };
  /** A cable laid along the floor from point to point, in lengths. */
  const cable = (pts: [number, number][]) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i] as [number, number];
      const [x1, y1] = pts[i + 1] as [number, number];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const a = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
      for (let d = 1.7; d < len + 0.5; d += 3.2) {
        const k = Math.min(d, len) / len;
        decal('cable', x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, {
          angle: a + tilt(8),
          depth: -44,
          alpha: 1,
        });
      }
    }
  };

  // --- Chamber 7 ------------------------------------------------------------------------
  // The hall under Victor's shed, stone for stone, looking-glass wise: the
  // same chalk circle, the same candles still burning, the same shelves and
  // stairs. The Facility poured a concrete box round it and moved in: they
  // broke through its wall in two places, ran cables to the mirror, clamped
  // the dais, taped the circle off and tagged everything in it, and sank a
  // pier into the old stairs. Everyone left; the red lamp still turns, one
  // screen still scrolls, a rack still blinks.
  const C7 = CHAMBER;
  const cx1 = C7.x0 + C7.w - 1;
  const cy1 = C7.y0 + C7.h - 1;
  room(C7.x0, C7.y0, cx1, cy1, TL.CONCRETE);
  hwall(C7.y0, C7.x0, cx1, -1);
  hwall(cy1 + 1, C7.x0, cx1, 1, [[57, 58]]);
  vwall(C7.x0, C7.y0, cy1, -1);
  vwall(cx1 + 1, C7.y0, cy1, 1);
  const mirror = labMirror();
  const mx = mirror.x / T;
  const my = mirror.y / T;
  // The same seed as the cellar's: the same sigils, the same wax, the same bones.
  const hall = layHall({
    mid: mirror,
    flip: true,
    R: mulberry32(6660),
    floor: (x, y) => set(x, y, TL.ROCK),
    solid: (x, y) => (block[I(x, y)] = 1),
    objects,
    decals,
    lights,
    walls,
    patches,
    // Broken through to the south, for the door, and to the west, for the cables.
    gaps: [
      [Math.PI / 2, 0.12],
      [0, 0.11],
    ],
  });
  // Stones knocked out of the wall where they broke through.
  for (const [x, y] of [
    [55.2, 35.9],
    [60.4, 36.3],
    [42.8, 24.2],
    [42.5, 28.4],
  ] as const) {
    walls.push({ kind: 'stone', x: x * T - 7, y: y * T - 7, w: 14, h: 14 });
    for (let k = 0; k < 2; k++)
      decals.push({ frame: 'debris', ...P(x + tilt(1.6), y + tilt(1.2)), angle: R() * 360 });
  }
  // The old stairs go up the same way, and run into a pier of poured concrete.
  walls.push({ kind: 'concrete', x: 73.3 * T, y: 23.4 * T, w: (cx1 + 1 - 73.3) * T, h: 4.2 * T });
  look('old-stairs', 'tag', 71.2, 26.4, t().use.oldStairs, t().thoughts.oldStairs, { angle: -12 });
  // The lectern is there; the book on it is not.
  things.push({
    id: 'lab-lectern',
    key: 'ln-cellar',
    frame: 'lecternBare',
    ...hall.lectern,
    label: t().use.lectern,
    says: t().thoughts.lectern,
  });

  // What the Facility did to the circle: clamps on the dais, one sprung;
  // tape round the chalk, sagging; a marker by everything in it.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const sprung = k === 4;
    decal('clamp', mx + Math.cos(a) * 2.25, my + Math.sin(a) * 2.25, {
      angle: (a * 180) / Math.PI + (sprung ? 38 : 0),
      depth: -44,
      alpha: 1,
    });
  }
  const tape = 5.7;
  for (let k = -tape + 1; k < tape; k += 2) {
    // The south side is left open where they walked in and out.
    if (Math.abs(k) > 1.6) decal('hazard', mx + k, my + tape, { angle: tilt(4), depth: -44 });
    if (Math.abs(k + 2.7) > 0.5) decal('hazard', mx + k, my - tape, { angle: tilt(4), depth: -44 });
    decal('hazard', mx - tape, my + k, { angle: 90 + tilt(4), depth: -44 });
    if (Math.abs(k - 1.3) > 0.5)
      decal('hazard', mx + tape, my + k, { angle: 90 + tilt(4), depth: -44 });
  }
  for (const [x, y] of [
    [64.6, 29.4],
    [52.6, 19.9],
    [54.9, 32.4],
    [60.8, 23.1],
    [53.1, 24.6],
    [62.4, 31.2],
    [56.2, 21.3],
    [65.2, 25.6],
  ] as const) {
    decal('tag', x, y, { angle: tilt(40), depth: -43, alpha: 1 });
  }
  // Cables from the dais out through the breaches to the racks and the console.
  cable([
    [mx - 2.1, my + 0.3],
    [48.8, 28.7],
    [44.6, 26.1],
    [41.2, 21.4],
  ]);
  cable([
    [mx + 0.4, my + 2.2],
    [57.7, 36.4],
    [49.4, 38.4],
  ]);
  cable([
    [mx + 2.1, my - 0.5],
    [65.8, 23.6],
    [71.2, 17.3],
    [75.8, 16.1],
  ]);
  // Work lights on tripods, turned on the circle: one still burns.
  obj('worklight', 52.4, 33.1, { angle: -35 + tilt(6) });
  solidAt(52.4, 33.1);
  light(53, 32.4, 150, 0xf4f2e8, { flicker: 0.03 });
  obj('worklightDown', 63.2, 32.9, { angle: 160 + tilt(10) });

  // Along the south wall, west of the door: the console, its chair on its side.
  obj('console', 47.6, 39.55, { angle: tilt(2), depth: 40 * T });
  for (const x of [46, 47, 48, 49]) solidAt(x, 39);
  things.push({
    id: 'lab-screen',
    key: 'ln-lab',
    frame: 'screenOn',
    ...P(48.4, 39.1),
    depth: 40 * T + 2,
    label: t().use.screen,
    says: t().thoughts.screen,
  });
  light(48.4, 38.6, 70, SCREEN, { flicker: 0.12 });
  things.push({
    id: 'shift-log',
    key: 'ln-lab',
    frame: 'logbook',
    ...P(46.4, 39.2),
    depth: 40 * T + 2,
    angle: 9,
    label: t().use.shiftLog,
    read: 'shift-log',
  });
  obj('chairDown', 50.2, 37.6, { angle: 200 + tilt(10) });
  // East of the door, a desk: the keycard is in its drawer, among junk.
  things.push({
    id: 'lab-desk',
    key: 'ln-lab',
    frame: 'labDesk',
    ...P(66.2, 39.6),
    angle: -3,
    label: t().use.labDesk,
    hoard: {
      place: t().hoard.deskDrawer,
      items: ['keycard'],
      junk: [t().hoard.junk.pens, t().hoard.junk.pager, t().hoard.junk.printouts],
    },
  });
  solidAt(65, 39);
  solidAt(66, 39);
  obj('stool', 64.3, 37.9, { angle: R() * 360 });
  // Server racks down the west wall and in the north-east corner; one still blinks.
  for (const [x, y, a] of [
    [38.45, 14.6, 1],
    [38.45, 16.4, -1.5],
    [38.45, 18.2, 2.5],
    [38.45, 20, -0.5],
    [77.55, 14.4, 1.5],
    [77.55, 16.2, -2],
  ] as const) {
    obj('rack', x, y, { angle: 90 + a });
    solidAt(x, y);
  }
  light(38.8, 18.2, 26, 0x6aff8a, { flicker: 0.5 });
  // Shelves and a sample fridge on the east wall, its door hanging open.
  obj('shelfLab', 77.45, 30.6, { angle: -90 + tilt(3) });
  solidAt(77, 30);
  solidAt(77, 31);
  obj('fridgeLab', 77.4, 33.4, { angle: -90 + tilt(2) });
  solidAt(77, 33);
  obj('labDesk', 39.4, 31.4, { angle: 90 + tilt(3) });
  solidAt(39, 31);
  obj('trolley', 40.6, 35.2, { angle: 75 + tilt(12) });
  solidAt(40, 35);
  // The red lamp over the door turns and turns; a panel overhead flickers.
  obj('alarmLamp', 58, 40.75);
  light(58, 40.2, 160, ALARM, { slow: true, flicker: 0.45 });
  light(44, 15.5, 110, PANEL, { flicker: 0.35 });
  light(72.5, 37, 90, PANEL, { flicker: 0.5 });
  decal('stencil7', 54.6, 38.4, { alpha: 0.75, angle: tilt(2) });
  decal('stencilLevel', 61.6, 38.5, { alpha: 0.75, angle: tilt(2) });
  decal('crack', 69.6, 39.2, { angle: R() * 360, alpha: 0.7 });
  decal('crack', 40.2, 26.6, { angle: R() * 360, alpha: 0.6 });
  decal('crack', 74.8, 21.4, { angle: R() * 360, alpha: 0.6 });
  decal('stain', 52.2, 39.6, { angle: R() * 360, alpha: 0.6 });
  for (let k = 0; k < 12; k++) {
    const [x, y] = R() < 0.5 ? [44 + R() * 26, 36.6 + R() * 3.4] : [39 + R() * 4, 13 + R() * 26];
    decal(`papers${k % 3}`, x, y, { angle: R() * 360 });
  }

  // The door: shut, and it takes a keycard.
  room(57, cy1 + 1, 58, HALLWAY.y0 - 1, TL.GRATE);
  things.push({
    id: 'door7',
    key: 'ln-lab',
    frame: 'labDoor',
    ...P(58, cy1 + 1.2),
    depth: (cy1 + 1) * T - 6,
    label: t().use.door,
    door: {
      tiles: [
        [57, cy1 + 1],
        [58, cy1 + 1],
      ],
      open: 'labDoorOpen',
      lock: {
        key: 'keycard',
        fact: 'door7-lock',
        says: t().thoughts.keycard,
        open: 'door7-open',
        unlock: t().use.swipe,
      },
    },
  });
  vwall(57, cy1 + 1, HALLWAY.y0 - 1, -1);
  vwall(59, cy1 + 1, HALLWAY.y0 - 1, 1);
  decal('hazard', 58, cy1 + 2, { depth: -49 });

  // --- The corridor -----------------------------------------------------------------------
  // Long and low, lit only by the emergency lamps. Doors on either side,
  // every one sealed; the stairs up at the west end; the far east end has
  // come down.
  const { x0: hx0, x1: hx1, y0: hy0, y1: hy1 } = HALLWAY;
  room(hx0, hy0, hx1, hy1, TL.LINO);
  hwall(hy0, hx0, hx1, -1, [
    [17, 20],
    [57, 58],
  ]);
  hwall(hy1 + 1, hx0, hx1, 1, [
    [29, 30],
    [85, 86],
  ]);
  vwall(hx0, hy0, hy1, -1);
  vwall(hx1 + 1, hy0, hy1, 1);
  for (const [x, lit] of [
    [24, true],
    [37, true],
    [50, false],
    [66, true],
    [79, true],
    [93, false],
    [104, true],
  ] as const) {
    obj('lampEmergency', x, hy0 + 0.25);
    if (lit) light(x, hy0 + 0.8, 70, EMERGENCY, { flicker: 0.05 });
  }
  const sealed = (x: number, north: boolean) =>
    look(
      `sealed-${x}`,
      'sealedDoor',
      x,
      north ? hy0 - 0.15 : hy1 + 1.15,
      t().use.sealed,
      t().thoughts.sealed,
      {
        angle: north ? 0 : 180,
      },
    );
  for (const x of [27, 34, 46, 69, 82, 96, 105]) sealed(x, true);
  for (const x of [40, 45, 52, 64, 109]) sealed(x, false);
  // The east end: the ceiling down across it, and beyond, more of the place.
  obj('rubble', hx1 - 1.4, hy0 + 1, { angle: tilt(20) });
  for (let y = hy0; y <= hy1; y++) for (let x = hx1 - 2; x <= hx1; x++) solidAt(x, y);
  for (let k = 0; k < 6; k++)
    decals.push({ frame: 'debris', ...P(hx1 - 6 + R() * 4, hy0 + R() * 3), angle: R() * 360 });
  obj('trolley', 73.2, hy0 + 0.6, { angle: 172 + tilt(8) });
  solidAt(73, hy0);
  obj('extinguisher', 43.2, hy1 + 0.6, { angle: tilt(6) });
  decal('puddle', 61.5, hy0 + 1.6, { angle: R() * 360, alpha: 0.75 });
  decal('puddle', 98.2, hy0 + 1.2, { angle: R() * 360, alpha: 0.7 });
  decal('arrows', 40.5, hy0 + 1, { angle: 180, alpha: 0.6 });
  decal('arrows', 76.5, hy0 + 1, { angle: 180, alpha: 0.5 });
  decal('stencilLevel', 61.2, hy0 + 1.1, { alpha: 0.6, angle: tilt(3) });
  decal('signVivarium', 88.6, hy1 + 0.55, { alpha: 0.9, depth: -40 });
  decal('signExit', 32.6, hy1 + 0.55, { alpha: 0.9, depth: -40 });
  for (let k = 0; k < 10; k++)
    decal(`papers${k % 3}`, 20 + R() * 85, hy0 + R() * 2.6, { angle: R() * 360 });

  // The stairs up to level 0, at the west end: the shutter at the top is
  // down, and the freight lift beside them is dead.
  room(15, 38, 22, hy0 - 1, TL.CONCRETE);
  hwall(38, 15, 22, -1);
  vwall(15, 38, hy0 - 1, -1);
  vwall(23, 38, hy0 - 1, 1);
  decal('flight', 18.5, 40.1, { depth: -47, alpha: 1 });
  look('shutter', 'shutter', 18.5, 38.3, t().use.shutter, t().thoughts.shutter, {
    angle: tilt(1.5),
  });
  look('lift', 'liftDoor', 22.6, 42.6, t().use.lift, t().thoughts.lift, { angle: 90 });
  solidAt(22, 42);
  solidAt(22, 43);
  obj('lampEmergency', 15.25, 41, { angle: -90 });
  light(15.8, 41, 70, EMERGENCY, { flicker: 0.05 });
  decal('stencilLevel', 19.2, 43.6, { alpha: 0.7, angle: tilt(3) });
  decal('stain', 16.6, 43.2, { angle: R() * 360, alpha: 0.5 });

  // --- The vivarium -----------------------------------------------------------------------
  // A long hall with five cages along its far wall, bars at the front,
  // concrete between, a drain in front of them. Two still hold what came
  // through the mirror; two are empty and shut, nobody says where to; the
  // last is empty with its bars bent outward. A desk to watch them from,
  // a corner to hose them down.
  room(70, 49, 104, CAGE_Y1, TL.CONCRETE);
  room(85, hy1 + 1, 86, hy1 + 1, TL.CONCRETE);
  room(71, CAGE_Y0 - 1, 99, CAGE_Y0 - 1, TL.GRATE);
  hwall(49, 70, 104, -1, [[85, 86]]);
  hwall(CAGE_Y1 + 1, 70, 104, 1);
  vwall(70, 49, CAGE_Y1, -1);
  vwall(105, 49, CAGE_Y1, 1);
  const foes: FoeSpawn[] = [];
  const kinds = ['empty', 'empty', 'crawler', 'shade', 'bent'] as const;
  /** Concrete between one cage and the next, in tile column `x`. */
  const between = (x: number) =>
    walls.push({
      kind: 'concrete',
      x: x * T + 4,
      y: CAGE_Y0 * T,
      w: T - 8,
      h: (CAGE_Y1 + 1 - CAGE_Y0) * T,
    });
  between((CAGES[0] as number) - 1);
  CAGES.forEach((x0, k) => {
    const kind = kinds[k];
    const mid = x0 + CAGE_W / 2;
    room(x0, CAGE_Y0, x0 + CAGE_W - 1, CAGE_Y1, TL.GRATE);
    between(x0 + CAGE_W);
    // The bars across the front; the last cage's are bent wide open.
    if (kind !== 'bent') {
      walls.push({ kind: 'bars', x: x0 * T, y: CAGE_Y0 * T, w: CAGE_W * T, h: BARS });
    } else {
      walls.push({ kind: 'bars', x: x0 * T, y: CAGE_Y0 * T, w: 1.6 * T, h: BARS });
      walls.push({ kind: 'bars', x: (x0 + 3.4) * T, y: CAGE_Y0 * T, w: 1.6 * T, h: BARS });
      decal('barsBent', mid, CAGE_Y0 - 0.25, { depth: -29, alpha: 1 });
      decal('scratches', mid, CAGE_Y0 - 1.6, { angle: tilt(30), alpha: 0.7 });
    }
    decal('drain', mid, CAGE_Y1 - 0.6, { alpha: 0.9 });
    // The empty ones were left as they were: a bowl kicked over, gnawed bones, claw marks.
    if (kind === 'empty') {
      decal('bowl', x0 + 1 + R() * 3, CAGE_Y0 + 2 + R() * 3, { depth: -44, alpha: 1 });
      decals.push({ frame: 'bones', ...P(x0 + 1.2 + R() * 2.6, CAGE_Y1 - 1.6), angle: R() * 360 });
      decal('scratches', x0 + 0.8 + R() * 3, CAGE_Y1 - 0.2, { angle: 180 + tilt(20), alpha: 0.6 });
      decal('stain', mid + tilt(2), CAGE_Y0 + 3.4, { angle: R() * 360, alpha: 0.45 });
    } else {
      decal('bowl', x0 + 0.7 + R() * 0.4, CAGE_Y1 - 0.4, { depth: -44, alpha: 1 });
    }
    // A plaque on the front of each, and a lamp over all but the shade's.
    things.push({
      id: `plaque-${k + 1}`,
      key: 'ln-lab',
      frame: 'plaque',
      ...P(mid, CAGE_Y0 - 0.35),
      angle: tilt(5),
      label: t().use.plaque,
      says: t().thoughts.plaques[k] as string,
    });
    if (kind !== 'shade') light(mid, CAGE_Y0 + 2.5, 74, CAGE, { flicker: k === 1 ? 0.4 : 0.06 });
    if (kind === 'crawler' || kind === 'shade')
      foes.push({ kind, ...P(mid, CAGE_Y0 + 3.5), caged: true });
  });
  for (let x = 71.5; x < 100; x += 2)
    decal('hazard', x, CAGE_Y0 - 1.55, { depth: -49, alpha: 0.85, angle: tilt(2) });
  // The desk they watched from, facing the cages; the feeding chart on it.
  obj('console', 77.6, 50.4, { angle: 180 + tilt(2), depth: 50 * T });
  for (const x of [76, 77, 78, 79]) solidAt(x, 50);
  obj('screenOff', 77.2, 50.6, { angle: 180 + tilt(6), depth: 50 * T + 2 });
  obj('chairLab', 78.3, 52, { angle: 110 + tilt(20) });
  things.push({
    id: 'feed-chart',
    key: 'ln-lab',
    frame: 'logbook',
    ...P(79.4, 50.5),
    depth: 50 * T + 2,
    angle: -7,
    label: t().use.chart,
    says: t().thoughts.chart,
  });
  // Where the feed was made up: a table, buckets, a trolley; a shelf and a fridge.
  obj('labDesk', 71.4, 50.6, { angle: 90 + tilt(3) });
  solidAt(71, 50);
  obj('bucket', 72.9, 52.6, { angle: R() * 360 });
  obj('bucket', 71, 52.9, { angle: R() * 360 });
  obj('trolley', 73.6, 55.4, { angle: 14 + tilt(12) });
  solidAt(73, 55);
  obj('shelfLab', 89.6, 49.45, { angle: tilt(3) });
  solidAt(89, 49);
  solidAt(90, 49);
  obj('fridgeLab', 92.4, 49.5, { angle: tilt(2) });
  solidAt(92, 49);
  // The wash-down corner past the last cage: a hose, a drain, a bucket on its side.
  room(101, CAGE_Y0 - 1, 104, CAGE_Y1, TL.GRATE);
  decal('hose', 102.6, 60.4, { angle: 90 + tilt(20), alpha: 1 });
  decal('drain', 102.6, 64.6, { alpha: 0.9 });
  decal('puddle', 102.2, 62.6, { angle: R() * 360, alpha: 0.7 });
  obj('bucket', 103.6, 63.4, { angle: R() * 360 });
  obj('trolley', 99.6, 52.2, { angle: tilt(12) });
  solidAt(99, 52);
  decal('stain', 86, 55.5, { angle: R() * 360, alpha: 0.5 });
  decal('stain', 95.4, 53.2, { angle: R() * 360, alpha: 0.4 });
  for (let k = 0; k < 5; k++)
    decal(`papers${k % 3}`, 74 + R() * 26, 51 + R() * 5, { angle: R() * 360 });
  for (const x of [74, 97]) {
    obj('lampEmergency', x, 49.25);
    light(x, 49.8, 64, EMERGENCY, { flicker: 0.05 });
  }
  light(86.5, 53.5, 120, PANEL, { flicker: 0.4 });

  // --- The checkpoint ----------------------------------------------------------------------
  // Where the guards sat: a booth, turnstiles, their lockers — and the
  // weapons locker, left open. Through the blast doors, the tunnel up.
  room(24, 49, 35, 63, TL.LINO);
  room(29, hy1 + 1, 30, hy1 + 1, TL.LINO);
  hwall(49, 24, 35, -1, [[29, 30]]);
  hwall(64, 24, 35, 1, [[29, 30]]);
  vwall(24, 49, 63, -1);
  vwall(36, 49, 63, 1);
  obj('guardDesk', 27.2, 52.2, { angle: tilt(2) });
  for (const x of [26, 27, 28]) solidAt(x, 52);
  obj('screenOff', 26.6, 51.8, { angle: -6 });
  obj('chairLab', 27.4, 51.0, { angle: 260 + tilt(20) });
  things.push({
    id: 'gun-locker',
    key: 'ln-lab',
    frame: 'gunLocker',
    ...P(35.2, 52.4),
    angle: 270,
    label: t().use.gunLocker,
    hoard: {
      place: t().hoard.gunLocker,
      items: ['pistol'],
      junk: [t().hoard.junk.holster, t().hoard.junk.manual],
    },
  });
  solidAt(35, 52);
  things.push({
    id: 'ammo',
    key: 'ln-foes',
    frame: 'ammo',
    ...P(35.1, 54.4),
    angle: 92,
    label: t().use.rounds,
  });
  solidAt(35, 54);
  for (const [y, f] of [
    [56.2, 'locker'],
    [57.2, 'lockerOpen'],
    [58.2, 'locker'],
    [59.2, 'locker'],
  ] as const) {
    obj(f, 24.45, y, { angle: 90 + tilt(2) });
    solidAt(24, y);
  }
  // Turnstiles across the hall, the way out between them.
  for (const x of [26, 27, 32, 33]) {
    obj('turnstile', x + 0.5, 60.5, { angle: tilt(3) });
    solidAt(x, 60);
  }
  for (const x of [25, 28, 31, 34]) {
    solidAt(x, 60);
    obj('barrierPost', x + 0.5, 60.5);
  }
  decal('hazard', 29.9, 60.5, { depth: -49 });
  obj('lampExit', 29.9, 63.7);
  light(29.9, 63.2, 55, 0x5aff8a, { flicker: 0.03 });
  decal('signExit', 32.4, 63.55, { alpha: 0.9, depth: -40 });
  obj('lampEmergency', 30, 49.25);
  light(30, 49.8, 60, EMERGENCY, { flicker: 0.05 });
  for (let k = 0; k < 4; k++)
    decal(`papers${k % 3}`, 25 + R() * 9, 53 + R() * 5, { angle: R() * 360 });

  // The blast doors, stuck half open.
  room(29, 64, 30, TUNNEL.y0 - 1, TL.CONCRETE);
  vwall(29, 64, TUNNEL.y0 - 1, -1);
  vwall(31, 64, TUNNEL.y0 - 1, 1);
  obj('blastDoor', 28.55, 65, { depth: 66 * T });
  obj('blastDoor', 31.45, 65, { depth: 66 * T, angle: 180 });

  // --- The tunnel -------------------------------------------------------------------------
  // A long ramp for trucks, climbing from level −1 to the surface. Lamps
  // every so often, some dead; cables along the wall; a cart where its
  // battery gave out; a slope of fallen earth. The last stretch is open
  // to the sky, between retaining walls.
  const { x0: tx0, x1: tx1, y0: ty0, y1: ty1 } = TUNNEL;
  room(tx0, ty0, tx1, ty1, TL.CONCRETE);
  hwall(ty0, tx0, tx1, -1, [[29, 30]]);
  vwall(tx0, ty0, ty1, -1);
  vwall(tx1 + 1, ty0, ty1, 1);
  patches.push({
    kind: 'asphalt',
    width: 5.2 * T,
    pts: [P(30, SURFACE - 6), P(30.1, ty1 + 0.6)],
  });
  for (const [y, west, lit] of [
    [70, true, true],
    [77, false, true],
    [84, true, false],
    [91, false, true],
    [98, true, false],
    [105, false, true],
  ] as const) {
    obj('lampEmergency', west ? tx0 + 0.25 : tx1 + 0.75, y, { angle: west ? -90 : 90 });
    if (lit) light(west ? tx0 + 0.8 : tx1 + 0.2, y, 80, EMERGENCY, { flicker: 0.05 });
  }
  for (let y = ty0 + 1.5; y < SURFACE - 1; y += 3.4)
    decal('cable', tx1 + 0.55, y, { angle: 90 + tilt(6), depth: -44, alpha: 1 });
  for (const y of [72, 88, 104]) decal('arrows', 30, y, { angle: 90, alpha: 0.5 });
  obj('cart', 31.2, 80, { angle: 6 + tilt(4) });
  for (let y = 79; y <= 81; y++) solidAt(31, y);
  solidAt(30.6, 80);
  obj('rubble', 28.2, 92.2, { angle: tilt(30), scale: 0.9 });
  for (let y = 91; y <= 93; y++) for (const x of [27, 28]) solidAt(x, y);
  for (let k = 0; k < 6; k++)
    decals.push({ frame: 'debris', ...P(28 + R() * 3, 89 + R() * 6), angle: R() * 360 });
  decal('puddle', 29.4, 74.5, { angle: R() * 360, alpha: 0.75 });
  decal('puddle', 30.8, 97.2, { angle: R() * 360, alpha: 0.7 });
  decal('crack', 29, 85, { angle: R() * 360, alpha: 0.7 });
  decal('stain', 30.6, 82.6, { angle: R() * 360, alpha: 0.5 });
  for (let k = 0; k < 4; k++)
    decal(`papers${k % 3}`, 27.5 + R() * 4.5, 67 + R() * 36, { angle: R() * 360 });
  // Where the roof ends and the sky begins.
  decal('hazard', 28.5, SURFACE - 0.3, { depth: -49, alpha: 0.7 });
  decal('hazard', 31, SURFACE - 0.3, { depth: -49, alpha: 0.7, angle: 180 });

  // --- Level 0, from outside ---------------------------------------------------------------
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
  look('level0-door', 'sealedDoor', 76, front + 0.15, t().use.sealed, t().thoughts.entrance, {
    angle: 180,
  });
  obj('floodlight', 80.4, front + 0.35);
  for (const [x, a] of [
    [72.6, 4],
    [79.6, -7],
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

  // --- The yard ------------------------------------------------------------------------------
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
    pts: [P(30.1, YARD.y0 - 0.4), P(30.4, 124), P(31.6, 128.6), P(60, 129.2), P(110.6, 128.8)],
  });
  patches.push({ kind: 'asphalt', width: 5 * T, pts: [P(45, 123.2), P(66, 123.4)] });
  patches.push({ kind: 'asphalt', width: 4 * T, pts: [P(76, front + 0.4), P(76.4, 128.6)] });
  obj('carBurnt', 51.2, 123.2, { angle: 7 });
  for (let y = 122; y <= 123; y++) for (let x = 50; x <= 52; x++) solidAt(x, y);
  obj('carBurnt', 58.4, 123.6, { angle: 184, scale: 0.97 });
  for (let y = 123; y <= 124; y++) for (let x = 57; x <= 59; x++) solidAt(x, y);
  obj('barrier', 108.4, 128.6, { angle: 68 });
  obj('barrierPost', 109.6, 127.2);
  solidAt(109, 127);
  for (const [x, y, a] of [
    [42.4, 128.2, -8],
    [44.6, 127.1, 14],
    [70.2, 125.6, 82],
  ] as const) {
    obj('sandbags', x, y, { angle: a });
    solidAt(x, y);
  }
  // The marauder's fire, in an oil drum, and where he sleeps.
  obj('fireBarrel', 66.5, 126.5);
  solidAt(66.5, 126.5);
  light(66.5, 126.2, 120, FIRE, { flicker: 0.2 });
  decal('mattress', 68.8, 125.4, { angle: -12, depth: -46, alpha: 1 });
  foes.push({ kind: 'marauder', ...P(67.5, 128.5) });
  objects.push({ frame: 'crate', ...P(64.6, 125.2), angle: 12 });
  solidAt(64.6, 125.2);
  // The floodlight over the tunnel, and the dead lamps along the road.
  obj('floodlight', 34.6, front + 0.35);
  light(31.5, front + 2.5, 210, 0xfff2d0, { flicker: 0.02 });
  for (const x of [48, 72, 90, 104]) {
    obj('lampPost', x, 131.6);
    solidAt(x, 131.6);
  }
  // Dead trees, ash, rubbish.
  for (const [x, y] of [
    [20.5, 121.5],
    [24.5, 135.5],
    [47.5, 136.5],
    [86.5, 121.5],
    [93.5, 136.5],
    [98.5, 124.5],
    [21.5, 129.5],
    [76.5, 135.5],
    [60.5, 141.5],
    [104.5, 142.5],
    [36.5, 143.5],
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
    [38, 123],
    [55, 130.4],
    [80, 129.4],
    [95, 138],
  ] as const) {
    decal('crack', x, y, { angle: R() * 360, alpha: 0.8, depth: -90 });
  }

  wallTiles(walls, (x, y) => (block[I(x, y)] = 1));
  // The doorways stay open; the shut door is the scene's to block.
  for (const [x, y] of [
    [17, hy0 - 1],
    [18, hy0 - 1],
    [19, hy0 - 1],
    [20, hy0 - 1],
    [29, hy1 + 1],
    [30, hy1 + 1],
    [85, hy1 + 1],
    [86, hy1 + 1],
    [29, 64],
    [30, 64],
    [29, 65],
    [30, 65],
    [29, ty0],
    [30, ty0],
    [57, hy0 - 1],
    [58, hy0 - 1],
    [57, cy1 + 1],
    [58, cy1 + 1],
  ] as const) {
    block[I(x, y)] = 0;
  }
  for (let x = tx0; x <= tx1; x++) block[I(x, ty1)] = 0;

  return {
    realm: 'lower',
    w: LW,
    h: LH,
    ground,
    block,
    indoors,
    objects,
    decals,
    lights,
    // Below the mirror, facing the door: where you come to after a fall.
    spawn: P(mx, my + 3),
    buildings: [],
    portals: [
      {
        ...mirror,
        to: 'cellar',
        exit: cellarMirror(),
        label: t().use.mirror,
        fade: 'glint',
      },
    ],
    walls,
    patches,
    things,
    foes,
  };
}
