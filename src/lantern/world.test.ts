import { describe, expect, it } from 'vitest';
import { Nav } from './nav';
import { generateUpperWorld } from './upper';
import { T, TOWN, type Pt } from './util';
import { generateWorld, type Portal } from './world';

describe('lantern world', () => {
  const world = generateWorld();
  const nav = new Nav(world.block);

  it('is the same every run', () => {
    expect(generateWorld().objects).toEqual(world.objects);
  });

  it('starts the hero on free ground inside the village', () => {
    const { x, y } = world.spawn;
    expect(nav.circleFree(x, y, 10)).toBe(true);
    expect(world.town[Math.floor(y / T) * 100 + Math.floor(x / T)]).toBe(1);
  });

  it('lets the hero walk out of every gate and on to the Mirror', () => {
    const from = world.spawn;
    for (const [x, y] of [
      [49.5, TOWN.y0 - 2],
      [49.5, TOWN.y1 + 2],
      [TOWN.x0 - 2, 39.5],
      [TOWN.x1 + 2, 39.5],
      [84, 24],
    ] as const) {
      const route = nav.route(from, { x: x * T, y: y * T }, 10);
      expect(route.length, `to ${x},${y}`).toBeGreaterThan(0);
    }
  });
});

describe('the two worlds', () => {
  const lower = generateWorld();
  const upper = generateUpperWorld();
  const navs = {
    lower: new Nav(lower.block, lower.w, lower.h),
    upper: new Nav(upper.block, upper.w, upper.h),
  };

  it('starts the hero on free ground in the Upper World house', () => {
    const { x, y } = upper.spawn;
    expect(navs.upper.circleFree(x, y, 10)).toBe(true);
  });

  it('lets the hero walk to the mill mirror in both worlds', () => {
    for (const w of [lower, upper]) {
      const [portal] = w.portals;
      expect(portal, w.realm).toBeDefined();
      const p = portal as Portal;
      const route = navs[w.realm].route(w.spawn, p, 10);
      expect(route.length, w.realm).toBeGreaterThan(0);
      const end = route[route.length - 1] as Pt;
      expect(Math.hypot(end.x - p.x, end.y - p.y), w.realm).toBeLessThan(T);
    }
  });

  it('brings you out on free ground beside the other mirror', () => {
    for (const w of [lower, upper]) {
      const p = w.portals[0] as Portal;
      const other = p.to === 'upper' ? upper : lower;
      expect(navs[other.realm].circleFree(p.exit.x, p.exit.y, 10)).toBe(true);
      const back = other.portals.find((q) => q.to === w.realm) as Portal;
      expect(Math.hypot(back.x - p.exit.x, back.y - p.exit.y)).toBeLessThan(T);
    }
  });
});

describe('thin walls', () => {
  const upper = generateUpperWorld();
  const nav = new Nav(upper.block, upper.w, upper.h, upper.walls);

  it('block on the wall line but not beside it', () => {
    // The wall between the kitchen and the living room runs down column 14.
    const x = 14.5 * T;
    const y = 11.5 * T;
    expect(nav.solidAt(x, y)).toBe(true);
    expect(nav.solidAt(x - 10, y)).toBe(false);
    expect(nav.solidAt(x + 10, y)).toBe(false);
  });

  it('let the hero walk from the living room out to the road', () => {
    const route = nav.route(upper.spawn, { x: 17 * T, y: 26.5 * T }, 10);
    expect(route.length).toBeGreaterThan(0);
  });
});
