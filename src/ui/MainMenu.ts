import { tr } from '../i18n';
import { loadSave } from '../lantern/save';
import { h, uiRoot } from './dom';
import { SettingsPanel } from './Settings';

export interface MainMenuActions {
  /** Start a new game. */
  play: () => void;
  /** Carry on from the saved game. */
  resume: () => void;
}

/** Title screen: a new game, Continue when there is a save, and Settings. */
export class MainMenu {
  private readonly el: HTMLElement;
  private readonly nav: HTMLElement;
  private settings?: SettingsPanel;

  constructor(private readonly actions: MainMenuActions) {
    this.nav = h('nav', { class: 'interactive' });
    this.el = h('div', { class: 'menu' });
    uiRoot().append(this.el);
    this.render();
  }

  /** Everything in the current language; again when it changes. */
  private render(): void {
    this.el.replaceChildren(
      h('div', { class: 'eyebrow' }, tr('Chapter I · The Lower World', 'Глава I · Нижний мир')),
      h('h1', {}, 'Mirrowick'),
      h(
        'p',
        { class: 'tagline' },
        tr(
          'Two villages, one name. Only one of them is still on the maps.',
          'Две деревни, одно имя. На картах осталась только одна.',
        ),
      ),
      this.nav,
      h(
        'footer',
        {},
        h('span', {}, tr('v0.1 · prototype', 'v0.1 · прототип')),
        h(
          'span',
          {},
          tr(
            'Art painted in code · Music: procedural',
            'Графика нарисована кодом · Музыка: процедурная',
          ),
        ),
      ),
    );
    this.renderNav();
  }

  /** With a save, Continue leads and Play becomes New game. */
  private renderNav(): void {
    const button = (label: string, opts: { primary?: boolean; onClick?: () => void } = {}) => {
      const b = h(
        'button',
        { class: `menu-btn${opts.primary ? ' primary' : ''}`, disabled: !opts.onClick },
        h('span', { class: 'dot' }),
        label,
        !opts.onClick && h('span', { class: 'soon' }, tr('soon', 'скоро')),
      );
      if (opts.onClick) b.addEventListener('click', opts.onClick);
      return b;
    };
    const saved = !!loadSave();
    const first = saved
      ? button(tr('Continue', 'Продолжить'), { primary: true, onClick: this.actions.resume })
      : button(tr('Play', 'Играть'), { primary: true, onClick: this.actions.play });
    const items = [first];
    if (saved) items.push(button(tr('New game', 'Новая игра'), { onClick: this.actions.play }));
    items.push(
      button(tr('Settings', 'Настройки'), { onClick: () => this.openSettings() }),
      button(tr('Credits', 'Авторы')),
    );
    this.nav.replaceChildren(...items);
    first.focus();
  }

  private openSettings(): void {
    this.nav.hidden = true;
    this.settings = new SettingsPanel(
      () => this.closeSettings(),
      () => this.renderNav(),
      () => {
        // Redraw the menu in the new language, with the settings still open.
        this.closeSettings();
        this.render();
        this.openSettings();
      },
    );
    this.nav.after(this.settings.el);
  }

  private closeSettings(): void {
    this.settings?.destroy();
    this.settings = undefined;
    this.nav.hidden = false;
    this.renderNav();
  }

  destroy(): void {
    this.settings?.destroy();
    this.el.remove();
  }
}
