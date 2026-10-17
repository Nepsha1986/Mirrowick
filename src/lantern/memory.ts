import { fill, list, t } from '../i18n';
import { ITEMS, itemWords, type Fact } from './items';

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
    const saw = wanted.find(([id]) => this.known.has(seen(id)));
    const recall = saw && itemWords(saw[0])?.recall;
    return recall ?? t().thoughts.facts[fact];
  }

  /** Whether he is done with a thing: what it was for is behind him. */
  spent(id: string): boolean {
    const done = ITEMS[id]?.spent;
    return !!done && this.known.has(done);
  }

  /** Whether something the fact calls for, and is still of use, is out of his pockets. */
  lacks(fact: Fact, carried: ReadonlySet<string>): boolean {
    return Object.entries(ITEMS).some(
      ([id, it]) => it.needs === fact && !carried.has(id) && !this.spent(id),
    );
  }

  /**
   * Whether a hoard is still worth a look: it holds something he hasn't
   * seen yet, or something he has seen and now knows he needs.
   */
  worthLooking(hoard: Hoard, carried: ReadonlySet<string>): boolean {
    return hoard.items.some((id) => {
      if (carried.has(id) || this.spent(id)) return false;
      const need = ITEMS[id]?.needs;
      return !this.known.has(seen(id)) || !need || this.known.has(need);
    });
  }

  /** Looks through a hoard: takes what seems worth it, remembers the rest. */
  search(hoard: Hoard, carried: ReadonlySet<string>): Search {
    const take: string[] = [];
    const left: string[] = [];
    for (const id of hoard.items) {
      if (carried.has(id) || this.spent(id)) continue;
      const need = ITEMS[id]?.needs;
      if (!need || this.known.has(need)) take.push(id);
      else {
        left.push(id);
        this.known.add(seen(id));
      }
    }
    const words = t().hoard;
    const said = (form: 'plain' | 'taken') => (id: string) => itemWords(id)?.[form] ?? id;
    if (take.length) {
      const what = list(take.map(said('taken')));
      return { take, says: fill(words.took, { place: hoard.place, what }) };
    }
    // What he leaves goes in among the junk, not at the front.
    const [first, ...rest] = hoard.junk;
    const all = [first, ...left.map(said('plain')), ...rest].filter((s): s is string => !!s);
    const what = all.length ? list(all) : words.nothing;
    return { take, says: fill(words.nothingNeeded, { place: hoard.place, what }) };
  }
}
