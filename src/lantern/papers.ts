import { t } from '../i18n';

/**
 * How a paper looks: in someone's hand, typed, printed in an old book, or
 * messages on a phone's screen.
 */
export type Hand = 'hand' | 'typed' | 'print' | 'phone';

/** Something to read: a note, a letter, a book, a phone's messages. */
export interface Paper {
  title: string;
  hand: Hand;
  /**
   * One page per string; blank lines split paragraphs. On a phone each
   * paragraph is a message: `> ` starts one the owner sent, `# ` a date.
   */
  pages: string[];
  /** What the hero thinks once he has read it the first time. */
  after?: string;
}

/**
 * Everything there is to read, by id, and how it looks. A thing points at
 * one with `Thing.read`; the words are in `papers` of the language files.
 */
export const PAPERS: Record<string, Hand> = {
  'fridge-note': 'hand',
  phone: 'phone',
  'bookshop-letter': 'typed',
  tome: 'print',
  'shift-log': 'typed',
};

/** A paper in the current language, or nothing if there is no such paper. */
export function paper(id: string): Paper | null {
  const hand = PAPERS[id];
  const words = (t().papers as Record<string, Omit<Paper, 'hand'> | undefined>)[id];
  return hand && words ? { ...words, hand } : null;
}
