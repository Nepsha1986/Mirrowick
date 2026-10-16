import type * as Phaser from 'phaser';

/** Small procedural textures: light glow and ash flakes. */
export function createProceduralTextures(scene: Phaser.Scene): void {
  const glow = scene.textures.createCanvas('glow', 256, 256);
  if (glow) {
    const ctx = glow.getContext();
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    glow.refresh();
  }

  // Vignette: clear centre, opaque rim; tinted per style at run time.
  const vig = scene.textures.createCanvas('vignette', 512, 512);
  if (vig) {
    const ctx = vig.getContext();
    const g = ctx.createRadialGradient(256, 256, 120, 256, 256, 362);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    vig.refresh();
  }

  const ash = scene.textures.createCanvas('ash', 16, 16);
  if (ash) {
    const ctx = ash.getContext();
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    ash.refresh();
  }
}
