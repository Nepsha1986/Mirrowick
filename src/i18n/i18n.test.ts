import { afterEach, describe, expect, it } from 'vitest';
import { Memory, type Hoard } from '../lantern/memory';
import { en } from './en';
import { LANGS, fill, setLang, t, type Lang } from '.';

/** Every path to a line in a catalog, with its `{slots}`. */
function lines(o: object, at = ''): [string, string[]][] {
  return Object.entries(o).flatMap(([k, v]): [string, string[]][] =>
    typeof v === 'string'
      ? [[at + k, [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()]]
      : Array.isArray(v)
        ? [[at + k, []]]
        : lines(v as object, `${at}${k}.`),
  );
}

describe('languages', () => {
  afterEach(() => setLang('en'));

  it('switches the words', async () => {
    await setLang('en');
    expect(t().settings.back).toBe('Back');
    await setLang('ru');
    expect(t().settings.back).toBe('Назад');
  });

  it('fills in values', () => {
    expect(fill('Day {day} · {time}', { day: 2, time: '06:00' })).toBe('Day 2 · 06:00');
  });

  it('has every line of English in every language, with the same slots', async () => {
    const source = new Map(lines(en));
    for (const id of Object.keys(LANGS) as Lang[]) {
      const own = new Map(lines(await LANGS[id].load()));
      for (const [path, slots] of source) {
        expect(own.has(path), `${id}: ${path}`).toBe(true);
        expect(own.get(path), `${id}: ${path}`).toEqual(slots);
      }
    }
  });

  it("puts the hero's thoughts in the current language", async () => {
    await setLang('ru');
    const drawer: Hoard = { place: 'В ящике', items: ['flashlight'], junk: ['старые чеки'] };
    expect(new Memory().search(drawer, new Set()).says).toBe(
      'В ящике: старые чеки и фонарик. Ничего нужного.',
    );
  });
});
