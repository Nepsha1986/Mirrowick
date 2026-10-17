import { tr } from '../i18n';
import { FACTS, ITEMS, type Fact } from './items';

/** What lies in a drawer or a box: things worth having, maybe, and plain junk. */
export interface Hoard {
  /** Where you look, for the words: "In the drawer", in the current language. */
  place: string;
  /** Ids of things you could carry. */
  items: string[];
  /** The rest, never worth taking. */
  junk: string[];
}

/** What came of looking in: what you take, and what goes through your head. */
export interface Search {
  take: string[];
  says: string;
}

const seen = (item: string) => `seen:${item}`;
const read = (paper: string) => `read:${paper}`;
/** "a flashlight" becomes "the flashlight"; Russian has no articles. */
const the = (plain: string) => plain.replace(/^an? /, 'the ');

/**
 * What the hero knows and has seen. He leaves what he has no use for, but
 * remembers it: once he learns he needs it, it comes to mind, and the next
 * time he looks he takes it.
 */
export class Memory {
  private readonly known: Set<string>;

  constructor(known: Iterable<string> = []) {
    this.known = new Set(known);
  }

  /** Everything, for the save. */
  get list(): string[] {
    return [...this.known];
  }

  knows(fact: Fact): boolean {
    return this.known.has(fact);
  }

  /** Reads a paper: true the first time. */
  read(paper: string): boolean {
    if (this.known.has(read(paper))) return false;
    this.known.add(read(paper));
    return true;
  }

  hasRead(paper: string): boolean {
    return this.known.has(read(paper));
  }

  /**
   * Learns a fact. The first time, returns what he thinks: a thing he saw
   * and left that would help now, or just the fact. Nothing if what it
   * calls for is already in his pockets.
   */
  learn(fact: Fact, carried: ReadonlySet<string>): string | null {
    if (this.known.has(fact)) return null;
    this.known.add(fact);
    const wanted = Object.entries(ITEMS).filter(([, it]) => it.needs === fact);
    if (wanted.some(([id]) => carried.has(id))) return null;
    const recall = wanted.find(([id]) => this.known.has(seen(id)))?.[1].recall;
    return tr(recall ?? FACTS[fact]);
  }

  /** Whether something the fact calls for is still out of his pockets. */
  lacks(fact: Fact, carried: ReadonlySet<string>): boolean {
    return Object.entries(ITEMS).some(([id, it]) => it.needs === fact && !carried.has(id));
  }

  /**
   * Whether a hoard is still worth a look: it holds something he hasn't
   * seen yet, or something he has seen and now knows he needs.
   */
  worthLooking(hoard: Hoard, carried: ReadonlySet<string>): boolean {
    return hoard.items.some((id) => {
      if (carried.has(id)) return false;
      const need = ITEMS[id]?.needs;
      return !this.known.has(seen(id)) || !need || this.known.has(need);
    });
  }

  /** Looks through a hoard: takes what seems worth it, remembers the rest. */
  search(hoard: Hoard, carried: ReadonlySet<string>): Search {
    const take: string[] = [];
    const left: string[] = [];
    for (const id of hoard.items) {
      if (carried.has(id)) continue;
      const need = ITEMS[id]?.needs;
      if (!need || this.known.has(need)) take.push(id);
      else {
        left.push(id);
        this.known.add(seen(id));
      }
    }
    const plain = (id: string) => {
      const p = ITEMS[id]?.plain;
      return p ? tr(p) : id;
    };
    if (take.length) {
      const what = take.map((id) => the(plain(id)));
      return {
        take,
        says: tr(
          `${hoard.place}: you take ${list(what)}. The rest is junk.`,
          `${hoard.place}: вы берёте ${list(what)}. Остальное — хлам.`,
        ),
      };
    }
    // What he leaves goes in among the junk, not at the front.
    const [first, ...rest] = hoard.junk;
    const all = [first, ...left.map(plain), ...rest].filter((s): s is string => !!s);
    return {
      take,
      says: tr(
        `${hoard.place}: ${list(all)}. Nothing you need.`,
        `${hoard.place}: ${list(all)}. Ничего нужного.`,
      ),
    };
  }
}

/** "a, b and c". */
function list(words: string[]): string {
  if (words.length < 2) return words[0] ?? tr('nothing', 'ничего');
  return `${words.slice(0, -1).join(', ')} ${tr('and', 'и')} ${words[words.length - 1]}`;
}
