import { t } from '../i18n';

/** How a paper looks: in someone's hand, typed, or printed in an old book. */
export type Hand = 'hand' | 'typed' | 'print';

/** Something to read: a note, a letter, a notebook, a book. */
export interface Paper {
  title: string;
  hand: Hand;
  /** One page per string; blank lines split paragraphs. */
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
  notebook: 'hand',
  'bookshop-letter': 'typed',
  tome: 'print',
};

/** A paper in the current language, or nothing if there is no such paper. */
export function paper(id: string): Paper | null {
  const hand = PAPERS[id];
  const words = (t().papers as Record<string, Omit<Paper, 'hand'> | undefined>)[id];
  return hand && words ? { ...words, hand } : null;
}
