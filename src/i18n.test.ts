import { afterEach, describe, expect, it } from 'vitest';
import { setLang, tr } from './i18n';
import { Memory, type Hoard } from './lantern/memory';

describe('languages', () => {
  afterEach(() => setLang('en'));

  it('speaks English or Russian, as chosen', () => {
    setLang('en');
    expect(tr('Back', 'Назад')).toBe('Back');
    expect(tr({ en: 'Back', ru: 'Назад' })).toBe('Back');
    setLang('ru');
    expect(tr('Back', 'Назад')).toBe('Назад');
    expect(tr({ en: 'Back', ru: 'Назад' })).toBe('Назад');
  });

  it("puts the hero's thoughts in the current language", () => {
    setLang('ru');
    const drawer: Hoard = { place: 'В ящике', items: ['flashlight'], junk: ['старые чеки'] };
    expect(new Memory().search(drawer, new Set()).says).toBe(
      'В ящике: старые чеки и фонарик. Ничего нужного.',
    );
  });
});
