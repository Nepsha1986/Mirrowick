import { storage } from '../ui/dom';

const MUTE_KEY = 'mirrowick.muted';

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
  // D minor, slow and low: Dm – B♭ – Gm – A.
  lower: {
    chords: [
      [50, 53, 57],
      [46, 50, 53],
      [43, 46, 50],
      [45, 49, 52],
    ],
    bells: [62, 65, 67, 69, 72, 74],
    drone: 1,
    cutoff: 700,
    bellGap: [3500, 6000],
    bellDecay: 3.2,
  },
  // F major, warm and open: F – C – Dm – B♭, with a music box on top.
  upper: {
    chords: [
      [53, 57, 60],
      [52, 55, 60],
      [50, 53, 57],
      [50, 53, 58],
    ],
    bells: [72, 74, 76, 77, 79, 81, 84],
    drone: 0.15,
    cutoff: 1700,
    bellGap: [900, 2400],
    bellDecay: 1.4,
  },
};
const CHORD_SECONDS = 9;

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/**
 * Procedural ambient score: a low drone, a slow pad progression and the odd
 * distant bell, all through a synthetic reverb. No audio files needed.
 */
export class AmbientMusic {
  private ctx?: AudioContext;
  private master?: GainNode;
  private pad?: GainNode;
  private reverb?: ConvolverNode;
  private lowpass?: BiquadFilterNode;
  private droneBus?: GainNode;
  private timers: number[] = [];
  private chordTimer = 0;
  private chordIndex = 0;
  private mood: Mood = 'lower';
  muted = storage.get(MUTE_KEY) === '1';

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

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.applyVolume(4);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

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
    lowpass.connect(this.master);
    lowpass.connect(this.reverb);

    this.droneBus = ctx.createGain();
    this.droneBus.gain.value = SCORES[this.mood].drone;
    this.droneBus.connect(this.pad);
    this.drone(38, 0.16);
    this.drone(45, 0.07);

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

  setMuted(muted: boolean): void {
    this.muted = muted;
    storage.set(MUTE_KEY, muted ? '1' : '0');
    this.applyVolume(0.6);
  }

  toggle(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private applyVolume(seconds: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.42, t + seconds);
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
    g.connect(this.reverb as ConvolverNode);
    g.connect(this.master as GainNode);
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

/** One score for the whole game, shared across scenes. */
export const music = new AmbientMusic();
