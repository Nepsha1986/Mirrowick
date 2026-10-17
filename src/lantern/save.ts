import { storage } from '../ui/dom';
import type { Realm } from './world';

const KEY = 'mirrowick.save';

/** Everything a game needs to carry on where it left off. */
export interface SaveData {
  realm: Realm;
  x: number;
  y: number;
  /** Time of day, 0…1 from 06:00, and the day number. */
  tod: number;
  day: number;
  /** Things that are switched on. */
  things: string[];
  /** What you carry. */
  items: string[];
  /** What the hero knows and has seen; older saves have none. */
  known?: string[];
  /** Rounds in the pistol and spare. */
  ammo?: [number, number];
}

/** The saved game, or null if there is none or it can't be read. */
export function loadSave(): SaveData | null {
  const raw = storage.get(KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    if (d.realm !== 'lower' && d.realm !== 'upper' && d.realm !== 'cellar') return null;
    if (!num(d.x) || !num(d.y) || !num(d.tod) || !num(d.day)) return null;
    const strings = (v: unknown) =>
      Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : null;
    const things = strings(d.things) ?? [];
    // Saves from before you had to find the flashlight already carry it.
    const items = strings(d.items) ?? ['flashlight'];
    const known = strings(d.known) ?? undefined;
    const ammo =
      Array.isArray(d.ammo) && d.ammo.length === 2 && d.ammo.every((n) => num(n) && n >= 0)
        ? d.ammo
        : undefined;
    return { realm: d.realm, x: d.x, y: d.y, tod: d.tod, day: d.day, things, items, known, ammo };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  storage.set(KEY, JSON.stringify(data));
}

export function clearSave(): void {
  storage.remove(KEY);
}
