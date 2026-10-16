import type { Interaction, ItemDef } from '../level/types';
import type { GameState } from './GameState';

export interface InteractionResult {
  line: string;
  /** Item that changes hands this time. */
  item?: ItemDef;
  /** The prop vanishes into the inventory. */
  removeProp?: boolean;
  /** Frame (isometric) or tile (top-down) to swap the prop to. */
  frame?: string;
  tile?: number;
  /** Whether to play the pickup animation first. */
  grab?: boolean;
}

/**
 * Pure rules for using a prop. `uses` counts previous successful uses; a
 * locked prop does not count attempts as uses (only its own `missing` lines).
 */
export function resolveInteraction(
  it: Interaction,
  propIndex: number,
  state: GameState,
  lockedAttempts: number,
): InteractionResult & { unlocked: boolean } {
  if (it.requires && !state.has(it.requires.item)) {
    const lines = it.requires.missing;
    return { line: pick(lines, lockedAttempts), unlocked: false };
  }
  const uses = state.usesOf(propIndex);
  const line = pick(it.lines, uses);
  const first = uses === 0;
  if (first && it.pickup) {
    return { line, item: it.pickup, removeProp: true, grab: true, unlocked: true };
  }
  if (first && it.gives) {
    return {
      line,
      item: it.gives,
      frame: it.usedFrame,
      tile: it.usedTile,
      grab: true,
      unlocked: true,
    };
  }
  return first
    ? { line, frame: it.usedFrame, tile: it.usedTile, unlocked: true }
    : { line, unlocked: true };
}

function pick(lines: string[], n: number): string {
  return lines[Math.min(n, lines.length - 1)] ?? '';
}
