import { storage } from '../ui/dom';

const VOLUME_KEY = 'mirrowick.volume';
const SOUNDS_KEY = 'mirrowick.sounds';
/** Gain of the sounds at full volume. */
const FULL = 0.5;
/** Gain of the music at full volume: kept well under the sounds, just a backdrop. */
const MUSIC_FULL = 0.2;

/** The sounds of a fight, and of using things and going between places. */
export type Sfx =
  | 'shot'
  | 'boom'
  | 'click'
  | 'reload'
  | 'hit'
  | 'glass'
  | 'swish'
  | 'bite'
  | 'growl'
  | 'snort'
  | 'whisper'
  | 'yelp'
  | 'hurt'
  | 'thud'
  | 'drum'
  | 'ring'
  | 'pickup'
  | 'drawer'
  | 'paper'
  | 'switch'
  | 'locked'
  | 'steps'
  | 'mirror';

/** The Lower World is dusk and dread; the Upper World is an ordinary sunny day. */
export type Mood = 'lower' | 'upper';

interface MoodScore {
  chords: number[][];
  bells: number[];
  /** Low drone level, 0…1. */
  drone: number;
  /** Lowpass cutoff over the pad, Hz. */
  cutoff: number;
  /** Milliseconds between bells: base + random spread. */
  bellGap: [number, number];
  bellDecay: number;
}

const SCORES: Record<Mood, MoodScore> = {
  // D minor, slow and quiet, with no leading tone to pull at you: Dm – B♭ – F – C.
  lower: {
    chords: [
      [50, 57, 62],
      [46, 53, 62],
      [45, 53, 60],
      [43, 52, 60],
    ],
    bells: [62, 65, 69, 72],
    drone: 0.35,
    cutoff: 600,
    bellGap: [9000, 9000],
    bellDecay: 3,
  },
  // F major, warm and open: F – C – Dm – B♭, with a rare music-box note.
  upper: {
    chords: [
      [53, 57, 60],
      [52, 55, 60],
      [50, 53, 57],
      [50, 53, 58],
    ],
    bells: [72, 74, 77, 79, 81],
    drone: 0,
    cutoff: 1400,
    bellGap: [5000, 6000],
    bellDecay: 1.6,
  },
};
const CHORD_SECONDS = 12;

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/**
 * Procedural ambient score, kept faint: a slow pad progression, a soft drone
 * below and the odd distant bell, all through a synthetic reverb. The sounds
 * of the game share the reverb but have their own volume. No audio files
 * needed.
 */
export class AmbientMusic {
  private ctx?: AudioContext;
  private master?: GainNode;
  /** The music's own level, under the master. */
  private musicBus?: GainNode;
  private pad?: GainNode;
  private reverb?: ConvolverNode;
  private lowpass?: BiquadFilterNode;
  private droneBus?: GainNode;
  private timers: number[] = [];
  /** A second of fading noise, for the sounds of a fight. */
  private noise?: AudioBuffer;
  private chordTimer = 0;
  private chordIndex = 0;
  private mood: Mood = 'lower';
  /** Music volume, 0…1, as set in Settings. */
  volume = readLevel(VOLUME_KEY, 0.5);
  /** Volume of the sounds, 0…1, as set in Settings. */
  sounds = readLevel(SOUNDS_KEY, 0.8);

  /** Must be called from a user gesture the first time (autoplay policy). */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    // A limiter last of all, so a loud moment squeezes instead of clipping
    // (clipping is what crackles in the speakers).
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    // One echo for everything (a long reverb is the costliest node here),
    // fed by two buses: the sounds, and the faint music.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    this.reverb.connect(wet).connect(limiter);
    const bus = (level: number) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(limiter);
      g.connect(this.reverb as ConvolverNode);
      return g;
    };
    this.master = bus(this.sounds * FULL);
    this.musicBus = bus(0);
    this.applyVolume(6);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = SCORES[this.mood].cutoff;
    this.lowpass = lowpass;
    lowpass.Q.value = 0.4;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(lowpass.frequency);
    lfo.start();

    this.pad = ctx.createGain();
    this.pad.gain.value = 0.9;
    this.pad.connect(lowpass);
    lowpass.connect(this.musicBus);

    this.droneBus = ctx.createGain();
    this.droneBus.gain.value = SCORES[this.mood].drone;
    this.droneBus.connect(this.pad);
    this.drone(38, 0.1);

    this.restartChords();
    this.scheduleBell();
  }

  /** Crossfades to the other world's score; safe to call before start(). */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    const ctx = this.ctx;
    if (!ctx || !this.lowpass || !this.droneBus) return;
    const t = ctx.currentTime;
    const score = SCORES[mood];
    for (const [param, value] of [
      [this.lowpass.frequency, score.cutoff],
      [this.droneBus.gain, score.drone],
    ] as const) {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(value, t + 3);
    }
    this.chordIndex = 0;
    this.restartChords();
  }

  private restartChords(): void {
    window.clearInterval(this.chordTimer);
    this.playChord();
    this.chordTimer = window.setInterval(() => this.playChord(), CHORD_SECONDS * 1000);
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    storage.set(VOLUME_KEY, String(this.volume));
    this.applyVolume(0.3);
  }

  setSounds(volume: number): void {
    this.sounds = Math.min(1, Math.max(0, volume));
    storage.set(SOUNDS_KEY, String(this.sounds));
    this.ramp(this.master, this.sounds * FULL, 0.3);
  }

  private applyVolume(seconds: number): void {
    this.ramp(this.musicBus, this.volume * MUSIC_FULL, seconds);
  }

  private ramp(node: GainNode | undefined, value: number, seconds: number): void {
    if (!this.ctx || !node) return;
    const t = this.ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(value, t + seconds);
  }

  private drone(midi: number, level: number): void {
    const ctx = this.ctx as AudioContext;
    const g = ctx.createGain();
    g.gain.value = level;
    for (const detune of [-6, 5]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = midiToHz(midi);
      o.detune.value = detune;
      o.connect(g);
      o.start();
    }
    g.connect(this.droneBus as GainNode);
  }

  private playChord(): void {
    const ctx = this.ctx as AudioContext;
    const { chords } = SCORES[this.mood];
    const notes = chords[this.chordIndex++ % chords.length] as number[];
    const t = ctx.currentTime + 0.05;
    const len = CHORD_SECONDS + 3;
    for (const n of notes) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 3.5);
      g.gain.setValueAtTime(0.06, t + len - 4);
      g.gain.linearRampToValueAtTime(0, t + len);
      g.connect(this.pad as GainNode);
      for (const detune of [-8, 7]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = midiToHz(n);
        o.detune.value = detune;
        o.connect(g);
        o.start(t);
        o.stop(t + len + 0.1);
      }
    }
  }

  private scheduleBell(): void {
    const [base, spread] = SCORES[this.mood].bellGap;
    const delay = base + Math.random() * spread;
    this.timers.push(
      window.setTimeout(() => {
        this.bell();
        this.scheduleBell();
      }, delay),
    );
  }

  private bell(): void {
    const ctx = this.ctx as AudioContext;
    if (ctx.state !== 'running') return;
    const { bells, bellDecay } = SCORES[this.mood];
    const midi = bells[Math.floor(Math.random() * bells.length)] as number;
    const t = ctx.currentTime + 0.02;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + bellDecay);
    g.connect(this.musicBus as GainNode);
    for (const [ratio, level] of [
      [1, 1],
      [2.76, 0.25],
    ] as const) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = midiToHz(midi) * ratio;
      og.gain.value = level;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + bellDecay + 0.1);
    }
  }

  /**
   * A short sound, through the same reverb, made from noise and a tone or
   * two: shots, blows, beasts, a low drum while something hunts you, and the
   * small sounds of using things and going between places.
   */
  sfx(kind: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime + 0.01;
    this.noise ??= this.impulse(1);
    const out = (gain: number, len: number, at: number, swell = 0) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(swell ? 0.0001 : gain, at);
      if (swell) g.gain.exponentialRampToValueAtTime(gain, at + swell);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      g.connect(this.master as GainNode);
      return g;
    };
    const noise = (
      type: BiquadFilterType,
      freq: number,
      gain: number,
      len: number,
      { q = 1, delay = 0, swell = 0 } = {},
    ) => {
      const at = now + delay;
      const src = ctx.createBufferSource();
      src.buffer = this.noise as AudioBuffer;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      src.connect(f).connect(out(gain, len, at, swell));
      src.start(at, Math.random() * 0.3);
      src.stop(at + len);
    };
    const tone = (
      type: OscillatorType,
      from: number,
      to: number,
      gain: number,
      len: number,
      { delay = 0, cutoff = 0 } = {},
    ) => {
      const at = now + delay;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from, at);
      o.frequency.exponentialRampToValueAtTime(to, at + len);
      const g = out(gain, len, at);
      if (cutoff) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = cutoff;
        o.connect(f).connect(g);
      } else {
        o.connect(g);
      }
      o.start(at);
      o.stop(at + len + 0.02);
    };
    switch (kind) {
      case 'shot':
        noise('lowpass', 2600, 0.5, 0.25);
        tone('sine', 140, 50, 0.25, 0.12);
        break;
      case 'boom':
        noise('lowpass', 900, 0.6, 0.6);
        tone('sine', 90, 35, 0.3, 0.4);
        break;
      case 'click':
        tone('square', 1900, 1700, 0.06, 0.04);
        break;
      case 'reload':
        tone('square', 1300, 1200, 0.05, 0.03);
        tone('square', 900, 800, 0.06, 0.04, { delay: 0.22 });
        break;
      case 'hit':
        noise('bandpass', 1100, 0.4, 0.08, { q: 2 });
        noise('lowpass', 260, 0.35, 0.14);
        break;
      case 'glass':
        for (const [f, d] of [
          [2300, 0],
          [3500, 0.02],
          [4700, 0.05],
        ] as const) {
          tone('sine', f, f * 0.98, 0.04, 0.5, { delay: d });
        }
        break;
      case 'swish':
        noise('bandpass', 1600, 0.16, 0.16, { q: 1.5, swell: 0.05 });
        break;
      case 'bite':
        noise('bandpass', 2400, 0.32, 0.07, { q: 3 });
        tone('square', 320, 110, 0.035, 0.08, { cutoff: 900 });
        break;
      case 'growl':
        tone('sawtooth', 82, 64, 0.11, 0.8, { cutoff: 420 });
        tone('sawtooth', 87, 70, 0.07, 0.7, { cutoff: 380 });
        break;
      case 'snort':
        noise('bandpass', 650, 0.35, 0.22, { q: 4 });
        noise('bandpass', 480, 0.3, 0.3, { q: 4, delay: 0.25 });
        break;
      case 'whisper':
        noise('bandpass', 3200, 0.1, 1.2, { q: 6, swell: 0.5 });
        noise('bandpass', 2100, 0.07, 1.4, { q: 8, swell: 0.7 });
        break;
      case 'yelp':
        tone('triangle', 1150, 650, 0.08, 0.28);
        break;
      case 'hurt':
        tone('triangle', 210, 130, 0.12, 0.22, { cutoff: 900 });
        noise('lowpass', 500, 0.2, 0.1);
        break;
      case 'thud':
        noise('lowpass', 420, 0.4, 0.18);
        break;
      case 'drum':
        tone('sine', 72, 42, 0.2, 0.35);
        noise('lowpass', 140, 0.15, 0.12);
        break;
      case 'ring':
        // A phone's trill: two tones flickering for a second.
        for (let i = 0; i < 16; i++) {
          const f = i % 2 ? 1320 : 1100;
          tone('square', f, f, 0.025, 0.055, { delay: i * 0.06, cutoff: 2600 });
        }
        break;
      case 'pickup':
        // Into a pocket: a rustle of cloth and a small, soft tick.
        noise('bandpass', 1400, 0.12, 0.18, { q: 1.2, swell: 0.04 });
        tone('sine', 880, 860, 0.035, 0.18, { delay: 0.12 });
        break;
      case 'drawer':
        // Wood sliding out, a little unevenly, and a knock as it stops.
        noise('bandpass', 420, 0.22, 0.32, { q: 3, swell: 0.08 });
        noise('bandpass', 560, 0.1, 0.18, { q: 4, delay: 0.14 });
        noise('lowpass', 300, 0.25, 0.1, { delay: 0.34 });
        break;
      case 'paper':
        noise('highpass', 2600, 0.1, 0.12, { swell: 0.03 });
        noise('highpass', 3400, 0.07, 0.16, { swell: 0.05, delay: 0.1 });
        break;
      case 'switch':
        tone('square', 2200, 1800, 0.04, 0.025, { cutoff: 3000 });
        noise('lowpass', 900, 0.12, 0.05);
        break;
      case 'locked':
        // A handle tried twice: it rattles and holds.
        for (const d of [0, 0.16]) {
          noise('bandpass', 1500, 0.18, 0.07, { q: 5, delay: d });
          noise('lowpass', 350, 0.18, 0.08, { delay: d + 0.02 });
        }
        break;
      case 'steps':
        // Four footfalls on wooden stairs, not quite in time.
        for (const [d, f] of [
          [0, 240],
          [0.31, 210],
          [0.6, 250],
          [0.93, 200],
        ] as const) {
          noise('lowpass', f, 0.3, 0.12, { delay: d });
          noise('bandpass', 900, 0.04, 0.05, { q: 2, delay: d });
        }
        break;
      case 'mirror':
        // Glass that hums and rises, and lets you through.
        noise('bandpass', 2800, 0.05, 1, { q: 10, swell: 0.6 });
        for (const [f, d] of [
          [660, 0],
          [990, 0.15],
          [1320, 0.3],
        ] as const) {
          tone('sine', f, f * 1.5, 0.03, 0.9, { delay: d });
        }
        break;
    }
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    return buf;
  }
}

function readLevel(key: string, fallback: number): number {
  const v = Number(storage.get(key));
  return storage.get(key) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/** One score for the whole game, shared across scenes. */
export const music = new AmbientMusic();
