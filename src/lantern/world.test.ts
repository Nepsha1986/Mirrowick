import { describe, expect, it } from 'vitest';
import { Nav } from './nav';
import { generateUpperWorld } from './upper';
import { T, type Pt } from './util';
import { generateCellar } from './cellar';
import { ITEMS } from './items';
import { PAPERS, paper } from './papers';
import { generateLab } from './lab';
import { generateYard } from './yard';
import { upperHatch } from './ways';
import type { Portal, Thing, World } from './world';

describe('the Facility', () => {
  const lab = generateLab();
  const door = lab.things.find((t) => t.id === 'door7') as Thing;
  /** The Facility as you find it, with Chamber 7's door shut, or after you open it. */
  const nav = (open: boolean) => {
    const block = lab.block.slice();
    for (const [x, y] of door.door?.tiles ?? []) block[y * lab.w + x] = open ? 0 : 1;
    return new Nav(block, lab.w, lab.h, lab.walls);
  };
  const reach = (n: Nav, from: Pt, to: Pt, r = 10) => {
    const route = n.route(from, to, r);
    const end = route[route.length - 1] ?? from;
    return Math.hypot(end.x - to.x, end.y - to.y);
  };
  const thing = (id: string) => lab.things.find((t) => t.id === id) as Thing;

  it('is the same every run', () => {
    expect(generateLab().objects).toEqual(lab.objects);
  });

  it('starts the hero on free ground in Chamber 7, underground', () => {
    const { x, y } = lab.spawn;
    expect(nav(false).circleFree(x, y, 10)).toBe(true);
    expect(lab.indoors?.[Math.floor(y / T) * lab.w + Math.floor(x / T)]).toBe(1);
  });

  it('shuts Chamber 7 in until the door opens, and the card is inside', () => {
    expect(door.door?.lock?.key).toBe('keycard');
    expect(reach(nav(false), lab.spawn, thing('lab-desk'))).toBeLessThan(1.4 * T);
    expect(reach(nav(false), lab.spawn, thing('gun-locker'))).toBeGreaterThan(2 * T);
    expect(reach(nav(false), lab.spawn, door)).toBeLessThan(1.4 * T);
  });

  it('leads, once the door is open, past the vivarium and the checkpoint up the ramp', () => {
    const open = nav(true);
    for (const id of [
      'gun-locker',
      'ammo',
      'plaque-1',
      'plaque-5',
      'feed-chart',
      'sealed-27',
      'shutter',
      'lift',
    ]) {
      expect(reach(open, lab.spawn, thing(id)), id).toBeLessThan(1.4 * T);
    }
    const ramp = lab.portals.find((p) => p.to === 'yard') as Portal;
    expect(reach(open, lab.spawn, ramp)).toBeLessThan(T);
  });

  it('comes up the ramp into the yard, to level 0’s door and the marauder out in the open', () => {
    const yard = generateYard();
    const open = new Nav(yard.block, yard.w, yard.h, yard.walls);
    const door = yard.things.find((t) => t.id === 'level0-door') as Thing;
    expect(reach(open, yard.spawn, door)).toBeLessThan(1.4 * T);
    const marauder = yard.foes?.find((f) => f.kind === 'marauder') as Pt;
    expect(reach(open, yard.spawn, marauder)).toBeLessThan(T);
    expect(yard.indoors?.[Math.floor(marauder.y / T) * yard.w + Math.floor(marauder.x / T)]).toBe(
      0,
    );
  });

  it('has the cellar’s hall in Chamber 7, stone for stone, looking-glass wise', () => {
    const cellar = generateCellar();
    const laid = (w: World, flip: boolean) => {
      const mid = w.portals.find((p) => p.fade === 'glint') as Pt;
      return [...w.objects, ...w.decals]
        .filter((o) => o.key === 'ln-cellar')
        .map((o) => {
          const x = Math.round((flip ? mid.x - o.x : o.x - mid.x) / 4);
          return `${o.frame} ${x} ${Math.round((o.y - mid.y) / 4)}`;
        })
        .sort();
    };
    expect(laid(lab, true)).toEqual(laid(cellar, false));
  });

  it('keeps every beast in its own cage, out of the hero’s reach', () => {
    const open = nav(true);
    const caged = (lab.foes ?? []).filter((f) => f.caged);
    expect(caged.map((f) => f.kind).sort()).toEqual(['crawler', 'shade']);
    for (const f of caged) {
      expect(open.circleFree(f.x, f.y, 14), f.kind).toBe(true);
      expect(reach(open, f, lab.spawn, 10), f.kind).toBeGreaterThan(3 * T);
      for (const g of caged) if (g !== f) expect(reach(open, f, g, 10)).toBeGreaterThan(2 * T);
    }
  });
});

describe('the worlds and the ways between them', () => {
  const worlds = {
    lower: generateLab(),
    yard: generateYard(),
    upper: generateUpperWorld(),
    cellar: generateCellar(),
  };
  const all = Object.values(worlds);
  const nav = (w: World) => new Nav(w.block, w.w, w.h, w.walls);

  it('starts the hero on free ground by the car', () => {
    const { x, y } = worlds.upper.spawn;
    expect(nav(worlds.upper).circleFree(x, y, 10)).toBe(true);
  });

  it('lets the hero find everything he will need, and learn that he needs it', () => {
    const locks = all.flatMap((w) => [
      ...w.portals.map((p) => p.lock),
      ...w.things.map((t) => t.door?.lock),
    ]);
    const facts = new Set(['dark', ...locks.map((l) => l?.fact)]);
    for (const [id, item] of Object.entries(ITEMS)) {
      if (!item.needs) continue;
      expect(facts.has(item.needs), `${id} needs ${item.needs}`).toBe(true);
      // It lies somewhere you can walk to from where you come in, with no key.
      const w = all.find((w) => w.things.some((t) => t.hoard?.items.includes(id))) as World;
      expect(w, id).toBeDefined();
      const at = w.things.find((t) => t.hoard?.items.includes(id)) as Pt;
      const route = nav(w).route(w.spawn, at, 10);
      const end = route[route.length - 1] ?? w.spawn;
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
        // A way you walk onto doesn't take you straight back.
        const s = back.step;
        if (s) {
          const off = Math.max(
            Math.abs(p.exit.x - back.x) - s.w / 2,
            Math.abs(p.exit.y - back.y) - s.h / 2,
          );
          expect(off, where).toBeGreaterThan(10);
        }
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
    for (const w of [upper, generateCellar(), generateLab(), generateYard()]) {
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
