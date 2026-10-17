import { tr } from '../i18n';
import type { Paper } from '../lantern/papers';
import { h, uiRoot } from './dom';

/**
 * A sheet of paper held up in the middle of the screen: a note, a letter,
 * a page of a book. ← and → turn the pages; E, Esc or a click outside puts
 * it down. Keys pressed while it is open stay with it.
 */
export class Reader {
  private readonly el: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly title: HTMLElement;
  private readonly text: HTMLElement;
  private readonly count: HTMLElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private paper?: Paper;
  private page = 0;
  private onClose?: () => void;

  constructor() {
    this.title = h('h2', {});
    this.text = h('div', { class: 'reader-text' });
    this.count = h('span', { class: 'reader-count' });
    this.prev = h('button', { class: 'set-btn', title: tr('Previous page (←)', 'Назад (←)') }, '‹');
    this.next = h('button', { class: 'set-btn', title: tr('Next page (→)', 'Дальше (→)') }, '›');
    const done = h('button', { class: 'set-btn' }, tr('Put down', 'Отложить'));
    this.prev.addEventListener('click', () => this.turn(-1));
    this.next.addEventListener('click', () => this.turn(1));
    done.addEventListener('click', () => this.close());
    this.sheet = h(
      'div',
      { class: 'reader-sheet' },
      this.title,
      this.text,
      h('div', { class: 'reader-foot' }, this.prev, this.count, this.next, done),
    );
    this.el = h('div', { class: 'reader interactive', hidden: true, tabIndex: -1 }, this.sheet);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
    this.el.addEventListener('keydown', (e) => {
      // The game listens on the window; keep these keys from it.
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') this.close();
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.turn(-1);
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.turn(1);
    });
    uiRoot().append(this.el);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  /** Holds a paper up, at its first page; `onClose` runs once it is put down. */
  show(paper: Paper, onClose?: () => void): void {
    this.paper = paper;
    this.page = 0;
    this.onClose = onClose;
    this.title.textContent = tr(paper.title);
    this.sheet.className = `reader-sheet ${paper.hand}`;
    this.render();
    this.el.hidden = false;
    this.el.focus();
  }

  close(): void {
    if (!this.open) return;
    this.el.hidden = true;
    (document.activeElement as HTMLElement | null)?.blur();
    const done = this.onClose;
    this.onClose = undefined;
    done?.();
  }

  destroy(): void {
    this.el.remove();
  }

  private turn(by: number): void {
    const pages = this.paper?.pages.length ?? 0;
    const to = Math.max(0, Math.min(pages - 1, this.page + by));
    if (to === this.page) return;
    this.page = to;
    this.render();
  }

  private render(): void {
    const pages = this.paper?.pages ?? [];
    const page = pages[this.page];
    const text = page ? tr(page) : '';
    this.text.replaceChildren(...text.split('\n\n').map((para) => h('p', {}, para)));
    const many = pages.length > 1;
    this.count.textContent = many ? `${this.page + 1} / ${pages.length}` : '';
    this.prev.hidden = !many;
    this.next.hidden = !many;
    this.prev.disabled = this.page === 0;
    this.next.disabled = this.page === pages.length - 1;
  }
}
