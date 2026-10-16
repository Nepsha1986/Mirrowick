import { describe, expect, it } from 'vitest';
import type { Interaction } from '../level/types';
import { GameState } from './GameState';
import { resolveInteraction } from './interactions';

const key = { id: 'key', name: 'Key', description: '' };

describe('resolveInteraction', () => {
  it('gives an item once, then repeats the last line', () => {
    const s = new GameState();
    const chest: Interaction = {
      name: 'Chest',
      lines: ['found', 'empty'],
      gives: key,
      usedFrame: 'open',
    };
    const first = resolveInteraction(chest, 0, s, 0);
    expect(first).toMatchObject({ line: 'found', item: key, frame: 'open', grab: true });
    s.give(key);
    s.markUsed(0);
    const again = resolveInteraction(chest, 0, s, 0);
    expect(again.line).toBe('empty');
    expect(again.item).toBeUndefined();
  });

  it('stays locked until the required item is held', () => {
    const s = new GameState();
    const door: Interaction = {
      name: 'Door',
      lines: ['opens'],
      requires: { item: 'key', missing: ['locked', 'still locked'] },
    };
    expect(resolveInteraction(door, 1, s, 0)).toMatchObject({ line: 'locked', unlocked: false });
    expect(resolveInteraction(door, 1, s, 5).line).toBe('still locked');
    s.give(key);
    expect(resolveInteraction(door, 1, s, 2)).toMatchObject({ line: 'opens', unlocked: true });
  });

  it('removes picked-up props', () => {
    const s = new GameState();
    const cup: Interaction = { name: 'Cup', lines: ['taken'], pickup: key };
    expect(resolveInteraction(cup, 2, s, 0)).toMatchObject({ removeProp: true, item: key });
  });
});
