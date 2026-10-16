import { h, uiRoot } from './dom';

export type MoodId = 'day' | 'dusk' | 'night' | 'mist';
const MOODS: [MoodId, string][] = [
  ['day', 'Day'],
  ['dusk', 'Dusk'],
  ['night', 'Night'],
  ['mist', 'Mist'],
];

export interface PaintedHudActions {
  setMood: (id: MoodId) => void;
  mainMenu: () => void;
}

/** A light HUD for the painted prototype: place name, moods, a way back. */
export class PaintedHud {
  private readonly el: HTMLElement;
  private readonly buttons = new Map<MoodId, HTMLButtonElement>();
  private readonly onKey = (e: KeyboardEvent) => {
    const mood = MOODS[Number(e.key) - 1];
    if (mood) this.actions.setMood(mood[0]);
    if (e.key === 'Escape') this.actions.mainMenu();
  };

  constructor(
    mood: MoodId,
    private readonly actions: PaintedHudActions,
  ) {
    const back = h('button', { class: 'round-btn', title: 'Main menu (Esc)' }, '←');
    back.addEventListener('click', actions.mainMenu);
    const pill = h('div', { class: 'pill interactive' });
    for (const [id, label] of MOODS) {
      const b = h('button', { title: `Key ${MOODS.findIndex((m) => m[0] === id) + 1}` }, label);
      b.addEventListener('click', () => actions.setMood(id));
      this.buttons.set(id, b);
      pill.append(b);
    }
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
            h('div', { class: 'sub' }, 'The Lower World · painted'),
          ),
        ),
        pill,
      ),
      h('div', { class: 'hint-pill' }, 'Click to walk · Wheel to zoom · 1–4 mood · Esc menu'),
    );
    uiRoot().append(this.el);
    this.setMood(mood);
    window.addEventListener('keydown', this.onKey);
  }

  setMood(id: MoodId): void {
    for (const [key, b] of this.buttons) b.classList.toggle('active', key === id);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }
}
