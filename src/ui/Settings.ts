import { music } from '../audio/AmbientMusic';
import { LANGS, isLang, lang, setLang, t } from '../i18n';
import { clearSave, loadSave } from '../lantern/save';
import { h } from './dom';

/** Language, music and sound volume, full screen, and a way to delete the saved game. */
export class SettingsPanel {
  readonly el: HTMLElement;
  private readonly offKeys: () => void;
  private readonly offFullscreen: () => void;

  constructor(close: () => void, saveDeleted: () => void, langChanged: () => void) {
    const w = t().settings;

    // Language: each one by its own name, so you can find yours in any.
    const langs = h(
      'select',
      { class: 'set-select' },
      ...Object.entries(LANGS).map(([id, l]) =>
        h('option', { value: id, selected: id === lang() }, l.name),
      ),
    );
    langs.addEventListener('change', () => {
      if (isLang(langs.value)) void setLang(langs.value).then(langChanged);
    });

    // Volumes: the music, and the sounds.
    const volume = (get: () => number, set: (v: number) => void) => {
      const level = h('span', { class: 'set-value' });
      const slider = h('input', {
        type: 'range',
        min: '0',
        max: '100',
        step: '5',
        value: String(Math.round(get() * 100)),
      });
      const showLevel = () => (level.textContent = `${slider.value}%`);
      showLevel();
      slider.addEventListener('input', () => {
        // Moving the slider is a gesture, so the sound may start: you hear the level you pick.
        music.start();
        set(Number(slider.value) / 100);
        showLevel();
      });
      return [slider, level];
    };
    const musicLevel = volume(
      () => music.volume,
      (v) => music.setVolume(v),
    );
    const soundsLevel = volume(
      () => music.sounds,
      (v) => {
        music.setSounds(v);
        music.sfx('pickup');
      },
    );

    // Full screen.
    const full = h('button', { class: 'set-btn' });
    const showFull = () => (full.textContent = document.fullscreenElement ? w.on : w.off);
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
      del.textContent = !has ? w.none : armed ? w.confirm : w.delete;
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

    const back = h('button', { class: 'menu-btn' }, h('span', { class: 'dot' }), w.back);
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
      h('h2', {}, w.title),
      row(w.language, langs),
      row(w.music, ...musicLevel),
      row(w.sounds, ...soundsLevel),
      row(w.fullScreen, full),
      row(w.save, del),
      back,
    );
  }

  destroy(): void {
    this.offKeys();
    this.offFullscreen();
    this.el.remove();
  }
}
