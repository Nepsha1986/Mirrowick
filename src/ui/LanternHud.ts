import { Dialog } from './Dialog';
import { h, uiRoot } from './dom';

/** Clock, a way back and what you can do right here; nothing else. */
export class LanternHud {
  /** What a thing asks of you when you use it: the mailbox's choices. */
  readonly dialog = new Dialog();
  private readonly el: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly action: HTMLElement;

  constructor(mainMenu: () => void, place: string) {
    const back = h('button', { class: 'round-btn', title: 'Main menu (Esc)' }, '←');
    back.addEventListener('click', mainMenu);
    this.clock = h('div', { class: 'title' });
    this.phase = h('div', { class: 'sub' });
    this.action = h('div', { class: 'action-pill', hidden: true });
    this.el = h(
      'div',
      { class: 'hud' },
      h(
        'div',
        { class: 'hud-top' },
        h(
          'div',
          { class: 'place' },
          back,
          h(
            'div',
            {},
            h('div', { class: 'title' }, 'Mirrowick'),
            h('div', { class: 'sub' }, place),
          ),
        ),
        h('div', { class: 'place clock' }, h('div', {}, this.clock, this.phase)),
      ),
      this.dialog.el,
      this.action,
    );
    uiRoot().append(this.el);
  }

  /** What you can do right here, or nothing. */
  prompt(text: string | null): void {
    if (this.dialog.open) text = null;
    this.action.hidden = !text;
    if (text && this.action.textContent !== text) this.action.textContent = text;
  }

  update(day: number, hour: number, night: number): void {
    const hr = Math.floor(hour);
    const mn = Math.floor(((hour - hr) * 60) / 10) * 10;
    const text = `Day ${day} · ${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
    if (this.clock.textContent !== text) this.clock.textContent = text;
    const phase = night >= 1 ? 'Night' : night <= 0 ? 'Day' : hour >= 12 ? 'Dusk' : 'Dawn';
    if (this.phase.textContent !== phase) this.phase.textContent = phase;
  }

  destroy(): void {
    this.el.remove();
  }
}
