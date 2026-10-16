import type * as Phaser from 'phaser';
import type { Cell, Point } from '../core/iso';
import { Walker } from '../game/Walker';
import { T } from './layout';
import { LANTERN, type HeroFacing } from './paint';

/** The painted hero: frames are stand / step / step for each facing row. */
export class PaintedPlayer extends Walker {
  facing: HeroFacing = 'up';
  private walkTime = 0;

  constructor(scene: Phaser.Scene, start: Cell) {
    super(scene.add.sprite(0, 0, 'pt-hero', 'up_0').setOrigin(0.5, 1), start, 3.6);
    this.place();
    this.playIdle();
  }

  /** Where the lantern flame is in the world right now. */
  get lantern(): Point {
    const l = LANTERN[this.facing];
    return { x: this.sprite.x + l.x, y: this.sprite.y + l.y };
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.moving) {
      this.walkTime += dt;
      const f = Math.floor(this.walkTime * 7) % 4;
      this.sprite.setFrame(`${this.facing}_${f === 1 ? 1 : f === 3 ? 2 : 0}`);
    }
  }

  protected toWorld(c: number, r: number): Point {
    return { x: c * T + T / 2, y: r * T + T - 4 };
  }

  protected turn(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
  }

  protected playWalk(): void {}

  protected playIdle(): void {
    this.walkTime = 0;
    this.sprite.setFrame(`${this.facing}_0`);
  }
}
