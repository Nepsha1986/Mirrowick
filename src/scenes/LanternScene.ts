import * as Phaser from 'phaser';
import { music } from '../audio/AmbientMusic';
import { createLanternTextures } from '../lantern/art';
import { paintGround, paintWalls } from '../lantern/ground-art';
import { ROOF_PAD, paintRoofs, roofKey } from '../lantern/town-art';
import { Nav } from '../lantern/nav';
import { generateUpperWorld } from '../lantern/upper';
import { writeSave } from '../lantern/save';
import { generateWorld, type Portal, type Realm, type Thing, type World } from '../lantern/world';
import { DAY_LEN, T, clamp, lerp, rnd, type Pt } from '../lantern/util';
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
/** How close you must stand to something to use it. */
const REACH = 1.4 * T;
/** Seconds between autosaves. */
const AUTOSAVE = 5;
/** The Mirror's cold glint, for the flash between the worlds. */
const GLINT: [number, number, number] = [159, 216, 230];

/** What the scene is started with: which world, and where and when you arrive. */
export interface LanternData {
  demo?: boolean;
  realm?: Realm;
  at?: Pt;
  tod?: number;
  day?: number;
  /** Things that are switched on. */
  things?: string[];
  /** Arriving through a mirror rather than from the menu. */
  via?: boolean;
}

/** Something you can use where you stand: a mirror, a switch. */
interface Target extends Pt {
  label: () => string;
  use: () => void;
}

/** A villager or a chicken pottering about. */
interface Walker extends Pt {
  img: Phaser.GameObjects.Image;
  path: Pt[];
  wait: number;
  speed: number;
  chicken: boolean;
}

interface Hero extends Pt {
  facing: number;
  path: Pt[];
  walk: number;
}

/**
 * The lantern prototype: Заслон's way of playing — free top-down movement,
 * a world painted by code, real darkness with a lantern beam and a day–night
 * cycle. It plays either Mirrowick: the Lower World of dusk around the
 * village, or the Upper World — an ordinary sunny homestead — and the
 * mirror in the windmill's floor leads from one to the other.
 */
export class LanternScene extends Phaser.Scene {
  private realm: Realm = 'lower';
  private start: LanternData = {};
  private world!: World;
  private nav!: Nav;
  private hero!: Hero;
  private heroImg!: Phaser.GameObjects.Image;
  private hud?: LanternHud;
  /** Backdrop for the main menu: no hero control, the camera drifts at dusk. */
  private demo = false;
  private dark!: Phaser.Textures.DynamicTexture;
  private darkImg!: Phaser.GameObjects.Image;
  private erasers: Phaser.GameObjects.Image[] = [];
  private eraserCone!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Graphics;
  private markerAt: (Pt & { t: number }) | null = null;
  private motes: (Phaser.GameObjects.Image & { vx: number; vy: number; ph: number; ba: number })[] =
    [];
  private roofs: { img: Phaser.GameObjects.Image; area: Phaser.Geom.Rectangle }[] = [];
  private sails: { img: Phaser.GameObjects.Image; room: number }[] = [];
  /** Glows under the outdoor lights; in the Upper World they only show after dark. */
  private glows: Phaser.GameObjects.Image[] = [];
  /** Mirrors and things you can use. */
  private targets: Target[] = [];
  /** Something you clicked: used as soon as you reach it. */
  private heading: Target | null = null;
  private thingsOn = new Set<string>();
  private thingImgs = new Map<string, Phaser.GameObjects.Image>();
  private leaving = false;
  private sinceSave = 0;
  private walkers: Walker[] = [];
  private chunks = new Map<string, Phaser.GameObjects.Image[]>();
  private visible = new Set<string>();
  private cullKey = '';
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private holding = false;
  private lastGo = 0;
  /** Time of day, 0…1 from 06:00. Starts late afternoon so dusk comes soon. */
  private tod = 10.5 / 24;
  private day = 1;

  constructor() {
    super('lantern');
  }

  init(data?: LanternData): void {
    this.start = data ?? {};
    this.demo = !!data?.demo;
    // The menu's backdrop is the Lower World; a new game starts at home, upstairs.
    this.realm = data?.realm ?? (this.demo ? 'lower' : 'upper');
  }

  create(): void {
    this.world = this.realm === 'upper' ? generateUpperWorld() : generateWorld();
    this.nav = new Nav(this.world.block, this.world.w, this.world.h, this.world.walls);
    this.chunks.clear();
    this.visible.clear();
    this.cullKey = '';
    this.erasers = [];
    this.motes = [];
    this.roofs = [];
    this.sails = [];
    this.glows = [];
    this.walkers = [];
    this.keys = {};
    this.heading = null;
    this.thingsOn = new Set(this.start.things ?? []);
    this.thingImgs.clear();
    this.leaving = false;
    this.sinceSave = 0;
    this.holding = false;
    this.markerAt = null;
    this.tod = this.start.tod ?? 10.5 / 24;
    this.day = this.start.day ?? 1;
    createLanternTextures(this);
    if (!this.demo) music.setMood(this.realm);

    this.buildGround();
    this.buildObjects();
    this.buildTargets();
    // A saved spot that is no longer free (the world changed) falls back to the start.
    const want = this.start.at;
    const at = want && this.nav.circleFree(want.x, want.y, HERO_R) ? want : this.world.spawn;
    this.hero = { ...at, facing: Math.PI / 2, path: [], walk: 0 };
    this.heroImg = this.add.image(this.hero.x, this.hero.y, 'ln-atlas', 'hero');
    this.marker = this.add.graphics().setDepth(DEPTH_DARK - 1);
    this.buildTownLife();
    this.buildDarkness();
    this.buildMotes();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.w * T, this.world.h * T);
    cam.setBackgroundColor(this.realm === 'upper' ? '#2c3a1e' : '#0d0a08');
    if (this.demo) {
      this.tod = (19.4 - 6) / 24;
      this.hero.x = 43.5 * T;
      this.hero.y = 38 * T;
      this.hero.facing = Math.PI / 2;
      this.moveHero(0);
    } else {
      cam.startFollow(this.heroImg, true, 0.14, 0.14);
    }
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);

    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') this.save();
    };
    if (!this.demo) {
      this.setupInput();
      this.hud = new LanternHud(() => this.scene.start('menu'), this.realm);
      document.addEventListener('visibilitychange', saveOnHide);
      this.save();
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Leaving for the menu saves; leaving through a mirror saved on arrival.
      this.save();
      document.removeEventListener('visibilitychange', saveOnHide);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.hud?.destroy();
      this.hud = undefined;
      this.textures.remove('ln-dark');
    });
    this.cull(true);
    if (this.start.via) cam.fadeIn(1100, ...GLINT);
    else cam.fadeIn(800, 13, 10, 8);
  }

  // --- World -------------------------------------------------------------------------

  private buildGround(): void {
    const { w, h, ground } = this.world;
    const data: number[][] = [];
    for (let y = 0; y < h; y++) data.push(Array.from(ground.subarray(y * w, (y + 1) * w)));
    const map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
    const tiles = map.addTilesetImage('ln-tiles', 'ln-tiles', T, T, 0, 0);
    if (!tiles) throw new Error('lantern tiles missing');
    map.createLayer(0, tiles, 0, 0)?.setDepth(-100);
    // Roads and paths painted over the ground; thin walls and fences on top.
    const pw = w * T;
    const ph = h * T;
    if (this.world.patches.length) {
      const key = `ln-ground-${this.realm}`;
      paintGround(this, key, pw, ph, this.world.patches);
      this.add.image(0, 0, key).setOrigin(0).setDepth(-97);
    }
    if (this.world.walls.length) {
      const key = `ln-walls-${this.realm}`;
      paintWalls(this, key, pw, ph, this.world.walls);
      this.add.image(0, 0, key).setOrigin(0).setDepth(-30);
    }
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
    this.hangFestoons();
    for (const d of this.world.decals) {
      this.chunked(
        this.add
          .image(d.x, d.y, d.key ?? 'ln-atlas', d.frame)
          .setAngle(d.angle ?? 0)
          .setDepth(d.depth ?? -50)
          .setScale(d.scale ?? 1)
          .setAlpha(d.alpha ?? 0.85),
      );
    }
    for (const o of this.world.objects) {
      const img = this.add
        .image(o.x, o.y, o.key ?? 'ln-atlas', o.frame)
        .setDepth(o.depth ?? o.y + 4)
        .setAngle(o.angle ?? 0)
        .setScale(o.scale ?? 1);
      this.chunked(img);
    }
    // Warm or cold glow under each light: shows through where the dark is cut away.
    for (const l of this.world.lights) {
      if (l.room !== undefined) continue;
      const glow = this.chunked(
        this.add
          .image(l.x, l.y, 'glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(l.color)
          .setAlpha(0.35)
          .setScale((l.radius * 1.6) / 256)
          .setDepth(-40),
      );
      this.glows.push(glow);
    }
    // The Wick's flame.
    if (!this.world.wick) return;
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

  /** Strings of little lights: a sagging wire, bulbs that cut the dark. */
  private hangFestoons(): void {
    const g = this.add.graphics().setDepth(49_000);
    for (const { a, b } of this.world.life.festoons) {
      const sag = 14;
      const point = (t: number) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * sag,
      });
      g.lineStyle(1.2, 0x1c130d, 0.9);
      g.beginPath();
      for (let t = 0; t <= 1.001; t += 0.05) {
        const p = point(t);
        if (t === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();
      const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 22);
      for (let k = 1; k < n; k++) {
        const p = point(k / n);
        const color = [0xffc86a, 0xff8a5a, 0xfff0b0][k % 3] as number;
        this.add
          .image(p.x, p.y + 2, 'ln-atlas', 'dot')
          .setTint(color)
          .setScale(0.55)
          .setDepth(49_001);
        this.world.lights.push({ x: p.x, y: p.y + 2, radius: 30, flicker: 0.08, color });
      }
    }
  }

  /** Roofs that lift when you walk in, chimney smoke, forge sparks, villagers, hens. */
  private buildTownLife(): void {
    const { buildings, forge, spots, coop } = this.world.life;
    paintRoofs(this, buildings, this.realm);
    buildings.forEach((b, i) => {
      const img = this.add
        .image(b.x0 * T - ROOF_PAD, b.y0 * T - ROOF_PAD, roofKey(this.realm, i))
        .setOrigin(0)
        .setDepth(50_000);
      this.roofs.push({
        img,
        area: new Phaser.Geom.Rectangle(b.x0 * T, b.y0 * T, b.w * T, b.h * T),
      });
      for (const ch of b.chimneys) {
        this.add
          .particles(b.x0 * T + ch.x * T, b.y0 * T + ch.y * T, 'glow', {
            lifespan: 4200,
            speedY: { min: -14, max: -7 },
            speedX: { min: 4, max: 12 },
            scale: { start: 0.05, end: 0.24 },
            alpha: { start: 0.3, end: 0 },
            tint: 0x8a8076,
            frequency: 220,
          })
          .setDepth(50_001);
      }
    });
    for (const s of this.world.sails) {
      const img = this.add.image(s.x, s.y, 'ln-up', 'sails').setDepth(50_002);
      this.sails.push({ img, room: s.room });
    }
    if (forge)
      this.add
        .particles(forge.x, forge.y, 'ln-atlas', {
          frame: 'dot',
          lifespan: { min: 300, max: 700 },
          speed: { min: 20, max: 70 },
          angle: { min: 200, max: 340 },
          gravityY: 60,
          scale: { start: 0.45, end: 0 },
          tint: [0xffe0a0, 0xff9a40],
          blendMode: Phaser.BlendModes.ADD,
          frequency: 140,
        })
        .setDepth(forge.y + 20);

    spots.slice(0, 4).forEach((p, i) => {
      const img = this.add.image(p.x, p.y, 'ln-town', `villager${i}`);
      this.walkers.push({ ...p, img, path: [], wait: rnd(0, 3), speed: 34, chicken: false });
    });
    for (let i = 0; coop && i < 5; i++) {
      const x = rnd(coop.x0 + 0.5, coop.x1 + 0.5) * T;
      const y = rnd(coop.y0 + 0.5, coop.y1 + 0.5) * T;
      const img = this.add.image(x, y, 'ln-town', i % 2 ? 'chicken2' : 'chicken');
      this.walkers.push({ x, y, img, path: [], wait: rnd(0, 2), speed: 26, chicken: true });
    }
  }

  private updateTownLife(dt: number): void {
    const h = this.hero;
    for (const { img, area } of this.roofs) {
      const target = area.contains(h.x, h.y) ? 0 : 1;
      img.setAlpha(img.alpha + (target - img.alpha) * Math.min(1, dt * 6));
    }
    // The sails turn slowly and thin out while you're inside, like the roof.
    for (const { img, room } of this.sails) {
      img.rotation += dt * 0.35;
      img.setAlpha(0.2 + 0.8 * (this.roofs[room]?.img.alpha ?? 1));
    }
    const { spots, coop } = this.world.life;
    for (const w of this.walkers) {
      if (w.wait > 0) {
        w.wait -= dt;
        // Hens peck while they wait.
        if (w.chicken)
          w.img.setScale(1, 1 + Math.max(0, Math.sin(this.time.now / 90 + w.x)) * 0.12);
      } else if (!w.path.length) {
        const to =
          w.chicken && coop
            ? { x: rnd(coop.x0 + 0.3, coop.x1 + 0.7) * T, y: rnd(coop.y0 + 0.3, coop.y1 + 0.7) * T }
            : (spots[Math.floor(Math.random() * spots.length)] as Pt);
        w.path = w.chicken ? [to] : this.nav.route(w, to, 8);
        if (!w.path.length) w.wait = 1;
      } else {
        const t = w.path[0] as Pt;
        const dx = t.x - w.x;
        const dy = t.y - w.y;
        const d = Math.hypot(dx, dy);
        if (d < 3) {
          w.path.shift();
          if (!w.path.length) w.wait = w.chicken ? rnd(0.6, 2.5) : rnd(2, 7);
        } else {
          const s = Math.min(d, w.speed * dt);
          const bx = w.x;
          const by = w.y;
          this.nav.move(w, (dx / d) * s, (dy / d) * s, w.chicken ? 4 : 8);
          if (w.x === bx && w.y === by) w.path = [];
          w.img.setRotation(Math.atan2(dy, dx));
          const bob = Math.sin(this.time.now / (w.chicken ? 50 : 110)) * 0.05;
          w.img.setScale(1 + bob, 1 - bob);
        }
      }
      w.img.setPosition(w.x, w.y).setDepth(w.y + 4);
    }
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
    const up = this.realm === 'upper';
    for (let i = 0; i < (up ? 30 : 60); i++) {
      const m = this.add
        .image(
          this.world.spawn.x + rnd(-800, 800),
          this.world.spawn.y + rnd(-600, 600),
          'ln-atlas',
          'dot',
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(up ? (i % 2 ? 0xfff6c0 : 0xd8f080) : i % 3 ? 0x9fd8e6 : 0xffc27a)
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
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,T,E,ESC') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    kb.on('keydown-ESC', () => this.scene.start('menu'));
    kb.on('keydown-E', () => this.inReach()?.use());
  }

  private goTo(pointer: Phaser.Input.Pointer): void {
    this.lastGo = this.time.now;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.heading = this.targets.find((p) => Math.hypot(p.x - wp.x, p.y - wp.y) < 36) ?? null;
    this.hero.path = this.nav.route(this.hero, wp, HERO_R);
    const end = this.hero.path[this.hero.path.length - 1] ?? wp;
    this.markerAt = { x: end.x, y: end.y, t: 0.6 };
  }

  // --- Frame -------------------------------------------------------------------------

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const prev = this.hour();
    if (this.demo) this.drift();
    else this.tod = (this.tod + (dt * (this.keys.T?.isDown ? FAST : 1)) / DAY_LEN) % 1;
    if (prev < 6 && this.hour() >= 6) this.day++;

    this.moveHero(dt);
    this.checkTargets();
    this.sinceSave += dt;
    if (this.sinceSave > AUTOSAVE) this.save();
    this.updateTownLife(dt);
    this.cull();
    this.drawMarker(dt);
    this.updateLighting(dt);
    this.hud?.update(this.day, this.hour(), this.night());
  }

  // --- Using things ------------------------------------------------------------------

  /** The mirrors, and the things you can switch on and off. */
  private buildTargets(): void {
    this.targets = this.world.portals.map((p) => ({
      ...p,
      label: () => p.label,
      use: () => this.travel(p),
    }));
    for (const t of this.world.things) {
      const img = this.chunked(
        this.add
          .image(t.x, t.y, t.key, this.thingsOn.has(t.id) ? t.frameOn : t.frame)
          .setDepth(t.depth ?? t.y + 4),
      );
      this.thingImgs.set(t.id, img);
      this.targets.push({
        x: t.x,
        y: t.y,
        label: () => t.labels[this.thingsOn.has(t.id) ? 1 : 0],
        use: () => this.toggle(t),
      });
    }
  }

  private toggle(t: Thing): void {
    if (this.thingsOn.has(t.id)) this.thingsOn.delete(t.id);
    else this.thingsOn.add(t.id);
    this.thingImgs.get(t.id)?.setFrame(this.thingsOn.has(t.id) ? t.frameOn : t.frame);
    this.save();
  }

  /** The nearest thing within reach, if any. */
  private inReach(): Target | null {
    if (this.demo || this.leaving) return null;
    const h = this.hero;
    let best: Target | null = null;
    let bd = REACH;
    for (const t of this.targets) {
      const d = Math.hypot(t.x - h.x, t.y - h.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private checkTargets(): void {
    const near = this.inReach();
    this.hud?.prompt(near ? `E · ${near.label()}` : null);
    if (near && this.heading === near) {
      this.heading = null;
      near.use();
    }
  }

  /** Remembers where you are; the menu's Continue picks up from here. */
  private save(): void {
    this.sinceSave = 0;
    if (this.demo || this.leaving) return;
    writeSave({
      realm: this.realm,
      x: Math.round(this.hero.x),
      y: Math.round(this.hero.y),
      tod: this.tod,
      day: this.day,
      things: [...this.thingsOn],
    });
  }

  // --- Between the worlds ------------------------------------------------------------

  /** A flash of the Mirror's light, and you come up through the other mirror. */
  private travel(p: Portal): void {
    if (this.leaving) return;
    this.leaving = true;
    this.heading = null;
    this.hero.path = [];
    this.hud?.prompt(null);
    const cam = this.cameras.main;
    cam.fadeOut(700, ...GLINT);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const next: LanternData = {
        realm: p.to,
        at: p.exit,
        tod: this.tod,
        day: this.day,
        things: [...this.thingsOn],
        via: true,
      };
      this.scene.restart(next);
    });
  }

  /** The menu backdrop: a slow loop over the square and the rooftops. */
  private drift(): void {
    const t = this.time.now / 1000;
    const { x, y } = this.world.wick ?? this.world.spawn;
    this.cameras.main.centerOn(x + Math.cos(t * 0.06) * 220, y + Math.sin(t * 0.09) * 130);
  }

  private moveHero(dt: number): void {
    const h = this.hero;
    const k = this.keys;
    const down = (...names: string[]) => names.some((n) => k[n]?.isDown);
    const kx = (down('D', 'RIGHT') ? 1 : 0) - (down('A', 'LEFT') ? 1 : 0);
    const ky = (down('S', 'DOWN') ? 1 : 0) - (down('W', 'UP') ? 1 : 0);
    let mx = 0;
    let my = 0;
    if (this.leaving) {
      // Standing still while the light takes you.
    } else if (kx || ky) {
      h.path = [];
      this.heading = null;
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
    const dusk = n > 0 && n < 1 ? Math.sin(n * Math.PI) : 0;
    let alpha: number;
    let r: number;
    let g: number;
    let b: number;
    if (this.realm === 'upper') {
      // An ordinary sky: clear by day, a golden-pink dusk, a deep blue night.
      alpha = lerp(0, 0.78, n) + dusk * 0.12;
      r = Math.round(lerp(lerp(40, 6, n), 90, dusk * 0.6));
      g = Math.round(lerp(lerp(40, 12, n), 44, dusk * 0.6));
      b = Math.round(lerp(lerp(60, 34, n), 40, dusk * 0.6));
    } else {
      // The Lower World never gets truly bright; dusk and dawn go crimson-violet.
      alpha = lerp(0.16, 0.92, n);
      r = Math.round(lerp(lerp(30, 5, n), 52, dusk * 0.5));
      g = Math.round(lerp(lerp(24, 6, n), 18, dusk * 0.5));
      b = Math.round(lerp(lerp(22, 12, n), 34, dusk * 0.5));
    }
    this.dark.clear();
    this.dark.fill((r << 16) | (g << 8) | b, alpha);
    if (this.realm === 'upper') for (const glow of this.glows) glow.setAlpha(0.35 * n);

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
      if (l.thing && !this.thingsOn.has(l.thing)) continue;
      const room = l.room === undefined ? 1 : 1 - (this.roofs[l.room]?.img.alpha ?? 1);
      if (room > 0.02) cut(l.x, l.y, l.radius * f, 0.95 * room);
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
