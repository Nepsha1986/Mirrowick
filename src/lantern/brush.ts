export type Ctx = CanvasRenderingContext2D;
export type P = [number, number];

export const INK = '#1c130d';

/** Tiny canvas brush set; every shape can carry an ink outline. */
export function painter(c: Ctx) {
  const finish = (fill: string, ink: number) => {
    c.fillStyle = fill;
    c.fill();
    if (ink > 0) {
      c.strokeStyle = INK;
      c.lineWidth = ink;
      c.lineJoin = 'round';
      c.stroke();
    }
  };
  return {
    ctx: c,
    circ(x: number, y: number, r: number, f: string, ink = 0) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      finish(f, ink);
    },
    ell(x: number, y: number, rx: number, ry: number, f: string, ink = 0) {
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      finish(f, ink);
    },
    rect(x: number, y: number, w: number, h: number, f: string, ink = 0) {
      c.beginPath();
      c.rect(x, y, w, h);
      finish(f, ink);
    },
    line(x0: number, y0: number, x1: number, y1: number, s: string, w: number) {
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.strokeStyle = s;
      c.lineWidth = w;
      c.lineCap = 'round';
      c.stroke();
    },
    poly(p: P[], f: string, ink = 0) {
      c.beginPath();
      p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      finish(f, ink);
    },
  };
}
export type Painter = ReturnType<typeof painter>;
