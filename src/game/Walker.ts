import type * as Phaser from 'phaser';
import type { Cell, Point } from '../core/iso';

/**
 * A character that follows a path of grid cells. Subclasses decide how grid
 * coordinates map to the world and which animations to play.
 */
export abstract class Walker {
  /** Fractional grid position. */
  readonly pos: { c: number; r: number };
  private path: Cell[] = [];
  private onArrive: (() => void) | undefined;
  protected busy = false;

  protected constructor(
    readonly sprite: Phaser.GameObjects.Sprite,
    start: Cell,
    /** Cells per second. */
    private readonly speed: number,
  ) {
    this.pos = { c: start.c, r: start.r };
  }

  /** Grid → world position of the sprite's anchor. */
  protected abstract toWorld(c: number, r: number): Point;
  /** Turn towards a world-space direction (does not change the animation). */
  protected abstract turn(dx: number, dy: number): void;
  protected abstract playWalk(): void;
  protected abstract playIdle(): void;

  get cell(): Cell {
    return { c: Math.round(this.pos.c), r: Math.round(this.pos.r) };
  }

  /** The cell the walker is heading to (or standing on). */
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
      this.playIdle();
      onArrive?.();
    }
  }

  face(c: number, r: number): void {
    const from = this.toWorld(this.pos.c, this.pos.r);
    const to = this.toWorld(c, r);
    if (from.x !== to.x || from.y !== to.y) this.turn(to.x - from.x, to.y - from.y);
    if (!this.moving) this.playIdle();
  }

  protected place(): void {
    const p = this.toWorld(this.pos.c, this.pos.r);
    this.sprite.setPosition(p.x, p.y);
  }

  update(dt: number): void {
    const next = this.path[0];
    if (!next || this.busy) return;
    const dc = next.c - this.pos.c;
    const dr = next.r - this.pos.r;
    const dist = Math.hypot(dc, dr);
    const step = this.speed * dt;
    const from = this.toWorld(this.pos.c, this.pos.r);
    if (dist <= step) {
      this.pos.c = next.c;
      this.pos.r = next.r;
      this.path.shift();
    } else {
      this.pos.c += (dc / dist) * step;
      this.pos.r += (dr / dist) * step;
    }
    const to = this.toWorld(this.pos.c, this.pos.r);
    if (to.x !== from.x || to.y !== from.y) this.turn(to.x - from.x, to.y - from.y);
    this.sprite.setPosition(to.x, to.y);
    if (this.path.length) {
      this.playWalk();
    } else {
      this.playIdle();
      const cb = this.onArrive;
      this.onArrive = undefined;
      cb?.();
    }
  }
}
