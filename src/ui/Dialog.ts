import { h } from './dom';

/** A choice: what the button says, and what it does. */
export type Choice = [label: string, run: () => void];

/**
 * A small panel by the thing you use: a title, maybe some words or a
 * field, and a few choices. One at a time; Esc closes it. Keys pressed in
 * it stay in it, so typing doesn't walk the hero about.
 */
export class Dialog {
  readonly el: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly choices: HTMLElement;
  private onClose?: () => void;

  constructor() {
    this.title = h('h2', {});
    this.body = h('div', { class: 'dialog-body' });
    this.choices = h('div', { class: 'dialog-choices' });
    this.el = h(
      'div',
      { class: 'dialog interactive', hidden: true },
      this.title,
      this.body,
      this.choices,
    );
    this.el.addEventListener('keydown', (e) => {
      // The game listens on the window; keep these keys from it.
      e.stopPropagation();
      if (e.key === 'Escape') this.close();
    });
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  /** Shows a page; `onClose` runs once when the dialog is closed. */
  show(title: string, body: Node | string | null, choices: Choice[], onClose?: () => void): void {
    if (onClose) this.onClose = onClose;
    this.title.textContent = title;
    this.body.replaceChildren(...(body ? [body] : []));
    this.body.hidden = !body;
    this.choices.replaceChildren(
      ...choices.map(([label, run]) => {
        const b = h('button', { class: 'set-btn' }, label);
        b.addEventListener('click', run);
        return b;
      }),
    );
    this.el.hidden = false;
    const first = this.el.querySelector<HTMLElement>('textarea, button');
    first?.focus();
  }

  close(): void {
    if (!this.open) return;
    this.el.hidden = true;
    (document.activeElement as HTMLElement | null)?.blur();
    const done = this.onClose;
    this.onClose = undefined;
    done?.();
  }
}
