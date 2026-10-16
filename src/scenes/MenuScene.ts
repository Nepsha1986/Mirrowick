import * as Phaser from 'phaser';
import { music } from '../audio/AmbientMusic';
import { MainMenu } from '../ui/MainMenu';

export class MenuScene extends Phaser.Scene {
  private menu?: MainMenu;

  constructor() {
    super('menu');
  }

  create(): void {
    const bg = this.add.image(0, 0, 'menu-bg');
    const fit = () => {
      const { width, height } = this.scale;
      bg.setPosition(width / 2, height / 2);
      bg.setScale(Math.max(width / bg.width, height / bg.height));
    };
    fit();
    this.scale.on(Phaser.Scale.Events.RESIZE, fit);
    this.cameras.main.fadeIn(900, 26, 18, 12);

    const start = (key: string) => {
      music.start();
      this.menu?.destroy();
      this.cameras.main.fadeOut(600, 26, 18, 12);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
        this.scene.start(key),
      );
    };
    this.menu = new MainMenu({
      play: () => start('game'),
      playTopDown: () => start('topdown'),
      playPainted: () => start('painted'),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, fit);
      this.menu?.destroy();
    });
  }
}
