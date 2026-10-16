import { h, uiRoot } from './dom';

export class Loader {
  private readonly el: HTMLElement;
  private readonly fill: HTMLElement;

  constructor() {
    this.fill = h('span');
    this.el = h(
      'div',
      { class: 'loading' },
      h('h1', {}, 'Mirrowick'),
      h('div', { class: 'bar' }, this.fill),
    );
    uiRoot().append(this.el);
  }

  progress(value: number): void {
    this.fill.style.width = `${Math.round(value * 100)}%`;
  }

  done(): void {
    this.el.style.opacity = '0';
    window.setTimeout(() => this.el.remove(), 600);
  }
}
