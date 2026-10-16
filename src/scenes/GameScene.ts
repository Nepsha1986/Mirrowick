import * as Phaser from 'phaser';
import { music } from '../audio/AmbientMusic';
import { TILE_H, TILE_W, gridToWorld, worldToCell, type Cell } from '../core/iso';
import { findPath } from '../core/pathfinding';
import type { NavGrid } from '../core/grid';
import { GameState } from '../game/GameState';
import { Player } from '../game/Player';
import { resolveInteraction } from '../game/interactions';
import { buildNav, levelSize, useSpots } from '../level/nav';
import { GROUND_FRAMES, GROUND_TINTS, type LevelDef, type Light, type Prop } from '../level/types';
import { VILLAGE } from '../level/village';
import { drawIslandUnderside, hash2 } from '../render/island';
import { presetById, type StyleId, type StylePreset } from '../render/stylePresets';
import { storage } from '../ui/dom';
import { Hud } from '../ui/Hud';

const STYLE_KEY = 'mirrowick.style';

// Depth bands. World objects sort by their footprint's world y (0…~1500).
const DEPTH_UNDERSIDE = -200_000;
const DEPTH_GROUND = -100_000;
const DEPTH_CURSOR = -90_000;
const DEPTH_FOG = 900_000;
const DEPTH_SHADE = 910_000;
const DEPTH_LIGHTS = 1_000_000;
const DEPTH_ASH = 1_100_000;

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

interface LightView {
  light: Light;
  halo: Phaser.GameObjects.Image;
  pool: Phaser.GameObjects.Image;
  phase: number;
}

export class GameScene extends Phaser.Scene {
  private level: LevelDef = VILLAGE;
  private nav!: NavGrid;
  private state!: GameState;
  private player!: Player;
  private hud!: Hud;
  private props: PropView[] = [];
  private lamps: LightView[] = [];
  private heroGlow!: Phaser.GameObjects.Image;
  private sky!: Phaser.GameObjects.Image;
  private fog!: Phaser.GameObjects.TileSprite;
  private shade!: Phaser.GameObjects.Rectangle;
  private ash!: Phaser.GameObjects.Particles.ParticleEmitter;
  private cursor!: Phaser.GameObjects.Graphics;
  private grade!: Phaser.Filters.ColorMatrix;
  private vignette!: Phaser.GameObjects.Image;
  private inkMap!: Phaser.Filters.GradientMap;
  private preset!: StylePreset;
  private lockedAttempts = new Map<number, number>();
  private hovered: PropView | undefined;

  constructor() {
    super('game');
  }

  create(): void {
    this.state = new GameState();
    this.nav = buildNav(this.level);
    this.props = [];
    this.lamps = [];
    this.lockedAttempts.clear();
    this.hovered = undefined;

    this.buildBackdrop();
    this.buildGround();
    this.buildProps();
    this.player = new Player(this, this.level.spawn, this.level.spawnFacing);
    this.buildLights();
    this.buildAtmosphere();
    this.setupCamera();
    this.setupInput();

    this.hud = new Hud('Mirrowick', 'The Lower World', music.muted, {
      setStyle: (id) => this.applyStyle(id),
      toggleMusic: () => {
        music.start();
        return music.toggle();
      },
      pause: (paused) => (paused ? this.scene.pause() : this.scene.resume()),
      mainMenu: () => this.scene.start('menu'),
    });
    this.applyStyle(presetById(storage.get(STYLE_KEY)).id);
    for (const line of this.level.intro) this.hud.message(line);
    this.hud.message(
      'Click to walk, click things to use them. Keys 1–5 switch the visual style.',
      'hint',
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hud.destroy();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutScreenLayers, this);
    });
    this.cameras.main.fadeIn(900, 26, 18, 12);
  }

  update(): void {
    // Real elapsed time (Phaser's smoothed delta drifts when frames drop).
    const dt = Math.min(this.game.loop.rawDelta, 100) / 1000;
    this.player.update(dt);
    const hero = this.player.sprite;
    hero.setDepth(hero.y + 0.5);
    this.heroGlow.setPosition(hero.x, hero.y - 40);
    this.updateOcclusion();
    this.updateLights(this.time.now / 1000);

    const cam = this.cameras.main;
    this.fog.tilePositionX = cam.scrollX * 0.35 + this.time.now * 0.006;
    this.fog.tilePositionY = cam.scrollY * 0.35;
  }

  // --- World construction ----------------------------------------------------

  private buildBackdrop(): void {
    this.sky = this.add.image(0, 0, 'sky').setScrollFactor(0).setDepth(-1_000_000);
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
    });
  }

  private buildLights(): void {
    const add = (x: number, y: number, light: Light) => {
      const pool = this.add
        .image(x, y, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(light.color)
        .setScale((light.radius * 2) / 256, light.radius / 256)
        .setDepth(DEPTH_LIGHTS);
      const halo = this.add
        .image(x, y - light.height, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(light.color)
        .setScale(light.radius / 3 / 128)
        .setDepth(DEPTH_LIGHTS);
      this.lamps.push({ light, halo, pool, phase: Math.random() * 100 });
    };
    for (const prop of this.level.props) {
      if (!prop.light) continue;
      const p = gridToWorld(prop.c, prop.r);
      add(p.x, p.y, prop.light);
    }
    this.heroGlow = this.add
      .image(0, 0, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffc27a)
      .setScale(1.6, 1.1)
      .setDepth(DEPTH_LIGHTS);
  }

  private buildAtmosphere(): void {
    const { width, height } = this.scale;
    this.fog = this.add
      .tileSprite(0, 0, width, height, 'fog')
      .setScrollFactor(0)
      .setDepth(DEPTH_FOG);
    this.shade = this.add
      .rectangle(0, 0, width, height, 0x000000)
      .setScrollFactor(0)
      .setDepth(DEPTH_SHADE);
    this.vignette = this.add
      .image(0, 0, 'vignette')
      .setScrollFactor(0)
      .setDepth(DEPTH_ASH + 1);
    this.ash = this.add
      .particles(0, 0, 'ash', {
        x: { min: -100, max: width + 100 },
        y: { min: -60, max: height },
        lifespan: 9000,
        speedX: { min: -14, max: 6 },
        speedY: { min: 6, max: 20 },
        scale: { min: 0.12, max: 0.42 },
        // Fade each flake in and out over its life.
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.55 },
        tint: 0xe8d9c0,
        frequency: 160,
        quantity: 1,
      })
      .setScrollFactor(0)
      .setDepth(DEPTH_ASH);
    this.ash.fastForward(9000);
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    const { width, height } = levelSize(this.level);
    const left = -height * (TILE_W / 2) - 200;
    const right = width * (TILE_W / 2) + 200;
    cam.setBounds(left, -260, right - left, (width + height) * (TILE_H / 2) + 620);
    cam.startFollow(this.player.sprite, true, 0.08, 0.08, 0, 50);
    cam.setZoom(0.85);

    this.grade = cam.filters.internal.addColorMatrix();
    this.inkMap = cam.filters.internal.addGradientMap({
      ramp: { colorStart: 0x1f150e, colorEnd: 0xf1e2c6 },
    });

    this.layoutScreenLayers();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutScreenLayers, this);
  }

  /** Keeps the screen-space layers covering the view at any zoom or size. */
  private layoutScreenLayers(): void {
    const { width, height } = this.scale;
    const z = this.cameras.main.zoom;
    const w = width / z;
    const h = height / z;
    this.sky
      .setPosition(width / 2, height / 2)
      .setScale(Math.max(w / this.sky.width, h / this.sky.height) * 1.05);
    this.fog.setPosition(width / 2, height / 2).setSize(w, h);
    this.shade.setPosition(width / 2, height / 2).setSize(w, h);
    this.vignette.setPosition(width / 2, height / 2).setDisplaySize(w, h);
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
        this.layoutScreenLayers();
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

  private updateLights(t: number): void {
    const boost = this.preset.lights;
    for (const l of this.lamps) {
      const f = l.light.flicker
        ? 0.84 + 0.1 * Math.sin(t * 7.3 + l.phase) + 0.06 * Math.sin(t * 17.9 + l.phase * 2)
        : 1;
      const a = l.light.intensity * boost * f;
      l.pool.setAlpha(a * 0.55);
      l.halo.setAlpha(Math.min(1, a * 0.9));
    }
    this.heroGlow.setAlpha(this.preset.heroLight * (0.92 + 0.08 * Math.sin(t * 5.1)));
  }

  private applyStyle(id: StyleId): void {
    const p = presetById(id);
    this.preset = p;
    storage.set(STYLE_KEY, p.id);
    this.grade.colorMatrix.reset();
    p.grade(this.grade.colorMatrix);
    this.grade.active = this.grade.colorMatrix.alpha > 0;
    this.inkMap.active = !!p.gradientMap;
    this.vignette.setTint(p.vignette.color).setAlpha(p.vignette.strength);
    this.shade.setFillStyle(p.shade.color, 1).setAlpha(p.shade.alpha);
    this.shade.setVisible(p.shade.alpha > 0);
    this.sky.setTint(p.sky);
    this.fog.setTint(p.fog.tint).setAlpha(p.fog.alpha);
    this.ash.setVisible(p.ash > 0).setAlpha(p.ash);
    this.hud.setStyle(p.id);
  }
}
