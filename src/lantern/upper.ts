import { MILL_HALF, millDoor, millMirror, millRing, tileCentre } from './mill';
import type { Building } from './town';
import { LOWER_MILL, T, TL, UH, UPPER_MILL, UW, makeNoise, mulberry32, type Pt } from './util';
import { GLASS, type Light, type World, type WorldObject } from './world';

const WARM = 0xffc070;
const LAMP = 0xfff0c8;

/**
 * The Upper World, for now one homestead on a country road: a village house
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

  // A green meadow.
  for (let y = 0; y < UH; y++) {
    for (let x = 0; x < UW; x++) {
      const v = n1(x * 0.12, y * 0.12) + 0.4 * n2(x * 0.3, y * 0.3);
      ground[I(x, y)] = v < 0.6 ? TL.UG1 : v < 0.95 ? TL.UG2 : TL.UG3;
    }
  }

  // The country road along the south edge, a gravel walk and a drive.
  for (let x = 0; x < UW; x++) {
    set(x, 26, TL.ASPH1);
    set(x, 27, TL.ASPH2);
  }
  for (let y = 19; y <= 25; y++) for (const x of [16, 17]) set(x, y, TL.GRAVEL);
  for (let y = 15; y <= 25; y++) for (let x = 24; x <= 26; x++) set(x, y, TL.GRAVEL);
  // The lane up to the mill, and a footpath from the back door to the vegetable beds.
  for (let x = 27; x <= UPPER_MILL.x; x++) set(x, 15, TL.UPATH);
  for (let y = UPPER_MILL.y + MILL_HALF + 1; y <= 15; y++) set(UPPER_MILL.x, y, TL.UPATH);
  for (let y = 6; y <= 7; y++) set(11, y, TL.UPATH);

  // --- The house -----------------------------------------------------------------------
  const house: Building = {
    name: 'Home',
    x0: 8,
    y0: 8,
    w: 15,
    h: 11,
    roof: 'tiles',
    chimneys: [{ x: 4.5, y: 1.4 }],
  };
  const floor = (x: number, y: number): number => {
    if (x <= 13 && y <= 12) return TL.CHECKER; // kitchen
    if (x <= 13) return TL.PLANK2; // bedroom
    if (y <= 13) return TL.PARQUET; // living room
    if (x >= 20) return TL.TILEW; // bathroom
    return TL.PLANK; // hall
  };
  const x1 = house.x0 + house.w - 1;
  const y1 = house.y0 + house.h - 1;
  for (let y = house.y0; y <= y1; y++) {
    for (let x = house.x0; x <= x1; x++) {
      const rim = x === house.x0 || x === x1 || y === house.y0 || y === y1;
      const inner =
        x === 14 || (y === 13 && x <= 14) || (y === 14 && x >= 14) || (x === 19 && y >= 14);
      const wall = rim || inner;
      set(x, y, wall ? TL.TIMBER : floor(x, y), wall ? 1 : 0);
    }
  }
  // Doors: kitchen–living, bedroom–hall, living–hall, hall–bath, back and front.
  for (const [x, y, f] of [
    [14, 10, TL.PARQUET],
    [14, 16, TL.PLANK],
    [17, 14, TL.PLANK],
    [19, 16, TL.TILEW],
    [11, 8, TL.CHECKER],
    [16, 18, TL.PLANK],
    [17, 18, TL.PLANK],
  ] as const) {
    set(x, y, f);
  }
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
  obj('tv', 18, 9);
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
  lamp(C(18, 9.6), 46, 0x8ab8ff);
  lamp(C(20.6, 10.5), 40, 0xa8d8ff);

  // Hall: a mat at the door, a coat stand, a plant.
  decal('doormat', 16.5, 17);
  obj('coatrack', 15, 15);
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
  objects.push({ key: 'ln-town', frame: 'stable', ...C(9, 14), scale: 0.7 });
  solid(9, 14);
  obj('wardrobe', 12, 14, { x: 12 * T });
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
  decal('step', 16.5, 18.9);
  light({ x: 17 * T, y: 19.9 * T }, 60, LAMP);

  // --- The yard ------------------------------------------------------------------------
  // A car in the drive.
  objects.push({ key: 'ln-up', frame: 'car', x: 25 * T, y: 19 * T, depth: 20.8 * T });
  for (let y = 17; y <= 20; y++) for (const x of [24, 25]) solid(x, y);

  // A picket fence along the road, gaps for the walk and the drive.
  for (let x = 3; x <= 29; x++) {
    if (x === 16 || x === 17 || (x >= 24 && x <= 26)) continue;
    set(x, 24, ground[I(x, 24)] as number, 1);
    obj('fence', x, 24);
  }
  obj('mailbox', 18, 25);
  solid(18, 25);
  for (const x of [12, 29]) {
    obj('streetlamp', x, 25);
    solid(x, 25);
    light(C(x, 25), 140, LAMP, { flicker: 0.01 });
  }

  // Flowers under the front windows; vegetable beds and a bench out the back.
  for (const x of [9, 10, 11, 12, 13, 19, 20, 21]) {
    obj('flowerbed', x, 19, { depth: 19 * T });
    solid(x, 19);
  }
  for (let x = 8; x <= 14; x++) {
    for (let y = 3; y <= 5; y++) {
      if (x === 11) continue;
      set(x, y, TL.SOIL);
      decals.push({ key: 'ln-town', frame: 'cabbage', ...C(x, y), depth: -45 });
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

  // --- The old mill --------------------------------------------------------------------
  // A ring of tumbled stone open to the sky; the sails lie broken in the grass.
  const mc = UPPER_MILL;
  millRing(mc.x, mc.y, (x, y, wall) => {
    if (wall && R() > 0.35) set(x, y, TL.WALL, 1);
    else {
      set(x, y, TL.FLAG);
      if (wall) decals.push({ frame: 'debris', ...C(x, y), angle: R() * 360 });
    }
  });
  const door = millDoor(mc);
  set(door.x, door.y, TL.FLAG);
  obj('millstoneBroken', mc.x, mc.y);
  solid(mc.x, mc.y);
  const mirror = tileCentre(millMirror(mc));
  decals.push({ key: 'ln-up', frame: 'mirrorCracked', ...mirror, depth: -44 });
  light(mirror, 70, GLASS, { flicker: 0.15, slow: true });
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
    spawn: C(16, 11),
    life: { buildings: [house], festoons: [], spots: [] },
    portals: [
      {
        ...mirror,
        to: 'lower',
        exit: tileCentre(millMirror(LOWER_MILL)),
        label: 'Step into the mirror',
      },
    ],
    sails: [],
  };
}
