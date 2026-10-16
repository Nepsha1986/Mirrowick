import type * as Phaser from 'phaser';

export type StyleId = 'dusk' | 'ash' | 'night' | 'ink' | 'raw';

export interface StylePreset {
  id: StyleId;
  label: string;
  /** Applied to the colour-matrix filter after a reset. */
  grade: (m: Phaser.Display.ColorMatrix) => void;
  vignette: { strength: number; color: number };
  /** Translucent overlay that darkens the world but not the lights. */
  shade: { color: number; alpha: number };
  sky: number;
  fog: { tint: number; alpha: number };
  lights: number;
  /** Lantern glow around the player. */
  heroLight: number;
  ash: number;
  /** Duotone ramp, for the ink-wash look. */
  gradientMap?: [number, number];
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'dusk',
    label: 'Dusk',
    grade: (m) => {
      m.saturate(-0.25, true);
      m.sepia(true);
      m.alpha = 0.55;
    },
    vignette: { strength: 0.7, color: 0x1a0f08 },
    shade: { color: 0x2a1a10, alpha: 0.16 },
    sky: 0xffffff,
    fog: { tint: 0xf3dcc0, alpha: 0.16 },
    lights: 0.6,
    heroLight: 0,
    ash: 0.5,
  },
  {
    id: 'ash',
    label: 'Ash',
    grade: (m) => {
      m.saturate(-0.75, true);
      m.contrast(0.08, true);
      m.alpha = 1;
    },
    vignette: { strength: 0.75, color: 0x0e0e0e },
    shade: { color: 0x1c1c1e, alpha: 0.22 },
    sky: 0xbdb6ad,
    fog: { tint: 0xe6e2dc, alpha: 0.3 },
    lights: 0.45,
    heroLight: 0,
    ash: 1,
  },
  {
    id: 'night',
    label: 'Night',
    grade: (m) => {
      m.saturate(-0.45, true);
      m.alpha = 1;
    },
    vignette: { strength: 0.9, color: 0x03040a },
    shade: { color: 0x0a0e1c, alpha: 0.64 },
    sky: 0x4a5068,
    fog: { tint: 0x8a96b8, alpha: 0.14 },
    lights: 1.25,
    heroLight: 0.55,
    ash: 0.35,
  },
  {
    id: 'ink',
    label: 'Ink',
    grade: (m) => {
      m.contrast(0.15, true);
      m.alpha = 1;
    },
    vignette: { strength: 0.55, color: 0x2a1c12 },
    shade: { color: 0x000000, alpha: 0 },
    sky: 0xffffff,
    fog: { tint: 0xf1e6d3, alpha: 0.2 },
    lights: 0.35,
    heroLight: 0,
    ash: 0.4,
    gradientMap: [0x1f150e, 0xf1e2c6],
  },
  {
    id: 'raw',
    label: 'Raw',
    grade: (m) => {
      m.alpha = 0;
    },
    vignette: { strength: 0, color: 0x000000 },
    shade: { color: 0x000000, alpha: 0 },
    sky: 0xffffff,
    fog: { tint: 0xffffff, alpha: 0 },
    lights: 0.4,
    heroLight: 0,
    ash: 0,
  },
];

export function presetById(id: string | null): StylePreset {
  return STYLE_PRESETS.find((p) => p.id === id) ?? (STYLE_PRESETS[0] as StylePreset);
}
