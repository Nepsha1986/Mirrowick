import * as Phaser from 'phaser';
import { facingFromVector, type Facing } from '../core/direction';
import { gridToWorld, type Cell } from '../core/iso';

/** Cells per second. */
const SPEED = 2.6;

/**
 * The hero: follows a path of cells, plays 8-way run/idle animations and an
 * optional pickup animation.
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Fractional grid position. */
  readonly pos: { c: number; r: number };
  facing: Facing;
  private path: Cell[] = [];
  private onArrive: (() => void) | undefined;
  private busy = false;

  constructor(scene: Phaser.Scene, start: Cell, facing: Facing) {
    this.pos = { c: start.c, r: start.r };
    this.facing = facing;
    const p = gridToWorld(start.c, start.r);
    this.sprite = scene.add.sprite(p.x, p.y, 'hero', `hero_idle_${facing}_0`);
    this.idle();
  }

  get cell(): Cell {
    return { c: Math.round(this.pos.c), r: Math.round(this.pos.r) };
  }

  /** The cell the hero is heading to (or standing on). */
  get nextCell(): Cell {
    return this.path[0] ?? this.cell;
  }

  get moving(): boolean {
    return this.path.length > 0;
  }

  walk(path: Cell[], onArrive?: () => void): void {
    if (this.busy) return;
    this.path = path;
    this.onArrive = onArrive;
    if (!path.length) {
      this.idle();
      onArrive?.();
    }
  }

  face(c: number, r: number): void {
    const from = gridToWorld(this.pos.c, this.pos.r);
    const to = gridToWorld(c, r);
    if (from.x !== to.x || from.y !== to.y)
      this.facing = facingFromVector(to.x - from.x, to.y - from.y);
    if (!this.moving) this.idle();
  }

  /** Crouch-and-grab animation; `done` fires when the hand reaches the item. */
  pickup(done: () => void): void {
    this.busy = true;
    this.sprite.play(`hero_pickup_${this.facing}`);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.busy = false;
      this.idle();
      done();
    });
  }

  update(dt: number): void {
    const next = this.path[0];
    if (!next || this.busy) return;
    const dc = next.c - this.pos.c;
    const dr = next.r - this.pos.r;
    const dist = Math.hypot(dc, dr);
    const step = SPEED * dt;
    const from = gridToWorld(this.pos.c, this.pos.r);
    if (dist <= step) {
      this.pos.c = next.c;
      this.pos.r = next.r;
      this.path.shift();
    } else {
      this.pos.c += (dc / dist) * step;
      this.pos.r += (dr / dist) * step;
    }
    const to = gridToWorld(this.pos.c, this.pos.r);
    if (to.x !== from.x || to.y !== from.y) {
      this.facing = facingFromVector(to.x - from.x, to.y - from.y);
    }
    this.sprite.setPosition(to.x, to.y);
    if (this.path.length) {
      this.sprite.play(`hero_run_${this.facing}`, true);
    } else {
      this.idle();
      const cb = this.onArrive;
      this.onArrive = undefined;
      cb?.();
    }
  }

  private idle(): void {
    this.sprite.play(`hero_idle_${this.facing}`, true);
  }
}
