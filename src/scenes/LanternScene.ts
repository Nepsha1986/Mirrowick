import * as Phaser from 'phaser';
import { createLanternTextures } from '../lantern/art';
import { Nav } from '../lantern/nav';
import { generateWorld, type World } from '../lantern/world';
import { DAY_LEN, H, T, W, clamp, lerp, rnd, type Pt } from '../lantern/util';
import { LanternHud } from '../ui/LanternHud';

const DEPTH_DARK = 100_000;
const DEPTH_ABOVE_DARK = 100_001;
const HERO_R = 10;
const SPEED = 140;
const LIGHT_R = 150;
/** How much faster time runs while T is held. */
const FAST = 24;
/** Objects are shown and hidden in square chunks of this many pixels. */
const CHUNK = 10 * T;

interface Hero extends Pt {
  facing: number;
  path: Pt[];
  walk: number;
}

/**
 * The lantern prototype: Заслон's way of playing — free top-down movement,
 * a world painted by code, real darkness with a lantern beam and a day–night
 * cycle — dressed as the Lower World around Mirrowick. Nothing else: no
 * combat, loot or levels. It exists to judge the look and the feel.
 */
export class LanternScene extends Phaser.Scene {
  private world!: World;
  private nav!: Nav;
  private hero!: Hero;
  private heroImg!: Phaser.GameObjects.Image;
  private hud!: LanternHud;
  private dark!: Phaser.Textures.DynamicTexture;
  private darkImg!: Phaser.GameObjects.Image;
  private erasers: Phaser.GameObjects.Image[] = [];
  private eraserCone!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Graphics;
  private markerAt: (Pt & { t: number }) | null = null;
  private motes: (Phaser.GameObjects.Image & { vx: number; vy: number; ph: number; ba: number })[] =
    [];
  private chunks = new Map<string, Phaser.GameObjects.Image[]>();
  private visible = new Set<string>();
  private cullKey = '';
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private holding = false;
  private lastGo = 0;
  /** Time of day, 0…1 from 06:00. Starts late afternoon so dusk comes soon. */
  private tod = 10.5 / 24;
  private day = 1;

  constructor() {
    super('lantern');
  }

  create(): void {
    this.world = generateWorld();
    this.nav = new Nav(this.world.block);
    this.chunks.clear();
    this.visible.clear();
    this.cullKey = '';
    this.erasers = [];
    this.motes = [];
    createLanternTextures(this);

    this.buildGround();
    this.buildObjects();
    this.hero = { ...this.world.spawn, facing: -Math.PI / 2, path: [], walk: 0 };
    this.heroImg = this.add.image(this.hero.x, this.hero.y, 'ln-atlas', 'hero');
    this.marker = this.add.graphics().setDepth(DEPTH_DARK - 1);
    this.buildDarkness();
    this.buildMotes();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W * T, H * T);
    cam.setBackgroundColor('#0d0a08');
    cam.startFollow(this.heroImg, true, 0.14, 0.14);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);

    this.setupInput();
    this.hud = new LanternHud(() => this.scene.start('menu'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.hud.destroy();
      this.textures.remove('ln-dark');
    });
    this.cull(true);
    cam.fadeIn(800, 13, 10, 8);
  }

  // --- World -------------------------------------------------------------------------

  private buildGround(): void {
    const data: number[][] = [];
    for (let y = 0; y < H; y++) {
      data.push(Array.from(this.world.ground.subarray(y * W, (y + 1) * W)));
    }
    const map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
    const tiles = map.addTilesetImage('ln-tiles', 'ln-tiles', T, T, 0, 0);
    if (!tiles) throw new Error('lantern tiles missing');
    map.createLayer(0, tiles, 0, 0)?.setDepth(-100);
  }

  /** Registers an image in its chunk; only chunks near the camera are shown. */
  private chunked(img: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    const k = `${Math.floor(img.x / CHUNK)},${Math.floor(img.y / CHUNK)}`;
    let list = this.chunks.get(k);
    if (!list) this.chunks.set(k, (list = []));
    list.push(img);
    img.setVisible(false);
    return img;
  }

  private buildObjects(): void {
    for (const d of this.world.decals) {
      this.chunked(
        this.add
          .image(d.x, d.y, 'ln-atlas', d.frame)
          .setAngle(d.angle ?? 0)
          .setDepth(-50)
          .setAlpha(0.85),
      );
    }
    for (const o of this.world.objects) {
      const img = this.add
        .image(o.x, o.y, 'ln-atlas', o.frame)
        .setDepth(o.depth ?? o.y + 4)
        .setAngle(o.angle ?? 0)
        .setScale(o.scale ?? 1);
      this.chunked(img);
    }
    // Warm or cold glow under each light: shows through where the dark is cut away.
    for (const l of this.world.lights) {
      this.chunked(
        this.add
          .image(l.x, l.y, 'glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(l.color)
          .setAlpha(0.35)
          .setScale((l.radius * 1.6) / 256)
          .setDepth(-40),
      );
    }
    // The Wick's flame.
    const { x, y } = this.world.wick;
    this.add
      .particles(x, y, 'ln-atlas', {
        frame: 'dot',
        lifespan: { min: 500, max: 900 },
        speedY: { min: -46, max: -20 },
        speedX: { min: -8, max: 8 },
        scale: { start: 1.6, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffe0a0, 0xffa04a, 0xe0602a],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 30,
      })
      .setDepth(y + 10);
  }

  private buildDarkness(): void {
    const { width, height } = this.scale;
    this.dark = this.textures.addDynamicTexture(
      'ln-dark',
      width,
      height,
    ) as Phaser.Textures.DynamicTexture;
    this.darkImg = this.add.image(0, 0, 'ln-dark').setScrollFactor(0).setDepth(DEPTH_DARK);
    this.eraserCone = new Phaser.GameObjects.Image(this, 0, 0, 'ln-cone').setOrigin(8 / 256, 0.5);
  }

  /** Spores and embers drifting in the air, brighter at night. */
  private buildMotes(): void {
    for (let i = 0; i < 60; i++) {
      const m = this.add
        .image(
          this.world.spawn.x + rnd(-800, 800),
          this.world.spawn.y + rnd(-600, 600),
          'ln-atlas',
          'dot',
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(i % 3 ? 0x9fd8e6 : 0xffc27a)
        .setScale(rnd(0.25, 0.6))
        .setDepth(DEPTH_ABOVE_DARK) as LanternScene['motes'][number];
      m.vx = rnd(-6, 6);
      m.vy = rnd(-10, -2);
      m.ph = rnd(0, 6.28);
      m.ba = rnd(0.15, 0.5);
      this.motes.push(m);
    }
  }

  private layout(): void {
    const { width, height } = this.scale;
    const cam = this.cameras.main;
    cam.setZoom(clamp(Math.min(width, height) / 700, 0.62, 1.1));
    const z = cam.zoom;
    if (this.dark.width !== width || this.dark.height !== height) this.dark.setSize(width, height);
    this.darkImg.setPosition(width / 2, height / 2).setDisplaySize(width / z, height / z);
  }

  private cull(force = false): void {
    const v = this.cameras.main.worldView;
    const m = CHUNK / 2;
    const x0 = Math.floor((v.x - m) / CHUNK);
    const x1 = Math.floor((v.right + m) / CHUNK);
    const y0 = Math.floor((v.y - m) / CHUNK);
    const y1 = Math.floor((v.bottom + m) / CHUNK);
    const key = `${x0},${x1},${y0},${y1}`;
    if (!force && key === this.cullKey) return;
    this.cullKey = key;
    const next = new Set<string>();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) next.add(`${x},${y}`);
    for (const k of this.visible)
      if (!next.has(k)) this.chunks.get(k)?.forEach((o) => o.setVisible(false));
    for (const k of next) this.chunks.get(k)?.forEach((o) => o.setVisible(true));
    this.visible = next;
  }

  // --- Input -------------------------------------------------------------------------

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.holding = true;
      this.goTo(p);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.holding && this.time.now - this.lastGo > 160) this.goTo(p);
    });
    const release = () => (this.holding = false);
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input missing');
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,T,ESC') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    kb.on('keydown-ESC', () => this.scene.start('menu'));
  }

  private goTo(pointer: Phaser.Input.Pointer): void {
    this.lastGo = this.time.now;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.hero.path = this.nav.route(this.hero, wp, HERO_R);
    const end = this.hero.path[this.hero.path.length - 1] ?? wp;
    this.markerAt = { x: end.x, y: end.y, t: 0.6 };
  }

  // --- Frame -------------------------------------------------------------------------

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const k = this.keys;
    const prev = this.hour();
    this.tod = (this.tod + (dt * (k.T?.isDown ? FAST : 1)) / DAY_LEN) % 1;
    if (prev < 6 && this.hour() >= 6) this.day++;

    this.moveHero(dt);
    this.cull();
    this.drawMarker(dt);
    this.updateLighting(dt);
    this.hud.update(this.day, this.hour(), this.night());
  }

  private moveHero(dt: number): void {
    const h = this.hero;
    const k = this.keys;
    const down = (...names: string[]) => names.some((n) => k[n]?.isDown);
    const kx = (down('D', 'RIGHT') ? 1 : 0) - (down('A', 'LEFT') ? 1 : 0);
    const ky = (down('S', 'DOWN') ? 1 : 0) - (down('W', 'UP') ? 1 : 0);
    let mx = 0;
    let my = 0;
    if (kx || ky) {
      h.path = [];
      const l = Math.hypot(kx, ky);
      mx = (kx / l) * SPEED * dt;
      my = (ky / l) * SPEED * dt;
    } else if (h.path.length) {
      const t = h.path[0] as Pt;
      const dx = t.x - h.x;
      const dy = t.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) h.path.shift();
      else {
        const s = Math.min(d, SPEED * dt);
        mx = (dx / d) * s;
        my = (dy / d) * s;
      }
    }
    if (mx || my) {
      this.nav.move(h, mx, my, HERO_R);
      // Turn smoothly towards the walking direction.
      const want = Math.atan2(my, mx);
      h.facing += Phaser.Math.Angle.Wrap(want - h.facing) * Math.min(1, dt * 14);
      h.walk += dt * 10;
    }
    const bob = mx || my ? Math.sin(h.walk) * 0.04 : 0;
    this.heroImg
      .setPosition(h.x, h.y)
      .setRotation(h.facing)
      .setDepth(h.y + 6)
      .setScale(1 + bob, 1 - bob);
  }

  private drawMarker(dt: number): void {
    const g = this.marker;
    g.clear();
    const m = this.markerAt;
    if (!m || m.t <= 0) return;
    m.t -= dt;
    const a = m.t / 0.6;
    g.lineStyle(2, 0xf08a3c, a * 0.8);
    g.strokeCircle(m.x, m.y, 6 + (1 - a) * 10);
  }

  // --- Time and light ----------------------------------------------------------------

  hour(): number {
    return (6 + this.tod * 24) % 24;
  }

  /** 0 by day, 1 at night, easing through dusk and dawn. */
  night(): number {
    const h = this.hour();
    if (h >= 7 && h < 17) return 0;
    if (h >= 17 && h < 21) return (h - 17) / 4;
    if (h >= 21 || h < 4) return 1;
    return 1 - (h - 4) / 3;
  }

  private eraser(i: number): Phaser.GameObjects.Image {
    let e = this.erasers[i];
    if (!e) {
      e = new Phaser.GameObjects.Image(this, 0, 0, 'ln-light');
      this.erasers[i] = e;
    }
    return e;
  }

  private updateLighting(dt: number): void {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const wv = cam.worldView;
    const h = this.hero;
    const n = this.night();
    // The Lower World never gets truly bright; dusk and dawn go crimson-violet.
    const alpha = lerp(0.22, 0.92, n);
    const dusk = n > 0 && n < 1 ? Math.sin(n * Math.PI) : 0;
    const r = Math.round(lerp(lerp(30, 5, n), 52, dusk * 0.5));
    const g = Math.round(lerp(lerp(24, 6, n), 18, dusk * 0.5));
    const b = Math.round(lerp(lerp(22, 12, n), 34, dusk * 0.5));
    this.dark.clear();
    this.dark.fill((r << 16) | (g << 8) | b, alpha);

    const toX = (x: number) => (x - wv.x) * z;
    const toY = (y: number) => (y - wv.y) * z;
    const t = this.time.now / 1000;
    let i = 0;
    const cut = (x: number, y: number, radius: number, a: number) => {
      this.dark.erase(
        this.eraser(i++)
          .setPosition(toX(x), toY(y))
          .setScale((radius * z) / 128)
          .setAlpha(a),
      );
    };
    // The lantern: a pool around the hero and a beam ahead.
    const lf = 1 + Math.sin(t * 9) * 0.02 + Math.sin(t * 23) * 0.015;
    cut(h.x, h.y, LIGHT_R * 0.75 * lf, 1);
    this.dark.erase(
      this.eraserCone
        .setPosition(toX(h.x), toY(h.y))
        .setRotation(h.facing)
        .setScale((LIGHT_R * 1.75 * z * lf) / 236),
    );
    for (const l of this.world.lights) {
      if (l.x < wv.x - l.radius || l.x > wv.right + l.radius) continue;
      if (l.y < wv.y - l.radius || l.y > wv.bottom + l.radius) continue;
      const f = l.slow
        ? 1 + Math.sin(t * 1.6 + l.x) * l.flicker
        : 1 + (Math.sin(t * 11 + l.x) * 0.5 + Math.sin(t * 23 + l.y) * 0.5) * l.flicker;
      cut(l.x, l.y, l.radius * f, 0.95);
    }
    this.dark.render();

    // Motes drift around the view and glow brighter as night falls.
    for (const m of this.motes) {
      m.ph += dt;
      m.x += m.vx * dt + Math.sin(m.ph) * 0.2;
      m.y += m.vy * dt;
      if (m.x < wv.x - 10) m.x += wv.width + 20;
      if (m.x > wv.right + 10) m.x -= wv.width + 20;
      if (m.y < wv.y - 10) m.y += wv.height + 20;
      if (m.y > wv.bottom + 10) m.y -= wv.height + 20;
      m.setAlpha(m.ba * (0.3 + n * 0.9) * (0.6 + 0.4 * Math.sin(m.ph * 1.7)));
    }
  }
}
