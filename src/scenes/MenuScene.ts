import * as Phaser from 'phaser';
import { music } from '../audio/AmbientMusic';
import { MainMenu } from '../ui/MainMenu';

/**
 * The title screen: the DOM menu over a live backdrop — the lantern scene in
 * demo mode, the camera drifting over the village at dusk.
 */
export class MenuScene extends Phaser.Scene {
  private menu?: MainMenu;

  constructor() {
    super('menu');
  }

  create(): void {
    this.scene.launch('lantern', { demo: true });
    this.menu = new MainMenu({
      play: () => {
        music.start();
        this.menu?.destroy();
        const cam = this.scene.get('lantern').cameras.main;
        cam.fadeOut(600, 13, 10, 8);
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          // Restart the backdrop as the real thing.
          this.scene.stop('lantern');
          this.scene.start('lantern', { demo: false });
        });
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu?.destroy());
  }
}
