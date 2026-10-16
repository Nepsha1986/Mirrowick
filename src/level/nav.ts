import { NavGrid } from '../core/grid';
import type { Cell } from '../core/iso';
import { SIDE_STEP, type LevelDef, type Prop } from './types';

/** Props that never block movement unless they say otherwise. */
const DECOR = [
  'grass',
  'mushroom',
  'debris',
  'planksBroken',
  'hanging_moss',
  'detailChalice',
  'woodenSupports',
  'shovelDirt',
  'town_wheel',
];

export function isSolid(p: Prop): boolean {
  if (p.edge) return false;
  if (p.solid !== undefined) return p.solid;
  return !DECOR.some((d) => p.frame.startsWith(d));
}

export function levelSize(level: LevelDef): { width: number; height: number } {
  return { width: level.ground[0]?.length ?? 0, height: level.ground.length };
}

export function buildNav(level: LevelDef): NavGrid {
  const { width, height } = levelSize(level);
  const grid = new NavGrid(width, height);
  level.ground.forEach((row, r) => {
    for (let c = 0; c < width; c++) if (row[c] === ' ') grid.blockCell(c, r);
  });
  for (const p of level.props) {
    if (p.edge) {
      const [dc, dr] = SIDE_STEP[p.edge];
      grid.blockEdge(p.c, p.r, dc, dr);
    } else if (isSolid(p)) {
      grid.blockCell(p.c, p.r);
    }
  }
  return grid;
}

/**
 * Cells from which a prop can be used: walkable 8-neighbours not separated
 * from the prop by a wall, plus the prop's own cell when it is walkable.
 */
export function useSpots(grid: NavGrid, p: Prop): Cell[] {
  const spots: Cell[] = [];
  if (grid.isWalkable(p.c, p.r)) spots.push({ c: p.c, r: p.r });
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const c = p.c + dc;
      const r = p.r + dr;
      if (!grid.isWalkable(c, r)) continue;
      if (dc && dr) {
        // Diagonal neighbours count only if one of the L-routes is wall-free.
        const viaC = !grid.isEdgeBlocked(p.c, p.r, dc, 0) && !grid.isEdgeBlocked(c, p.r, 0, dr);
        const viaR = !grid.isEdgeBlocked(p.c, p.r, 0, dr) && !grid.isEdgeBlocked(p.c, r, dc, 0);
        if (viaC || viaR) spots.push({ c, r });
      } else if (!grid.isEdgeBlocked(p.c, p.r, dc, dr)) {
        spots.push({ c, r });
      }
    }
  }
  return spots;
}
