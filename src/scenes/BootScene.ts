import * as Phaser from 'phaser';
import { TD_FACINGS } from '../game/TopDownPlayer';
import { createProceduralTextures } from '../render/textures';
import { Loader } from '../ui/Loader';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const loader = new Loader();
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => loader.progress(v));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => loader.done());
    this.load.setPath('assets/');
    this.load.multiatlas('world', 'world.json');
    this.load.multiatlas('hero', 'hero.json');
    this.load.image('sky', 'sky.webp');
    this.load.image('fog', 'fog.png');
    this.load.image('menu-bg', 'menu-bg.webp');
    this.load.image('td-tiles', 'topdown/tiles.png');
    this.load.spritesheet('td-hero', 'topdown/hero.png', { frameWidth: 16, frameHeight: 16 });
    this.load.tilemapTiledJSON('td-village', 'topdown/village.tmj');
  }

  create(): void {
    createProceduralTextures(this);
    for (let d = 0; d < 8; d++) {
      this.anims.create({
        key: `hero_idle_${d}`,
        frames: [{ key: 'hero', frame: `hero_idle_${d}_0` }],
      });
      this.anims.create({
        key: `hero_run_${d}`,
        frames: this.anims.generateFrameNames('hero', {
          prefix: `hero_run_${d}_`,
          start: 0,
          end: 9,
        }),
        frameRate: 15,
        repeat: -1,
      });
      this.anims.create({
        key: `hero_pickup_${d}`,
        frames: this.anims.generateFrameNames('hero', {
          prefix: `hero_pickup_${d}_`,
          start: 0,
          end: 9,
        }),
        frameRate: 18,
      });
    }
    // Pixel art stays crisp; everything else keeps smooth filtering.
    for (const key of ['td-tiles', 'td-hero']) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    TD_FACINGS.forEach((facing, row) => {
      const f = (i: number) => ({ key: 'td-hero', frame: row * 3 + i });
      this.anims.create({ key: `td_idle_${facing}`, frames: [f(0)] });
      this.anims.create({
        key: `td_walk_${facing}`,
        frames: [f(1), f(0), f(2), f(0)],
        frameRate: 9,
        repeat: -1,
      });
    });
    this.scene.start('menu');
  }
}
