import * as Phaser from 'phaser';
import { music } from '../audio/AmbientMusic';
import { loadSave } from '../lantern/save';
import { Cutscene } from '../ui/Cutscene';
import { MainMenu } from '../ui/MainMenu';
import type { LanternData } from './LanternScene';

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
    const begin = (data: LanternData, intro = false) => {
      music.start();
      this.menu?.destroy();
      const cam = this.scene.get('lantern').cameras.main;
      cam.fadeOut(600, 13, 10, 8);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        // Restart the backdrop as the real thing; a new game opens with the call.
        this.scene.stop('lantern');
        if (intro) Cutscene.call(() => this.scene.start('lantern', data));
        else this.scene.start('lantern', data);
      });
    };
    this.menu = new MainMenu({
      play: () => begin({ demo: false, fresh: true }, true),
      resume: () => {
        const save = loadSave();
        if (!save) return begin({ demo: false, fresh: true }, true);
        const { realm, x, y, tod, day, items, known, ammo } = save;
        begin({ demo: false, realm, at: { x, y }, tod, day, items, known, ammo });
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu?.destroy());
  }
}
