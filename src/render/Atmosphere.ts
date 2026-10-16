import * as Phaser from 'phaser';
import type { Light } from '../level/types';
import { storage } from '../ui/dom';
import { presetById, type StyleId, type StylePreset } from './stylePresets';

const STYLE_KEY = 'mirrowick.style';

// Depth bands above every world object.
const DEPTH_FOG = 900_000;
const DEPTH_SHADE = 910_000;
const DEPTH_LIGHTS = 1_000_000;
const DEPTH_ASH = 1_100_000;

interface Lamp {
  light: Light;
  halo: Phaser.GameObjects.Image;
  pool: Phaser.GameObjects.Image;
  phase: number;
}

export interface AtmosphereOptions {
  /** Painted sky behind the world (the floating island needs one). */
  sky?: boolean;
  /** Size of the lantern glow around the hero, in world pixels. */
  heroGlow: { width: number; height: number; lift: number };
}

/**
 * Everything that sets the mood and is shared by both views: colour grading,
 * fog, drifting ash, a darkening layer, a vignette and flickering light glows,
 * all driven by the visual-style presets.
 */
export class Atmosphere {
  private readonly sky?: Phaser.GameObjects.Image;
  private readonly fog: Phaser.GameObjects.TileSprite;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly vignette: Phaser.GameObjects.Image;
  private readonly ash: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly grade: Phaser.Filters.ColorMatrix;
  private readonly inkMap: Phaser.Filters.GradientMap;
  private readonly heroGlow: Phaser.GameObjects.Image;
  private readonly lamps: Lamp[] = [];
  private preset: StylePreset = presetById(storage.get(STYLE_KEY));

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: AtmosphereOptions,
  ) {
    const { width, height } = scene.scale;
    if (options.sky) {
      this.sky = scene.add.image(0, 0, 'sky').setScrollFactor(0).setDepth(-1_000_000);
    }
    this.fog = scene.add
      .tileSprite(0, 0, width, height, 'fog')
      .setScrollFactor(0)
      .setDepth(DEPTH_FOG);
    this.shade = scene.add
      .rectangle(0, 0, width, height, 0x000000)
      .setScrollFactor(0)
      .setDepth(DEPTH_SHADE);
    this.vignette = scene.add
      .image(0, 0, 'vignette')
      .setScrollFactor(0)
      .setDepth(DEPTH_ASH + 1);
    // Emitted around the screen centre in screen pixels; layout() undoes the zoom.
    this.ash = scene.add
      .particles(0, 0, 'ash', {
        x: { min: -width / 2 - 100, max: width / 2 + 100 },
        y: { min: -height / 2 - 60, max: height / 2 },
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

    const { width: gw, height: gh } = options.heroGlow;
    this.heroGlow = scene.add
      .image(0, 0, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffc27a)
      .setScale(gw / 256, gh / 256)
      .setDepth(DEPTH_LIGHTS);

    const cam = scene.cameras.main;
    this.grade = cam.filters.internal.addColorMatrix();
    this.inkMap = cam.filters.internal.addGradientMap({
      ramp: { colorStart: 0x1f150e, colorEnd: 0xf1e2c6 },
    });

    this.layout();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this),
    );
  }

  get styleId(): StyleId {
    return this.preset.id;
  }

  /** A flickering light: a pool on the ground and a halo at the flame. */
  addLight(x: number, y: number, light: Light): void {
    const pool = this.scene.add
      .image(x, y, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(light.color)
      .setScale((light.radius * 2) / 256, light.radius / 256)
      .setDepth(DEPTH_LIGHTS);
    const halo = this.scene.add
      .image(x, y - light.height, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(light.color)
      .setScale(light.radius / 3 / 128)
      .setDepth(DEPTH_LIGHTS);
    this.lamps.push({ light, halo, pool, phase: Math.random() * 100 });
  }

  /** Keeps the screen-space layers covering the view at any zoom or size. */
  layout(): void {
    const { width, height } = this.scene.scale;
    const z = this.scene.cameras.main.zoom;
    const w = width / z;
    const h = height / z;
    this.sky
      ?.setPosition(width / 2, height / 2)
      .setScale(Math.max(w / this.sky.width, h / this.sky.height) * 1.05);
    this.fog
      .setPosition(width / 2, height / 2)
      .setSize(w, h)
      .setTileScale(1 / z);
    this.shade.setPosition(width / 2, height / 2).setSize(w, h);
    this.vignette.setPosition(width / 2, height / 2).setDisplaySize(w, h);
    this.ash.setPosition(width / 2, height / 2).setScale(1 / z);
  }

  update(heroX: number, heroY: number): void {
    const t = this.scene.time.now / 1000;
    const cam = this.scene.cameras.main;
    this.fog.tilePositionX = cam.scrollX * 0.35 + this.scene.time.now * 0.006;
    this.fog.tilePositionY = cam.scrollY * 0.35;

    const boost = this.preset.lights;
    for (const l of this.lamps) {
      const f = l.light.flicker
        ? 0.84 + 0.1 * Math.sin(t * 7.3 + l.phase) + 0.06 * Math.sin(t * 17.9 + l.phase * 2)
        : 1;
      const a = l.light.intensity * boost * f;
      l.pool.setAlpha(a * 0.55);
      l.halo.setAlpha(Math.min(1, a * 0.9));
    }
    this.heroGlow.setPosition(heroX, heroY - this.options.heroGlow.lift);
    this.heroGlow.setAlpha(this.preset.heroLight * (0.92 + 0.08 * Math.sin(t * 5.1)));
  }

  applyStyle(id: StyleId): void {
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
    this.sky?.setTint(p.sky);
    this.fog.setTint(p.fog.tint).setAlpha(p.fog.alpha);
    this.ash.setVisible(p.ash > 0).setAlpha(p.ash);
  }
}
