import { storage } from './ui/dom';

/** The languages the game speaks. */
export type Lang = 'en' | 'ru';

/** A line in every language, for text kept in tables. */
export interface Words {
  en: string;
  ru: string;
}

const KEY = 'mirrowick.lang';

/** The saved choice, else the browser's language. */
function initial(): Lang {
  const saved = storage.get(KEY);
  if (saved === 'en' || saved === 'ru') return saved;
  const nav = typeof navigator === 'undefined' ? '' : (navigator.language ?? '');
  return nav.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

let current: Lang = initial();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function lang(): Lang {
  return current;
}

/** Switches the language. Text already on screen stays until it is redrawn. */
export function setLang(l: Lang): void {
  current = l;
  storage.set(KEY, l);
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** The line in the current language: `tr('Back', 'Назад')`, or `tr(words)`. */
export function tr(en: string, ru: string): string;
export function tr(words: Words): string;
export function tr(en: string | Words, ru?: string): string {
  if (typeof en !== 'string') return en[current];
  return current === 'ru' ? (ru ?? en) : en;
}
