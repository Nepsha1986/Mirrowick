import type * as Phaser from 'phaser';
import type { Cell, Point } from '../core/iso';
import { Walker } from './Walker';

export const TD_TILE = 16;

/** Rows of the hero sheet. */
export type TopDownFacing = 'down' | 'left' | 'right' | 'up';
export const TD_FACINGS: TopDownFacing[] = ['down', 'left', 'right', 'up'];

/** The top-down hero: 4-way walk cycle from a 3-frame pixel-art sheet. */
export class TopDownPlayer extends Walker {
  facing: TopDownFacing;

  constructor(scene: Phaser.Scene, start: Cell, facing: TopDownFacing) {
    super(scene.add.sprite(0, 0, 'td-hero', 0).setOrigin(0.5, 1), start, 4.5);
    this.facing = facing;
    this.place();
    this.playIdle();
  }

  /** A little hop instead of a crouch: there is no pickup animation in 16px. */
  pickup(done: () => void): void {
    this.busy = true;
    this.sprite.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 3,
      duration: 110,
      yoyo: true,
      onComplete: () => {
        this.busy = false;
        done();
      },
    });
  }

  /** Feet at the bottom of the cell, one pixel up so they sit on the tile. */
  protected toWorld(c: number, r: number): Point {
    return { x: c * TD_TILE + TD_TILE / 2, y: r * TD_TILE + TD_TILE - 1 };
  }

  protected turn(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
  }

  protected playWalk(): void {
    this.sprite.play(`td_walk_${this.facing}`, true);
  }

  protected playIdle(): void {
    this.sprite.play(`td_idle_${this.facing}`, true);
  }
}
