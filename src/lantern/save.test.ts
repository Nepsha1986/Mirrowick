import { beforeEach, describe, expect, it } from 'vitest';
import { clearSave, loadSave, writeSave } from './save';

describe('saved game', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    } as Storage;
  });

  it('comes back as it was written', () => {
    const save = {
      realm: 'upper' as const,
      x: 512,
      y: 352,
      tod: 0.4,
      day: 3,
      things: ['tv'],
      items: ['flashlight', 'pistol'],
      known: ['dark', 'seen:cellar-key'],
      ammo: [5, 24] as [number, number],
    };
    writeSave(save);
    expect(loadSave()).toEqual(save);
    clearSave();
    expect(loadSave()).toBeNull();
  });

  it('ignores a save it cannot trust', () => {
    localStorage.setItem('mirrowick.save', '{not json');
    expect(loadSave()).toBeNull();
    localStorage.setItem(
      'mirrowick.save',
      JSON.stringify({ realm: 'moon', x: 1, y: 1, tod: 0, day: 1 }),
    );
    expect(loadSave()).toBeNull();
  });
});
