import '@fontsource/fraunces/latin-600.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/lora/cyrillic-600.css';
import '@fontsource/lora/cyrillic-600-italic.css';
import '@fontsource/pt-sans/cyrillic-400.css';
import '@fontsource/pt-sans/cyrillic-700.css';
import './ui/styles.css';
import * as Phaser from 'phaser';
import { lang } from './i18n';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { LanternScene } from './scenes/LanternScene';

async function boot(): Promise<void> {
  // The DOM UI uses these fonts from the first frame; wait so nothing reflows.
  await Promise.allSettled([
    document.fonts.load('600 32px Fraunces'),
    document.fonts.load('400 16px Lato'),
    document.fonts.load('700 16px Lato'),
    ...(lang() === 'ru'
      ? [
          document.fonts.load('600 32px Lora', 'Я'),
          document.fonts.load('400 16px "PT Sans"', 'Я'),
          document.fonts.load('700 16px "PT Sans"', 'Я'),
        ]
      : []),
  ]);

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
    scene: [BootScene, MenuScene, LanternScene],
  });
  // Handy for poking at the game from the console and for browser smoke tests.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

void boot();
