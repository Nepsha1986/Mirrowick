import type { NavGrid } from './grid';
import type { Cell } from './iso';

const SQRT2 = Math.SQRT2;

function octile(a: Cell, b: Cell): number {
  const dx = Math.abs(a.c - b.c);
  const dy = Math.abs(a.r - b.r);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * A* over the 8-connected grid. Returns the cells to walk through after
 * `start`, ending at `goal`; an empty array when already there; null when the
 * goal is unreachable.
 */
export function findPath(grid: NavGrid, start: Cell, goal: Cell): Cell[] | null {
  if (!grid.isWalkable(goal.c, goal.r)) return null;
  if (start.c === goal.c && start.r === goal.r) return [];

  const w = grid.width;
  const idx = (c: Cell) => c.r * w + c.c;
  const g = new Map<number, number>([[idx(start), 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const open = new MinHeap();
  open.push(idx(start), octile(start, goal));

  while (open.size) {
    const cur = open.pop();
    if (closed.has(cur)) continue;
    if (cur === idx(goal)) return rebuild(came, cur, idx(start), w);
    closed.add(cur);
    const cell = { c: cur % w, r: Math.floor(cur / w) };
    const base = g.get(cur) ?? 0;
    for (const n of grid.neighbours(cell)) {
      const ni = idx(n);
      if (closed.has(ni)) continue;
      const cost = base + (n.c !== cell.c && n.r !== cell.r ? SQRT2 : 1);
      if (cost < (g.get(ni) ?? Infinity)) {
        g.set(ni, cost);
        came.set(ni, cur);
        open.push(ni, cost + octile(n, goal));
      }
    }
  }
  return null;
}

function rebuild(came: Map<number, number>, end: number, start: number, w: number): Cell[] {
  const path: Cell[] = [];
  for (let cur = end; cur !== start; cur = came.get(cur) as number) {
    path.push({ c: cur % w, r: Math.floor(cur / w) });
  }
  return path.reverse();
}

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.prio.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((this.prio[p] as number) <= priority) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.items[0] as number;
    const lastItem = this.items.pop() as number;
    const lastPrio = this.prio.pop() as number;
    if (this.items.length) {
      this.items[0] = lastItem;
      this.prio[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.prio.length && (this.prio[l] as number) < (this.prio[m] as number)) m = l;
        if (r < this.prio.length && (this.prio[r] as number) < (this.prio[m] as number)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b] as number, this.items[a] as number];
    [this.prio[a], this.prio[b]] = [this.prio[b] as number, this.prio[a] as number];
  }
}
