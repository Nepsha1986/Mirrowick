import { describe, expect, it } from 'vitest';
import { Nav } from './nav';
import { T, TOWN } from './util';
import { generateWorld } from './world';

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
