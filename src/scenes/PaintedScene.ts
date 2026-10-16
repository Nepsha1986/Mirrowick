import * as Phaser from 'phaser';
import type { Cell } from '../core/iso';
import { findPath } from '../core/pathfinding';
import { buildLayout, T, type VillageLayout } from '../painted/layout';
import { FOOT, HERO_H, PROP_LIGHT, PROP_SIZE, RES, WORLD_H, WORLD_W } from '../painted/paint';
import { PaintedPlayer } from '../painted/PaintedPlayer';
import { createPaintedTextures, groundKey, houseKey, propKey } from '../painted/textures';
import { PaintedHud, type MoodId } from '../ui/PaintedHud';
import { storage } from '../ui/dom';

const DEPTH_GROUND = -1_000_000;
const DEPTH_CURSOR = -900_000;
const DEPTH_DARK = 500_000;
const DEPTH_GLOW = 600_000;
const DEPTH_FOG = 700_000;
const DEPTH_VIGNETTE = 800_000;
const ZOOMS = [1.25, 1.75, 2.5];
/** The darkness is painted at half resolution: it is all soft gradients anyway. */
const DARK_SCALE = 2;
const MOOD_KEY = 'mirrowick.mood';

interface Mood {
  dark: number;
  darkness: number;
  glow: number;
  fog: number;
  fogTint: number;
  grade: (m: Phaser.Display.ColorMatrix) => void;
}

const MOODS: Record<MoodId, Mood> = {
  day: {
    dark: 0x000000,
    darkness: 0,
    glow: 0.15,
    fog: 0.08,
    fogTint: 0xf3e4cc,
    grade: (m) => {
      m.sepia(true);
      m.alpha = 0.2;
    },
  },
  dusk: {
    dark: 0x24131a,
    darkness: 0.42,
    glow: 0.6,
    fog: 0.08,
    fogTint: 0xf0d6b8,
    grade: (m) => {
      m.sepia(true);
      m.alpha = 0.3;
    },
  },
  night: {
    dark: 0x060912,
    darkness: 0.9,
    glow: 1,
    fog: 0.1,
    fogTint: 0x8a96b8,
    grade: (m) => {
      m.saturate(-0.3, true);
      m.alpha = 1;
    },
  },
  mist: {
    dark: 0x22252a,
    darkness: 0.55,
    glow: 0.75,
    fog: 0.32,
    fogTint: 0xd8d6d0,
    grade: (m) => {
      m.saturate(-0.55, true);
      m.alpha = 1;
    },
  },
};

interface Lamp {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: number;
  flicker: number;
  phase: number;
  /** Cuts the light out of the darkness. */
  eraser: Phaser.GameObjects.Image;
  /** Warm colour added on top. */
  glow: Phaser.GameObjects.Image;
}

/**
 * The third look: everything — ground, houses, trees, the hero — is painted
 * by code at start-up, and the night is a real darkness texture with light
 * cut out of it by the hero's lantern, street lamps and lit windows.
 * No quests here: it exists to judge the look.
 */
export class PaintedScene extends Phaser.Scene {
  private layout!: VillageLayout;
  private player!: PaintedPlayer;
  private hud!: PaintedHud;
  private dark!: Phaser.Textures.DynamicTexture;
  private darkImage!: Phaser.GameObjects.Image;
  private lamps: Lamp[] = [];
  private lantern!: Lamp;
  private fog!: Phaser.GameObjects.TileSprite;
  private vignette!: Phaser.GameObjects.Image;
  private grade!: Phaser.Filters.ColorMatrix;
  private occluders: { img: Phaser.GameObjects.Image; area: Phaser.Geom.Rectangle }[] = [];
  private cursor!: Phaser.GameObjects.Graphics;
  private mood: Mood = MOODS.night;
  private zoomIndex = 1;

  constructor() {
    super('painted');
  }

  create(): void {
    this.layout = buildLayout();
    this.lamps = [];
    this.occluders = [];
    const houses = createPaintedTextures(this, this.layout);
    this.createLightMask();

    this.add
      .image(0, 0, groundKey)
      .setOrigin(0)
      .setScale(1 / RES)
      .setDepth(DEPTH_GROUND);
    this.cursor = this.add.graphics().setDepth(DEPTH_CURSOR);

    this.layout.houses.forEach((h, i) => {
      const piece = houses[i];
      if (!piece) return;
      const x = h.c * T + piece.ox;
      const y = h.r * T + piece.oy;
      const img = this.add
        .image(x, y, houseKey(i))
        .setOrigin(0)
        .setScale(1 / RES)
        .setDepth((h.r + h.h) * T);
      this.occluders.push({ img, area: img.getBounds() });
      for (const l of piece.lights) {
        this.addLamp(x + l.x, y + l.y, {
          radius: 80,
          intensity: 0.85,
          color: 0xffb35c,
          flicker: 0.05,
        });
      }
      if (piece.smoke) this.addSmoke(x + piece.smoke.x, y + piece.smoke.y);
    });

    for (const p of this.layout.props) {
      const [w, h] = PROP_SIZE[p.kind];
      const x = p.c * T + T / 2;
      const y = p.r * T + T * 0.85;
      const img = this.add
        .image(x, y, propKey(p.kind, p.variant))
        .setOrigin(0.5, (h - FOOT) / h)
        .setScale(1 / RES)
        .setDepth(y)
        .setFlipX((p.kind === 'tree' || p.kind === 'dead') && (p.c + p.r) % 2 === 0);
      if (w * h > 4000) this.occluders.push({ img, area: img.getBounds() });
      const light = PROP_LIGHT[p.kind];
      if (light && p.kind === 'lamp') {
        this.addLamp(x + light.x, y + light.y, {
          radius: 130,
          intensity: 0.95,
          color: 0xffc070,
          flicker: 0.04,
        });
      }
      if (light && p.kind === 'fire') {
        this.addLamp(x + light.x, y + light.y, {
          radius: 170,
          intensity: 1,
          color: 0xff8a3a,
          flicker: 0.16,
        });
        this.addFire(x + light.x, y + light.y);
      }
    }

    this.player = new PaintedPlayer(this, this.layout.spawn);
    this.player.sprite.setScale(1 / RES).setOrigin(0.5, (HERO_H - 4) / HERO_H);
    this.lantern = this.addLamp(0, 0, {
      radius: 170,
      intensity: 1,
      color: 0xffc27a,
      flicker: 0.06,
    });

    this.buildAtmosphere();
    this.setupCamera();
    this.setupInput();

    this.hud = new PaintedHud(this.moodId(), {
      setMood: (id) => this.setMood(id),
      mainMenu: () => this.scene.start('menu'),
    });
    this.setMood(this.moodId());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hud.destroy();
      this.textures.remove('pt-dark');
    });
    this.cameras.main.fadeIn(900, 6, 6, 10);
  }

  update(): void {
    const dt = Math.min(this.game.loop.rawDelta, 100) / 1000;
    this.player.update(dt);
    const hero = this.player.sprite;
    hero.setDepth(hero.y);
    const l = this.player.lantern;
    this.lantern.x = l.x;
    this.lantern.y = l.y;
    this.updateOcclusion();
    this.updateLights();
    this.fog.tilePositionX = this.time.now * 0.008;
    this.fog.tilePositionY = this.time.now * 0.002;
  }

  // --- Light and darkness ---------------------------------------------------------

  private addLamp(
    x: number,
    y: number,
    o: { radius: number; intensity: number; color: number; flicker: number },
  ): Lamp {
    const eraser = new Phaser.GameObjects.Image(this, 0, 0, 'pt-light');
    const glow = this.add
      .image(x, y, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(o.color)
      .setDepth(DEPTH_GLOW);
    const lamp: Lamp = { x, y, ...o, phase: Math.random() * 100, eraser, glow };
    this.lamps.push(lamp);
    return lamp;
  }

  /** A light with a solid core and a long soft falloff, to cut out of the dark. */
  private createLightMask(): void {
    if (!this.textures.exists('pt-light')) {
      const tex = this.textures.createCanvas('pt-light', 256, 256);
      const ctx = tex?.getContext();
      if (tex && ctx) {
        const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.7, 'rgba(255,255,255,0.3)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        tex.refresh();
      }
    }
  }

  private buildAtmosphere(): void {
    this.dark = this.textures.addDynamicTexture(
      'pt-dark',
      WORLD_W / DARK_SCALE,
      WORLD_H / DARK_SCALE,
    ) as Phaser.Textures.DynamicTexture;
    this.darkImage = this.add
      .image(0, 0, 'pt-dark')
      .setOrigin(0)
      .setScale(DARK_SCALE)
      .setDepth(DEPTH_DARK);

    this.fog = this.add
      .tileSprite(0, 0, WORLD_W, WORLD_H, 'fog')
      .setOrigin(0)
      .setTileScale(2.5)
      .setDepth(DEPTH_FOG);
    // Dust and ash drifting through the lantern light.
    this.add
      .particles(0, 0, 'ash', {
        x: { min: 0, max: WORLD_W },
        y: { min: 0, max: WORLD_H },
        lifespan: 8000,
        speedX: { min: -6, max: 4 },
        speedY: { min: 2, max: 8 },
        scale: { min: 0.08, max: 0.2 },
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.5 },
        tint: 0xe8d9c0,
        frequency: 40,
      })
      .setDepth(DEPTH_FOG + 1)
      .fastForward(8000);
    this.vignette = this.add.image(0, 0, 'vignette').setScrollFactor(0).setDepth(DEPTH_VIGNETTE);
    this.grade = this.cameras.main.filters.internal.addColorMatrix();
  }

  private updateLights(): void {
    const t = this.time.now / 1000;
    const m = this.mood;
    this.darkImage.setVisible(m.darkness > 0);
    this.dark.clear();
    this.dark.fill(m.dark, m.darkness);
    for (const l of this.lamps) {
      const f =
        1 -
        l.flicker +
        l.flicker * (0.6 * Math.sin(t * 7.3 + l.phase) + 0.4 * Math.sin(t * 17.9 + l.phase * 2));
      const r = l.radius * f;
      l.eraser
        .setPosition(l.x / DARK_SCALE, l.y / DARK_SCALE)
        .setScale((r * 2) / 256 / DARK_SCALE)
        .setAlpha(l.intensity);
      this.dark.erase(l.eraser);
      l.glow
        .setPosition(l.x, l.y)
        .setScale((r * 1.3) / 256)
        .setAlpha(l.intensity * m.glow * 0.42 * f);
    }
    this.dark.render();
  }

  private addFire(x: number, y: number): void {
    this.add
      .particles(x, y, 'glow', {
        lifespan: { min: 400, max: 800 },
        speedY: { min: -40, max: -18 },
        speedX: { min: -6, max: 6 },
        scale: { start: 0.07, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffd27a, 0xff8a3a, 0xe0502a],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 35,
      })
      .setDepth(y + 1);
    this.addSmoke(x, y - 14);
  }

  private addSmoke(x: number, y: number): void {
    this.add
      .particles(x, y, 'glow', {
        lifespan: 3600,
        speedY: { min: -16, max: -9 },
        speedX: { min: 2, max: 9 },
        scale: { start: 0.05, end: 0.22 },
        alpha: { start: 0.22, end: 0 },
        tint: 0x8a7f74,
        frequency: 260,
      })
      .setDepth(DEPTH_DARK + 1);
  }

  private moodId(): MoodId {
    const id = storage.get(MOOD_KEY);
    return id === 'day' || id === 'dusk' || id === 'mist' ? id : 'night';
  }

  private setMood(id: MoodId): void {
    this.mood = MOODS[id];
    storage.set(MOOD_KEY, id);
    this.fog.setTint(this.mood.fogTint).setAlpha(this.mood.fog);
    this.vignette.setTint(0x05060a).setAlpha(id === 'dusk' ? 0.6 : 0.85);
    this.grade.colorMatrix.reset();
    this.mood.grade(this.grade.colorMatrix);
    this.hud.setMood(id);
  }

  // --- Camera and input -------------------------------------------------------------

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    this.applyZoom();
    cam.startFollow(this.player.sprite, true, 0.09, 0.09);
    this.layoutScreen();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this),
    );
  }

  /** Never zoom out past the edge of the world, whatever the window size. */
  private applyZoom(): void {
    const { width, height } = this.scale;
    const fit = Math.max(width / WORLD_W, height / WORLD_H);
    this.cameras.main.setZoom(Math.max(ZOOMS[this.zoomIndex] as number, fit));
    this.layoutScreen();
  }

  private layoutScreen(): void {
    const { width, height } = this.scale;
    const z = this.cameras.main.zoom;
    this.vignette.setPosition(width / 2, height / 2).setDisplaySize(width / z, height / z);
  }

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const cell = this.pointerCell(p);
      this.cursor.clear();
      if (!this.layout.nav.isWalkable(cell.c, cell.r)) return;
      this.cursor.lineStyle(1.5, 0xf0c48a, 0.55);
      this.cursor.strokeEllipse(cell.c * T + T / 2, cell.r * T + T * 0.75, T * 0.8, T * 0.4);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      const goal = this.pointerCell(p);
      const start = this.player.nextCell;
      const path = findPath(this.layout.nav, start, goal);
      if (path) this.player.walk([...(this.player.moving ? [start] : []), ...path]);
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        this.zoomIndex = Phaser.Math.Clamp(this.zoomIndex + (dy > 0 ? -1 : 1), 0, ZOOMS.length - 1);
        this.applyZoom();
      },
    );
  }

  private pointerCell(pointer: Phaser.Input.Pointer): Cell {
    const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return { c: Math.floor(p.x / T), r: Math.floor(p.y / T) };
  }

  /** Roofs and canopies go see-through when the hero walks behind them. */
  private updateOcclusion(): void {
    const hero = this.player.sprite;
    const hx = hero.x;
    const hy = hero.y - 14;
    for (const { img, area } of this.occluders) {
      const behind = img.depth > hero.depth && area.contains(hx, hy);
      const target = behind ? 0.4 : 1;
      img.alpha += (target - img.alpha) * 0.15;
    }
  }
}
