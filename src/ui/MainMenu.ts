import { h, uiRoot } from './dom';

export interface MainMenuActions {
  play: () => void;
}

/** Title screen. Only "Play" works for now; the rest are placeholders. */
export class MainMenu {
  private readonly el: HTMLElement;

  constructor(actions: MainMenuActions) {
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
    const play = button('Play', { primary: true, onClick: actions.play });
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
      h(
        'nav',
        { class: 'interactive' },
        play,
        button('Continue'),
        button('Settings'),
        button('Credits'),
      ),
      h(
        'footer',
        {},
        h('span', {}, 'v0.1 · prototype'),
        h('span', {}, 'Art: Kenney.nl (CC0) · Music: procedural'),
      ),
    );
    uiRoot().append(this.el);
    play.focus();
  }

  destroy(): void {
    this.el.remove();
  }
}
