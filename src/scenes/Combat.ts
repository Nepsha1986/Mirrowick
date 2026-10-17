import * as Phaser from 'phaser';
import { music, type Sfx } from '../audio/AmbientMusic';
import {
  FISTS,
  FOES,
  HERO_HP,
  HERO_SKILLS,
  ON_THE_MOVE,
  PISTOL,
  SPARE_ROUNDS,
  aimTime,
  clearTime,
  comfortRange,
  damage,
  hitChance,
  jamChance,
  reloadTime,
  rollAttack,
  type Ammo,
  type FoeId,
  type FoeKind,
  type Weapon,
} from '../lantern/combat';
import type { FoeSpawn } from '../lantern/hollow';
import type { Nav } from '../lantern/nav';
import { T, clamp, lerp, rnd, type Pt } from '../lantern/util';
import { CombatPanel, type Stance } from '../ui/CombatPanel';

/** Backing away, still facing them; and backing away from one at your throat. */
const BACK = 58;
const PRESSED = 36;
/** Walking at them, or sideways, gun up. */
const ADVANCE = 100;
/** Turned and running. */
const RUN = 140;
/** No one hunting you within this: the fight is over. */
const CALM = 11 * T;
/** A shot wakes whatever sleeps this close. */
const ALERT = 5 * T;
/** Seconds before the dead come back, once you're away. */
const RESPAWN = 60;
const RED = '#ff8a7a';
const PALE = '#d8d0c0';

type FoeState = 'idle' | 'hunt' | 'flee' | 'home' | 'dead';
type Charge = 'ready' | 'windup' | 'run' | 'blown';

interface Foe extends Pt {
  kind: FoeKind;
  home: Pt;
  hp: number;
  state: FoeState;
  img: Phaser.GameObjects.Image;
  eyes: Phaser.GameObjects.Image[];
  facing: number;
  /** Attack cooldown, or aim for the brigand. */
  cd: number;
  /** A general timer: wandering, fleeing, lying dead, a charge's stage. */
  t: number;
  /** Ignores you while it walks home. */
  calm: number;
  path: Pt[];
  repath: number;
  walk: number;
  hurt: number;
  /** Backing off after a blow, before coming in again. */
  skip: number;
  /** The lunge of a blow, for the look of it. */
  lunge: number;
  /** The brigand's flintlock. */
  loaded: boolean;
  /** The boar's charge: its stage, heading and how far it has run. */
  charge: Charge;
  dir: number;
  ran: number;
  wander: Pt | null;
}

/** How the hero should move this frame, if the fight has a say in it. */
export interface Steer {
  dir: Pt | null;
  speed: number;
  /** Keep facing this way (radians), not the way you walk. */
  face: number | null;
}

/** What the fight needs from the scene. */
export interface CombatHost {
  scene: Phaser.Scene;
  nav: Nav;
  hero: Pt & { facing: number };
  heroR: number;
  /** The rounds you carry, kept by the scene between the worlds. */
  ammo: Ammo;
  /** A depth that draws over the darkness. */
  above: number;
  /** Carrying the pistol. */
  armed(): boolean;
  /** How much the dark spoils your aim at a point: 0 where it's lit, up to 30. */
  dark(p: Pt): number;
  /** The flashlight's beam is on this point. */
  inBeam(p: Pt): boolean;
  /** Inside the village, where wounds heal quickly. */
  safe(p: Pt): boolean;
  /** Down: the scene takes it from here. */
  fall(): void;
}

const VERB: Record<FoeId, string> = {
  wolf: 'bites',
  brigand: 'shoots',
  boar: 'gores',
  crawler: 'slashes',
  shade: 'chills',
};
const NOTICE: Record<FoeId, string> = {
  wolf: 'A wolf growls and comes for you.',
  brigand: 'The brigand draws his flintlock.',
  boar: 'The boar snorts and lowers its head.',
  crawler: 'Glass grinds on glass: the crawler stirs.',
  shade: 'Something in the dark moves towards you.',
};
const DEATH: Record<FoeId, string> = {
  wolf: 'The wolf is dead.',
  brigand: 'The brigand is dead.',
  boar: 'The boar is dead.',
  crawler: 'The crawler shatters.',
  shade: 'The shade comes apart like smoke.',
};

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x);
const unit = (dx: number, dy: number): Pt | null => {
  const d = Math.hypot(dx, dy);
  return d > 0.001 ? { x: dx / d, y: dy / d } : null;
};
const lower = (f: Foe) => f.kind.name.toLowerCase();
/** What each enemy sounds like when it notices you, and when it strikes. */
const CRY: Record<FoeId, Sfx | null> = {
  wolf: 'growl',
  brigand: 'reload',
  boar: 'snort',
  crawler: 'glass',
  shade: 'whisper',
};
const STRIKE: Record<FoeId, Sfx> = {
  wolf: 'bite',
  brigand: 'boom',
  boar: 'thud',
  crawler: 'swish',
  shade: 'swish',
};
/** How long each backs off after a blow, seconds. */
const SKIP: Record<FoeId, number> = { wolf: 0.8, brigand: 0, boar: 0.9, crawler: 0.6, shade: 0.7 };

/**
 * A real-time fight played like the old turn-based ones: you never aim. In
 * a fight the hero faces the enemy, walks up to a range their skill is
 * comfortable with, steadies the aim and fires, and every shot is a roll —
 * a hit, a miss, a crit, a fumble, or a jam that takes seconds to clear.
 * The one choice is to fight or fall back, and falling back is slow:
 * you can't turn your back on something within reach of you, only back
 * away facing it, and run once you're clear. Some enemies are faster than
 * you and will catch you anyway.
 */
export class Combat {
  hp = HERO_HP;
  stance: Stance = 'fight';
  private readonly foes: Foe[] = [];
  private target: Foe | null = null;
  /** The nearest enemy close enough that you can't turn your back on it. */
  private threat: Foe | null = null;
  private jam = 0;
  private reload = 0;
  /** Seconds spent steadying the aim; below zero while the last shot recovers. */
  private aim = 0;
  /** Moving this frame: shots are harder and the aim steadies slower. */
  private moving = false;
  /** The kick of your last shot, and the flinch of your last wound, seconds. */
  private kick = 0;
  private flinch = 0;
  /** Till the next beat of the drum that plays while something hunts you. */
  private beat = 0;
  private sinceThreat = 99;
  private sinceFight = 99;
  private down = false;
  private flashes: (Pt & { t: number })[] = [];
  private tracers: { a: Pt; b: Pt; t: number }[] = [];
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly panel?: CombatPanel;
  /** Bursts of blood, glass and smoke when something is hit. */
  private readonly bits: Record<
    'blood' | 'glass' | 'smoke',
    Phaser.GameObjects.Particles.ParticleEmitter
  >;

  constructor(
    private readonly host: CombatHost,
    spawns: FoeSpawn[],
    hud: boolean,
  ) {
    const { scene } = host;
    for (const s of spawns) {
      const kind = FOES[s.kind];
      const img = scene.add.image(s.x, s.y, 'ln-foes', kind.id);
      const eye = kind.id === 'wolf' ? 0xffc86a : kind.id === 'shade' ? 0xcfeef4 : 0;
      const eyes = eye
        ? [0, 1].map(() =>
            scene.add
              .image(0, 0, 'ln-atlas', 'dot')
              .setTint(eye)
              .setScale(0.26)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(host.above),
          )
        : [];
      this.foes.push({
        ...s,
        kind,
        home: { x: s.x, y: s.y },
        hp: kind.hp,
        state: 'idle',
        img,
        eyes,
        facing: rnd(0, Math.PI * 2),
        cd: 0,
        t: rnd(0, 4),
        calm: 0,
        path: [],
        repath: 0,
        walk: 0,
        hurt: 0,
        skip: 0,
        lunge: 0,
        loaded: true,
        charge: 'ready',
        dir: 0,
        ran: 0,
        wander: null,
      });
    }
    this.ring = scene.add.graphics().setDepth(-20);
    this.g = scene.add.graphics().setDepth(host.above);
    if (hud) this.panel = new CombatPanel((s) => this.setStance(s));
    const burst = (tint: number, add: boolean) =>
      scene.add
        .particles(0, 0, 'ln-atlas', {
          frame: 'dot',
          lifespan: { min: 220, max: 520 },
          speed: { min: 30, max: 120 },
          scale: { start: 0.55, end: 0 },
          alpha: { start: 1, end: 0 },
          tint,
          blendMode: add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
          emitting: false,
        })
        .setDepth(49_000);
    this.bits = {
      blood: burst(0x8a1a12, false),
      glass: burst(0xbfeaf4, true),
      smoke: burst(0x0c0a14, false),
    };
  }

  destroy(): void {
    this.panel?.destroy();
  }

  // --- What the scene asks ---------------------------------------------------------

  private get ammo(): Ammo {
    return this.host.ammo;
  }

  /** How the hero looks this frame: pushed back by a shot, red from a wound. */
  heroLook(): { kick: number; hurt: boolean } {
    return { kick: this.kick > 0 ? 3 : 0, hurt: this.flinch > 0 };
  }

  /** Pistol drawn: around a fight, while carrying it. */
  drawn(): boolean {
    return this.host.armed() && this.sinceFight < 4;
  }

  /** The muzzle flashes, which light the dark for a moment. */
  lights(): (Pt & { radius: number; a: number })[] {
    return this.flashes.map((f) => ({ x: f.x, y: f.y, radius: 120, a: f.t / 0.08 }));
  }

  /** A living enemy under a click. */
  foeAt(p: Pt): Foe | null {
    return this.foes.find((f) => f.state !== 'dead' && dist(f, p) < f.kind.r + 16) ?? null;
  }

  /** Go for this one. */
  attack(f: Foe): void {
    this.target = f;
    this.setStance('fight');
    this.sinceFight = 0;
  }

  /** You walked off somewhere: stop going for whoever you were after. */
  release(): void {
    if (!this.threat) this.target = null;
  }

  setStance(s: Stance): void {
    if (s === this.stance || this.down) return;
    // Nothing to fall back from.
    if (s === 'fallback' && !this.hunters().some((f) => dist(f, this.host.hero) < CALM)) return;
    this.stance = s;
    if (s === 'fallback') {
      this.say(this.threat ? 'You start backing away, facing them.' : 'You fall back.');
    } else if (this.threat || this.target) {
      this.say('You stand and fight.');
    }
  }

  /** A crate of rounds: fill your pockets. */
  refill(): void {
    if (!this.host.armed()) {
      this.say('Rounds, but nothing to fire them from.');
      return;
    }
    this.ammo.spare = SPARE_ROUNDS;
    music.sfx('reload');
    this.float('+ rounds', this.host.hero, '#e8d8a0');
    this.say(`You take rounds: ${this.ammo.spare} spare.`, 'good');
  }

  /**
   * How the fight moves the hero. `want` is where the player is steering,
   * as a unit vector, or null. Null back means move as usual.
   */
  steer(want: Pt | null): Steer | null {
    const h = this.host.hero;
    this.moving = !!want;
    if (this.down) return { dir: null, speed: 0, face: null };
    const t = this.stance === 'fight' && this.target?.state !== 'dead' ? this.target : null;
    if (this.threat) {
      const focus = t ?? this.threat;
      const face = angle(h, focus);
      let dir = want;
      if (!dir && this.stance === 'fallback') dir = this.away();
      else if (!dir && t && t.state !== 'flee' && this.tooFar(t)) dir = unit(t.x - h.x, t.y - h.y);
      if (dir) this.moving = true;
      return { dir, speed: dir ? this.gait(dir, face) : 0, face };
    }
    if (this.stance === 'fallback') {
      if (want) return null;
      // Clear of them: turn and run while anything is still after you.
      if (this.hunters().some((f) => dist(f, h) < CALM)) {
        this.moving = true;
        return { dir: this.away(), speed: RUN, face: null };
      }
      this.stance = 'fight';
      this.say('You got away.', 'good');
      return null;
    }
    if (t && !want) {
      const face = angle(h, t);
      if (!this.tooFar(t)) return { dir: null, speed: 0, face };
      // Not chasing what runs from you.
      if (t.state === 'flee') {
        this.target = null;
        return null;
      }
      this.moving = true;
      return { dir: unit(t.x - h.x, t.y - h.y), speed: ADVANCE, face };
    }
    return null;
  }

  // --- Every frame -----------------------------------------------------------------

  update(dt: number): void {
    const h = this.host.hero;
    const wasEngaged = !!this.threat;
    this.threat = null;
    let near = Infinity;
    let hunted = false;
    for (const f of this.foes) {
      this.updateFoe(f, dt);
      if (f.state !== 'hunt') continue;
      const d = dist(f, h);
      if (d < CALM) hunted = true;
      if (d < f.kind.engage * T + f.kind.r && d < near) {
        near = d;
        this.threat = f;
      }
    }
    if (wasEngaged && !this.threat && this.stance === 'fallback' && !this.down) {
      this.say('Clear of them — you turn and run.', 'good');
    }
    const gone = (f: Foe) => f.state === 'dead' || f.state === 'home' || dist(f, h) > 1.5 * CALM;
    if (this.target && gone(this.target)) {
      this.target = null;
    }
    if (!this.target && this.threat) this.target = this.threat;
    this.sinceThreat = hunted ? 0 : this.sinceThreat + dt;
    this.kick -= dt;
    this.flinch -= dt;
    // A low drum while something hunts you, quicker when it's close.
    this.beat -= dt;
    if (!hunted || this.down) this.beat = 0;
    else if (this.beat <= 0) {
      music.sfx('drum');
      this.beat = this.threat ? 0.55 : 0.9;
    }
    this.sinceFight = hunted || this.target ? 0 : this.sinceFight + dt;

    if (!this.down) {
      this.heroAttacks(dt);
      // Wounds close slowly once nothing hunts you, and quickly by the Wick.
      if (this.sinceThreat > 6 && this.hp < HERO_HP) {
        this.hp = Math.min(HERO_HP, this.hp + dt * (this.host.safe(h) ? 4 : 0.5));
      }
    }
    this.draw(dt);
    this.updatePanel();
  }

  // --- The hero's side -------------------------------------------------------------

  private weapon(): Weapon {
    return this.host.armed() && this.ammo.mag + this.ammo.spare > 0 ? PISTOL : FISTS;
  }

  private skill(w: Weapon): number {
    return w === FISTS ? HERO_SKILLS.melee : HERO_SKILLS.guns;
  }

  /** How hard this enemy is to hit right now. */
  private evasion(f: Foe): number {
    if (f.kind.id === 'shade' && this.host.inBeam(f)) return 15;
    if (f.charge === 'blown' || f.charge === 'windup') return f.kind.evasion - 15;
    return f.kind.evasion;
  }

  private chance(f: Foe, w = this.weapon()): number {
    const d = dist(this.host.hero, f) / T;
    const move = this.moving ? ON_THE_MOVE : 0;
    return hitChance(this.skill(w), w, d, this.evasion(f), this.host.dark(f) + move);
  }

  /** Where you'd like to be to hit them: close for fists, at ease for the pistol. */
  private reach(f: Foe): number {
    const w = this.weapon();
    if (w === FISTS) return f.kind.r + this.host.heroR + 8;
    return comfortRange(this.skill(w), w, this.evasion(f), this.host.dark(f)) * T;
  }

  /**
   * Whether you'd strike now: standing, you wait till you're at ease; on the
   * move — backing off, say — you take any shot within the gun's reach.
   */
  private canStrike(f: Foe): boolean {
    const h = this.host.hero;
    const w = this.weapon();
    if (!this.host.nav.lineFree(h.x, h.y, f.x, f.y, 2)) return false;
    const d = dist(h, f);
    return this.moving && w !== FISTS ? d <= w.range * T : d <= this.reach(f);
  }

  private tooFar(f: Foe): boolean {
    const h = this.host.hero;
    return dist(h, f) > this.reach(f) || !this.host.nav.lineFree(h.x, h.y, f.x, f.y, 2);
  }

  private heroAttacks(dt: number): void {
    const t = this.target;
    const w = this.weapon();
    if (w === PISTOL) {
      if (this.jam > 0) {
        this.jam -= dt;
        if (this.jam <= 0) this.say('You clear the jam.');
        return;
      }
      if (this.reload > 0) {
        this.reload -= dt;
        if (this.reload <= 0) {
          const n = Math.min(PISTOL.mag - this.ammo.mag, this.ammo.spare);
          this.ammo.mag += n;
          this.ammo.spare -= n;
        }
        return;
      }
      if (this.ammo.mag === 0) {
        this.reload = reloadTime(HERO_SKILLS.guns, PISTOL);
        music.sfx('reload');
        this.say('Reloading…');
        return;
      }
    }
    // On the move the aim steadies slower, but you keep shooting.
    this.aim = Math.min(this.aim + dt * (this.moving ? 0.6 : 1), 9);
    if (!t || !this.canStrike(t)) {
      this.aim = Math.min(this.aim, 0);
      return;
    }
    // A fresh aim at an enemy you've only just turned to.
    const h = this.host.hero;
    if (Math.abs(Phaser.Math.Angle.Wrap(angle(h, t) - h.facing)) > 0.3) return;
    const skill = this.skill(w);
    if (this.aim < aimTime(skill) * (w === FISTS ? 0.4 : 1)) return;
    this.aim = -w.cycle;
    this.sinceFight = 0;

    if (w === PISTOL) {
      this.ammo.mag--;
      if (Math.random() < jamChance(skill, PISTOL)) {
        this.jam = clearTime(skill);
        this.aim = 0;
        music.sfx('click');
        this.float('jammed!', h, '#f0b060');
        this.say('Click — your pistol jams. Clearing it…', 'bad');
        return;
      }
      music.sfx('shot');
      this.kick = 0.09;
      const m = this.muzzle(h, h.facing, 17, -7);
      this.flash(m, h.facing);
      this.alert();
    }
    const chance = this.chance(t, w);
    const roll = rollAttack(chance, skill, Math.random);
    const name = lower(t);
    if (roll === 'miss' || roll === 'fumble') {
      if (w === PISTOL) this.tracer(h, t, true);
      this.float('miss', t, PALE);
      if (roll === 'fumble') {
        this.aim = -1.4;
        this.say(w === PISTOL ? 'You snatch at the trigger and fumble the shot.' : 'You stumble.');
      } else {
        this.say(`You miss the ${name}.`);
      }
      this.wake(t);
      return;
    }
    if (w === PISTOL) this.tracer(h, t, false);
    const dmg = damage(w, t.kind.armour, roll === 'crit', Math.random);
    if (dmg === 0) {
      music.sfx('glass');
      this.bits.glass.explode(5, t.x, t.y);
      this.float('glances off', t, PALE);
      this.say(`The bullet glances off the ${name}.`);
      this.wake(t);
      return;
    }
    music.sfx(t.kind.id === 'crawler' ? 'glass' : w === FISTS ? 'thud' : 'hit');
    this.splash(t, roll === 'crit' ? 14 : 7);
    // The blow pushes it back a little.
    const push = unit(t.x - h.x, t.y - h.y);
    if (push) this.host.nav.move(t, push.x * 6, push.y * 6, t.kind.r);
    this.say(
      roll === 'crit'
        ? `A critical hit! The ${name} takes ${dmg}.`
        : `You hit the ${name} for ${dmg}.`,
      'good',
    );
    this.hurtFoe(t, dmg, roll === 'crit');
  }

  /** Away from whatever is after you, the nearest counting most. */
  private away(): Pt | null {
    const h = this.host.hero;
    let x = 0;
    let y = 0;
    for (const f of this.hunters()) {
      const d = Math.max(dist(f, h), T);
      if (d > CALM) continue;
      x += (h.x - f.x) / d / d;
      y += (h.y - f.y) / d / d;
    }
    return unit(x, y);
  }

  /** Walking forwards is quicker than sideways, sideways than backwards. */
  private gait(dir: Pt, face: number): number {
    const h = this.host.hero;
    const fwd = (1 + dir.x * Math.cos(face) + dir.y * Math.sin(face)) / 2;
    const pressed = this.hunters().some(
      (f) => f.kind.attack.range <= 1.5 && dist(f, h) < this.contact(f) + 6,
    );
    return lerp(pressed ? PRESSED : BACK, ADVANCE, fwd);
  }

  private hurtHero(dmg: number, line: string): void {
    this.hp -= dmg;
    this.sinceThreat = 0;
    this.float(`-${dmg}`, this.host.hero, RED);
    this.say(line, 'bad');
    this.flinch = 0.18;
    this.bits.blood.explode(6, this.host.hero.x, this.host.hero.y);
    const cam = this.host.scene.cameras.main;
    cam.shake(120, 0.004 + dmg * 0.0006);
    music.sfx('hurt');
    if (this.hp > 0) return;
    this.down = true;
    this.say('You fall.', 'bad');
    this.host.fall();
  }

  // --- The enemies' side -----------------------------------------------------------

  private hunters(): Foe[] {
    return this.foes.filter((f) => f.state === 'hunt');
  }

  private contact(f: Foe): number {
    return f.kind.r + this.host.heroR + 8;
  }

  /** A gunshot wakes whatever sleeps close by. */
  private alert(): void {
    for (const f of this.foes) {
      if (f.state === 'idle' && dist(f, this.host.hero) < ALERT) this.wake(f);
    }
  }

  private wake(f: Foe): void {
    if (f.state !== 'idle' && f.state !== 'home') return;
    f.state = 'hunt';
    f.calm = 0;
    f.t = 0;
    f.cd = Math.max(f.cd, 0.4);
    const cry = CRY[f.kind.id];
    if (cry) music.sfx(cry);
    this.say(NOTICE[f.kind.id], 'bad');
  }

  private hurtFoe(f: Foe, dmg: number, crit: boolean): void {
    f.hp -= dmg;
    f.hurt = 0.18;
    this.float(crit ? `crit -${dmg}` : `-${dmg}`, f, crit ? '#ffd27a' : RED);
    if (f.hp <= 0) {
      this.kill(f);
      return;
    }
    this.wake(f);
    if (f.state === 'hunt' && f.kind.flee && f.hp < f.kind.hp * f.kind.flee) {
      f.state = 'flee';
      f.t = 0;
      if (f.kind.id === 'wolf') music.sfx('yelp');
      this.say(f.kind.id === 'wolf' ? 'The wolf yelps and bolts.' : `The ${lower(f)} runs for it.`);
    }
  }

  private kill(f: Foe): void {
    f.state = 'dead';
    f.t = 0;
    f.hp = 0;
    for (const e of f.eyes) e.setVisible(false);
    this.say(DEATH[f.kind.id], 'good');
    if (this.target === f) this.target = null;
    const { scene } = this.host;
    this.splash(f, 16);
    if (f.kind.id === 'shade') {
      scene.tweens.add({ targets: f.img, alpha: 0, scale: 1.6, duration: 900 });
      return;
    }
    // It goes down: rolls onto its side and sinks a little.
    f.img.setTint(0x6a6a6a).setDepth(f.y - 6);
    scene.tweens.add({
      targets: f.img,
      rotation: f.facing + (Math.random() < 0.5 ? -1.3 : 1.3),
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 380,
      ease: 'Quad.easeIn',
    });
    if (f.kind.id !== 'crawler') {
      const blood = scene.add
        .image(f.x, f.y, 'ln-foes', 'blood')
        .setAngle(rnd(0, 360))
        .setDepth(-45)
        .setAlpha(0.9);
      f.img.setData('blood', blood);
    }
  }

  private respawn(f: Foe): void {
    Object.assign(f, {
      ...f.home,
      hp: f.kind.hp,
      state: 'idle',
      t: 0,
      cd: 0,
      charge: 'ready',
      loaded: true,
      path: [],
      wander: null,
    });
    (f.img.getData('blood') as Phaser.GameObjects.Image | undefined)?.destroy();
    f.img.clearTint().setAlpha(1).setScale(1).setPosition(f.x, f.y);
    for (const e of f.eyes) e.setVisible(true);
  }

  /** An enemy's blow or shot at you: a roll like yours. */
  private foeAttacks(f: Foe, bonus = 0, mult = 1): boolean {
    const h = this.host.hero;
    const w = f.kind.attack;
    // Backing away from something at your throat leaves you open.
    const open = this.stance === 'fallback' || this.moving ? 10 : 0;
    const chance = clamp(
      hitChance(f.kind.skill, w, dist(f, h) / T, HERO_SKILLS.dodge) + bonus + open,
      5,
      95,
    );
    const roll = rollAttack(chance, f.kind.skill, Math.random);
    const name = lower(f);
    f.lunge = 0.16;
    if (f.kind.id !== 'brigand') music.sfx(STRIKE[f.kind.id]);
    if (roll === 'miss' || roll === 'fumble') {
      this.float('miss', h, PALE);
      this.say(f.kind.id === 'brigand' ? 'The brigand fires and misses.' : `The ${name} misses.`);
      return false;
    }
    const dmg = Math.round(damage(w, { dt: 0, dr: 0 }, roll === 'crit', Math.random) * mult);
    const crit = roll === 'crit' ? 'A critical hit! ' : '';
    this.hurtHero(dmg, `${crit}The ${name} ${VERB[f.kind.id]} you for ${dmg}.`);
    return true;
  }

  private updateFoe(f: Foe, dt: number): void {
    const h = this.host.hero;
    const d = dist(f, h);
    f.hurt = Math.max(0, f.hurt - dt);
    f.lunge = Math.max(0, f.lunge - dt);
    f.t += dt;
    if (f.state === 'dead') {
      if (f.t > RESPAWN && dist(h, f.home) > 12 * T) this.respawn(f);
      return;
    }
    if (f.state === 'idle' || f.state === 'home') {
      f.hp = Math.min(f.kind.hp, f.hp + dt);
      f.calm -= dt;
      if (!this.down && f.calm <= 0 && d < f.kind.aggro * T) {
        this.wake(f);
      } else if (f.state === 'home') {
        if (dist(f, f.home) < 8) f.state = 'idle';
        else this.walk(f, f.home, f.kind.speed * 0.6, dt);
      } else {
        this.idle(f, dt);
      }
      return;
    }
    if (f.state === 'flee') {
      this.step(f, f.x - h.x, f.y - h.y, f.kind.speed, dt);
      if (d > 12 * T || f.t > 6) this.goHome(f, '');
      return;
    }
    // Hunting. Too far from home, or you're down: back it goes.
    if (this.down) return this.goHome(f, '');
    if (dist(f, f.home) > f.kind.leash * T) {
      return this.goHome(
        f,
        f.kind.id === 'shade'
          ? 'The shade melts back into the trees.'
          : `The ${lower(f)} gives up the chase.`,
      );
    }
    if (f.kind.id === 'brigand') this.brigand(f, d, dt);
    else if (f.kind.id === 'boar' && f.charge !== 'ready') this.boar(f, d, dt);
    else this.melee(f, d, dt);
    // Bodies don't pass through each other.
    const gap = f.kind.r + this.host.heroR + 4 - dist(f, h);
    const u = unit(f.x - h.x, f.y - h.y);
    if (gap > 0 && u) this.host.nav.move(f, u.x * gap, u.y * gap, f.kind.r);
  }

  private goHome(f: Foe, line: string): void {
    f.state = 'home';
    f.calm = 6;
    f.charge = 'ready';
    if (line) this.say(line);
  }

  /** Pottering about at home. */
  private idle(f: Foe, dt: number): void {
    if (f.t > 3 && !f.wander) {
      f.wander = { x: f.home.x + rnd(-1.2, 1.2) * T, y: f.home.y + rnd(-1.2, 1.2) * T };
    }
    if (!f.wander) return;
    if (dist(f, f.wander) < 4) {
      f.wander = null;
      f.t = rnd(-3, 1);
    } else {
      this.walk(f, f.wander, f.kind.speed * 0.25, dt);
    }
  }

  /** Close in and strike: the wolf skips back after each bite. */
  private melee(f: Foe, d: number, dt: number): void {
    const h = this.host.hero;
    const slow = f.kind.id === 'shade' && this.host.inBeam(f) ? 0.5 : 1;
    // After a blow it backs off, still facing you — the wolf turns and
    // lopes away — then comes in again.
    if (f.skip > 0) {
      f.skip -= dt;
      const u = unit(f.x - h.x, f.y - h.y);
      const speed = Math.max(f.kind.speed * 0.6, 60);
      if (f.kind.id === 'wolf') this.step(f, f.x - h.x, f.y - h.y, speed, dt);
      else if (u) {
        this.host.nav.move(f, u.x * speed * dt, u.y * speed * dt, f.kind.r);
        this.turn(f, angle(f, h), dt);
        f.walk += dt * speed * 0.08;
      }
      return;
    }
    if (f.kind.id === 'boar') {
      f.t -= 2 * dt;
      if (f.t <= 0 && d > 2.5 * T && d < 7 * T && this.host.nav.lineFree(f.x, f.y, h.x, h.y, 6)) {
        f.charge = 'windup';
        f.t = 0;
        this.say('The boar paws the ground…', 'bad');
        return;
      }
    }
    // It keeps after you as you back away, and strikes once it's close
    // enough — it doesn't wait to be pressed right up against you.
    if (d > this.contact(f)) this.walk(f, h, f.kind.speed * slow, dt);
    if (d > this.contact(f) + 12) {
      f.cd = Math.max(f.cd, 0.35);
      return;
    }
    this.turn(f, angle(f, h), dt);
    f.cd -= dt;
    if (f.cd > 0) return;
    f.cd = f.kind.attack.cycle * rnd(0.85, 1.15);
    this.foeAttacks(f);
    f.skip = SKIP[f.kind.id] * rnd(0.8, 1.2);
  }

  /** The boar's charge: paw the ground, run straight, stand blown. */
  private boar(f: Foe, d: number, dt: number): void {
    const h = this.host.hero;
    if (f.charge === 'windup') {
      this.turn(f, angle(f, h), dt * 3);
      if (f.t < 0.8) return;
      f.charge = 'run';
      f.dir = angle(f, h);
      f.ran = 0;
      f.t = 0;
      music.sfx('snort');
      this.say('The boar charges!', 'bad');
      return;
    }
    if (f.charge === 'run') {
      const bx = f.x;
      const by = f.y;
      const s = 250 * dt;
      this.step(f, Math.cos(f.dir), Math.sin(f.dir), 250, dt);
      const moved = Math.hypot(f.x - bx, f.y - by);
      f.ran += moved;
      if (d < this.contact(f)) {
        if (this.foeAttacks(f, 15, 1.25)) {
          this.host.nav.move(h, Math.cos(f.dir) * 26, Math.sin(f.dir) * 26, this.host.heroR);
        } else {
          this.say('You sidestep the boar.', 'good');
        }
        f.charge = 'blown';
        f.t = 0;
      } else if (moved < s * 0.5 || f.ran > 9 * T) {
        f.charge = 'blown';
        f.t = 0;
      }
      return;
    }
    // Blown: it stands heaving, open to a shot.
    if (f.t > 2.2) {
      f.charge = 'ready';
      f.t = 4;
      f.cd = 0.5;
    }
  }

  /** Keeps his distance, shoots, and takes an age to reload. */
  private brigand(f: Foe, d: number, dt: number): void {
    const h = this.host.hero;
    const w = f.kind.attack;
    const line = this.host.nav.lineFree(f.x, f.y, h.x, h.y, 3);
    if (!f.loaded) {
      f.cd -= dt;
      if (f.cd <= 0) {
        f.loaded = true;
        f.t = 0;
      }
    }
    if (d < 3 * T) this.step(f, f.x - h.x, f.y - h.y, f.kind.speed, dt);
    else if (d > (w.range - 1) * T || !line) this.walk(f, h, f.kind.speed, dt);
    this.turn(f, angle(f, h), dt);
    if (!f.loaded) return;
    if (!line || d > w.range * T) {
      f.t = 0;
      return;
    }
    // Takes his aim, then fires; sometimes the powder only flashes in the pan.
    if (f.t < 0.9) return;
    f.t = 0;
    f.loaded = false;
    f.cd = reloadTime(f.kind.skill, w);
    if (Math.random() < w.jam) {
      music.sfx('click');
      this.say("The brigand's flintlock misfires.", 'good');
      return;
    }
    music.sfx('boom');
    this.flash(this.muzzle(f, f.facing, 20, 0), f.facing);
    this.tracer(f, h, false);
    this.foeAttacks(f);
  }

  /** Walks towards a point, round whatever is in the way. */
  private walk(f: Foe, to: Pt, speed: number, dt: number): void {
    const nav = this.host.nav;
    let goal = to;
    if (nav.lineFree(f.x, f.y, to.x, to.y, f.kind.r)) {
      f.path = [];
    } else {
      f.repath -= dt;
      if (f.repath <= 0 || !f.path.length) {
        f.path = nav.route(f, to, f.kind.r);
        f.repath = 0.6;
      }
      while (f.path.length && dist(f, f.path[0] as Pt) < 4) f.path.shift();
      goal = f.path[0] ?? to;
    }
    this.step(f, goal.x - f.x, goal.y - f.y, speed, dt);
  }

  private step(f: Foe, dx: number, dy: number, speed: number, dt: number): void {
    const u = unit(dx, dy);
    if (!u) return;
    this.host.nav.move(f, u.x * speed * dt, u.y * speed * dt, f.kind.r);
    this.turn(f, Math.atan2(u.y, u.x), dt);
    f.walk += dt * speed * 0.08;
  }

  private turn(f: Foe, to: number, dt: number): void {
    f.facing += Phaser.Math.Angle.Wrap(to - f.facing) * Math.min(1, dt * 10);
  }

  // --- Drawing ---------------------------------------------------------------------

  private muzzle(p: Pt, facing: number, fwd: number, side: number): Pt {
    const c = Math.cos(facing);
    const s = Math.sin(facing);
    return { x: p.x + c * fwd - s * side, y: p.y + s * fwd + c * side };
  }

  private flash(at: Pt, facing: number): void {
    this.flashes.push({ ...at, t: 0.08 });
    const img = this.host.scene.add
      .image(at.x, at.y, 'ln-foes', 'flash')
      .setOrigin(0, 0.5)
      .setRotation(facing)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.host.above);
    this.host.scene.time.delayedCall(60, () => img.destroy());
  }

  /** Blood, glass or smoke where something is hit. */
  private splash(f: Foe, n: number): void {
    const kind = f.kind.id === 'crawler' ? 'glass' : f.kind.id === 'shade' ? 'smoke' : 'blood';
    this.bits[kind].explode(n, f.x, f.y);
  }

  private tracer(from: Pt, to: Pt, miss: boolean): void {
    const b = miss ? { x: to.x + rnd(-18, 18), y: to.y + rnd(-18, 18) } : { ...to };
    this.tracers.push({ a: { ...from }, b, t: 0.07 });
  }

  /** Words over someone's head that drift up and fade. */
  private float(text: string, at: Pt, color: string): void {
    const { scene } = this.host;
    const label = scene.add
      .text(at.x + rnd(-6, 6), at.y - 20, text, {
        fontFamily: 'Lato, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color,
        stroke: '#120c08',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.host.above);
    scene.tweens.add({
      targets: label,
      y: label.y - 26,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private draw(dt: number): void {
    const now = this.host.scene.time.now;
    for (const f of this.foes) {
      if (f.state === 'dead') continue;
      // A blow lunges forward and back; a boar about to charge trembles.
      const l = f.lunge > 0 ? Math.sin((1 - f.lunge / 0.16) * Math.PI) * 8 : 0;
      let x = f.x + Math.cos(f.facing) * l;
      const y = f.y + Math.sin(f.facing) * l;
      if (f.charge === 'windup') x += Math.sin(now / 25) * 1.5;
      if (f.charge === 'run' && Math.random() < 0.4) this.bits.smoke.explode(1, f.x, f.y);
      const bob = f.state !== 'idle' ? Math.sin(f.walk) * 0.04 : 0;
      f.img.setPosition(x, y).setRotation(f.facing);
      f.img.setDepth(f.y + 4).setScale(1 + bob, 1 - bob);
      if (f.hurt > 0) f.img.setTint(0xff8070);
      else if (f.charge === 'blown') f.img.setTint(0xb8a898);
      else f.img.clearTint();
      if (f.kind.id === 'shade') {
        const lit = this.host.inBeam(f);
        f.img.setAlpha(lit ? 0.95 : 0.55 + Math.sin(now / 300 + f.home.x) * 0.15);
      }
      const fwd = f.kind.id === 'wolf' ? 14 : 8;
      const gap = f.kind.id === 'wolf' ? 2.6 : 4;
      f.eyes.forEach((e, i) => {
        const p = this.muzzle(f, f.facing, fwd, i ? gap : -gap);
        e.setPosition(p.x, p.y).setAlpha(f.state === 'hunt' ? 0.9 : 0.5);
      });
    }

    this.flashes = this.flashes.filter((f) => (f.t -= dt) > 0);
    const g = this.g;
    g.clear();
    this.tracers = this.tracers.filter((t) => (t.t -= dt) > 0);
    for (const t of this.tracers) {
      g.lineStyle(1.4, 0xffe2a0, t.t / 0.07);
      g.lineBetween(t.a.x, t.a.y, t.b.x, t.b.y);
    }
    // The one you're fighting: a ring at its feet and its health over its head.
    const r = this.ring;
    r.clear();
    const t = this.target;
    if (!t || t.state === 'dead') return;
    r.lineStyle(1.5, this.stance === 'fight' ? 0xf08a3c : 0x9a8a7a, 0.7);
    r.strokeEllipse(t.x, t.y + 2, t.kind.r * 2.6, t.kind.r * 1.9);
    const w = 30;
    const y = t.y - t.kind.r - 14;
    g.fillStyle(0x120c08, 0.75);
    g.fillRect(t.x - w / 2 - 1, y - 1, w + 2, 5);
    g.fillStyle(0xc0483a, 1);
    g.fillRect(t.x - w / 2, y, (w * t.hp) / t.kind.hp, 3);
  }

  private updatePanel(): void {
    const p = this.panel;
    if (!p) return;
    const show = this.sinceFight < 6 || this.hp < HERO_HP;
    p.show(show);
    if (!show) return;
    const armed = this.host.armed();
    const state =
      this.jam > 0
        ? ' · jammed!'
        : this.reload > 0
          ? ' · reloading…'
          : this.ammo.mag
            ? ''
            : ' · empty';
    const weapon = armed
      ? `Pistol · ${this.ammo.mag}/${PISTOL.mag} · ${this.ammo.spare} spare${state}`
      : 'Bare hands · no gun';
    const t = this.target;
    const target = t
      ? `${t.kind.name} · ${this.chance(t)}% to hit${t.state === 'flee' ? ' · fleeing' : ''}`
      : null;
    p.update({
      hp: this.hp,
      maxHp: HERO_HP,
      weapon,
      target,
      engaged: !!this.threat,
      stance: this.stance,
    });
  }

  private say(text: string, tone: 'good' | 'bad' | 'plain' = 'plain'): void {
    this.panel?.say(text, tone);
  }
}
