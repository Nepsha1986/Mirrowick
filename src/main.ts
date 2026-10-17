import '@fontsource/fraunces/latin-600.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import './ui/styles.css';
import * as Phaser from 'phaser';
import { initLang, langFonts } from './i18n';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { LanternScene } from './scenes/LanternScene';

async function boot(): Promise<void> {
  // The words first: they decide which fonts the first frame needs.
  await initLang();
  // The DOM UI uses these fonts from the first frame; wait so nothing reflows.
  await Promise.allSettled(
    ['600 32px Fraunces', '400 16px Lato', '700 16px Lato', ...langFonts()].map((font) =>
      document.fonts.load(font),
    ),
  );

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#1a120c',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    // One texture per batch: with several, some renderers drew one triangle of
    // a rotated sprite from the wrong texture. The scene is small enough.
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance',
      maxTextures: 1,
    },
    disableContextMenu: true,
    // Every sound is ours (src/audio): Phaser's own audio context would only
    // compete with it for the sound card.
    audio: { noAudio: true },
    scene: [BootScene, MenuScene, LanternScene],
  });
  // Handy for poking at the game from the console and for browser smoke tests.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

void boot();
