import { fill, t } from '../i18n';
import { clamp, type Pt } from '../lantern/util';
import { Dialog } from './Dialog';
import { h, uiRoot } from './dom';

/** Room kept between a label and the edge of the screen, and under the top bar. */
const EDGE = 12;
const TOP = 84;
/** How far a thought about a thing sits above it: clear of the prompt. */
const OVER_PROMPT = 46;

/** An element pinned over a point in the world, and its size, measured when its words change. */
interface Pin {
  el: HTMLElement;
  at: Pt | null;
  w: number;
  h: number;
}

/**
 * Clock, a way back and what you can do right here; nothing else. The
 * prompt, the hero's thoughts and a thing's dialog hang over the world:
 * over the thing they are about, or over the hero.
 */
export class LanternHud {
  /** What a thing asks of you when you use it: the mailbox's choices. */
  readonly dialog = new Dialog();
  private readonly el: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly action: Pin;
  private readonly thought: Pin;
  /** What the open dialog belongs to. */
  private dialogAt: Pt | null = null;
  private thoughtTimer = 0;
  private readonly satchel: HTMLElement;
  private readonly timers: number[] = [];
  /** The mouse is over the prompt: what it is about stays pointed at. */
  private overPrompt = false;

  constructor(
    mainMenu: () => void,
    place: { name: string; where: string },
    bag: () => void,
    /** A point in the world to one on the screen. */
    private readonly toScreen: (p: Pt) => Pt,
    /** The prompt was clicked: do what it says. */
    act: () => void,
  ) {
    const back = h('button', { class: 'round-btn', title: t().hud.menu }, '←');
    back.addEventListener('click', mainMenu);
    // A satchel, for the inventory.
    const satchel = h('button', { class: 'round-btn', title: t().hud.bag });
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
    const pin = (cls: string): Pin => ({
      el: h('div', { class: `${cls} pinned`, hidden: true }),
      at: null,
      w: 0,
      h: 0,
    });
    this.action = pin('action-pill interactive');
    this.thought = pin('thought');
    const pill = this.action.el;
    pill.addEventListener('mouseenter', () => (this.overPrompt = true));
    pill.addEventListener('mouseleave', () => (this.overPrompt = false));
    pill.addEventListener('click', act);
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
            h('div', { class: 'title' }, place.name),
            h('div', { class: 'sub' }, place.where),
          ),
        ),
        h('div', { class: 'place clock' }, h('div', {}, this.clock, this.phase)),
      ),
      this.dialog.el,
      this.thought.el,
      this.action.el,
    );
    uiRoot().append(this.el);
  }

  /** What you can do with the thing under the mouse, over it (`at`, the top of it), or nothing. */
  prompt(text: string | null, at: Pt | null = null): void {
    const a = this.action;
    if (this.dialog.open) text = null;
    a.el.hidden = !text;
    if (!text) this.overPrompt = false;
    a.at = at;
    if (!text) return;
    if (a.el.textContent !== text || !a.w) {
      a.el.textContent = text;
      this.measure(a);
    }
  }

  /**
   * What goes through the hero's head, or what he sees: a line for a few
   * seconds, over the thing it is about (`at`, the top of it) or over him.
   */
  think(text: string, at: Pt | null = null): void {
    const th = this.thought;
    th.el.textContent = text;
    th.el.hidden = false;
    th.at = at;
    // Restart the fade-in for a new line.
    th.el.style.animation = 'none';
    this.measure(th);
    th.el.style.animation = '';
    window.clearTimeout(this.thoughtTimer);
    const ms = 2500 + text.length * 45;
    this.thoughtTimer = window.setTimeout(() => (th.el.hidden = true), ms);
  }

  /** Whether the mouse is over the prompt. */
  get pointing(): boolean {
    return this.overPrompt;
  }

  /** The dialog about to open belongs to the thing at `at` (the top of it): it opens by it. */
  dialogBy(at: Pt): void {
    this.dialogAt = at;
    this.dialog.el.classList.add('pinned');
  }

  /**
   * Hangs the prompt, the thought and the dialog over what they are about,
   * kept on the screen. Call once the camera has moved, with the top of the
   * hero's head.
   */
  place(hero: Pt): void {
    const vw = this.el.clientWidth;
    const vh = this.el.clientHeight;
    const put = (el: HTMLElement, w: number, h: number, at: Pt, lift: number) => {
      const p = this.toScreen(at);
      const x = clamp(p.x - w / 2, EDGE, vw - w - EDGE);
      const y = clamp(p.y - lift - h, TOP, vh - h - EDGE);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };
    const a = this.action;
    if (!a.el.hidden && a.at) put(a.el, a.w, a.h, a.at, 8);
    const th = this.thought;
    if (!th.el.hidden) put(th.el, th.w, th.h, th.at ?? hero, th.at ? OVER_PROMPT : 8);
    const d = this.dialog.el;
    if (this.dialog.open && this.dialogAt) {
      const w = d.offsetWidth;
      const h = d.offsetHeight;
      // Over the thing if there is room, else under it.
      const p = this.toScreen(this.dialogAt);
      put(d, w, h, this.dialogAt, p.y - h - 16 < TOP ? -h - 56 : 16);
    }
  }

  private measure(pin: Pin): void {
    pin.w = pin.el.offsetWidth;
    pin.h = pin.el.offsetHeight;
  }

  /** How to play, for a few seconds at the start of a new game. */
  controls(): void {
    const w = t().hud.keys;
    const keys: [string, string][] = [
      [w.click, w.clickWhat],
      ['WASD', w.wasdWhat],
      ['E', w.eWhat],
      ['I', w.iWhat],
      [w.hold, w.holdWhat],
      ['Esc', w.escWhat],
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
    const time = `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
    const text = fill(t().hud.clock, { day, time });
    if (this.clock.textContent !== text) this.clock.textContent = text;
    const w = t().hud.phase;
    const phase = night >= 1 ? w.night : night <= 0 ? w.day : hour >= 12 ? w.dusk : w.dawn;
    if (this.phase.textContent !== phase) this.phase.textContent = phase;
  }

  destroy(): void {
    window.clearTimeout(this.thoughtTimer);
    for (const id of this.timers) window.clearTimeout(id);
    this.el.remove();
  }
}
