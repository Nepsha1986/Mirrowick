import * as Phaser from 'phaser';
import type { Pt } from '../lantern/util';

/** How each walker marks the ground: its print, stride and gait width. */
const KINDS = {
  hero: { frame: 'printShoe', stride: 15, side: 4, a: 0.5 },
  marauder: { frame: 'printShoe', stride: 16, side: 4.5, a: 0.55 },
  wolf: { frame: 'printPaw', stride: 13, side: 3, a: 0.5 },
  boar: { frame: 'printHoof', stride: 12, side: 4.5, a: 0.6 },
  crawler: { frame: 'printClaw', stride: 10, side: 9, a: 0.45 },
} as const;
export type TrackKind = keyof typeof KINDS;

const POOL = 200;
/** Seconds a print lasts before it has faded away. */
const LIFE = 30;

interface Walk {
  last: Pt;
  d: number;
  left: boolean;
}

/**
 * Footprints, paw prints and scratches left on the ground behind whoever
 * walks. A fixed pool of small sprites is reused oldest first and fades
 * out, so the cost stays the same however far anyone walks.
 */
export class Tracks {
  private readonly prints: Phaser.GameObjects.Image[] = [];
  private readonly age = new Float32Array(POOL).fill(LIFE);
  private readonly base = new Float32Array(POOL);
  private readonly walks = new WeakMap<object, Walk>();
  private next = 0;

  constructor(
    scene: Phaser.Scene,
    /** Indoors and wherever else the ground takes no prints. */
    private readonly bare: (p: Pt) => boolean,
  ) {
    for (let i = 0; i < POOL; i++) {
      this.prints.push(
        scene.add.image(0, 0, 'ln-atlas', 'printShoe').setDepth(-90).setVisible(false),
      );
    }
  }

  /** Call every frame for each walker; a print falls at each stride. */
  follow(who: Pt & { facing: number }, kind: TrackKind): void {
    const k = KINDS[kind];
    const w = this.walks.get(who);
    if (!w) {
      this.walks.set(who, { last: { x: who.x, y: who.y }, d: 0, left: false });
      return;
    }
    const step = Math.hypot(who.x - w.last.x, who.y - w.last.y);
    w.last.x = who.x;
    w.last.y = who.y;
    // A jump (a respawn, a new spawn point) is not a walk.
    if (step > k.stride * 3) return;
    w.d += step;
    if (w.d < k.stride) return;
    w.d -= k.stride;
    w.left = !w.left;
    const s = w.left ? -k.side : k.side;
    const x = who.x - Math.sin(who.facing) * s;
    const y = who.y + Math.cos(who.facing) * s;
    if (this.bare({ x, y })) return;
    this.stamp(x, y, who.facing, k.frame, k.a, w.left);
  }

  update(dt: number): void {
    for (let i = 0; i < POOL; i++) {
      if (this.age[i]! >= LIFE) continue;
      const a = (this.age[i]! += dt);
      const img = this.prints[i]!;
      if (a >= LIFE) img.setVisible(false);
      // Holds for a while, then fades out.
      else img.setAlpha(this.base[i]! * Math.min(1, ((LIFE - a) / LIFE) * 1.6));
    }
  }

  private stamp(
    x: number,
    y: number,
    facing: number,
    frame: string,
    a: number,
    left: boolean,
  ): void {
    const i = this.next;
    this.next = (i + 1) % POOL;
    this.age[i] = 0;
    // No two alike: a slightly turned foot, some pressed harder than others.
    this.base[i] = a * (0.75 + Math.random() * 0.25);
    this.prints[i]!.setFrame(frame)
      .setPosition(x, y)
      .setRotation(facing + (Math.random() - 0.5) * 0.25)
      .setFlipY(left)
      .setAlpha(this.base[i]!)
      .setVisible(true);
  }
}
