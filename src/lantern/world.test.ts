import { describe, expect, it } from 'vitest';
import { Nav } from './nav';
import { generateUpperWorld } from './upper';
import { T, TOWN, type Pt } from './util';
import { generateCellar } from './cellar';
import { generateWorld, type Portal, type World } from './world';

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

describe('the worlds and the ways between them', () => {
  const worlds = { lower: generateWorld(), upper: generateUpperWorld(), cellar: generateCellar() };
  const all = Object.values(worlds);
  const nav = (w: World) => new Nav(w.block, w.w, w.h, w.walls);

  it('starts the hero on free ground in the Upper World house', () => {
    const { x, y } = worlds.upper.spawn;
    expect(nav(worlds.upper).circleFree(x, y, 10)).toBe(true);
  });

  it('lets the hero walk to every way out', () => {
    for (const w of all) {
      for (const p of w.portals) {
        const route = nav(w).route(w.spawn, p, 10);
        const end = route[route.length - 1] ?? w.spawn;
        expect(Math.hypot(end.x - p.x, end.y - p.y), `${w.realm} → ${p.to}`).toBeLessThan(T);
      }
    }
  });

  it('brings you out on free ground beside the way back', () => {
    for (const w of all) {
      for (const p of w.portals) {
        const other = worlds[p.to];
        const where = `${w.realm} → ${p.to}`;
        expect(nav(other).circleFree(p.exit.x, p.exit.y, 10), where).toBe(true);
        const back = other.portals.find((q) => q.to === w.realm) as Portal;
        expect(back, where).toBeDefined();
        expect(Math.hypot(back.x - p.exit.x, back.y - p.exit.y), where).toBeLessThan(T);
      }
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

describe('things', () => {
  const upper = generateUpperWorld();
  const nav = new Nav(upper.block, upper.w, upper.h, upper.walls);

  it('put the TV within reach of the living room floor', () => {
    const tv = upper.things.find((t) => t.id === 'tv') as Pt;
    expect(tv).toBeDefined();
    const route = nav.route(upper.spawn, tv, 10);
    const end = route[route.length - 1] as Pt;
    expect(Math.hypot(end.x - tv.x, end.y - tv.y)).toBeLessThan(1.4 * T);
  });
});
