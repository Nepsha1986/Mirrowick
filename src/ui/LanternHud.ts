import { h, uiRoot } from './dom';

/** Clock, a way back and the controls; nothing else. */
export class LanternHud {
  private readonly el: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly phase: HTMLElement;

  constructor(mainMenu: () => void) {
    const back = h('button', { class: 'round-btn', title: 'Main menu (Esc)' }, '←');
    back.addEventListener('click', mainMenu);
    this.clock = h('div', { class: 'title' });
    this.phase = h('div', { class: 'sub' });
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
            h('div', { class: 'sub' }, 'The Lower World · lantern'),
          ),
        ),
        h('div', { class: 'place clock' }, h('div', {}, this.clock, this.phase)),
      ),
      h(
        'div',
        { class: 'hint-pill' },
        'Click or hold to walk · WASD · Hold T to speed up time · Esc menu',
      ),
    );
    uiRoot().append(this.el);
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
