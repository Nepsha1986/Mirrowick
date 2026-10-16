/** Isometric projection for a 2:1 diamond grid. */

export const TILE_W = 128;
export const TILE_H = 64;

export interface Cell {
  c: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Grid → world pixels. Integer (c, r) is the centre of a cell; the column axis
 * runs down-right on screen and the row axis down-left.
 */
export function gridToWorld(c: number, r: number): Point {
  return { x: ((c - r) * TILE_W) / 2, y: ((c + r) * TILE_H) / 2 };
}

/** World pixels → fractional grid coordinates (inverse of gridToWorld). */
export function worldToGrid(x: number, y: number): Point {
  const u = x / (TILE_W / 2);
  const v = y / (TILE_H / 2);
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

/** World pixels → the cell whose diamond contains the point. */
export function worldToCell(x: number, y: number): Cell {
  const g = worldToGrid(x, y);
  return { c: Math.round(g.x), r: Math.round(g.y) };
}

/** Depth used for painter's-algorithm sorting: the footprint's screen y. */
export function depthOf(c: number, r: number): number {
  return gridToWorld(c, r).y;
}
