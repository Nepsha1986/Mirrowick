import { describe, expect, it } from 'vitest';
import { Nav } from './nav';
import { generateUpperWorld } from './upper';
import { T, TOWN, type Pt } from './util';
import { generateCellar } from './cellar';
import { ITEMS } from './items';
import { PAPERS, paper } from './papers';
import { upperHatch } from './mill';
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
      [9.5, 26.5],
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

  it('starts the hero on free ground by the car', () => {
    const { x, y } = worlds.upper.spawn;
    expect(nav(worlds.upper).circleFree(x, y, 10)).toBe(true);
  });

  it('lets the hero find everything he will need, and learn that he needs it', () => {
    const { upper } = worlds;
    const facts = new Set(['dark', ...all.flatMap((w) => w.portals.map((p) => p.lock?.fact))]);
    for (const [id, item] of Object.entries(ITEMS)) {
      if (!item.needs) continue;
      expect(facts.has(item.needs), `${id} needs ${item.needs}`).toBe(true);
      // It lies in the Upper World, which you can walk all over without a key.
      const hoard = upper.things.find((t) => t.hoard?.items.includes(id));
      expect(hoard, id).toBeDefined();
      const at = hoard as Pt;
      const route = nav(upper).route(upper.spawn, at, 10);
      const end = route[route.length - 1] ?? upper.spawn;
      expect(Math.hypot(end.x - at.x, end.y - at.y), id).toBeLessThan(1.4 * T);
    }
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
    // The wall between the kitchen and the living room runs down column 20.
    const x = 20.5 * T;
    const y = 25.5 * T;
    expect(nav.solidAt(x, y)).toBe(true);
    expect(nav.solidAt(x - 10, y)).toBe(false);
    expect(nav.solidAt(x + 10, y)).toBe(false);
  });

  it('let the hero walk from the living room out to the road', () => {
    const route = nav.route(upper.spawn, { x: 23 * T, y: 40.5 * T }, 10);
    expect(route.length).toBeGreaterThan(0);
  });
});

describe('things', () => {
  const upper = generateUpperWorld();
  const nav = new Nav(upper.block, upper.w, upper.h, upper.walls);

  it.each(['mailbox', 'nightstand', 'coat', 'fridge-note', 'victor-car'])(
    'put the %s within reach',
    (id) => {
      const thing = upper.things.find((t) => t.id === id) as Pt;
      expect(thing).toBeDefined();
      const route = nav.route(upper.spawn, thing, 10);
      const end = route[route.length - 1] as Pt;
      expect(Math.hypot(end.x - thing.x, end.y - thing.y)).toBeLessThan(1.4 * T);
    },
  );

  it('put the tome in the cellar within reach', () => {
    const cellar = generateCellar();
    const tome = cellar.things.find((t) => t.id === 'tome') as Pt;
    const route = new Nav(cellar.block, cellar.w, cellar.h, cellar.walls).route(
      cellar.spawn,
      tome,
      10,
    );
    const end = route[route.length - 1] ?? cellar.spawn;
    expect(Math.hypot(end.x - tome.x, end.y - tome.y)).toBeLessThan(1.4 * T);
  });

  it('give everything you can read something to read', () => {
    for (const w of [upper, generateCellar()]) {
      for (const t of w.things) if (t.read) expect(paper(t.read), t.id).not.toBeNull();
    }
    expect(PAPERS['bookshop-letter']).toBeDefined();
    for (const it of Object.values(ITEMS)) if (it.read) expect(paper(it.read)).not.toBeNull();
  });
});

describe('the long grass', () => {
  const upper = generateUpperWorld();
  const tall = upper.tall ?? new Uint8Array();
  const at = (p: Pt) => tall[Math.floor(p.y / T) * upper.w + Math.floor(p.x / T)];

  it('grows round the edges, on free ground only', () => {
    expect(tall.reduce((a, b) => a + b, 0)).toBeGreaterThan(200);
    tall.forEach((v, i) => v && expect(upper.block[i], `tile ${i}`).toBe(0));
  });

  it('keeps off the paths, the yard and where you start', () => {
    expect(at(upper.spawn)).toBe(0);
    for (const p of upper.patches) {
      if (p.kind === 'meadow' || p.kind === 'road') continue;
      for (const q of p.pts) expect(at(q), `${p.kind} at ${q.x},${q.y}`).toBe(0);
    }
  });
});

describe("Victor's glowing footprints", () => {
  const upper = generateUpperWorld();
  const trail = upper.trail ?? [];
  const hatch = upperHatch();

  it('are trodden round the shed door and inside about the hatch, not along the garden', () => {
    expect(trail.length).toBeGreaterThan(40);
    const door = { x: 47.5 * T, y: 11.5 * T };
    for (const p of trail) expect(Math.hypot(p.x - door.x, p.y - door.y)).toBeLessThan(4 * T);
    expect(trail.some((p) => p.y < 11 * T)).toBe(true);
    expect(trail.some((p) => p.y > 12 * T)).toBe(true);
    expect(trail.some((p) => Math.hypot(p.x - hatch.x, p.y - hatch.y) < T)).toBe(true);
  });

  it('follow a way the hero can walk', () => {
    const nav = new Nav(upper.block, upper.w, upper.h, upper.walls);
    const route = nav.route(upper.spawn, hatch, 10);
    const end = route[route.length - 1] ?? upper.spawn;
    expect(Math.hypot(end.x - hatch.x, end.y - hatch.y)).toBeLessThan(T);
  });
});

describe('the Hollow', () => {
  const world = generateWorld();
  const nav = new Nav(world.block, world.w, world.h, world.walls);
  const reach = (to: Pt, r: number) => {
    const route = nav.route(world.spawn, to, r);
    const end = route[route.length - 1] ?? world.spawn;
    return Math.hypot(end.x - to.x, end.y - to.y);
  };

  it('has five enemies, each on free ground the hero can reach', () => {
    expect(world.foes).toHaveLength(5);
    for (const f of world.foes ?? []) {
      expect(nav.circleFree(f.x, f.y, 14), f.kind).toBe(true);
      expect(reach(f, 10), f.kind).toBeLessThan(T);
    }
  });

  it.each(['pistol', 'ammo'])('puts the %s within reach', (id) => {
    const thing = world.things.find((t) => t.id === id) as Pt;
    expect(thing).toBeDefined();
    expect(reach(thing, 10)).toBeLessThan(1.4 * T);
  });
});
