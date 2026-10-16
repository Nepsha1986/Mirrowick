import type { ItemDef } from '../level/types';
import { STYLE_PRESETS, type StyleId } from '../render/stylePresets';
import { h, uiRoot } from './dom';

const LOG_LINES = 5;
const SLOTS = 6;

export interface HudActions {
  setStyle: (id: StyleId) => void;
  toggleMusic: () => boolean;
  pause: (paused: boolean) => void;
  mainMenu: () => void;
}

/** In-game overlay: place title, style switcher, message log, inventory. */
export class Hud {
  private readonly el: HTMLElement;
  private readonly log: HTMLElement;
  private readonly slots: HTMLElement[] = [];
  private readonly tip: HTMLElement;
  private readonly styleButtons = new Map<StyleId, HTMLButtonElement>();
  private readonly musicBtn: HTMLButtonElement;
  private pauseEl: HTMLElement | undefined;
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor(
    title: string,
    subtitle: string,
    musicMuted: boolean,
    private readonly actions: HudActions,
  ) {
    const menuBtn = h(
      'button',
      { class: 'round-btn', title: 'Menu (Esc)', ariaLabel: 'Menu' },
      '☰',
    );
    menuBtn.addEventListener('click', () => this.togglePause());
    this.musicBtn = h('button', { class: 'round-btn', title: 'Music (M)', ariaLabel: 'Music' });
    this.setMusicIcon(musicMuted);
    this.musicBtn.addEventListener('click', () => this.setMusicIcon(this.actions.toggleMusic()));

    const pill = h('div', { class: 'pill interactive', title: 'Visual style (1–5)' });
    for (const preset of STYLE_PRESETS) {
      const b = h('button', {}, preset.label);
      b.addEventListener('click', () => this.actions.setStyle(preset.id));
      this.styleButtons.set(preset.id, b);
      pill.append(b);
    }

    this.log = h('div', { class: 'log', ariaLive: 'polite' });
    const inv = h('div', { class: 'inventory interactive' });
    for (let i = 0; i < SLOTS; i++) {
      const s = h('div', { class: 'slot' });
      s.addEventListener('mouseenter', () => this.showItemTip(s));
      s.addEventListener('mouseleave', () => this.hideTip());
      this.slots.push(s);
      inv.append(s);
    }
    this.tip = h('div', { class: 'tooltip' });

    this.el = h(
      'div',
      { class: 'hud' },
      h(
        'div',
        { class: 'hud-top' },
        h(
          'div',
          { class: 'place interactive' },
          menuBtn,
          this.musicBtn,
          h('div', {}, h('div', { class: 'title' }, title), h('div', { class: 'sub' }, subtitle)),
        ),
        pill,
      ),
      h('div', { class: 'panel interactive' }, this.log, inv),
      this.tip,
    );
    uiRoot().append(this.el);
    window.addEventListener('keydown', this.onKey);
  }

  setStyle(id: StyleId): void {
    for (const [key, b] of this.styleButtons) b.classList.toggle('active', key === id);
  }

  message(html: string, kind: 'normal' | 'hint' = 'normal'): void {
    const p = h('p', { class: kind === 'hint' ? 'hint' : '' });
    p.innerHTML = html;
    this.log.append(p);
    while (this.log.childElementCount > LOG_LINES) this.log.firstElementChild?.remove();
  }

  setItems(items: ItemDef[], fresh?: string): void {
    this.slots.forEach((slot, i) => {
      const item = items[i];
      slot.textContent = item?.name ?? '';
      slot.classList.toggle('filled', !!item);
      slot.classList.toggle('fresh', !!item && item.id === fresh);
      slot.dataset.desc = item ? item.description : '';
    });
  }

  /** Hover label over the world; `x`, `y` are viewport pixels. */
  hoverLabel(text: string | null, x = 0, y = 0): void {
    this.tip.className = 'tooltip';
    if (!text) return;
    this.tip.textContent = text;
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
    this.tip.classList.add('show');
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.pauseEl?.remove();
    this.el.remove();
  }

  private showItemTip(slot: HTMLElement): void {
    if (!slot.dataset.desc) return;
    const r = slot.getBoundingClientRect();
    this.tip.className = 'tooltip item show';
    this.tip.textContent = slot.dataset.desc;
    this.tip.style.left = `${Math.min(r.left + r.width / 2, window.innerWidth - 150)}px`;
    this.tip.style.top = `${r.top}px`;
  }

  private hideTip(): void {
    this.tip.className = 'tooltip';
  }

  private setMusicIcon(muted: boolean): void {
    this.musicBtn.textContent = muted ? '♪̸' : '♪';
    this.musicBtn.style.opacity = muted ? '0.55' : '1';
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.togglePause();
    } else if (this.pauseEl) {
      return;
    } else if (e.key === 'm' || e.key === 'M') {
      this.setMusicIcon(this.actions.toggleMusic());
    } else {
      const preset = STYLE_PRESETS[Number(e.key) - 1];
      if (preset) this.actions.setStyle(preset.id);
    }
  }

  private togglePause(): void {
    if (this.pauseEl) {
      this.pauseEl.remove();
      this.pauseEl = undefined;
      this.actions.pause(false);
      return;
    }
    const resume = h(
      'button',
      { class: 'menu-btn primary' },
      h('span', { class: 'dot' }),
      'Resume',
    );
    resume.addEventListener('click', () => this.togglePause());
    const leave = h('button', { class: 'menu-btn' }, h('span', { class: 'dot' }), 'Main menu');
    leave.addEventListener('click', () => this.actions.mainMenu());
    this.pauseEl = h(
      'div',
      { class: 'pause interactive' },
      h(
        'div',
        { class: 'card' },
        h('h2', {}, 'Paused'),
        resume,
        leave,
        h(
          'div',
          { class: 'keys' },
          'Click — walk / use · Wheel — zoom',
          h('br'),
          '1–5 — visual style · M — music · Esc — menu',
        ),
      ),
    );
    this.el.append(this.pauseEl);
    this.actions.pause(true);
    resume.focus();
  }
}
