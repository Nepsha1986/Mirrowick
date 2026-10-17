import { T, type Pt } from './util';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Free movement over a tile grid: circle collision, A* and path smoothing.
 * Thin walls give their tiles finer collision: A* still routes round those
 * tiles, but you can walk right up to the wall itself.
 */
export class Nav {
  private readonly thin = new Map<number, Rect[]>();

  constructor(
    private readonly block: Uint8Array,
    private readonly w: number,
    private readonly h: number,
    walls: Rect[] = [],
  ) {
    for (const r of walls) {
      for (let ty = Math.floor(r.y / T); ty <= Math.floor((r.y + r.h - 0.01) / T); ty++) {
        for (let tx = Math.floor(r.x / T); tx <= Math.floor((r.x + r.w - 0.01) / T); tx++) {
          const i = ty * w + tx;
          let list = this.thin.get(i);
          if (!list) this.thin.set(i, (list = []));
          list.push(r);
        }
      }
    }
  }

  walkable(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.block[y * this.w + x] === 0;
  }

  solidAt(px: number, py: number): boolean {
    return this.thinAt(px, py) ?? !this.walkable(Math.floor(px / T), Math.floor(py / T));
  }

  /** On a tile with thin walls, whether the point is in one; elsewhere undefined. */
  private thinAt(px: number, py: number): boolean | undefined {
    const x = Math.floor(px / T);
    const y = Math.floor(py / T);
    const rects = x >= 0 && y >= 0 && x < this.w && y < this.h && this.thin.get(y * this.w + x);
    if (rects) return rects.some((r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
    return undefined;
  }

  circleFree(x: number, y: number, r: number): boolean {
    for (const [dx, dy] of [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r],
      [0, -r],
      [0, r],
      [-r, 0],
      [r, 0],
    ] as const) {
      if (this.solidAt(x + dx, y + dy)) return false;
    }
    return true;
  }

  /** Moves axis by axis so the walker slides along walls. */
  move(e: Pt, dx: number, dy: number, r: number): void {
    if (dx && this.circleFree(e.x + dx, e.y, r)) e.x += dx;
    if (dy && this.circleFree(e.x, e.y + dy, r)) e.y += dy;
  }

  lineFree(x0: number, y0: number, x1: number, y1: number, r: number): boolean {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!this.circleFree(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r)) return false;
    }
    return true;
  }

  /** Whether a thin wall, post or fence stands between two points. */
  wallBetween(a: Pt, b: Pt): boolean {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
    for (let i = 1; i < n; i++) {
      if (this.thinAt(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)) return true;
    }
    return false;
  }

  /** A* between tiles; snaps an unwalkable goal to the nearest free tile. */
  astar(sx: number, sy: number, tx: number, ty: number): Pt[] | null {
    if (!this.walkable(tx, ty)) {
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (let r = 1; r <= 4 && !best; r++) {
        for (let y = ty - r; y <= ty + r; y++) {
          for (let x = tx - r; x <= tx + r; x++) {
            const d = (x - tx) ** 2 + (y - ty) ** 2;
            if (this.walkable(x, y) && d < bd) {
              bd = d;
              best = [x, y];
            }
          }
        }
      }
      if (!best) return null;
      [tx, ty] = best;
    }
    const W = this.w;
    const N = W * this.h;
    const g = new Float32Array(N).fill(1e9);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap: [number, number][] = [];
    const hf = (i: number) => {
      const dx = Math.abs((i % W) - tx);
      const dy = Math.abs(((i / W) | 0) - ty);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const push = (n: [number, number]) => {
      heap.push(n);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if ((heap[p] as [number, number])[0] <= n[0]) break;
        heap[i] = heap[p] as [number, number];
        i = p;
      }
      heap[i] = n;
    };
    const pop = () => {
      const top = heap[0] as [number, number];
      const last = heap.pop() as [number, number];
      if (heap.length) {
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          const val = (k: number) => (k === i ? last[0] : (heap[k] as [number, number])[0]);
          if (l < heap.length && val(l) < val(m)) m = l;
          if (r < heap.length && val(r) < val(m)) m = r;
          if (m === i) break;
          heap[i] = heap[m] as [number, number];
          i = m;
        }
        heap[i] = last;
      }
      return top;
    };
    const s = sy * W + sx;
    const t = ty * W + tx;
    g[s] = 0;
    push([hf(s), s]);
    let found = false;
    for (let it = 0; heap.length && it < 12000; it++) {
      const [, c] = pop();
      if (c === t) {
        found = true;
        break;
      }
      if (closed[c]) continue;
      closed[c] = 1;
      const cx = c % W;
      const cy = (c / W) | 0;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.walkable(nx, ny)) continue;
        if (dx && dy && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        const ng = (g[c] as number) + cost;
        if (ng < (g[ni] as number)) {
          g[ni] = ng;
          came[ni] = c;
          push([ng + hf(ni), ni]);
        }
      }
    }
    if (!found) return null;
    const out: Pt[] = [];
    for (let c = t; c !== -1 && c !== s; c = came[c] as number) {
      out.push({ x: ((c % W) + 0.5) * T, y: (((c / W) | 0) + 0.5) * T });
    }
    return out.reverse();
  }

  /** Path to a world point, with corners cut wherever a straight walk fits. */
  route(from: Pt, to: Pt, r: number): Pt[] {
    const tx = Math.floor(to.x / T);
    const ty = Math.floor(to.y / T);
    const path = this.astar(Math.floor(from.x / T), Math.floor(from.y / T), tx, ty);
    if (!path) return [];
    if (path.length && this.walkable(tx, ty) && this.circleFree(to.x, to.y, r)) {
      path[path.length - 1] = { ...to };
    }
    const out: Pt[] = [];
    let cur = from;
    for (let i = 0; i < path.length;) {
      let j = path.length - 1;
      while (j > i && !this.lineFree(cur.x, cur.y, (path[j] as Pt).x, (path[j] as Pt).y, r)) j--;
      cur = path[j] as Pt;
      out.push(cur);
      i = j + 1;
    }
    return out;
  }
}
