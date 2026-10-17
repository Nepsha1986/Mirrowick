import { describe, expect, it } from 'vitest';
import { FACTS, ITEMS } from './items';
import { Memory, type Hoard } from './memory';

const drawer: Hoard = {
  place: 'In the drawer',
  items: ['flashlight', 'cellar-key'],
  junk: ['chargers', 'receipts'],
};

describe("the hero's memory", () => {
  it('leaves what he has no use for yet, but sees it', () => {
    const m = new Memory();
    const r = m.search(drawer, new Set());
    expect(r.take).toEqual([]);
    expect(r.says).toContain('a flashlight');
    expect(r.says).toContain('a little brass key');
    expect(r.says).toContain('Nothing you need');
  });

  it('remembers what he saw once he needs it, and takes it next time', () => {
    const m = new Memory();
    m.search(drawer, new Set());
    expect(m.learn('dark', new Set())).toBe(ITEMS.flashlight?.recall?.en);
    const r = m.search(drawer, new Set());
    expect(r.take).toEqual(['flashlight']);
    expect(r.says).toContain('the flashlight');
  });

  it('just knows the fact if he never saw what would help', () => {
    expect(new Memory().learn('cellar-lock', new Set())).toBe(FACTS['cellar-lock'].en);
  });

  it('takes it at once if he already knows he needs it', () => {
    const m = new Memory();
    m.learn('cellar-lock', new Set());
    expect(m.search(drawer, new Set()).take).toEqual(['cellar-key']);
  });

  it('thinks of each fact only once, and not at all if he has what it calls for', () => {
    const m = new Memory();
    expect(m.learn('dark', new Set(['flashlight']))).toBeNull();
    expect(m.learn('dark', new Set())).toBeNull();
  });

  it('finds a drawer worth a look until he has seen it, and again once he needs what is in it', () => {
    const m = new Memory();
    expect(m.worthLooking(drawer, new Set())).toBe(true);
    m.search(drawer, new Set());
    expect(m.worthLooking(drawer, new Set())).toBe(false);
    m.learn('cellar-lock', new Set());
    expect(m.lacks('cellar-lock', new Set())).toBe(true);
    expect(m.worthLooking(drawer, new Set())).toBe(true);
    const carried = new Set(m.search(drawer, new Set()).take);
    expect(m.lacks('cellar-lock', carried)).toBe(false);
    expect(m.worthLooking(drawer, carried)).toBe(false);
  });

  it('carries over in the save', () => {
    const m = new Memory();
    m.search(drawer, new Set());
    m.learn('dark', new Set());
    const again = new Memory(m.list);
    expect(again.knows('dark')).toBe(true);
    expect(again.search(drawer, new Set(['flashlight'])).take).toEqual([]);
  });

  it('remembers what he has read', () => {
    const m = new Memory();
    expect(m.hasRead('notebook')).toBe(false);
    expect(m.read('notebook')).toBe(true);
    expect(m.read('notebook')).toBe(false);
    expect(new Memory(m.list).hasRead('notebook')).toBe(true);
  });
});
