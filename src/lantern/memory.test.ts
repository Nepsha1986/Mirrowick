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
    expect(m.learn('dark', new Set())).toBe(ITEMS.flashlight?.recall);
    const r = m.search(drawer, new Set());
    expect(r.take).toEqual(['flashlight']);
    expect(r.says).toContain('the flashlight');
  });

  it('just knows the fact if he never saw what would help', () => {
    expect(new Memory().learn('cellar-lock', new Set())).toBe(FACTS['cellar-lock']);
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

  it('carries over in the save', () => {
    const m = new Memory();
    m.search(drawer, new Set());
    m.learn('dark', new Set());
    const again = new Memory(m.list);
    expect(again.knows('dark')).toBe(true);
    expect(again.search(drawer, new Set(['flashlight'])).take).toEqual([]);
  });
});
