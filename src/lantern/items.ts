/** Something the hero has learned: that it gets dark, that a hatch is locked. */
export type Fact = 'dark' | 'cellar-lock';

/** A thing you can carry. */
export interface Item {
  name: string;
  about: string;
  /** Its picture in an atlas, for the bag. */
  icon: [key: string, frame: string];
  /** How it reads among odds and ends in a drawer. */
  plain?: string;
  /**
   * What the hero must know before it seems worth taking: until then it is
   * junk, and he only remembers that he saw it.
   */
  needs?: Fact;
  /** What he thinks when he learns that, if he saw it and left it. */
  recall?: string;
}

/** Everything the hero can carry, by id. */
export const ITEMS: Record<string, Item> = {
  flashlight: {
    name: 'Flashlight',
    about: 'A steady beam ahead of you.',
    icon: ['ln-up', 'flashlight'],
    plain: 'a flashlight',
    needs: 'dark',
    recall: "There was a flashlight in Victor's bedside table. I could use it now.",
  },
  'cellar-key': {
    name: 'Brass key',
    about: 'A small key from Victor’s bedside table. It fits the padlock on the mill’s hatch.',
    icon: ['ln-up', 'key'],
    plain: 'a little brass key',
    needs: 'cellar-lock',
    recall: "That little brass key in Victor's bedside table. It might fit this padlock.",
  },
  pistol: {
    name: 'Pistol',
    about: 'A worn service pistol. It jams now and then.',
    icon: ['ln-foes', 'pistol'],
  },
};

/** What the hero thinks on learning something, when nothing he saw comes to mind. */
export const FACTS: Record<Fact, string> = {
  dark: "It's getting dark. I could do with a light.",
  'cellar-lock': 'A padlock on the hatch. Victor must keep the key somewhere.',
};
