import { music, type Sfx } from '../audio/AmbientMusic';
import { t, type Messages } from '../i18n';
import { h, uiRoot } from './dom';

type Who = keyof Messages['intro']['who'];

/** A line of a scene: who says it, or nobody for what happens, and a sound with it. */
type Line<K> = [who: Who | null, text: K, sound?: Sfx];

/** The phone call that brings Mark out to his uncle's house. */
const CALL: Line<keyof Messages['intro']['call']>[] = [
  [null, 'buzz'],
  ['mark', 'hello'],
  ['pete', 'itsPete'],
  ['mark', 'what'],
  ['pete', 'uncle'],
  ['pete', 'gone'],
  ['mark', 'police'],
  ['pete', 'turnUp'],
  ['pete', 'come'],
  ['mark', 'onMyWay'],
  [null, 'road'],
];

/** The first way down under the shed: a long crawl in the dark. */
const DESCENT: Line<keyof Messages['descent']>[] = [
  [null, 'steps', 'steps'],
  ['mark', 'dark'],
  [null, 'crawl', 'crawl'],
  ['mark', 'dislike'],
  ['mark', 'damp', 'drip'],
  [null, 'long', 'crawl'],
  ['mark', 'far'],
  ['mark', 'victor', 'drip'],
  [null, 'behind', 'scrape'],
  ['mark', 'rats'],
  [null, 'faster', 'crawl'],
  ['mark', 'keepGoing'],
  [null, 'light', 'drip'],
  ['mark', 'never'],
  ['mark', 'what'],
];

/** The first time through the mirror: the same circle, and a place built round it that nobody has left. */
const ARRIVAL: Line<keyof Messages['arrival']>[] = [
  [null, 'through', 'mirror'],
  [null, 'floor', 'thud'],
  ['mark', 'cold'],
  [null, 'hum', 'hum'],
  [null, 'wrong'],
  ['mark', 'notCellar'],
  [null, 'lamp'],
  [null, 'built'],
  [null, 'drip', 'drip'],
  ['mark', 'hello'],
  [null, 'nobody'],
  [null, 'dust'],
  ['mark', 'left'],
  [null, 'screen', 'hum'],
  [null, 'far', 'scrape'],
  ['mark', 'victor'],
];

/** How long a line stays before the next: time enough to read it unhurried. */
const readTime = (text: string) => 1400 + text.length * 55;

/**
 * Words on black, one line at a time, each following the last once there
 * has been time to read it. A click, Space, Enter or E brings the next at
 * once; Esc skips the lot. The game underneath hears none of these keys.
 */
export class Cutscene {
  private readonly el: HTMLElement;
  private readonly lines: HTMLElement;
  private next = 0;
  private done = false;
  private readonly timers: number[] = [];
  /** The next line, coming by itself. */
  private auto = 0;
  private readonly onKey = (e: KeyboardEvent) => {
    // Caught on the way down, before the game sees it: Esc here isn't the menu.
    e.stopPropagation();
    if (e.repeat) return;
    if (e.key === 'Escape') this.finish();
    else if ([' ', 'Enter', 'e', 'E'].includes(e.key)) this.step();
    else return;
    e.preventDefault();
  };

  private constructor(
    private readonly script: { who: Who | null; text: string; sound?: Sfx }[],
    private readonly onDone: () => void,
    lead: number,
  ) {
    this.lines = h('div', { class: 'intro-lines' });
    this.el = h(
      'div',
      { class: 'intro interactive' },
      this.lines,
      h('div', { class: 'intro-hint' }, t().intro.hint),
    );
    this.el.addEventListener('click', () => this.step());
    window.addEventListener('keydown', this.onKey, true);
    uiRoot().append(this.el);
    this.timers.push(window.setTimeout(() => this.step(), lead));
  }

  /** The opening of a new game: the phone rings twice before the first words. */
  static call(onDone: () => void): Cutscene {
    const words = t().intro.call;
    const scene = new Cutscene(
      CALL.map(([who, key]) => ({ who, text: words[key] })),
      onDone,
      900,
    );
    music.sfx('ring');
    scene.timers.push(window.setTimeout(() => music.sfx('ring'), 1600));
    return scene;
  }

  /** The first time down the hatch, before the cellar opens out. */
  static descent(onDone: () => void): Cutscene {
    const words = t().descent;
    return new Cutscene(
      DESCENT.map(([who, key, sound]) => ({ who, text: words[key], sound })),
      onDone,
      600,
    );
  }

  /** The first time through the mirror, before the Facility shows. */
  static arrival(onDone: () => void): Cutscene {
    const words = t().arrival;
    return new Cutscene(
      ARRIVAL.map(([who, key, sound]) => ({ who, text: words[key], sound })),
      onDone,
      900,
    );
  }

  private step(): void {
    if (this.done) return;
    window.clearTimeout(this.auto);
    const line = this.script[this.next++];
    if (!line) return this.finish();
    const who = line.who && t().intro.who[line.who];
    if (line.sound) music.sfx(line.sound);
    this.auto = window.setTimeout(() => this.step(), readTime(line.text));
    for (const old of this.lines.children) old.classList.add('past');
    this.lines.append(
      h(
        'p',
        { class: who ? 'said' : 'told' },
        who ? h('b', {}, who) : null,
        who ? ` ${line.text}` : line.text,
      ),
    );
    // Only the last few lines stay on screen.
    while (this.lines.children.length > 5) this.lines.firstElementChild?.remove();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    for (const id of this.timers) window.clearTimeout(id);
    window.clearTimeout(this.auto);
    window.removeEventListener('keydown', this.onKey, true);
    // The game starts under the black, which then lifts.
    this.onDone();
    window.setTimeout(() => this.el.classList.add('leaving'), 300);
    window.setTimeout(() => this.el.remove(), 1200);
  }
}
