import { t } from '../i18n';

/**
 * Something the hero has learned: that it gets dark, that a hatch is locked,
 * that someone's footprints glow in the beam. What he thinks of it is in
 * `thoughts.facts` of the language files.
 */
export type Fact = 'dark' | 'cellar-lock' | 'cellar-open' | 'trail' | 'door7-lock' | 'door7-open';

/** A thing you can carry. Its words are in `items` of the language files, by id. */
export interface Item {
  /** Its picture in an atlas, for the bag. */
  icon: [key: string, frame: string];
  /**
   * What the hero must know before it seems worth taking: until then it is
   * junk, and he only remembers that he saw it.
   */
  needs?: Fact;
  /** Something on it to read (a paper id): read once you take it, and again from the bag. */
  read?: string;
  /**
   * Once the hero knows this, he has no more use for it: the bag shows it
   * as likely done with, and he leaves it behind when he leaves the place.
   */
  spent?: Fact;
}

/** Everything the hero can carry, by id. */
export const ITEMS: Record<string, Item> = {
  flashlight: { icon: ['ln-up', 'flashlight'], needs: 'dark' },
  'cellar-key': { icon: ['ln-up', 'key'], needs: 'cellar-lock', spent: 'cellar-open' },
  keycard: { icon: ['ln-lab', 'keycard'], needs: 'door7-lock', spent: 'door7-open' },
  pistol: { icon: ['ln-foes', 'pistol'] },
};

/**
 * A thing's words: its name and what it is, how it reads among odds and
 * ends and as you take it, and what the hero thinks once he learns he
 * needs it, if he saw it and left it.
 */
export interface ItemWords {
  name: string;
  about: string;
  plain: string;
  taken: string;
  recall?: string;
}

export function itemWords(id: string): ItemWords | undefined {
  return (t().items as Record<string, ItemWords | undefined>)[id];
}
