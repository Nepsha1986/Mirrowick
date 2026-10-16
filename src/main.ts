import '@fontsource/fraunces/latin-600.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import './ui/styles.css';
import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { LanternScene } from './scenes/LanternScene';
import { TopDownScene } from './scenes/TopDownScene';

async function boot(): Promise<void> {
  // The DOM UI uses these fonts from the first frame; wait so nothing reflows.
  await Promise.allSettled([
    document.fonts.load('600 32px Fraunces'),
    document.fonts.load('400 16px Lato'),
    document.fonts.load('700 16px Lato'),
  ]);

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#1a120c',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    disableContextMenu: true,
    scene: [BootScene, MenuScene, GameScene, TopDownScene, LanternScene],
  });
  // Handy for poking at the game from the console and for browser smoke tests.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

void boot();
