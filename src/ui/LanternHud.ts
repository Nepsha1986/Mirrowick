import { tr } from '../i18n';
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
  private readonly thought: HTMLElement;
  private thoughtTimer = 0;
  private readonly satchel: HTMLElement;
  private readonly timers: number[] = [];

  constructor(mainMenu: () => void, place: string, bag: () => void) {
    const back = h(
      'button',
      { class: 'round-btn', title: tr('Main menu (Esc)', 'Главное меню (Esc)') },
      '←',
    );
    back.addEventListener('click', mainMenu);
    // A satchel, for the inventory.
    const satchel = h('button', { class: 'round-btn', title: tr('Inventory (I)', 'Сумка (I)') });
    satchel.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linejoin="round"><path d="M7 6V4.5a3 3 0 0 1 6 0V6"/>' +
      '<path d="M3.5 7.2c0-.7.5-1.2 1.2-1.2h10.6c.7 0 1.2.5 1.2 1.2l-.8 9.1c0 .7-.6 1.2-1.3 ' +
      '1.2H5.6c-.7 0-1.2-.5-1.3-1.2z"/><path d="M3.8 10.5h12.4M9 10.5v2h2v-2"/></svg>';
    satchel.addEventListener('click', () => {
      satchel.classList.remove('fresh');
      bag();
    });
    this.satchel = satchel;
    this.clock = h('div', { class: 'title' });
    this.phase = h('div', { class: 'sub' });
    this.action = h('div', { class: 'action-pill', hidden: true });
    this.thought = h('div', { class: 'thought', hidden: true });
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
          satchel,
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
      this.thought,
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

  /** What goes through the hero's head, or what he sees: a line for a few seconds. */
  think(text: string): void {
    this.thought.textContent = text;
    this.thought.hidden = false;
    // Restart the fade-in for a new line.
    this.thought.style.animation = 'none';
    void this.thought.offsetWidth;
    this.thought.style.animation = '';
    window.clearTimeout(this.thoughtTimer);
    const ms = 2500 + text.length * 45;
    this.thoughtTimer = window.setTimeout(() => (this.thought.hidden = true), ms);
  }

  /** How to play, for a few seconds at the start of a new game. */
  controls(): void {
    const keys: [string, string][] = [
      [tr('Click', 'Клик'), tr('walk there', 'идти туда')],
      ['WASD', tr('walk', 'ходить')],
      ['E', tr('use what glows', 'взять, открыть, прочесть')],
      ['I', tr('inventory', 'сумка')],
      [tr('Hold T', 'Держать T'), tr('pass time', 'ждать')],
      ['Esc', tr('menu', 'меню')],
    ];
    const el = h(
      'div',
      { class: 'controls' },
      ...keys.map(([k, what]) => h('span', {}, h('kbd', {}, k), ` ${what}`)),
    );
    this.el.append(el);
    this.timers.push(window.setTimeout(() => el.classList.add('leaving'), 9000));
    this.timers.push(window.setTimeout(() => el.remove(), 10_000));
  }

  /**
   * Something went into the bag: its picture and name pop up mid-screen and
   * fly to the bag button, which keeps a dot until you open it.
   */
  gained(items: { name: string; icon?: string }[]): void {
    const card = h(
      'div',
      { class: 'gain' },
      ...items.map((it) =>
        h('div', {}, it.icon ? h('img', { src: it.icon, alt: '' }) : null, h('b', {}, it.name)),
      ),
    );
    this.el.append(card);
    const to = this.satchel.getBoundingClientRect();
    const from = card.getBoundingClientRect();
    card.style.setProperty('--dx', `${to.x + to.width / 2 - (from.x + from.width / 2)}px`);
    card.style.setProperty('--dy', `${to.y + to.height / 2 - (from.y + from.height / 2)}px`);
    this.timers.push(
      window.setTimeout(() => {
        card.remove();
        this.satchel.classList.add('fresh');
      }, 2600),
    );
  }

  /** The bag was opened: nothing new in it any more. */
  seenBag(): void {
    this.satchel.classList.remove('fresh');
  }

  update(day: number, hour: number, night: number): void {
    const hr = Math.floor(hour);
    const mn = Math.floor(((hour - hr) * 60) / 10) * 10;
    const text = `${tr('Day', 'День')} ${day} · ${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
    if (this.clock.textContent !== text) this.clock.textContent = text;
    const phase =
      night >= 1
        ? tr('Night', 'Ночь')
        : night <= 0
          ? tr('Day', 'День')
          : hour >= 12
            ? tr('Dusk', 'Сумерки')
            : tr('Dawn', 'Рассвет');
    if (this.phase.textContent !== phase) this.phase.textContent = phase;
  }

  destroy(): void {
    window.clearTimeout(this.thoughtTimer);
    for (const t of this.timers) window.clearTimeout(t);
    this.el.remove();
  }
}
