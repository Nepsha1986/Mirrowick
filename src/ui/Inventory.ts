import { fill, t } from '../i18n';
import { h, uiRoot } from './dom';

/** One thing in your pockets. */
export interface BagItem {
  name: string;
  about: string;
  /** Its picture, as a data URL. */
  icon?: string;
  /** A count or state shown beside it: rounds, say. */
  note?: string;
  /** A paper id, if it has something to read: a click reads it. */
  read?: string;
  /** Done with: shown faded, and left behind soon. */
  spent?: boolean;
}

/** What the bag shows: your things and yourself. */
export interface BagView {
  items: BagItem[];
  hp: number;
  maxHp: number;
  skills: { guns: number; melee: number; dodge: number };
}

/**
 * The inventory, top right under the clock: what the hero carries, with a
 * picture of each, and how they are — health and skills. `I` or the bag
 * button opens and closes it. A thing with words on it reads on a click.
 */
export class Inventory {
  private readonly el: HTMLElement;
  private readonly list: HTMLElement;
  private readonly stats: HTMLElement;
  private last = '';

  constructor(private readonly onRead: (paper: string) => void) {
    this.list = h('ul', { class: 'bag-items' });
    this.stats = h('div', { class: 'bag-stats' });
    const close = h('button', { class: 'bag-close', title: t().bag.close }, '×');
    close.addEventListener('click', () => this.toggle(false));
    this.el = h(
      'div',
      { class: 'bag interactive', hidden: true },
      h('div', { class: 'bag-head' }, h('h2', {}, t().bag.title), close),
      this.list,
      h('h3', {}, t().bag.you),
      this.stats,
    );
    uiRoot().append(this.el);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  toggle(on = !this.open): void {
    this.el.hidden = !on;
  }

  /** Redraws only when something changed. */
  show(v: BagView): void {
    const key = JSON.stringify(v);
    if (key === this.last) return;
    this.last = key;
    this.list.replaceChildren(
      ...(v.items.length
        ? v.items.map((it) => {
            const li = h(
              'li',
              {
                class: [it.read && 'bag-read', it.spent && 'bag-spent'].filter(Boolean).join(' '),
                title: it.read ? t().bag.read : '',
              },
              it.icon ? h('img', { src: it.icon, alt: '' }) : h('span', { class: 'bag-blank' }),
              h(
                'div',
                {},
                h('b', {}, it.name, it.note ? h('em', {}, ` · ${it.note}`) : null),
                h('span', {}, it.about),
              ),
            );
            const read = it.read;
            if (read) li.addEventListener('click', () => this.onRead(read));
            return li;
          })
        : [h('li', { class: 'bag-empty' }, t().bag.empty)]),
    );
    const hp = Math.max(0, Math.ceil(v.hp));
    const { guns, melee, dodge } = v.skills;
    const bar = h('span', {});
    bar.style.width = `${(hp / v.maxHp) * 100}%`;
    this.stats.replaceChildren(
      h('div', { class: 'fight-hp' }, bar, h('b', {}, fill(t().bag.health, { hp, max: v.maxHp }))),
      h('div', { class: 'bag-skills' }, fill(t().bag.skills, { guns, melee, dodge })),
    );
  }

  destroy(): void {
    this.el.remove();
  }
}
