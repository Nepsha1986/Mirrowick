import { describe, expect, it } from 'vitest';
import { findPath } from '../core/pathfinding';
import { MAP_H, MAP_W, buildLayout } from './layout';

describe('painted village layout', () => {
  const layout = buildLayout();

  it('is the same every run', () => {
    expect(buildLayout().props).toEqual(layout.props);
  });

  it('keeps props inside the map and off each other', () => {
    const seen = new Set<string>();
    for (const p of layout.props) {
      expect(p.c >= 0 && p.r >= 0 && p.c < MAP_W && p.r < MAP_H).toBe(true);
      const key = `${p.c},${p.r}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('lets the hero walk from the spawn to every doorstep', () => {
    const { nav, spawn } = layout;
    expect(nav.isWalkable(spawn.c, spawn.r)).toBe(true);
    for (const h of layout.houses) {
      const step = { c: h.c + Math.floor(h.w / 2), r: h.r + h.h };
      expect(findPath(nav, spawn, step), `${h.kind} at ${h.c},${h.r}`).not.toBeNull();
    }
  });
});
