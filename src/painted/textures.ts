import type * as Phaser from 'phaser';
import type { House, PropKind, VillageLayout } from './layout';
import {
  HERO_FACINGS,
  HERO_H,
  HERO_W,
  PROP_SIZE,
  RES,
  WORLD_H,
  WORLD_W,
  paintGround,
  paintHero,
  paintHouse,
  paintProp,
  type PaintedPiece,
} from './paint';

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Phaser.Textures.CanvasTexture {
  const tex = scene.textures.createCanvas(key, Math.ceil(w * RES), Math.ceil(h * RES));
  if (!tex) throw new Error(`could not create ${key}`);
  const ctx = tex.getContext();
  ctx.scale(RES, RES);
  draw(ctx);
  tex.refresh();
  return tex;
}

export const groundKey = 'pt-ground';
export const houseKey = (i: number) => `pt-house-${i}`;
export const propKey = (kind: PropKind, variant: number) => `pt-${kind}-${variant}`;

/**
 * Paints every texture of the painted village into canvases. Nothing is
 * loaded from disk: the whole look lives in paint.ts.
 */
export function createPaintedTextures(scene: Phaser.Scene, layout: VillageLayout): PaintedPiece[] {
  const pieces = layout.houses.map((h: House) => paintHouse(h));
  if (scene.textures.exists(groundKey)) return pieces;

  canvasTexture(scene, groundKey, WORLD_W, WORLD_H, (ctx) => paintGround(ctx, layout));
  pieces.forEach((p, i) => canvasTexture(scene, houseKey(i), p.w, p.h, p.draw));

  const seen = new Set<string>();
  for (const prop of layout.props) {
    const key = propKey(prop.kind, prop.variant);
    if (seen.has(key)) continue;
    seen.add(key);
    const [w, h] = PROP_SIZE[prop.kind];
    canvasTexture(scene, key, w, h, (ctx) => paintProp(ctx, prop.kind, prop.variant));
  }

  const hero = canvasTexture(scene, 'pt-hero', HERO_W * 3, HERO_H * HERO_FACINGS.length, paintHero);
  HERO_FACINGS.forEach((facing, row) => {
    for (let f = 0; f < 3; f++) {
      hero.add(
        `${facing}_${f}`,
        0,
        f * HERO_W * RES,
        row * HERO_H * RES,
        HERO_W * RES,
        HERO_H * RES,
      );
    }
  });
  return pieces;
}
