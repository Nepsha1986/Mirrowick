import { music } from '../audio/AmbientMusic';
import { h, uiRoot } from './dom';

/** A line of the opening: who says it, or nobody for what happens. */
type Line = [who: string | null, text: string];

/** The phone call that brings Mark out to his uncle's house. */
const CALL: Line[] = [
  [null, 'A phone buzzes on the table. An unknown number.'],
  ['Mark', 'Hello?'],
  ['Pete', "Mark? It's Pete. Victor's neighbour, out by the old mill."],
  ['Mark', 'Pete… Has something happened?'],
  ['Pete', "It's your uncle. Nobody's seen him for three days."],
  ['Pete', "The door was open, his coat still on the hook. But he's gone."],
  ['Mark', 'Have you called the police?'],
  ['Pete', "They had a look round and said he'll turn up. I don't think he will."],
  ['Pete', "You're the only family he's got. Can you come?"],
  ['Mark', "I'm on my way."],
  [null, 'Four hours of road later…'],
];

/**
 * The opening of a new game: words on black, one line at a time. A click,
 * Space, Enter or E brings the next; Esc skips the lot.
 */
export class Intro {
  private readonly el: HTMLElement;
  private readonly lines: HTMLElement;
  private next = 0;
  private done = false;
  private readonly timers: number[] = [];
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
      h('div', { class: 'intro-hint' }, 'Space · next   Esc · skip'),
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
    const line = CALL[this.next++];
    if (!line) return this.finish();
    const [who, text] = line;
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
    for (const t of this.timers) window.clearTimeout(t);
    window.removeEventListener('keydown', this.onKey);
    // The game starts under the black, which then lifts.
    this.onDone();
    window.setTimeout(() => this.el.classList.add('leaving'), 300);
    window.setTimeout(() => this.el.remove(), 1200);
  }
}
