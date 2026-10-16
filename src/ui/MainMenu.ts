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
    this.el = h(
      'div',
      { class: 'menu' },
      h('div', { class: 'eyebrow' }, 'Chapter I · The Lower World'),
      h('h1', {}, 'Mirrowick'),
      h(
        'p',
        { class: 'tagline' },
        'Two villages, one name. Only one of them is still on the maps.',
      ),
      this.nav,
      h(
        'footer',
        {},
        h('span', {}, 'v0.1 · prototype'),
        h('span', {}, 'Art painted in code · Music: procedural'),
      ),
    );
    uiRoot().append(this.el);
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
        !opts.onClick && h('span', { class: 'soon' }, 'soon'),
      );
      if (opts.onClick) b.addEventListener('click', opts.onClick);
      return b;
    };
    const saved = !!loadSave();
    const first = saved
      ? button('Continue', { primary: true, onClick: this.actions.resume })
      : button('Play', { primary: true, onClick: this.actions.play });
    const items = [first];
    if (saved) items.push(button('New game', { onClick: this.actions.play }));
    items.push(button('Settings', { onClick: () => this.openSettings() }), button('Credits'));
    this.nav.replaceChildren(...items);
    first.focus();
  }

  private openSettings(): void {
    this.nav.hidden = true;
    this.settings = new SettingsPanel(
      () => this.closeSettings(),
      () => this.renderNav(),
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
