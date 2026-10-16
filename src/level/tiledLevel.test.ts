import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findPath } from '../core/pathfinding';
import { useSpots } from './nav';
import { parseTopDownLevel, type TiledMap } from './tiledLevel';

const map = JSON.parse(
  readFileSync(new URL('../../public/assets/topdown/village.tmj', import.meta.url), 'utf8'),
) as TiledMap;

describe('top-down village', () => {
  const level = parseTopDownLevel(map);

  it('spawns the player on a walkable cell', () => {
    expect(level.nav.isWalkable(level.spawn.c, level.spawn.r)).toBe(true);
  });

  it('has the same story beats as the isometric village', () => {
    const names = level.interactables.map((i) => i.value.name);
    expect(names).toEqual(
      expect.arrayContaining(['Sealed crypt', 'Tavern strongbox', 'Carpenter’s chest']),
    );
    expect(level.lights.length).toBeGreaterThan(0);
  });

  it('lets the player reach every interactable', () => {
    const unreachable = level.interactables
      .filter(
        (t) => !useSpots(level.nav, t).some((s) => findPath(level.nav, level.spawn, s) !== null),
      )
      .map((t) => `${t.value.name} @ ${t.c},${t.r}`);
    expect(unreachable).toEqual([]);
  });
});
