import { t } from '../i18n';
import type { FoeSpawn } from './combat';
import { cellarMirror, labMirror, wallTiles } from './ways';
import { CHAMBER, LH, LW, T, TL, mulberry32, type Pt } from './util';
import {
  GLASS,
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
/** The building's footprint: everything in it is under the roof (tiles, inclusive). */
const BUILDING = { x0: 14, y0: 10, x1: 105, y1: 93 };
/** The yard in front of it, fenced in (tiles, inclusive). */
const YARD = { x0: 20, y0: 94, x1: 99, y1: 114 };
/** The five cages along the vivarium's south wall: left edge of each, and their rows. */
const CAGES = [62, 67, 72, 77, 82];
const CAGE_Y0 = 85;
const CAGE_Y1 = 90;

/**
 * The Lower World: the Facility, a vast research complex built round the
 * mirror and abandoned in a hurry. Most of it is still solid roof; what is
 * built is the way out: Chamber 7, where the mirror stands, the corridor
 * past sealed doors, the vivarium where the beasts that came through are
 * still caged, the checkpoint with the guards' weapons locker, and the
 * fenced yard outside, where a marauder has made his camp.
 */
export function generateLab(): World {
  const R = mulberry32(7007);
  const N = LW * LH;
  const ground = new Uint8Array(N).fill(TL.ASH);
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

  // The building: flat roof over everything, and dark under it.
  for (let y = BUILDING.y0; y <= BUILDING.y1; y++) {
    for (let x = BUILDING.x0; x <= BUILDING.x1; x++) {
      ground[I(x, y)] = TL.ROOFTOP;
      indoors[I(x, y)] = 1;
    }
  }
  /** Carves a room out of the building: floor, and free to walk (tiles, inclusive). */
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

  // --- Chamber 7 ------------------------------------------------------------------------
  // A concrete box with no windows. The mirror lies in a raised steel ring
  // in the middle of the floor, cables snaking from it to the racks and
  // the console. Everyone left; the red lamp still turns, one screen still
  // scrolls, a rack still blinks.
  const C7 = CHAMBER;
  const cx1 = C7.x0 + C7.w - 1;
  const cy1 = C7.y0 + C7.h - 1;
  room(C7.x0, C7.y0, cx1, cy1, TL.CONCRETE);
  hwall(C7.y0, C7.x0, cx1, -1);
  hwall(cy1 + 1, C7.x0, cx1, 1, [[57, 58]]);
  vwall(C7.x0, C7.y0, cy1, -1);
  vwall(cx1 + 1, C7.y0, cy1, 1);
  const mirror = labMirror();
  decal('hazardRing', mirror.x / T, mirror.y / T, { depth: -49, alpha: 0.8 });
  decal('pad', mirror.x / T, mirror.y / T, { depth: -47, alpha: 1 });
  decals.push({ key: 'ln-up', frame: 'mirror', ...mirror, depth: -45, scale: 1.25 });
  light(mirror.x / T, mirror.y / T, 90, GLASS, { slow: true, flicker: 0.18 });
  light(mirror.x / T, mirror.y / T, 190, 0x5a8cff, { slow: true, flicker: 0.25 });
  // Clamps round the ring, one of them sprung.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const sprung = k === 4;
    decal('clamp', mirror.x / T + Math.cos(a) * 2.25, mirror.y / T + Math.sin(a) * 2.25, {
      angle: (a * 180) / Math.PI + (sprung ? 38 : 0),
      depth: -44,
      alpha: 1,
    });
  }
  // Cables from the ring out to the racks and the console.
  for (const [x, y, a] of [
    [61.2, 60.4, -12],
    [62.6, 59.2, -30],
    [55.6, 63.6, 140],
    [54.2, 64.9, 120],
  ] as const) {
    decal('cable', x, y, { angle: a + tilt(10), depth: -46, alpha: 1 });
  }
  // The console along the south-west, its chair on its side, papers everywhere.
  obj('console', 53.6, 66.55, { angle: tilt(2), depth: 67 * T });
  for (const x of [52, 53, 54, 55]) solidAt(x, 66);
  things.push({
    id: 'lab-screen',
    key: 'ln-lab',
    frame: 'screenOn',
    ...P(54.4, 66.1),
    depth: 67 * T + 2,
    label: t().use.screen,
    says: t().thoughts.screen,
  });
  light(54.4, 65.6, 70, SCREEN, { flicker: 0.12 });
  things.push({
    id: 'shift-log',
    key: 'ln-lab',
    frame: 'logbook',
    ...P(52.4, 66.2),
    depth: 67 * T + 2,
    angle: 9,
    label: t().use.shiftLog,
    read: 'shift-log',
  });
  obj('chairDown', 55.9, 64.7, { angle: 200 + tilt(10) });
  for (let k = 0; k < 9; k++) {
    decal(`papers${k % 3}`, 51.5 + R() * 9, 62.5 + R() * 5.5, { angle: R() * 360 });
  }
  // A desk by the east wall: the keycard is in its drawer, among junk.
  things.push({
    id: 'lab-desk',
    key: 'ln-lab',
    frame: 'labDesk',
    ...P(63.2, 66.6),
    angle: -3,
    label: t().use.labDesk,
    hoard: {
      place: t().hoard.deskDrawer,
      items: ['keycard'],
      junk: [t().hoard.junk.pens, t().hoard.junk.pager, t().hoard.junk.printouts],
    },
  });
  solidAt(62, 66);
  solidAt(63, 66);
  obj('stool', 61.4, 64.9, { angle: R() * 360 });
  // Server racks along the east wall; the middle one still blinks.
  for (const [y, a] of [
    [57.7, 1],
    [59.5, -1.5],
    [61.3, 2.5],
  ] as const) {
    obj('rack', 64.45, y, { angle: 90 + a });
    solidAt(64, y);
  }
  light(64.1, 59.5, 26, 0x6aff8a, { flicker: 0.5 });
  // Shelves and a sample fridge along the west wall, its door hanging open.
  obj('shelfLab', 50.55, 58.6, { angle: 90 + tilt(3) });
  solidAt(50, 58);
  solidAt(50, 59);
  obj('fridgeLab', 50.6, 61.4, { angle: 90 + tilt(2) });
  solidAt(50, 61);
  // The red lamp over the door turns and turns; a panel overhead flickers.
  obj('alarmLamp', 58, 56.2);
  light(58, 56.8, 150, ALARM, { slow: true, flicker: 0.45 });
  light(53.5, 59.5, 110, PANEL, { flicker: 0.35 });
  decal('stencil7', 52.6, 57.3, { alpha: 0.75, angle: tilt(2) });
  decal('crack', 60.6, 66.2, { angle: R() * 360, alpha: 0.7 });
  decal('crack', 52.2, 61.6, { angle: R() * 360, alpha: 0.6 });
  decal('stain', 57.2, 66.6, { angle: R() * 360, alpha: 0.6 });

  // The door: shut, and it takes a keycard.
  room(57, 69, 58, 72, TL.GRATE);
  things.push({
    id: 'door7',
    key: 'ln-lab',
    frame: 'labDoor',
    ...P(58, 69.2),
    depth: 69 * T - 6,
    label: t().use.door,
    door: {
      tiles: [
        [57, 69],
        [58, 69],
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
  vwall(57, 69, 72, -1);
  vwall(59, 69, 72, 1);
  decal('hazard', 58, 70, { depth: -49 });

  // --- The corridor -----------------------------------------------------------------------
  // Long and low, lit only by the emergency lamps. Doors on either side,
  // every one sealed; the far end has come down.
  const CX0 = 34;
  const CX1 = 84;
  room(CX0, 73, CX1, 75, TL.LINO);
  hwall(73, CX0, CX1, -1, [[57, 58]]);
  hwall(76, CX0, CX1, 1, [
    [35, 36],
    [72, 73],
  ]);
  vwall(CX0, 73, 75, -1);
  vwall(CX1 + 1, 73, 75, 1);
  for (const x of [38, 47, 66, 79]) {
    obj('lampEmergency', x, 73.25);
    light(x, 73.8, 70, EMERGENCY, { flicker: 0.05 });
  }
  const sealed = (x: number, north: boolean) =>
    things.push({
      id: `sealed-${x}`,
      key: 'ln-lab',
      frame: 'sealedDoor',
      ...P(x, north ? 72.85 : 76.15),
      angle: north ? 0 : 180,
      label: t().use.sealed,
      says: t().thoughts.sealed,
    });
  for (const x of [41, 51, 64, 76]) sealed(x, true);
  for (const x of [45, 54, 61]) sealed(x, false);
  // The east end: the ceiling down across it, and beyond, more of the place.
  obj('rubble', 82.6, 74, { angle: tilt(20) });
  for (const y of [73, 74, 75]) for (const x of [82, 83, 84]) solidAt(x, y);
  for (let k = 0; k < 5; k++)
    decals.push({ frame: 'debris', ...P(79 + R() * 3, 73 + R() * 3), angle: R() * 360 });
  obj('trolley', 69.2, 73.6, { angle: 172 + tilt(8) });
  solidAt(69, 73);
  obj('extinguisher', 44.2, 75.6, { angle: tilt(6) });
  decal('puddle', 61.5, 74.6, { angle: R() * 360, alpha: 0.75 });
  decal('arrows', 40.5, 74, { angle: 180, alpha: 0.6 });
  decal('signVivarium', 74.6, 75.55, { alpha: 0.9, depth: -40 });
  decal('signExit', 37.6, 75.55, { alpha: 0.9, depth: -40 });
  for (let k = 0; k < 6; k++)
    decal(`papers${k % 3}`, 40 + R() * 40, 73 + R() * 2.6, { angle: R() * 360 });

  // --- The vivarium -----------------------------------------------------------------------
  // A long hall with five cages along its far wall, bars at the front,
  // concrete between. Four still hold what came through the mirror; the
  // fifth is empty, its bars bent outward.
  room(62, 77, 85, CAGE_Y1, TL.CONCRETE);
  room(72, 76, 73, 76, TL.CONCRETE);
  hwall(77, 62, 85, -1, [[72, 73]]);
  hwall(CAGE_Y1 + 1, 62, 85, 1);
  vwall(62, 77, CAGE_Y1, -1);
  vwall(86, 77, CAGE_Y1, 1);
  const foes: FoeSpawn[] = [];
  const kinds = ['wolf', 'boar', 'crawler', 'shade', null] as const;
  CAGES.forEach((x0, k) => {
    const kind = kinds[k];
    room(x0, CAGE_Y0, x0 + 3, CAGE_Y1, TL.GRATE);
    // The bars across the front; the empty cage's are bent wide open.
    if (kind) {
      walls.push({ kind: 'bars', x: x0 * T, y: CAGE_Y0 * T, w: 4 * T, h: BARS });
    } else {
      walls.push({ kind: 'bars', x: x0 * T, y: CAGE_Y0 * T, w: 1.3 * T, h: BARS });
      walls.push({ kind: 'bars', x: (x0 + 2.8) * T, y: CAGE_Y0 * T, w: 1.2 * T, h: BARS });
      decal('barsBent', x0 + 2.05, CAGE_Y0 - 0.25, { depth: -29, alpha: 1 });
      decal('scratches', x0 + 2, CAGE_Y0 - 1.6, { angle: tilt(30), alpha: 0.7 });
    }
    // Concrete between this cage and the next.
    if (k < CAGES.length - 1) {
      const gx = x0 + 4;
      walls.push({
        kind: 'concrete',
        x: gx * T + 4,
        y: CAGE_Y0 * T,
        w: T - 8,
        h: (CAGE_Y1 + 1 - CAGE_Y0) * T,
      });
    }
    decal('drain', x0 + 2, CAGE_Y1 - 0.6, { alpha: 0.9 });
    decal('bowl', x0 + 0.7 + R() * 0.4, CAGE_Y1 - 0.4, { depth: -44, alpha: 1 });
    // A plaque on the front of each, and a lamp over all but the shade's.
    things.push({
      id: `plaque-${k + 1}`,
      key: 'ln-lab',
      frame: 'plaque',
      ...P(x0 + 2, CAGE_Y0 - 0.35),
      angle: tilt(5),
      label: t().use.plaque,
      says: t().thoughts.plaques[k] as string,
    });
    if (kind !== 'shade') light(x0 + 2, CAGE_Y0 + 2.5, 70, CAGE, { flicker: k === 1 ? 0.4 : 0.06 });
    if (kind) foes.push({ kind, ...P(x0 + 2, CAGE_Y0 + 3), caged: true });
  });
  for (let x = 63; x < 86; x += 2) decal('hazard', x, CAGE_Y0 - 0.85, { depth: -49, alpha: 0.85 });
  obj('labDesk', 63.4, 78.2, { angle: 90 + tilt(3) });
  solidAt(63, 78);
  obj('trolley', 80.6, 78.6, { angle: tilt(12) });
  solidAt(80, 78);
  obj('bucket', 84.6, 83.4, { angle: R() * 360 });
  decal('hose', 82.6, 81.2, { angle: tilt(20), alpha: 1 });
  decal('stain', 69, 82.5, { angle: R() * 360, alpha: 0.5 });
  for (const x of [66, 79]) {
    obj('lampEmergency', x, 77.25);
    light(x, 77.8, 60, EMERGENCY, { flicker: 0.05 });
  }

  // --- The checkpoint ----------------------------------------------------------------------
  // Where the guards sat: a booth, turnstiles, their lockers — and the
  // weapons locker, left open. Through the blast doors, the yard.
  room(30, 77, 41, 91, TL.LINO);
  room(35, 76, 36, 76, TL.LINO);
  hwall(77, 30, 41, -1, [[35, 36]]);
  hwall(92, 30, 41, 1, [[35, 36]]);
  vwall(30, 77, 91, -1);
  vwall(42, 77, 91, 1);
  obj('guardDesk', 33.2, 80.2, { angle: tilt(2) });
  for (const x of [32, 33, 34]) solidAt(x, 80);
  obj('screenOff', 32.6, 79.8, { angle: -6 });
  obj('chairLab', 33.4, 79.0, { angle: 260 + tilt(20) });
  things.push({
    id: 'gun-locker',
    key: 'ln-lab',
    frame: 'gunLocker',
    ...P(41.2, 80.4),
    angle: 270,
    label: t().use.gunLocker,
    hoard: {
      place: t().hoard.gunLocker,
      items: ['pistol'],
      junk: [t().hoard.junk.holster, t().hoard.junk.manual],
    },
  });
  solidAt(41, 80);
  things.push({
    id: 'ammo',
    key: 'ln-foes',
    frame: 'ammo',
    ...P(41.1, 82.4),
    angle: 92,
    label: t().use.rounds,
  });
  solidAt(41, 82);
  for (const [y, f] of [
    [84.2, 'locker'],
    [85.2, 'lockerOpen'],
    [86.2, 'locker'],
    [87.2, 'locker'],
  ] as const) {
    obj(f, 30.45, y, { angle: 90 + tilt(2) });
    solidAt(30, y);
  }
  // Turnstiles across the hall, the way out between them.
  for (const x of [32, 33, 38, 39]) {
    obj('turnstile', x + 0.5, 88.5, { angle: tilt(3) });
    solidAt(x, 88);
  }
  for (const x of [31, 34, 37, 40]) {
    solidAt(x, 88);
    obj('barrierPost', x + 0.5, 88.5);
  }
  decal('hazard', 35.9, 88.5, { depth: -49 });
  obj('lampExit', 35.9, 91.7);
  light(35.9, 91.2, 55, 0x5aff8a, { flicker: 0.03 });
  obj('lampEmergency', 36, 77.25);
  light(36, 77.8, 60, EMERGENCY, { flicker: 0.05 });
  for (let k = 0; k < 4; k++)
    decal(`papers${k % 3}`, 31 + R() * 9, 81 + R() * 5, { angle: R() * 360 });

  // The way out: blast doors that stuck half open.
  room(35, 92, 36, 93, TL.CONCRETE);
  vwall(35, 92, 93, -1);
  vwall(37, 92, 93, 1);
  obj('blastDoor', 34.55, 93, { depth: 94 * T });
  obj('blastDoor', 37.45, 93, { depth: 94 * T, angle: 180 });

  // The building's front, all along the yard.
  walls.push({
    kind: 'concrete',
    x: (BUILDING.x0 - 0.5) * T,
    y: 94 * T - WALL,
    w: (35 - BUILDING.x0 + 0.5) * T,
    h: WALL,
  });
  walls.push({
    kind: 'concrete',
    x: 37 * T,
    y: 94 * T - WALL,
    w: (BUILDING.x1 + 1.5 - 37) * T,
    h: WALL,
  });

  // --- The yard ------------------------------------------------------------------------------
  // Cracked asphalt over dead ground, ash in drifts; two cars burnt out
  // where they stood; a fallen barrier at the gate. One floodlight on the
  // wall still works. The marauder keeps a fire going in a drum.
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
    pts: [P(36, 94.3), P(36.3, 101), P(37.5, 105.5), P(60, 106), P(99.6, 105.8)],
  });
  patches.push({ kind: 'asphalt', width: 5 * T, pts: [P(43, 99.2), P(64, 99.4)] });
  obj('carBurnt', 51.2, 99.2, { angle: 7 });
  for (let y = 98; y <= 99; y++) for (let x = 50; x <= 52; x++) solidAt(x, y);
  obj('carBurnt', 58.4, 99.6, { angle: 184, scale: 0.97 });
  for (let y = 99; y <= 100; y++) for (let x = 57; x <= 59; x++) solidAt(x, y);
  obj('barrier', 97.4, 104.6, { angle: 68 });
  obj('barrierPost', 98.6, 103.2);
  solidAt(98, 103);
  for (const [x, y, a] of [
    [42.4, 104.2, -8],
    [44.6, 103.1, 14],
    [70.2, 101.6, 82],
  ] as const) {
    obj('sandbags', x, y, { angle: a });
    solidAt(x, y);
  }
  // The marauder's fire, in an oil drum, and where he sleeps.
  obj('fireBarrel', 66.5, 102.5);
  solidAt(66.5, 102.5);
  light(66.5, 102.2, 120, FIRE, { flicker: 0.2 });
  decal('mattress', 68.8, 101.4, { angle: -12, depth: -46, alpha: 1 });
  foes.push({ kind: 'marauder', ...P(67.5, 104.5) });
  objects.push({ frame: 'crate', ...P(64.6, 101.2), angle: 12 });
  solidAt(64.6, 101.2);
  // The floodlight over the door, and the dead lamps along the road.
  obj('floodlight', 39, 94.35);
  light(38, 96.5, 210, 0xfff2d0, { flicker: 0.02 });
  for (const x of [48, 72, 90]) {
    obj('lampPost', x, 107.6);
    solidAt(x, 107.6);
  }
  // Dead trees, ash, rubbish.
  for (const [x, y] of [
    [24.5, 97.5],
    [27.5, 111.5],
    [47.5, 112.5],
    [81.5, 96.5],
    [93.5, 112.5],
    [88.5, 99.5],
    [30.5, 104.5],
    [76.5, 111.5],
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
  for (let k = 0; k < 70; k++) {
    const x = YARD.x0 + 0.5 + R() * (YARD.x1 - YARD.x0);
    const y = YARD.y0 + 1 + R() * (YARD.y1 - YARD.y0 - 1);
    const v = R();
    if (v < 0.45) decals.push({ frame: 'tuft', ...P(x, y), angle: R() * 360, alpha: 0.6 });
    else if (v < 0.75) decal('ash', x, y, { angle: R() * 360, alpha: 0.7 });
    else if (v < 0.9) decals.push({ frame: 'debris', ...P(x, y), angle: R() * 360 });
    else decal('puddle', x, y, { angle: R() * 360, alpha: 0.6 });
  }
  for (const [x, y] of [
    [38, 99],
    [55, 106.4],
    [80, 105.4],
  ] as const) {
    decal('crack', x, y, { angle: R() * 360, alpha: 0.8, depth: -90 });
  }

  // On the roof: vents and units, here and there over the dark.
  for (let k = 0; k < 40; k++) {
    const x = BUILDING.x0 + 1 + Math.floor(R() * (BUILDING.x1 - BUILDING.x0 - 2));
    const y = BUILDING.y0 + 1 + Math.floor(R() * (BUILDING.y1 - BUILDING.y0 - 2));
    if (!block[I(x, y)] || !block[I(x + 1, y + 1)]) continue;
    obj(R() < 0.6 ? 'vent' : 'roofUnit', x + 1, y + 1, {
      angle: Math.floor(R() * 4) * 90 + tilt(3),
    });
  }

  wallTiles(walls, (x, y) => (block[I(x, y)] = 1));
  // The doorways stay open; the shut door is the scene's to block.
  for (const [x, y] of [
    [35, 76],
    [36, 76],
    [72, 76],
    [73, 76],
    [35, 92],
    [36, 92],
    [35, 93],
    [36, 93],
    [57, 72],
    [58, 72],
    [57, 69],
    [58, 69],
  ] as const) {
    block[I(x, y)] = 0;
  }

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
    spawn: P(58, 64.6),
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
