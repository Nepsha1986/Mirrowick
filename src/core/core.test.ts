import { describe, expect, it } from 'vitest';
import { facingFromVector } from './direction';
import { NavGrid } from './grid';
import { gridToWorld, worldToCell, worldToGrid } from './iso';
import { findPath } from './pathfinding';

describe('iso projection', () => {
  it('round-trips grid and world coordinates', () => {
    for (const [c, r] of [
      [0, 0],
      [3, 7],
      [12.5, 4.25],
    ] as const) {
      const p = gridToWorld(c, r);
      const g = worldToGrid(p.x, p.y);
      expect(g.x).toBeCloseTo(c);
      expect(g.y).toBeCloseTo(r);
    }
  });

  it('picks the diamond under a point', () => {
    const p = gridToWorld(5, 2);
    expect(worldToCell(p.x + 30, p.y + 10)).toEqual({ c: 5, r: 2 });
    expect(worldToCell(p.x + 70, p.y)).toEqual({ c: 6, r: 1 });
    expect(worldToCell(p.x + 40, p.y + 30)).toEqual({ c: 6, r: 2 });
  });
});

describe('facing', () => {
  it('maps screen vectors to the clockwise-from-NE sprite order', () => {
    expect(facingFromVector(1, 0)).toBe(1);
    expect(facingFromVector(0, 1)).toBe(3);
    expect(facingFromVector(-1, 0)).toBe(5);
    expect(facingFromVector(0, -1)).toBe(7);
    expect(facingFromVector(1, -1)).toBe(0);
    expect(facingFromVector(-1, 1)).toBe(4);
  });
});

describe('pathfinding', () => {
  it('walks straight on an open grid', () => {
    const g = new NavGrid(5, 5);
    expect(findPath(g, { c: 0, r: 0 }, { c: 3, r: 3 })).toEqual([
      { c: 1, r: 1 },
      { c: 2, r: 2 },
      { c: 3, r: 3 },
    ]);
  });

  it('goes around a wall edge and never cuts its corner', () => {
    const g = new NavGrid(4, 4);
    // Wall along the column-1/column-2 boundary for rows 0..2.
    for (let r = 0; r <= 2; r++) g.blockEdge(1, r, 1, 0);
    const path = findPath(g, { c: 1, r: 0 }, { c: 2, r: 0 });
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual({ c: 2, r: 0 });
    expect(path?.some((p) => p.r === 3)).toBe(true);
    expect(g.canStep(1, 2, 1, 1)).toBe(false);
  });

  it('returns null for unreachable or blocked goals', () => {
    const g = new NavGrid(3, 3);
    g.blockCell(2, 2);
    expect(findPath(g, { c: 0, r: 0 }, { c: 2, r: 2 })).toBeNull();
    for (let r = 0; r < 3; r++) g.blockEdge(0, r, 1, 0);
    expect(findPath(g, { c: 0, r: 0 }, { c: 2, r: 0 })).toBeNull();
  });
});
