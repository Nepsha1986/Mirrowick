import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findPath } from '../core/pathfinding';
import { buildNav, levelSize, useSpots } from './nav';
import { GROUND_FRAMES } from './types';
import { VILLAGE } from './village';

const atlas = JSON.parse(
  readFileSync(new URL('../../public/assets/world.json', import.meta.url), 'utf8'),
) as { textures: { frames: { filename: string }[] }[] };
const frames = new Set(atlas.textures.flatMap((t) => t.frames.map((f) => f.filename)));

describe('village level', () => {
  const level = VILLAGE;
  const { width, height } = levelSize(level);
  const nav = buildNav(level);

  it('has a rectangular ground map using known glyphs', () => {
    for (const row of level.ground) {
      expect(row).toHaveLength(width);
      for (const ch of row) expect(ch === ' ' || ch in GROUND_FRAMES).toBe(true);
    }
    expect(height).toBeGreaterThan(0);
  });

  it('only references frames that exist in the atlas', () => {
    const used = [
      ...level.props.flatMap((p) => [p.frame, p.interact?.usedFrame]),
      ...Object.values(GROUND_FRAMES).flat(),
    ].filter((f): f is string => !!f);
    expect(used.filter((f) => !frames.has(f))).toEqual([]);
  });

  it('places every prop on solid ground', () => {
    const off = level.props.filter(
      (p) => level.ground[p.r]?.[p.c] === ' ' || !nav.inBounds(p.c, p.r),
    );
    expect(off).toEqual([]);
  });

  it('spawns the player on a walkable cell', () => {
    expect(nav.isWalkable(level.spawn.c, level.spawn.r)).toBe(true);
  });

  it('lets the player reach every interactable prop', () => {
    const unreachable = level.props
      .filter((p) => p.interact)
      .filter((p) => !useSpots(nav, p).some((s) => findPath(nav, level.spawn, s) !== null))
      .map((p) => `${p.interact?.name} @ ${p.c},${p.r}`);
    expect(unreachable).toEqual([]);
  });
});
