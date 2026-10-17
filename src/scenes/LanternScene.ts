import * as Phaser from 'phaser';
import { music } from '../audio/AmbientMusic';
import { fill, t } from '../i18n';
import { createLanternTextures } from '../lantern/art';
import { groundBox, paintGround, paintWalls, wallsBox } from '../lantern/ground-art';
import { generateCellar } from '../lantern/cellar';
import { ROOF_PAD, paintRoofs, roofKey } from '../lantern/town-art';
import { Nav } from '../lantern/nav';
import { generateUpperWorld } from '../lantern/upper';
import { writeSave } from '../lantern/save';
import { generateWorld, type Portal, type Realm, type World } from '../lantern/world';
import { DAY_LEN, T, TL, clamp, lerp, rnd, type Pt } from '../lantern/util';
import { HERO_HP, HERO_SKILLS, PISTOL, SPARE_ROUNDS, type Ammo } from '../lantern/combat';
import { ITEMS, itemWords, type Fact } from '../lantern/items';
import { Memory, type Hoard } from '../lantern/memory';
import { paper as findPaper } from '../lantern/papers';
import { Inventory, type BagItem } from '../ui/Inventory';
import { LanternHud } from '../ui/LanternHud';
import { Reader } from '../ui/Reader';
import { Combat } from './Combat';
import { Tracks } from './Tracks';
import { openMailbox } from '../ui/mailbox';

const DEPTH_DARK = 100_000;
const DEPTH_ABOVE_DARK = 100_001;
/** Tree crowns hang over everything on the ground, under the roofs. */
const DEPTH_CROWN = 49_500;
/** How far a crown reaches at scale 1, and how thin it gets while you're under it. */
const CROWN_R = 60;
const CROWN_UNDER = 0.3;
const HERO_R = 10;
/** Ground tiles that are floors. */
const FLOORS = new Set<number>([
  TL.FLOOR,
  TL.PLANK,
  TL.PLANK2,
  TL.PARQUET,
  TL.CHECKER,
  TL.CARPET,
  TL.TILEW,
]);
const SPEED = 140;
const LIGHT_R = 150;
/** How much faster time runs while T is held. */
const FAST = 24;
/** Objects are shown and hidden in square chunks of this many pixels. */
const CHUNK = 10 * T;
/** How close you must stand to something to use it. */
const REACH = 1.4 * T;
/** How near something must be, in plain sight, to be haloed: E then walks you to it. */
const NOTICE = 3.2 * T;
/** Seconds into a new game before the hero notices Victor's car. */
const FIRST_THOUGHT = 2.5;
/** The cold light that clings to whoever has been to the other side. */
const TRAIL_GLOW = 0x7cd4ff;
/** How bright a glowing footprint must be before the hero takes it in. */
const TRAIL_SEEN = 0.45;
/** Seconds after a thought before the hero has a second one, if he's still stuck. */
const NUDGE_AFTER = 100;
/** Seconds between autosaves. */
const AUTOSAVE = 5;
/** The halo around whatever you can use right here. */
const HALO = 0xfff2c4;
/** The Mirror's cold glint, for the flash between the worlds. */
const GLINT: [number, number, number] = [159, 216, 230];
const DUSK: [number, number, number] = [13, 10, 8];
/** What each world is called in the HUD, and its backdrop colour. */
const PLACES: Record<Realm, { bg: string }> = {
  lower: { bg: '#0d0a08' },
  upper: { bg: '#2c3a1e' },
  cellar: { bg: '#060507' },
};

/** What the scene is started with: which world, and where and when you arrive. */
export interface LanternData {
  demo?: boolean;
  realm?: Realm;
  at?: Pt;
  tod?: number;
  day?: number;
  /** Things that are switched on. */
  things?: string[];
  /** What you carry. */
  items?: string[];
  /** What the hero knows and has seen. */
  known?: string[];
  /** Rounds in the pistol and spare. */
  ammo?: [number, number];
  /** How you arrived: through a mirror, or down or up the stairs. */
  via?: Portal['fade'];
  /** A new game, just after the intro: show the controls. */
  fresh?: boolean;
}

const chunkOf = (p: Pt) => `${Math.floor(p.x / CHUNK)},${Math.floor(p.y / CHUNK)}`;

/** Something you can use where you stand: a mirror, a switch. */
interface Target extends Pt {
  /** Its picture, outlined by the halo; without one the halo is a pool of light. */
  img?: Phaser.GameObjects.Image;
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
 * mirror in the cellar under Victor's shed leads from one to the other.
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
  /** Footprints behind the hero and the enemies; none in the cellar. */
  private tracks?: Tracks;
  private roofs: { img: Phaser.GameObjects.Image; area: Phaser.Geom.Rectangle }[] = [];
  private sails: { img: Phaser.GameObjects.Image; room: number }[] = [];
  /** Tree crowns, and how far each reaches. */
  private crowns: { img: Phaser.GameObjects.Image; r: number }[] = [];
  /** Glows under the outdoor lights; in the Upper World they only show after dark. */
  private glows: Phaser.GameObjects.Image[] = [];
  /** Mirrors and things you can use. */
  private targets: Target[] = [];
  /** What is in reach and haloed: only ever one, however many things there are. */
  private halo: Target | null = null;
  private haloGlow?: Phaser.Filters.Glow;
  private haloPool!: Phaser.GameObjects.Image;
  /** What you are using right now, while it shows a dialog. */
  private using: Target | null = null;
  /** What E sent you walking to, to use once you're there. */
  private pending: Target | null = null;
  /** Glints on drawers that still hold something worth a look, and on papers not yet read. */
  private glints: { img: Phaser.GameObjects.Image; worth: () => boolean }[] = [];
  /** Glowing footprints, and how much of each a roof hides (the shed's). */
  private trail: { img: Phaser.GameObjects.Image; room: number }[] = [];
  /** Notes, letters and books, held up to read. */
  private reader?: Reader;
  /** How long the hero has known each fact this visit without finding what it calls for. */
  private stuck = new Map<Fact, number>();
  /** Whether the hero walked this frame: time only passes while he does. */
  private moving = false;
  /** What the things that don't just switch on and off do, by id. */
  private readonly uses: Record<string, () => void> = {
    mailbox: () =>
      this.hud &&
      openMailbox(
        this.hud.dialog,
        () => (this.using = null),
        () => this.readPaper('bookshop-letter'),
      ),
    ammo: () => {
      this.using = null;
      this.combat?.refill();
    },
  };
  private thingsOn = new Set<string>();
  /** What you carry: the flashlight, once you've found it. */
  private items = new Set<string>();
  /** What the hero knows, and what he saw and left. */
  private memory = new Memory();
  /** The pistol's rounds, carried between the worlds. */
  private ammo: Ammo = { mag: PISTOL.mag, spare: SPARE_ROUNDS };
  private bag?: Inventory;
  /** The pictures of things, for the bag, painted once. */
  private icons = new Map<string, string>();
  private leaving = false;
  private sinceSave = 0;
  private walkers: Walker[] = [];
  /** The fight, where there are enemies about. */
  private combat?: Combat;
  /** How dark it is this frame, 0…1. */
  private darkness = 0;
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
    this.world =
      this.realm === 'upper'
        ? generateUpperWorld()
        : this.realm === 'cellar'
          ? generateCellar()
          : generateWorld();
    this.nav = new Nav(this.world.block, this.world.w, this.world.h, this.world.walls);
    this.chunks.clear();
    this.visible.clear();
    this.cullKey = '';
    this.erasers = [];
    this.motes = [];
    this.roofs = [];
    this.sails = [];
    this.crowns = [];
    this.glows = [];
    this.walkers = [];
    this.combat = undefined;
    this.keys = {};
    this.halo = null;
    this.haloGlow = undefined;
    this.using = null;
    this.pending = null;
    this.glints = [];
    this.trail = [];
    this.stuck.clear();
    this.moving = false;
    this.thingsOn = new Set(this.start.things ?? []);
    // The menu's backdrop wanders with a light; a new game starts empty-handed.
    this.items = new Set(this.start.items ?? (this.demo ? ['flashlight'] : []));
    this.memory = new Memory(this.start.known);
    const [mag, spare] = this.start.ammo ?? [PISTOL.mag, SPARE_ROUNDS];
    this.ammo = { mag, spare };
    this.leaving = false;
    this.sinceSave = 0;
    this.holding = false;
    this.markerAt = null;
    this.tod = this.start.tod ?? 10.5 / 24;
    this.day = this.start.day ?? 1;
    createLanternTextures(this);
    if (!this.demo) music.setMood(this.realm === 'upper' ? 'upper' : 'lower');

    this.buildGround();
    this.tracks = this.realm === 'cellar' ? undefined : new Tracks(this, (p) => this.indoors(p));
    this.buildObjects();
    this.buildTargets();
    // A saved spot that is no longer free (the world changed) falls back to the start.
    const want = this.start.at;
    const at = want && this.nav.circleFree(want.x, want.y, HERO_R) ? want : this.world.spawn;
    this.hero = { ...at, facing: Math.PI / 2, path: [], walk: 0 };
    this.heroImg = this.add.image(this.hero.x, this.hero.y, 'ln-atlas', this.heroFrame());
    this.marker = this.add.graphics().setDepth(DEPTH_DARK - 1);
    this.buildTownLife();
    this.buildTrail();
    this.buildFoes();
    this.buildDarkness();
    this.buildMotes();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.w * T, this.world.h * T);
    cam.setBackgroundColor(PLACES[this.realm].bg);
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
      this.hud = new LanternHud(
        () => this.scene.start('menu'),
        t().places[this.realm],
        () => this.bag?.toggle(),
      );
      this.bag = new Inventory();
      this.reader = new Reader();
      if (this.start.fresh) {
        this.hud.controls();
        // Just out of the car, the first thing he sees: Victor never drove off.
        this.time.delayedCall(FIRST_THOUGHT * 1000, () => this.hud?.think(t().thoughts.carStill));
      }
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
      this.bag?.destroy();
      this.bag = undefined;
      this.reader?.destroy();
      this.reader = undefined;
      this.combat?.destroy();
      this.textures.remove('ln-dark');
    });
    this.cull(true);
    if (this.start.via === 'glint') cam.fadeIn(1100, ...GLINT);
    else cam.fadeIn(800, ...DUSK);
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
    // Roads, paths and floors painted over the ground; thin walls and
    // fences on top. Each texture covers only the area it needs.
    const { patches, walls } = this.world;
    if (patches.length) {
      const key = `ln-ground-${this.realm}`;
      const box = groundBox(patches);
      paintGround(this, key, patches);
      this.add.image(box.x, box.y, key).setOrigin(0).setDepth(-97);
    }
    if (walls.length) {
      const key = `ln-walls-${this.realm}`;
      const box = wallsBox(walls);
      paintWalls(this, key, walls);
      this.add.image(box.x, box.y, key).setOrigin(0).setDepth(-30);
    }
  }

  /** Registers an image in its chunk; only chunks near the camera are shown. */
  private chunked(img: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    const k = chunkOf(img);
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
    for (const o of this.world.crowns ?? []) {
      const img = this.add
        .image(o.x, o.y, o.key ?? 'ln-trees', o.frame)
        .setDepth(DEPTH_CROWN)
        .setAngle(o.angle ?? 0)
        .setScale(o.scale ?? 1, Math.abs(o.scale ?? 1));
      this.crowns.push({ img: this.chunked(img), r: CROWN_R * Math.abs(o.scale ?? 1) });
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
    // A crown thins out while you walk under it, so you never lose the hero.
    for (const { img, r } of this.crowns) {
      if (!img.visible) continue;
      const target = Math.hypot(img.x - h.x, img.y - h.y) < r + HERO_R ? CROWN_UNDER : 1;
      img.setAlpha(img.alpha + (target - img.alpha) * Math.min(1, dt * 5));
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

  /** Victor's glowing footprints: unseen until the beam falls on them after dark. */
  private buildTrail(): void {
    for (const p of this.world.trail ?? []) {
      const img = this.add
        .image(p.x, p.y, 'ln-up', 'printGlow')
        .setRotation(p.angle)
        .setFlipY(p.left)
        .setTint(TRAIL_GLOW)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH_ABOVE_DARK)
        .setAlpha(0);
      // Inside the shed they hide under its roof until you walk in.
      const room = this.roofs.findIndex((r) => r.area.contains(p.x, p.y));
      this.trail.push({ img, room });
    }
  }

  /**
   * Lights up the footprints the beam falls on, once it is dark enough to
   * see them glow. The first time, the hero takes them in.
   */
  private updateTrail(): void {
    if (!this.trail.length) return;
    const dark = clamp((this.darkness - 0.3) / 0.35, 0, 1);
    const t = this.time.now / 1000;
    let seen = false;
    for (const { img, room } of this.trail) {
      const roof = room < 0 ? 0 : (this.roofs[room]?.img.alpha ?? 0);
      const b = dark ? dark * this.beam(img) * (1 - roof) : 0;
      img.setAlpha(b * (0.8 + 0.15 * Math.sin(t * 2.2 + img.x * 0.05)));
      if (b > TRAIL_SEEN) seen = true;
    }
    if (seen && !this.demo && !this.memory.knows('trail')) this.learn('trail');
  }

  /** The enemies, if this world has any; none behind the menu. */
  private buildFoes(): void {
    const foes = this.world.foes;
    if (this.demo || !foes?.length) return;
    this.combat = new Combat(
      {
        scene: this,
        nav: this.nav,
        hero: this.hero,
        heroR: HERO_R,
        ammo: this.ammo,
        above: DEPTH_ABOVE_DARK,
        armed: () => this.items.has('pistol'),
        dark: (p) => this.darkAt(p),
        inBeam: (p) => this.inBeam(p),
        safe: (p) =>
          this.world.town[Math.floor(p.y / T) * this.world.w + Math.floor(p.x / T)] === 1,
        fall: () => this.fall(),
        tracks: this.tracks,
      },
      foes,
      true,
    );
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
    if (this.realm === 'cellar') return;
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
    kb.on('keydown-E', () => this.act());
    kb.on('keydown-F', () => this.combat?.setStance('fight'));
    kb.on('keydown-R', () => this.combat?.setStance('fallback'));
    kb.on('keydown-I', () => this.bag?.toggle());
  }

  private goTo(pointer: Phaser.Input.Pointer): void {
    this.lastGo = this.time.now;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    // Clicking an enemy goes for it; clicking anywhere else walks there.
    const foe = this.combat?.foeAt(wp);
    if (foe) {
      this.combat?.attack(foe);
      this.hero.path = [];
      return;
    }
    // Clicking a thing only walks you to it: you use it with E.
    this.combat?.release();
    this.pending = null;
    this.hero.path = this.nav.route(this.hero, wp, HERO_R);
    const end = this.hero.path[this.hero.path.length - 1] ?? wp;
    this.markerAt = { x: end.x, y: end.y, t: 0.6 };
  }

  // --- Frame -------------------------------------------------------------------------

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const prev = this.hour();
    // Time passes while you walk, or while you hold T; standing still, it waits.
    if (this.demo) this.drift();
    else {
      const rate = this.keys.T?.isDown ? FAST : this.moving ? 1 : 0;
      this.tod = (this.tod + (dt * rate) / DAY_LEN) % 1;
    }
    if (prev < 6 && this.hour() >= 6) this.day++;

    this.moveHero(dt);
    this.combat?.update(dt);
    this.tracks?.update(dt);
    this.checkTargets();
    // Sundown on the first evening, or the dark below, tells the hero he needs a light.
    if (
      !this.demo &&
      !this.memory.knows('dark') &&
      (this.realm === 'cellar' || this.night() > 0.25)
    )
      this.learn('dark');
    this.nudge(dt);
    this.sinceSave += dt;
    if (this.sinceSave > AUTOSAVE) this.save();
    this.updateTownLife(dt);
    this.cull();
    this.drawMarker(dt);
    this.updateLighting(dt);
    this.updateTrail();
    this.hud?.update(this.day, this.hour(), this.night());
    if (this.bag?.open) {
      this.bag.show(this.bagView());
      this.hud?.seenBag();
    }
  }

  // --- Using things ------------------------------------------------------------------

  /** The mirrors, and the things you can use. */
  private buildTargets(): void {
    this.targets = this.world.portals.map((p) => ({
      ...p,
      label: () => p.label,
      use: () => this.tryWay(p),
    }));
    for (const t of this.world.things) {
      if (t.take && this.items.has(t.id)) continue;
      // How it looks and what it says now: switched on, or as it is.
      const now = () => (t.on && this.thingsOn.has(t.id) ? t.on : t);
      const img = this.chunked(
        this.add
          .image(t.x, t.y, t.key, now().frame)
          .setDepth(t.depth ?? t.y + 4)
          .setScale(t.scale ?? 1)
          .setAngle(t.angle ?? 0),
      );
      const { hoard, read, says } = t;
      // A twinkle on a drawer worth a look, or a paper you haven't read.
      const worth = hoard?.items.length
        ? () => this.memory.worthLooking(hoard, this.items)
        : read
          ? () => !this.memory.hasRead(read)
          : null;
      if (worth) {
        const glint = this.add
          .image(t.x + 6, t.y - 6, 'ln-up', 'glint')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth((t.depth ?? t.y + 4) + 1);
        this.glints.push({ img: glint, worth });
      }
      this.targets.push({
        x: t.x,
        y: t.y,
        img,
        label: () => now().label,
        use: () =>
          t.on
            ? this.toggle(t.id, () => img.setFrame(now().frame))
            : t.take
              ? this.take(t.id, img)
              : hoard
                ? this.look(hoard)
                : read
                  ? this.readPaper(read)
                  : says
                    ? this.hud?.think(says)
                    : this.useThing(t.id),
      });
    }
    this.haloPool = this.add
      .image(0, 0, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(HALO)
      .setScale(90 / 256)
      .setVisible(false);
  }

  private toggle(id: string, redraw: () => void): void {
    if (this.thingsOn.has(id)) this.thingsOn.delete(id);
    else this.thingsOn.add(id);
    music.sfx('switch');
    redraw();
    this.save();
  }

  /** Into your pockets: gone from the world, and the hero carries it. */
  private take(id: string, img: Phaser.GameObjects.Image): void {
    this.items.add(id);
    music.sfx('pickup');
    this.gained([id]);
    this.setHalo(null);
    this.targets = this.targets.filter((t) => t.img !== img);
    const chunk = this.chunks.get(chunkOf(img));
    chunk?.splice(chunk.indexOf(img), 1);
    img.destroy();
    this.heroImg.setFrame(this.heroFrame());
    this.save();
  }

  /** Through a drawer: takes what seems worth it, and says what else is there. */
  private look(hoard: Hoard): void {
    const { take, says } = this.memory.search(hoard, this.items);
    for (const id of take) this.items.add(id);
    music.sfx('drawer');
    if (take.length) this.time.delayedCall(380, () => music.sfx('pickup'));
    this.hud?.think(says);
    this.gained(take);
    this.heroImg.setFrame(this.heroFrame());
    this.save();
  }

  /**
   * Holds a paper up to read. The hero stops where he is; once he puts it
   * down the first time, he may think something of it.
   */
  private readPaper(id: string): void {
    const paper = findPaper(id);
    if (!paper || !this.reader) return;
    this.hero.path = [];
    this.pending = null;
    this.input.keyboard?.resetKeys();
    const first = this.memory.read(id);
    music.sfx('paper');
    this.save();
    this.reader.show(paper, () => {
      this.input.keyboard?.resetKeys();
      if (first && paper.after) this.hud?.think(paper.after);
    });
  }

  /** Learns something; the first time, the hero thinks about it. */
  private learn(fact: Fact): void {
    const thought = this.memory.learn(fact, this.items);
    if (thought) this.hud?.think(thought);
    this.save();
  }

  /** Shows what just went into the bag, flying up to it. */
  private gained(ids: string[]): void {
    const got = ids.flatMap((id) => {
      const it = ITEMS[id];
      const words = itemWords(id);
      return it && words ? [{ name: words.name, icon: this.icon(...it.icon) }] : [];
    });
    if (got.length) this.hud?.gained(got);
  }

  /**
   * A second thought, if the hero has long known he needs something and
   * still hasn't found it: where to look. Only up in the Upper World, where
   * Victor's house is.
   */
  private nudge(dt: number): void {
    if (this.demo || this.leaving || this.realm !== 'upper') return;
    for (const [fact, nudge] of Object.entries(t().thoughts.nudges) as [Fact, string][]) {
      const waited = this.stuck.get(fact) ?? 0;
      if (waited < 0 || !this.memory.knows(fact) || !this.memory.lacks(fact, this.items)) continue;
      if (waited + dt < NUDGE_AFTER) {
        this.stuck.set(fact, waited + dt);
        continue;
      }
      // Once a visit is enough.
      this.stuck.set(fact, -1);
      this.hud?.think(nudge);
    }
  }

  /** Through, unless it is locked and you have no key. */
  private tryWay(p: Portal): void {
    const lock = p.lock;
    if (!lock || this.items.has(lock.key)) return this.travel(p);
    music.sfx('locked');
    if (!this.memory.knows(lock.fact)) this.learn(lock.fact);
    else this.hud?.think(lock.says);
  }

  /** Under a roof or on a floor, where feet leave no prints. */
  private indoors(p: Pt): boolean {
    if (this.roofs.some((r) => r.area.contains(p.x, p.y))) return true;
    const g = this.world.ground[Math.floor(p.y / T) * this.world.w + Math.floor(p.x / T)];
    return g !== undefined && FLOORS.has(g);
  }

  private heroFrame(): string {
    const gun = this.combat?.drawn() ? 'Gun' : '';
    return this.items.has('flashlight') ? `heroLit${gun}` : `hero${gun}`;
  }

  /** What the bag shows: what you carry, and how you are. */
  private bagView() {
    const icon = this.icon.bind(this);
    const items: BagItem[] = [];
    for (const id of this.items) {
      const it = ITEMS[id];
      const words = itemWords(id);
      if (it && words) items.push({ name: words.name, about: words.about, icon: icon(...it.icon) });
    }
    if (this.items.has('pistol')) {
      const w = t().bag;
      items.push({
        name: w.rounds,
        about: w.roundsAbout,
        note: fill(w.roundsNote, { mag: this.ammo.mag, spare: this.ammo.spare }),
        icon: icon('ln-foes', 'ammo'),
      });
    }
    return { items, hp: this.combat?.hp ?? HERO_HP, maxHp: HERO_HP, skills: HERO_SKILLS };
  }

  /** A thing's picture as a data URL, painted once. */
  private icon(key: string, frame: string): string | undefined {
    const k = `${key}/${frame}`;
    if (!this.icons.has(k)) this.icons.set(k, this.textures.getBase64(key, frame));
    return this.icons.get(k);
  }

  private useThing(id: string): void {
    const use = this.uses[id];
    if (!use) return;
    this.using = this.halo;
    this.hero.path = [];
    this.input.keyboard?.resetKeys();
    use();
  }

  /**
   * Moves the halo to what is in reach: a glow around its outline (one
   * filter, on one image at a time), or a pool of light where it has no
   * picture of its own, like a hatch.
   */
  private setHalo(t: Target | null): void {
    if (t === this.halo) return;
    if (this.haloGlow) this.halo?.img?.filters?.internal.remove(this.haloGlow, true);
    this.haloGlow = undefined;
    this.halo = t;
    if (t?.img)
      this.haloGlow = t.img.enableFilters().filters?.internal.addGlow(HALO, 4, 0, 1, false, 10, 10);
    this.haloPool.setVisible(!!t && !t.img);
    if (t) this.haloPool.setPosition(t.x, t.y).setDepth(t.y + 5);
  }

  /**
   * The nearest thing you can use from here, if any: in reach, or a few
   * steps away with no wall between.
   */
  private noticed(): Target | null {
    if (this.demo || this.leaving) return null;
    const h = this.hero;
    let best: Target | null = null;
    let bd = NOTICE;
    for (const t of this.targets) {
      const d = Math.hypot(t.x - h.x, t.y - h.y);
      if (d < bd && (d < REACH || !this.nav.wallBetween(h, t))) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private inReach(t: Target): boolean {
    return Math.hypot(t.x - this.hero.x, t.y - this.hero.y) < REACH;
  }

  /** E: uses what is haloed, walking over to it first if it is a few steps away. */
  private act(): void {
    if (this.reader?.open) return;
    const t = this.noticed();
    if (!t) return;
    if (this.inReach(t)) return t.use();
    this.combat?.release();
    this.hero.path = this.nav.route(this.hero, t, HERO_R);
    this.pending = t;
  }

  private checkTargets(): void {
    // Arrived where E sent you: use it; stopped short of it: give up.
    const p = this.pending;
    if (p && this.inReach(p)) {
      this.pending = null;
      this.hero.path = [];
      p.use();
    } else if (p && (!this.hero.path.length || !this.targets.includes(p))) this.pending = null;
    const near = this.noticed();
    // Walking away from the mailbox closes it.
    if (this.using && near !== this.using) this.hud?.dialog.close();
    this.setHalo(near);
    const pulse = Math.sin(this.time.now / 260);
    if (this.haloGlow) this.haloGlow.outerStrength = 4 + pulse * 1.5;
    this.haloPool.setAlpha(0.45 + pulse * 0.15);
    this.hud?.prompt(near && !this.reader?.open ? fill(t().hud.use, { what: near.label() }) : null);
    // A twinkle on a drawer with something in it still worth having.
    const sec = this.time.now / 1000;
    for (const g of this.glints) {
      const on = !this.demo && g.worth();
      g.img.setVisible(on);
      if (on)
        g.img
          .setAlpha(0.35 + 0.45 * Math.max(0, Math.sin(sec * 2.4)))
          .setScale(0.6 + 0.25 * Math.sin(sec * 1.2));
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
      items: [...this.items],
      known: this.memory.list,
      ammo: [this.ammo.mag, this.ammo.spare],
    });
  }

  // --- Between the worlds ------------------------------------------------------------

  /** A flash of the Mirror's light, or a fade on the stairs, and you're through. */
  private travel(p: Portal): void {
    if (this.leaving) return;
    this.leaving = true;
    this.hero.path = [];
    this.setHalo(null);
    this.hud?.prompt(null);
    music.sfx(p.fade === 'glint' ? 'mirror' : 'steps');
    const cam = this.cameras.main;
    cam.fadeOut(700, ...(p.fade === 'glint' ? GLINT : DUSK));
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const next: LanternData = {
        realm: p.to,
        at: p.exit,
        tod: this.tod,
        day: this.day,
        things: [...this.thingsOn],
        items: [...this.items],
        known: this.memory.list,
        ammo: [this.ammo.mag, this.ammo.spare],
        via: p.fade,
      };
      this.scene.restart(next);
    });
  }

  /** Down in a fight: the dark takes you, and you come to by the Wick. */
  private fall(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.hero.path = [];
    this.setHalo(null);
    this.hud?.prompt(null);
    const cam = this.cameras.main;
    cam.fadeOut(1800, 40, 6, 4);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({
        realm: this.realm,
        at: this.world.spawn,
        tod: this.tod,
        day: this.day,
        things: [...this.thingsOn],
        items: [...this.items],
        known: this.memory.list,
        ammo: [this.ammo.mag, this.ammo.spare],
        via: 'dark',
      } satisfies LanternData);
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
    // Where the player steers, and how far there is left to go.
    let want: Pt | null = null;
    let left = Infinity;
    if (this.leaving) {
      // Standing still while the light takes you.
    } else if (kx || ky) {
      h.path = [];
      this.pending = null;
      const l = Math.hypot(kx, ky);
      want = { x: kx / l, y: ky / l };
    } else if (h.path.length) {
      const t = h.path[0] as Pt;
      const dx = t.x - h.x;
      const dy = t.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) h.path.shift();
      else {
        want = { x: dx / d, y: dy / d };
        left = d;
      }
    }
    // In a fight you face the enemy and back away slowly, or it moves you itself.
    const steer = this.leaving ? null : this.combat?.steer(want);
    const dir = steer ? steer.dir : want;
    const s = Math.min(left, (steer ? steer.speed : SPEED) * dt);
    const mx = dir ? dir.x * s : 0;
    const my = dir ? dir.y * s : 0;
    const bx = h.x;
    const by = h.y;
    if (mx || my) {
      this.nav.move(h, mx, my, HERO_R);
      h.walk += dt * 10;
    }
    this.moving = h.x !== bx || h.y !== by;
    this.tracks?.follow(h, 'hero');
    // Turn smoothly towards the walking direction, or the enemy.
    const face = steer?.face ?? (mx || my ? Math.atan2(my, mx) : null);
    if (face !== null) h.facing += Phaser.Math.Angle.Wrap(face - h.facing) * Math.min(1, dt * 12);
    // Mid-stride on one foot, then the other; a little lift on each step.
    const stride = mx || my ? Math.sin(h.walk) : 0;
    const bob = Math.abs(stride) * 0.03;
    const step = stride > 0.45 ? 'Step1' : stride < -0.45 ? 'Step2' : '';
    const frame = this.heroFrame() + step;
    if (this.heroImg.frame.name !== frame) this.heroImg.setFrame(frame);
    // A shot kicks you back a little; a wound flushes you red.
    const look = this.combat?.heroLook();
    const kick = look?.kick ?? 0;
    this.heroImg
      .setPosition(h.x - Math.cos(h.facing) * kick, h.y - Math.sin(h.facing) * kick)
      .setRotation(h.facing)
      .setDepth(h.y + 6)
      .setScale(1 + bob, 1 - bob);
    if (look?.hurt) this.heroImg.setTint(0xff8a78);
    else this.heroImg.clearTint();
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

  /** The flashlight's beam, or the pool around you, is on this point. */
  private inBeam(p: Pt): boolean {
    if (!this.items.has('flashlight')) return false;
    const h = this.hero;
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    if (d < LIGHT_R * 0.6) return true;
    const off = Phaser.Math.Angle.Wrap(Math.atan2(p.y - h.y, p.x - h.x) - h.facing);
    return d < LIGHT_R * 1.7 && Math.abs(off) < 0.42;
  }

  /** How strongly the flashlight lights a point, 0…1: the pool round you and the beam ahead. */
  private beam(p: Pt): number {
    if (!this.items.has('flashlight')) return 0;
    const h = this.hero;
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    const pool = clamp(1.4 - d / (LIGHT_R * 0.5), 0, 1);
    const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(p.y - h.y, p.x - h.x) - h.facing));
    const cone =
      clamp((0.45 - off) / 0.15, 0, 1) * clamp((LIGHT_R * 1.8 - d) / (LIGHT_R * 0.5), 0, 1);
    return Math.max(pool, cone);
  }

  /** How much the dark spoils your aim at a point: none where it's lit, up to 30. */
  private darkAt(p: Pt): number {
    const h = this.hero;
    if (this.inBeam(p) || Math.hypot(p.x - h.x, p.y - h.y) < LIGHT_R * 0.35) return 0;
    for (const l of this.world.lights) {
      if (l.room !== undefined || l.thing) continue;
      if (Math.hypot(l.x - p.x, l.y - p.y) < l.radius * 0.7) return 0;
    }
    return Math.round(30 * clamp(this.darkness / 0.92, 0, 1));
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
    if (this.realm === 'cellar') {
      // Underground it is always night; candles and the lantern are all there is.
      alpha = 0.9;
      r = 10;
      g = 6;
      b = 14;
    } else if (this.realm === 'upper') {
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
    this.darkness = alpha;
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
    // The flashlight: a pool around the hero and a steady beam ahead.
    // Without it, only what your eyes make out close by.
    if (this.items.has('flashlight')) {
      cut(h.x, h.y, LIGHT_R * 0.7, 1);
      this.dark.erase(
        this.eraserCone
          .setPosition(toX(h.x), toY(h.y))
          .setRotation(h.facing)
          .setScale((LIGHT_R * 1.85 * z) / 236),
      );
    } else {
      cut(h.x, h.y, LIGHT_R * 0.45, 0.5);
    }
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
    for (const f of this.combat?.lights() ?? []) cut(f.x, f.y, f.radius, f.a);
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
