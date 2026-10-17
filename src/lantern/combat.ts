/**
 * The rules of a fight, kept apart from the scene so they can be tested:
 * Fallout-like chances to hit, crits, jams and armour, played in real time.
 * Skills run 0…100; distances are in tiles.
 */

/** Something to fight with. */
export interface Weapon {
  name: string;
  /** Damage range, before armour. */
  dmg: [number, number];
  /** Furthest it reaches, tiles. */
  range: number;
  /** Bonus to hit. */
  acc: number;
  /** Rounds in a magazine; 0 for a weapon that needs none. */
  mag: number;
  /** Seconds to reload at middling skill. */
  reload: number;
  /** Seconds between blows or shots, after aiming. */
  cycle: number;
  /** Chance a shot jams, for an average hand. */
  jam: number;
}

/** A worn service pistol: the hero's only gun. */
export const PISTOL: Weapon = {
  name: 'Pistol',
  dmg: [5, 10],
  range: 10,
  acc: 10,
  mag: 8,
  reload: 2.4,
  cycle: 0.35,
  jam: 0.06,
};

/** Rounds you can carry besides the magazine. */
export const SPARE_ROUNDS = 32;

/** What the hero has to shoot with: the magazine and the rest. */
export interface Ammo {
  mag: number;
  spare: number;
}

export const FISTS: Weapon = {
  name: 'Fists',
  dmg: [2, 5],
  range: 1.1,
  acc: 0,
  mag: 0,
  reload: 0,
  cycle: 0.9,
  jam: 0,
};

export interface Skills {
  guns: number;
  melee: number;
  /** How hard you are to hit. */
  dodge: number;
}

/** A little experienced at everything, an expert at nothing. */
export const HERO_SKILLS: Skills = { guns: 50, melee: 45, dodge: 15 };
export const HERO_HP = 40;

/** Damage threshold (taken off each hit) and resistance (a share of the rest). */
export interface Armour {
  dt: number;
  dr: number;
}

export type FoeId = 'wolf' | 'marauder' | 'boar' | 'crawler' | 'shade';

/** Where an enemy lives, and comes back to (world pixels). */
export interface FoeSpawn {
  x: number;
  y: number;
  kind: FoeId;
  /** Shut in a cage: it paces and snarls at you, but never comes out. */
  caged?: boolean;
}

/** One kind of enemy and how it fights. */
export interface FoeKind {
  id: FoeId;
  name: string;
  hp: number;
  /** Pixels per second when hunting. */
  speed: number;
  /** Taken off the chance to hit it. */
  evasion: number;
  armour: Armour;
  /** Its skill at its own attack. */
  skill: number;
  attack: Weapon;
  /** Body radius, pixels. */
  r: number;
  /** Notices you within this many tiles. */
  aggro: number;
  /** While it hunts you within this many tiles you can't turn your back on it. */
  engage: number;
  /** Gives up the chase this far from home. */
  leash: number;
  /** Runs for it below this share of its health. */
  flee: number;
}

const tooth = (name: string, dmg: [number, number], cycle: number): Weapon => ({
  name,
  dmg,
  range: 1,
  acc: 0,
  mag: 0,
  reload: 0,
  cycle,
  jam: 0,
});

export const FOES: Record<FoeId, FoeKind> = {
  // Lean and quick: you can't outrun it, but it bolts when hurt.
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    hp: 16,
    speed: 175,
    evasion: 20,
    armour: { dt: 0, dr: 0 },
    skill: 60,
    attack: tooth('bite', [2, 6], 1.1),
    r: 10,
    aggro: 6,
    engage: 4,
    leash: 14,
    flee: 0.35,
  },
  // Keeps his distance and fires short bursts from a rifle: three rounds
  // at a time, none of them very careful.
  marauder: {
    id: 'marauder',
    name: 'Marauder',
    hp: 26,
    speed: 62,
    evasion: 10,
    armour: { dt: 1, dr: 0.1 },
    skill: 40,
    attack: {
      name: 'rifle',
      dmg: [3, 7],
      range: 9,
      acc: -5,
      mag: 3,
      reload: 2.6,
      cycle: 0.12,
      jam: 0.04,
    },
    r: 10,
    aggro: 7,
    engage: 8,
    leash: 10,
    flee: 0.25,
  },
  // Charges in a straight line, then stands blown.
  boar: {
    id: 'boar',
    name: 'Boar',
    hp: 24,
    speed: 90,
    evasion: 5,
    armour: { dt: 1, dr: 0.15 },
    skill: 55,
    attack: tooth('tusks', [5, 11], 1.6),
    r: 13,
    aggro: 5,
    engage: 5,
    leash: 10,
    flee: 0,
  },
  // Black glass on legs, out of the Mirror: slow, and bullets glance off it.
  crawler: {
    id: 'crawler',
    name: 'Glass crawler',
    hp: 28,
    speed: 46,
    evasion: 0,
    armour: { dt: 2, dr: 0.25 },
    skill: 50,
    attack: tooth('claws', [6, 12], 2.2),
    r: 14,
    aggro: 5,
    engage: 3,
    leash: 9,
    flee: 0,
  },
  // A piece of the dark itself: hard to hit unless your light is on it.
  shade: {
    id: 'shade',
    name: 'Shade',
    hp: 18,
    speed: 78,
    evasion: 40,
    armour: { dt: 0, dr: 0 },
    skill: 55,
    attack: tooth('touch', [3, 6], 1.3),
    r: 11,
    aggro: 5,
    engage: 3,
    leash: 10,
    flee: 0,
  },
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const k = (skill: number) => clamp(skill, 0, 100) / 100;

/** Chance to hit lost per tile of distance: the less skilled, the more. */
export const perTile = (skill: number) => lerp(8, 2.5, k(skill));

/**
 * Percent chance to hit, 5…95: skill and the weapon's accuracy, less the
 * distance, the target's evasion and the dark (0…30).
 */
export function hitChance(
  skill: number,
  w: Weapon,
  dist: number,
  evasion: number,
  dark = 0,
): number {
  const melee = w.range <= 1.5;
  const base = 35 + skill * 0.6 + w.acc;
  const far = melee ? 0 : perTile(skill) * Math.max(0, dist - 1.5);
  return Math.round(clamp(base - far - evasion - dark, 5, 95));
}

/**
 * How far away you are happy to shoot from: the furthest distance where the
 * chance is still decent, but never past the weapon's reach. The less
 * skilled you are, the closer you walk up before pulling the trigger.
 */
export function comfortRange(skill: number, w: Weapon, evasion: number, dark = 0): number {
  if (w.range <= 1.5) return w.range;
  const want = 50;
  const base = hitChance(skill, w, 1.5, evasion, dark);
  if (base <= want) return 1.5;
  return clamp(1.5 + (base - want) / perTile(skill), 1.5, w.range);
}

/** Seconds to steady the aim before each shot. */
export const aimTime = (skill: number) => lerp(1.1, 0.35, k(skill));
/** Taken off the chance to hit when you shoot on the move. */
export const ON_THE_MOVE = 15;
/** Chance a shot jams: a worn gun in unsure hands jams more. */
export const jamChance = (skill: number, w: Weapon) => w.jam * lerp(2.2, 0.4, k(skill));
/** Seconds to clear a jam. */
export const clearTime = (skill: number) => lerp(4.5, 1.2, k(skill));
export const reloadTime = (skill: number, w: Weapon) => w.reload * lerp(1.45, 0.6, k(skill));

export type Roll = 'crit' | 'hit' | 'miss' | 'fumble';

/**
 * One attack: a crit on the best few rolls, a fumble on the very worst
 * misses (the less skilled, the likelier).
 */
export function rollAttack(chance: number, skill: number, rand: () => number): Roll {
  const r = rand() * 100;
  const crit = chance * (0.05 + k(skill) * 0.1);
  if (r < crit) return 'crit';
  if (r < chance) return 'hit';
  return r >= 100 - lerp(6, 1, k(skill)) ? 'fumble' : 'miss';
}

/** Damage after armour; a crit hits harder and finds the gaps in it. */
export function damage(w: Weapon, a: Armour, crit: boolean, rand: () => number): number {
  const raw = w.dmg[0] + Math.floor(rand() * (w.dmg[1] - w.dmg[0] + 1));
  if (crit) return Math.round(raw * 1.8 * (1 - a.dr / 2));
  return Math.max(0, Math.round((raw - a.dt) * (1 - a.dr)));
}
