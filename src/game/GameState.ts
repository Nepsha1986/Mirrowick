import type { ItemDef } from '../level/types';

/** Run-time state of one play-through of a level. */
export class GameState {
  readonly items: ItemDef[] = [];
  /** How many times each prop (by index) has been used. */
  private readonly uses = new Map<number, number>();

  has(itemId: string): boolean {
    return this.items.some((i) => i.id === itemId);
  }

  give(item: ItemDef): void {
    if (!this.has(item.id)) this.items.push(item);
  }

  usesOf(prop: number): number {
    return this.uses.get(prop) ?? 0;
  }

  markUsed(prop: number): number {
    const n = this.usesOf(prop) + 1;
    this.uses.set(prop, n);
    return n;
  }
}
