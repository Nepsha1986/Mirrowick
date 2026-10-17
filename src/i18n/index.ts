import { storage } from '../ui/dom';
import { en } from './en';

/**
 * The game's words in many languages. Each language is one file in this
 * folder with the same shape as `en.ts`; to add one, write the file and
 * list it in `LANGS`. Text is read as `t().menu.play`; `fill` puts values
 * into `{name}` slots.
 */

/** Every word the game shows; English is its shape. */
export type Messages = typeof en;

/** A language that is still being translated: what it lacks stays English. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string | readonly string[] ? T[K] : DeepPartial<T[K]>;
};

interface Language {
  /** Its own name for itself, as the settings show it. */
  name: string;
  /** Its words, fetched only when it is chosen; they bring their own fonts. */
  load: () => Promise<DeepPartial<Messages>>;
  /** Its locale for `Intl`, if more than the bare code. */
  locale?: string;
  /** Fonts to have ready before the first frame, as `document.fonts.load` takes them. */
  fonts?: string[];
}

/** The languages the game speaks. */
export const LANGS = {
  en: { name: 'English', locale: 'en-GB', load: async () => en },
  ru: {
    name: 'Русский',
    load: async () => (await import('./ru')).ru,
    fonts: ['600 32px Lora', '400 16px "PT Sans"', '700 16px "PT Sans"'],
  },
} satisfies Record<string, Language>;

export type Lang = keyof typeof LANGS;

export const isLang = (s: unknown): s is Lang => typeof s === 'string' && s in LANGS;

const KEY = 'mirrowick.lang';

let current: Lang = 'en';
let messages: Messages = en;

export function lang(): Lang {
  return current;
}

/** The fonts the current language needs besides the game's own. */
export function langFonts(): string[] {
  const l: Language = LANGS[current];
  return l.fonts ?? [];
}

/** The words in the current language. */
export function t(): Messages {
  return messages;
}

/** Switches the language once its words are in. Text already on screen stays until redrawn. */
export async function setLang(l: Lang): Promise<void> {
  const words = await LANGS[l].load();
  current = l;
  messages = merge(en, words);
  storage.set(KEY, l);
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** At start-up: the saved choice, else the browser's language, else English. */
export function initLang(): Promise<void> {
  const saved = storage.get(KEY);
  const nav = typeof navigator === 'undefined' ? [] : (navigator.languages ?? []);
  const wanted = [saved, ...nav.map((n) => n.toLowerCase().split('-')[0])];
  return setLang(wanted.find(isLang) ?? 'en');
}

/** Puts values into a line's `{name}` slots. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (slot, name: string) =>
    name in values ? String(values[name]) : slot,
  );
}

/** "a, b and c", as the current language joins them. */
export function list(words: string[]): string {
  const l: Language = LANGS[current];
  return new Intl.ListFormat(l.locale ?? current, { type: 'conjunction' }).format(words);
}

/** English with the language's words laid over it, so nothing is ever missing. */
function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (over === undefined) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return over as T;
  const out = { ...base };
  for (const k of Object.keys(over) as (keyof T)[]) {
    out[k] = merge(base[k], (over as Record<keyof T, never>)[k]);
  }
  return out;
}
