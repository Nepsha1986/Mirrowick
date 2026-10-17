import { music } from '../audio/AmbientMusic';
import { t, type Messages } from '../i18n';
import { h, uiRoot } from './dom';

type Call = Messages['intro']['call'];

/** A line of the opening: who says it, or nobody for what happens. */
type Line = [who: keyof Messages['intro']['who'] | null, text: keyof Call];

/** The phone call that brings Mark out to his uncle's house. */
const CALL: Line[] = [
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

/** How long a line stays before the next: time enough to read it unhurried. */
const readTime = (text: string) => 1400 + text.length * 55;

/**
 * The opening of a new game: words on black, one line at a time, each
 * following the last once there has been time to read it. A click, Space,
 * Enter or E brings the next at once; Esc skips the lot.
 */
export class Intro {
  private readonly el: HTMLElement;
  private readonly lines: HTMLElement;
  private next = 0;
  private done = false;
  private readonly timers: number[] = [];
  /** The next line, coming by itself. */
  private auto = 0;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === 'Escape') this.finish();
    else if ([' ', 'Enter', 'e', 'E'].includes(e.key)) this.step();
    else return;
    e.preventDefault();
  };

  constructor(private readonly onDone: () => void) {
    this.lines = h('div', { class: 'intro-lines' });
    this.el = h(
      'div',
      { class: 'intro interactive' },
      this.lines,
      h('div', { class: 'intro-hint' }, t().intro.hint),
    );
    this.el.addEventListener('click', () => this.step());
    window.addEventListener('keydown', this.onKey);
    uiRoot().append(this.el);
    // The phone rings twice before the first words.
    music.sfx('ring');
    this.timers.push(window.setTimeout(() => music.sfx('ring'), 1600));
    this.timers.push(window.setTimeout(() => this.step(), 900));
  }

  private step(): void {
    if (this.done) return;
    window.clearTimeout(this.auto);
    const line = CALL[this.next++];
    if (!line) return this.finish();
    const words = t().intro;
    const who = line[0] && words.who[line[0]];
    const text = words.call[line[1]];
    this.auto = window.setTimeout(() => this.step(), readTime(text));
    for (const old of this.lines.children) old.classList.add('past');
    this.lines.append(
      h(
        'p',
        { class: who ? 'said' : 'told' },
        who ? h('b', {}, who) : null,
        who ? ` ${text}` : text,
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
    window.removeEventListener('keydown', this.onKey);
    // The game starts under the black, which then lifts.
    this.onDone();
    window.setTimeout(() => this.el.classList.add('leaving'), 300);
    window.setTimeout(() => this.el.remove(), 1200);
  }
}
