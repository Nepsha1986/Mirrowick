import { tr } from '../i18n';
import { h, uiRoot } from './dom';

/** One thing in your pockets. */
export interface BagItem {
  name: string;
  about: string;
  /** Its picture, as a data URL. */
  icon?: string;
  /** A count or state shown beside it: rounds, say. */
  note?: string;
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
 * button opens and closes it.
 */
export class Inventory {
  private readonly el: HTMLElement;
  private readonly list: HTMLElement;
  private readonly stats: HTMLElement;
  private last = '';

  constructor() {
    this.list = h('ul', { class: 'bag-items' });
    this.stats = h('div', { class: 'bag-stats' });
    const close = h('button', { class: 'bag-close', title: tr('Close (I)', 'Закрыть (I)') }, '×');
    close.addEventListener('click', () => this.toggle(false));
    this.el = h(
      'div',
      { class: 'bag interactive', hidden: true },
      h('div', { class: 'bag-head' }, h('h2', {}, tr('Inventory', 'Сумка')), close),
      this.list,
      h('h3', {}, tr('You', 'Вы')),
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
        ? v.items.map((it) =>
            h(
              'li',
              {},
              it.icon ? h('img', { src: it.icon, alt: '' }) : h('span', { class: 'bag-blank' }),
              h(
                'div',
                {},
                h('b', {}, it.name, it.note ? h('em', {}, ` · ${it.note}`) : null),
                h('span', {}, it.about),
              ),
            ),
          )
        : [h('li', { class: 'bag-empty' }, tr('Your pockets are empty.', 'Карманы пусты.'))]),
    );
    const hp = Math.max(0, Math.ceil(v.hp));
    const { guns, melee, dodge } = v.skills;
    const bar = h('span', {});
    bar.style.width = `${(hp / v.maxHp) * 100}%`;
    this.stats.replaceChildren(
      h(
        'div',
        { class: 'fight-hp' },
        bar,
        h('b', {}, `${tr('Health', 'Здоровье')} ${hp} / ${v.maxHp}`),
      ),
      h(
        'div',
        { class: 'bag-skills' },
        tr(
          `Guns ${guns} · Melee ${melee} · Dodge ${dodge}`,
          `Стрельба ${guns} · Драка ${melee} · Уклонение ${dodge}`,
        ),
      ),
    );
  }

  destroy(): void {
    this.el.remove();
  }
}
