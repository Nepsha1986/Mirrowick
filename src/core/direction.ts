/**
 * The hero sprites come in 8 facings numbered clockwise from up-right:
 * 0 ↗, 1 →, 2 ↘, 3 ↓, 4 ↙, 5 ←, 6 ↖, 7 ↑ (screen space).
 */
export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Facing for a screen-space movement vector (y grows downwards). */
export function facingFromVector(dx: number, dy: number): Facing {
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); // -4..4, 0 = right
  return ((((octant + 1) % 8) + 8) % 8) as Facing;
}
