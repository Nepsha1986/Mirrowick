import type { Words } from '../i18n';

/**
 * Something the hero has learned: that it gets dark, that a hatch is locked,
 * that someone's footprints glow in the beam.
 */
export type Fact = 'dark' | 'cellar-lock' | 'trail';

/** A thing you can carry. */
export interface Item {
  name: Words;
  about: Words;
  /** Its picture in an atlas, for the bag. */
  icon: [key: string, frame: string];
  /** How it reads among odds and ends in a drawer. */
  plain?: Words;
  /**
   * What the hero must know before it seems worth taking: until then it is
   * junk, and he only remembers that he saw it.
   */
  needs?: Fact;
  /** What he thinks when he learns that, if he saw it and left it. */
  recall?: Words;
}

/** Everything the hero can carry, by id. */
export const ITEMS: Record<string, Item> = {
  flashlight: {
    name: { en: 'Flashlight', ru: 'Фонарик' },
    about: { en: 'A steady beam ahead of you.', ru: 'Ровный луч перед вами.' },
    icon: ['ln-up', 'flashlight'],
    plain: { en: 'a flashlight', ru: 'фонарик' },
    needs: 'dark',
    recall: {
      en: "There was a flashlight in Victor's bedside table. I could use it now.",
      ru: 'В тумбочке у Виктора был фонарик. Сейчас бы он пригодился.',
    },
  },
  'cellar-key': {
    name: { en: 'Brass key', ru: 'Латунный ключ' },
    about: {
      en: 'A small key from Victor’s bedside table. It fits the padlock on the shed’s hatch.',
      ru: 'Маленький ключ из тумбочки Виктора. Подходит к замку на люке в сарае.',
    },
    icon: ['ln-up', 'key'],
    plain: { en: 'a little brass key', ru: 'латунный ключик' },
    needs: 'cellar-lock',
    recall: {
      en: "That little brass key in Victor's bedside table. It might fit this padlock.",
      ru: 'Тот латунный ключик в тумбочке Виктора. Может, он от этого замка.',
    },
  },
  pistol: {
    name: { en: 'Pistol', ru: 'Пистолет' },
    about: {
      en: 'A worn service pistol. It jams now and then.',
      ru: 'Потёртый служебный пистолет. Иногда заедает.',
    },
    icon: ['ln-foes', 'pistol'],
  },
};

/** What the hero thinks on learning something, when nothing he saw comes to mind. */
export const FACTS: Record<Fact, Words> = {
  dark: {
    en: "It's getting dark. I'll need a light soon.",
    ru: 'Темнеет. Скоро понадобится свет.',
  },
  'cellar-lock': {
    en: 'A padlock on the hatch. Victor kept everything in the house. Probably in his bedroom.',
    ru: 'На люке замок. Виктор всё держал в доме. Наверное, в спальне.',
  },
  trail: {
    en: 'Footprints, glowing where the light falls. Someone came and went here, again and again.',
    ru: 'Следы, они светятся в луче. Кто-то ходил здесь туда и обратно, снова и снова.',
  },
};

/**
 * A second thought, a while after the first, while the hero still hasn't
 * found what the fact calls for.
 */
export const NUDGES: Partial<Record<Fact, Words>> = {
  dark: {
    en: "Still no light. Victor's bedroom is off the hall, just inside the front door. His bedside table, maybe.",
    ru: 'Света всё нет. Спальня Виктора — из прихожей, сразу у входной двери. Может, в тумбочке.',
  },
  'cellar-lock': {
    en: "That key. Victor's bedroom is off the hall, just inside the front door. His bedside table, maybe.",
    ru: 'Ключ. Спальня Виктора — из прихожей, сразу у входной двери. Может, в тумбочке.',
  },
};
