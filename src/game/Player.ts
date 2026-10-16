import * as Phaser from 'phaser';
import { facingFromVector, type Facing } from '../core/direction';
import { gridToWorld, type Cell, type Point } from '../core/iso';
import { Walker } from './Walker';

/** The isometric hero: 8-way run/idle animations and a pickup animation. */
export class Player extends Walker {
  facing: Facing;

  constructor(scene: Phaser.Scene, start: Cell, facing: Facing) {
    const p = gridToWorld(start.c, start.r);
    super(scene.add.sprite(p.x, p.y, 'hero', `hero_idle_${facing}_0`), start, 2.6);
    this.facing = facing;
    this.playIdle();
  }

  /** Crouch-and-grab animation; `done` fires when the hand reaches the item. */
  pickup(done: () => void): void {
    this.busy = true;
    this.sprite.play(`hero_pickup_${this.facing}`);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.busy = false;
      this.playIdle();
      done();
    });
  }

  protected toWorld(c: number, r: number): Point {
    return gridToWorld(c, r);
  }

  protected turn(dx: number, dy: number): void {
    this.facing = facingFromVector(dx, dy);
  }

  protected playWalk(): void {
    this.sprite.play(`hero_run_${this.facing}`, true);
  }

  protected playIdle(): void {
    this.sprite.play(`hero_idle_${this.facing}`, true);
  }
}
