import * as Phaser from 'phaser';
import { music } from '../audio/AmbientMusic';
import { TILE_H, TILE_W, gridToWorld, worldToCell, type Cell } from '../core/iso';
import { findPath } from '../core/pathfinding';
import type { NavGrid } from '../core/grid';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { resolveInteraction } from '../game/interactions';
import { buildNav, levelSize, useSpots } from '../level/nav';
import { GROUND_FRAMES, GROUND_TINTS, type LevelDef, type Prop } from '../level/types';
import { VILLAGE } from '../level/village';
import { Atmosphere } from '../render/Atmosphere';
import { drawIslandUnderside, hash2 } from '../render/island';
import { Hud } from '../ui/Hud';

// Depth bands. World objects sort by their footprint's world y (0…~1500);
// the atmosphere layers sit above them all.
const DEPTH_UNDERSIDE = -200_000;
const DEPTH_GROUND = -100_000;
const DEPTH_CURSOR = -90_000;

/** Edge pieces sort by the midpoint of their edge, half a tile off-centre. */
const EDGE_DEPTH: Record<string, number> = {
  N: TILE_H / 4,
  W: TILE_H / 4,
  E: -TILE_H / 4,
  S: -TILE_H / 4,
};

interface PropView {
  prop: Prop;
  index: number;
  sprite: Phaser.GameObjects.Image;
  /** Tall props fade out when the hero walks behind them. */
  occluder?: Phaser.Geom.Rectangle;
}

export class GameScene extends Phaser.Scene {
  private level: LevelDef = VILLAGE;
  private nav!: NavGrid;
  private state!: GameState;
  private player!: Player;
  private hud!: Hud;
  private props: PropView[] = [];
  private atmosphere!: Atmosphere;
  private cursor!: Phaser.GameObjects.Graphics;
  private lockedAttempts = new Map<number, number>();
  private hovered: PropView | undefined;

  constructor() {
    super('game');
  }

  create(): void {
    this.state = new GameState();
    this.nav = buildNav(this.level);
    this.props = [];
    this.lockedAttempts.clear();
    this.hovered = undefined;

    this.setupCamera();
    this.atmosphere = new Atmosphere(this, {
      sky: true,
      heroGlow: { width: 410, height: 280, lift: 40 },
    });
    this.buildIsland();
    this.buildGround();
    this.buildProps();
    this.player = new Player(this, this.level.spawn, this.level.spawnFacing);
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08, 0, 50);
    this.setupInput();

    this.hud = new Hud('Mirrowick', 'The Lower World', music.muted, {
      setStyle: (id) => {
        this.atmosphere.applyStyle(id);
        this.hud.setStyle(id);
      },
      toggleMusic: () => {
        music.start();
        return music.toggle();
      },
      pause: (paused) => (paused ? this.scene.pause() : this.scene.resume()),
      mainMenu: () => this.scene.start('menu'),
    });
    this.atmosphere.applyStyle(this.atmosphere.styleId);
    this.hud.setStyle(this.atmosphere.styleId);
    for (const line of this.level.intro) this.hud.message(line);
    this.hud.message(
      'Click to walk, click things to use them. Keys 1–5 switch the visual style.',
      'hint',
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hud.destroy());
    this.cameras.main.fadeIn(900, 26, 18, 12);
  }

  update(): void {
    // Real elapsed time (Phaser's smoothed delta drifts when frames drop).
    const dt = Math.min(this.game.loop.rawDelta, 100) / 1000;
    this.player.update(dt);
    const hero = this.player.sprite;
    hero.setDepth(hero.y + 0.5);
    this.updateOcclusion();
    this.atmosphere.update(hero.x, hero.y);
  }

  // --- World construction ----------------------------------------------------

  private buildIsland(): void {
    const g = this.add.graphics().setDepth(DEPTH_UNDERSIDE);
    drawIslandUnderside(g, this.level.ground);
  }

  private buildGround(): void {
    this.level.ground.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const options = GROUND_FRAMES[ch];
        if (!options) return;
        const frame = options[Math.floor(hash2(c, r) * options.length)] as string;
        const p = gridToWorld(c, r);
        const tile = this.add.image(p.x, p.y, 'world', frame).setDepth(DEPTH_GROUND);
        const tints = GROUND_TINTS[ch];
        if (tints) tile.setTint(tints[Math.floor(hash2(r, c) * tints.length)] as number);
        // Mirror half the tiles so repeated textures don't line up.
        if (hash2(c + 7, r) > 0.5) tile.setFlipX(true);
      });
    });
    this.cursor = this.add.graphics().setDepth(DEPTH_CURSOR);
  }

  private buildProps(): void {
    this.level.props.forEach((prop, index) => {
      const p = gridToWorld(prop.c, prop.r);
      const sprite = this.add.image(p.x, p.y, 'world', prop.frame);
      sprite.setDepth(p.y + (prop.edge ? (EDGE_DEPTH[prop.edge] ?? 0) : 0));
      const view: PropView = { prop, index, sprite };
      if (sprite.height > 72 && !prop.interact) {
        view.occluder = sprite.getBounds();
      }
      if (prop.interact) {
        sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 40, useHandCursor: true });
        sprite.setData('view', view);
      }
      this.props.push(view);
      if (prop.light) this.atmosphere.addLight(p.x, p.y, prop.light);
    });
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    const { width, height } = levelSize(this.level);
    const left = -height * (TILE_W / 2) - 200;
    const right = width * (TILE_W / 2) + 200;
    cam.setBounds(left, -260, right - left, (width + height) * (TILE_H / 2) + 620);
    cam.setZoom(0.85);
  }

  // --- Input -------------------------------------------------------------------

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) =>
      this.onPointerMove(pointer),
    );
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (!pointer.leftButtonDown()) return;
        const view = over.map((o) => o.getData('view') as PropView | undefined).find(Boolean);
        if (view) this.useProp(view);
        else this.walkTo(this.pointerCell(pointer));
      },
    );
    this.input.on(
      Phaser.Input.Events.GAMEOBJECT_OVER,
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
        const view = obj.getData('view') as PropView | undefined;
        if (!view) return;
        this.hovered = view;
        obj.setTintMode(Phaser.TintModes.ADD).setTint(0x3a2412);
      },
    );
    this.input.on(
      Phaser.Input.Events.GAMEOBJECT_OUT,
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
        if (this.hovered?.sprite === obj) this.hovered = undefined;
        obj.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
        this.hud.hoverLabel(null);
      },
    );
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.6, 1.6));
        this.atmosphere.layout();
      },
    );
  }

  private pointerCell(pointer: Phaser.Input.Pointer): Cell {
    const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return worldToCell(p.x, p.y);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.cursor.clear();
    if (this.hovered) {
      this.hud.hoverLabel(this.hovered.prop.interact?.name ?? null, pointer.x, pointer.y - 22);
      return;
    }
    this.hud.hoverLabel(null);
    const cell = this.pointerCell(pointer);
    if (!this.nav.isWalkable(cell.c, cell.r)) return;
    this.drawDiamond(this.cursor, cell, 0xf08a3c, 0.75);
  }

  private drawDiamond(
    g: Phaser.GameObjects.Graphics,
    cell: Cell,
    color: number,
    alpha: number,
  ): void {
    const { x, y } = gridToWorld(cell.c, cell.r);
    const hw = TILE_W / 2 - 6;
    const hh = TILE_H / 2 - 3;
    g.lineStyle(2, color, alpha);
    g.beginPath();
    g.moveTo(x, y - hh);
    g.lineTo(x + hw, y);
    g.lineTo(x, y + hh);
    g.lineTo(x - hw, y);
    g.closePath();
    g.strokePath();
  }

  private flashMarker(cell: Cell): void {
    const g = this.add.graphics().setDepth(DEPTH_CURSOR + 1);
    this.drawDiamond(g, cell, 0xffd2a0, 1);
    this.tweens.add({ targets: g, alpha: 0, duration: 600, onComplete: () => g.destroy() });
  }

  // --- Movement and interaction --------------------------------------------------

  /** Where a new path should start: the hero's next waypoint or current cell. */
  private pathStart(): Cell {
    return this.player.nextCell;
  }

  private walkTo(goal: Cell, onArrive?: () => void): boolean {
    const start = this.pathStart();
    const path = findPath(this.nav, start, goal);
    if (!path) return false;
    const lead = this.player.moving ? [start] : [];
    this.player.walk([...lead, ...path], onArrive);
    if (!onArrive) this.flashMarker(goal);
    return true;
  }

  private useProp(view: PropView): void {
    const { prop } = view;
    const start = this.pathStart();
    let best: Cell[] | null = null;
    for (const spot of useSpots(this.nav, prop)) {
      const path = findPath(this.nav, start, spot);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) {
      this.hud.message(`You can’t reach the <b>${prop.interact?.name}</b> from here.`);
      return;
    }
    const lead = this.player.moving ? [start] : [];
    this.player.walk([...lead, ...best], () => {
      this.player.face(prop.c, prop.r);
      this.interact(view);
    });
  }

  private interact(view: PropView): void {
    const it = view.prop.interact;
    if (!it) return;
    const attempts = this.lockedAttempts.get(view.index) ?? 0;
    const result = resolveInteraction(it, view.index, this.state, attempts);
    const apply = () => {
      this.hud.message(`<b>${it.name}.</b> ${result.line}`);
      if (!result.unlocked) {
        this.lockedAttempts.set(view.index, attempts + 1);
        return;
      }
      this.state.markUsed(view.index);
      if (result.frame) view.sprite.setFrame(result.frame);
      if (result.item) {
        this.state.give(result.item);
        this.hud.setItems(this.state.items, result.item.id);
        this.hud.message(`Added to inventory: <b>${result.item.name}</b>.`);
      }
      if (result.removeProp) {
        view.sprite.disableInteractive();
        this.tweens.add({
          targets: view.sprite,
          alpha: 0,
          duration: 250,
          onComplete: () => view.sprite.destroy(),
        });
        this.hovered = undefined;
        this.hud.hoverLabel(null);
      }
    };
    if (result.grab) this.player.pickup(apply);
    else apply();
  }

  // --- Per-frame effects -----------------------------------------------------------

  private updateOcclusion(): void {
    const hero = this.player.sprite;
    const hx = hero.x;
    const hy = hero.y - 34;
    for (const v of this.props) {
      if (!v.occluder || !v.sprite.active) continue;
      const behind = v.sprite.depth > hero.depth && v.occluder.contains(hx, hy);
      const target = behind ? 0.35 : 1;
      v.sprite.alpha += (target - v.sprite.alpha) * 0.18;
    }
  }
}
