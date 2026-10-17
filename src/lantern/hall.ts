import { CELLAR_MIRROR, T, type Pt } from './util';
import { GLASS, type GroundPatch, type Light, type ThinWall, type WorldObject } from './world';

const CANDLE = 0xffb050;
/** The hall: an ellipse round the mirror, its wall's middle line (tiles). */
export const HALL_RX = 13.6;
export const HALL_RY = 9;

/** Where the hall goes, and what it is laid into. */
export interface HallSite {
  /** The mirror (world pixels). */
  mid: Pt;
  /** Laid out as in a looking-glass, east for west. */
  flip: boolean;
  R: () => number;
  /** Makes a tile floor, free to walk. */
  floor: (x: number, y: number) => void;
  solid: (x: number, y: number) => void;
  objects: WorldObject[];
  decals: WorldObject[];
  lights: Light[];
  walls: ThinWall[];
  patches: GroundPatch[];
  /** Arcs of the wall that are not there: [angle, half-width] (radians, as in the cellar). */
  gaps?: [number, number][];
}

export interface Hall {
  /** A point given in the cellar's own tiles, where it falls in this hall (world pixels). */
  at: (x: number, y: number) => Pt;
  /** A point on the wall line, `a` radians round from the east, as in the cellar. */
  rim: (a: number, inset?: number) => Pt;
  /** The lectern by the shelves. */
  lectern: Pt;
}

/**
 * The vaulted hall round a mirror: a chalk circle with a seven-pointed
 * star, a stone dais, candles that never go out, pillars, shelves of old
 * books, an alchemist's corner, stairs going up. It is under Victor's shed,
 * and the same hall, looking-glass wise, is on the far side of the mirror,
 * where the Facility was built round it. Laid out in the cellar's own
 * tiles, so both come out stone for stone alike.
 */
export function layHall(site: HallSite): Hall {
  const { mid, flip, R, objects, decals, lights, walls, patches } = site;
  const s = flip ? -1 : 1;
  const at = (x: number, y: number): Pt => ({
    x: mid.x + s * (x - CELLAR_MIRROR.x) * T,
    y: mid.y + (y - CELLAR_MIRROR.y) * T,
  });
  /** Mirrored, a turn is the other way round, and the picture is flipped. */
  const turn = (o: Partial<WorldObject>): Partial<WorldObject> =>
    flip ? { ...o, angle: -(o.angle ?? 0), flipX: true } : o;
  const up = (frame: string, p: Pt, o: Partial<WorldObject> = {}) =>
    objects.push({ key: 'ln-cellar', frame, ...p, ...turn(o) });
  const decal = (frame: string, p: Pt, o: Partial<WorldObject> = {}) =>
    decals.push({ key: 'ln-cellar', frame, ...p, depth: -48, alpha: 0.9, ...turn(o) });
  const solidAt = (p: Pt) => site.solid(Math.floor(p.x / T), Math.floor(p.y / T));
  /** The cellar's tile (x, y), wherever it falls here. */
  const solidTile = (x: number, y: number) => solidAt(at(x + 0.5, y + 0.5));
  const light = (p: Pt, radius: number, color: number, o: Partial<Light> = {}) =>
    lights.push({ ...p, radius, color, flicker: 0.12, ...o });
  const rim = (a: number, inset = 0): Pt => ({
    x: mid.x + s * Math.cos(a) * (HALL_RX * T - inset),
    y: mid.y + Math.sin(a) * (HALL_RY * T - inset),
  });

  // The hall floor: every tile whose middle is inside the wall.
  const tx0 = Math.floor(mid.x / T - HALL_RX - 1);
  const ty0 = Math.floor(mid.y / T - HALL_RY - 1);
  for (let y = ty0; y <= ty0 + 2 * HALL_RY + 2; y++) {
    for (let x = tx0; x <= tx0 + 2 * HALL_RX + 2; x++) {
      const dx = ((x + 0.5) * T - mid.x) / (HALL_RX * T);
      const dy = ((y + 0.5) * T - mid.y) / (HALL_RY * T);
      if (dx * dx + dy * dy < 1) site.floor(x, y);
    }
  }
  // The stair passage out to the west.
  for (let y = 12; y <= 13; y++) {
    for (let x = 2; x <= 5; x++) {
      const p = at(x + 0.5, y + 0.5);
      site.floor(Math.floor(p.x / T), Math.floor(p.y / T));
    }
  }

  // The wall: rough stone all round, open where the passage leaves.
  const stone = (p: Pt, size = 16) =>
    walls.push({ kind: 'stone', x: p.x - size / 2, y: p.y - size / 2, w: size, h: size });
  const gaps: [number, number][] = [[Math.PI, 0.15], ...(site.gaps ?? [])];
  const steps = Math.ceil((2 * Math.PI * HALL_RX * T) / 6);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    if (gaps.some(([g, w]) => Math.abs(a - g) < w)) continue;
    stone(rim(a));
  }
  for (let x = 1.6; x <= 5.2; x += 0.2) {
    stone(at(x, 11.9));
    stone(at(x, 14.1));
  }
  for (let y = 11.9; y <= 14.1; y += 0.2) stone(at(1.6, y));

  // Flagstones under it all, and the stairs.
  patches.push(
    {
      kind: 'flagstones',
      pts: [mid],
      width: (HALL_RX + 0.4) * 2 * T,
      height: (HALL_RY + 0.4) * 2 * T,
    },
    { kind: 'flagstones', pts: [at(3.6, 13)], width: 4.4 * T, height: 2.4 * T },
  );
  decal('stairs', at(3.5, 13), { depth: -46, alpha: 1 });

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
    up('pillar', at(x + 0.5, y + 0.5), { depth: mid.y + (y + 1 - CELLAR_MIRROR.y) * T });
    solidTile(x, y);
  }

  // Along the north wall: shelves of old books, and a lectern.
  for (const x of [15, 17, 21, 23]) {
    up('shelf', at(x, 5.75), { angle: (R() - 0.5) * 3 });
    solidTile(x - 1, 5);
    solidTile(x, 5);
  }
  const lectern = at(19, 6.6);
  solidAt(lectern);
  light(at(19, 6.2), 46, CANDLE);

  // The alchemist's corner to the east: a long table, a cauldron, crates.
  up('longtable', at(29, 13), { depth: mid.y + 1.6 * T });
  for (let y = 11; y <= 14; y++) solidTile(28, y);
  light(at(28.8, 11.8), 50, CANDLE);
  light(at(29.2, 13.6), 40, 0x7aff9a, { flicker: 0.3 });
  up('cauldron', at(25.5, 17.5));
  solidAt(at(25.5, 17.5));
  light(at(25.5, 17.5), 60, 0x7aff9a, { slow: true, flicker: 0.3 });
  for (const [x, y, f] of [
    [26.5, 9.5, 'crate'],
    [25.6, 9.2, 'barrel'],
    [10.5, 10.5, 'crate'],
  ] as const) {
    objects.push({ frame: f, ...at(x, y), angle: R() * 360 * s });
    solidAt(at(x, y));
  }
  // Chests by the stairs, and one by the shelves.
  for (const [x, y, a] of [
    [9.5, 12.2, 4],
    [12.3, 6.4, -8],
  ] as const) {
    up('chest', at(x, y), { angle: a });
    solidAt(at(x, y));
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
    decal(`sigil${k % 3}`, rim(a, (1 - d) * HALL_RY * T), { angle: R() * 360, alpha: 0.6 });
  }
  for (const [x, y] of [
    [12, 16],
    [24, 7.5],
    [21.5, 19],
  ] as const) {
    decal('skull', at(x, y), { angle: R() * 360 });
  }
  for (let k = 0; k < 6; k++) {
    const p = rim(R() * Math.PI * 2, 40 + R() * 60);
    decals.push({ frame: 'bones', ...p, angle: R() * 360 * s, depth: -48 });
  }
  for (const a of [0.7, 2.3, 3.95, 5.5]) {
    decal('cobweb', rim(a, 22), { angle: (a * 180) / Math.PI + 135, alpha: 0.7 });
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + R() * 0.3;
    const p = { x: mid.x + s * Math.cos(a) * 5.4 * T, y: mid.y + Math.sin(a) * 4.5 * T };
    decal('wax', p, { angle: R() * 360 });
  }

  return { at, rim, lectern };
}
