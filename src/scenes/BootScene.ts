import * as Phaser from 'phaser';
import { Loader } from '../ui/Loader';

/** Nothing to download: every texture is painted by code when a scene starts. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const loader = new Loader();
    loader.progress(1);
    loader.done();
    this.scene.start('menu');
  }
}
