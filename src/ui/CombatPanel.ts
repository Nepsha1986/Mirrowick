import { h, uiRoot } from './dom';

export type Stance = 'fight' | 'fallback';

/** What the panel shows, refreshed every frame. */
export interface FightView {
  hp: number;
  maxHp: number;
  /** The weapon in hand, its rounds and what it is doing. */
  weapon: string;
  /** Who you are fighting and your chance to hit them, if anyone. */
  target: string | null;
  /** Something is close enough that you can't just turn and run. */
  engaged: boolean;
  stance: Stance;
}

const LOG_LINES = 5;

/**
 * The fight, bottom left: your health, your weapon, the one choice you have
 * (fight or fall back) and a running log of what happened, in the manner
 * of the old games. Shows only around a fight, or while you're hurt.
 */
export class CombatPanel {
  private readonly el: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly weapon: HTMLElement;
  private readonly target: HTMLElement;
  private readonly stances: HTMLElement;
  private readonly fight: HTMLButtonElement;
  private readonly back: HTMLButtonElement;
  private readonly log: HTMLElement;

  constructor(onStance: (s: Stance) => void) {
    this.bar = h('span', {});
    this.hpText = h('b', {});
    this.weapon = h('div', { class: 'fight-gun' });
    this.target = h('div', { class: 'fight-target' });
    this.fight = h('button', { class: 'fight-btn', title: 'Fight (F)' }, 'F · Fight');
    this.back = h('button', { class: 'fight-btn', title: 'Fall back (R)' }, 'R · Fall back');
    this.fight.addEventListener('click', () => onStance('fight'));
    this.back.addEventListener('click', () => onStance('fallback'));
    this.stances = h('div', { class: 'fight-stance' }, this.fight, this.back);
    this.log = h('ol', { class: 'fight-log' });
    this.el = h(
      'div',
      { class: 'fight', hidden: true },
      h('div', { class: 'fight-hp' }, this.bar, this.hpText),
      this.weapon,
      this.target,
      this.stances,
      this.log,
    );
    uiRoot().append(this.el);
  }

  show(on: boolean): void {
    if (this.el.hidden === on) this.el.hidden = !on;
  }

  update(v: FightView): void {
    this.bar.style.width = `${Math.max(0, (v.hp / v.maxHp) * 100)}%`;
    this.bar.classList.toggle('low', v.hp / v.maxHp < 0.35);
    set(this.hpText, `${Math.max(0, Math.ceil(v.hp))} / ${v.maxHp}`);
    set(this.weapon, v.weapon);
    set(this.target, v.target ?? '');
    this.target.hidden = !v.target;
    this.stances.hidden = !v.engaged && !v.target;
    this.fight.classList.toggle('on', v.stance === 'fight');
    this.back.classList.toggle('on', v.stance === 'fallback');
  }

  /** A line in the log; the oldest drops off. */
  say(text: string, tone: 'good' | 'bad' | 'plain' = 'plain'): void {
    this.log.append(h('li', { class: tone }, text));
    while (this.log.children.length > LOG_LINES) this.log.firstElementChild?.remove();
  }

  destroy(): void {
    this.el.remove();
  }
}

const set = (el: HTMLElement, text: string) => {
  if (el.textContent !== text) el.textContent = text;
};
