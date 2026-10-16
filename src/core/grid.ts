import type { Cell } from './iso';

/**
 * Walkability grid. Cells can be blocked (void, rocks, barrels…) and the edges
 * between neighbouring cells can be blocked by thin walls.
 */
export class NavGrid {
  private readonly blockedCells = new Set<number>();
  private readonly blockedEdges = new Set<string>();

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  inBounds(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.width && r < this.height;
  }

  blockCell(c: number, r: number): void {
    this.blockedCells.add(r * this.width + c);
  }

  /** Blocks the shared edge between (c, r) and its orthogonal neighbour. */
  blockEdge(c: number, r: number, dc: number, dr: number): void {
    this.blockedEdges.add(edgeKey(c, r, c + dc, r + dr));
  }

  isEdgeBlocked(c: number, r: number, dc: number, dr: number): boolean {
    return this.blockedEdges.has(edgeKey(c, r, c + dc, r + dr));
  }

  isWalkable(c: number, r: number): boolean {
    return this.inBounds(c, r) && !this.blockedCells.has(r * this.width + c);
  }

  /** Whether a single 8-way step from (c, r) by (dc, dr) is allowed. */
  canStep(c: number, r: number, dc: number, dr: number): boolean {
    const nc = c + dc;
    const nr = r + dr;
    if (!this.isWalkable(nc, nr)) return false;
    if (dc === 0 || dr === 0) return !this.isEdgeBlocked(c, r, dc, dr);
    // Diagonal: both L-shaped routes must be open so we never clip a corner.
    return (
      this.canStep(c, r, dc, 0) &&
      this.canStep(c + dc, r, 0, dr) &&
      this.canStep(c, r, 0, dr) &&
      this.canStep(c, r + dr, dc, 0)
    );
  }

  neighbours(cell: Cell): Cell[] {
    const out: Cell[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if ((dc || dr) && this.canStep(cell.c, cell.r, dc, dr)) {
          out.push({ c: cell.c + dc, r: cell.r + dr });
        }
      }
    }
    return out;
  }
}

function edgeKey(c1: number, r1: number, c2: number, r2: number): string {
  return c1 < c2 || (c1 === c2 && r1 < r2) ? `${c1},${r1}|${c2},${r2}` : `${c2},${r2}|${c1},${r1}`;
}
