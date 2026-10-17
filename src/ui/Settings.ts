import { music } from '../audio/AmbientMusic';
import { lang, setLang, tr } from '../i18n';
import { clearSave, loadSave } from '../lantern/save';
import { h } from './dom';

/** Language, music volume, full screen, and a way to delete the saved game. */
export class SettingsPanel {
  readonly el: HTMLElement;
  private readonly offKeys: () => void;
  private readonly offFullscreen: () => void;

  constructor(close: () => void, saveDeleted: () => void, langChanged: () => void) {
    // Language: each button names its own, so you can find yours in either.
    const langs = h(
      'span',
      { class: 'set-langs' },
      ...(['en', 'ru'] as const).map((l) => {
        const b = h(
          'button',
          { class: `set-btn${lang() === l ? ' on' : ''}` },
          l === 'en' ? 'English' : 'Русский',
        );
        b.addEventListener('click', () => {
          if (lang() === l) return;
          setLang(l);
          langChanged();
        });
        return b;
      }),
    );

    // Volume.
    const level = h('span', { class: 'set-value' });
    const slider = h('input', {
      type: 'range',
      min: '0',
      max: '100',
      step: '5',
      value: String(Math.round(music.volume * 100)),
    });
    const showLevel = () => (level.textContent = `${slider.value}%`);
    showLevel();
    slider.addEventListener('input', () => {
      // Moving the slider is a gesture, so the music may start: you hear the level you pick.
      music.start();
      music.setVolume(Number(slider.value) / 100);
      showLevel();
    });

    // Full screen.
    const full = h('button', { class: 'set-btn' });
    const showFull = () =>
      (full.textContent = document.fullscreenElement ? tr('On', 'Вкл.') : tr('Off', 'Выкл.'));
    showFull();
    full.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    });
    document.addEventListener('fullscreenchange', showFull);
    this.offFullscreen = () => document.removeEventListener('fullscreenchange', showFull);

    // Delete the save: two clicks, so it can't happen by accident.
    const del = h('button', { class: 'set-btn danger' });
    let armed = 0;
    const showDel = () => {
      const has = !!loadSave();
      del.disabled = !has;
      del.textContent = !has
        ? tr('None', 'Нет')
        : armed
          ? tr('Click again', 'Ещё раз')
          : tr('Delete', 'Удалить');
    };
    showDel();
    del.addEventListener('click', () => {
      if (!armed) {
        armed = window.setTimeout(() => {
          armed = 0;
          showDel();
        }, 3000);
      } else {
        window.clearTimeout(armed);
        armed = 0;
        clearSave();
        saveDeleted();
      }
      showDel();
    });

    const back = h(
      'button',
      { class: 'menu-btn' },
      h('span', { class: 'dot' }),
      tr('Back', 'Назад'),
    );
    back.addEventListener('click', close);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    this.offKeys = () => window.removeEventListener('keydown', onKey);

    const row = (label: string, ...control: (Node | string)[]) =>
      h('div', { class: 'set-row' }, h('span', { class: 'set-label' }, label), ...control);
    this.el = h(
      'div',
      { class: 'settings interactive' },
      h('h2', {}, tr('Settings', 'Настройки')),
      row(tr('Language', 'Язык'), langs),
      row(tr('Music', 'Музыка'), slider, level),
      row(tr('Full screen', 'Полный экран'), full),
      row(tr('Saved game', 'Сохранение'), del),
      back,
    );
  }

  destroy(): void {
    this.offKeys();
    this.offFullscreen();
    this.el.remove();
  }
}
