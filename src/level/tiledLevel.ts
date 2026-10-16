import { NavGrid } from '../core/grid';
import type { Cell } from '../core/iso';
import type { TopDownFacing } from '../game/TopDownPlayer';
import type { Interaction, Light } from './types';

/** The subset of the Tiled JSON format the game reads. */
export interface TiledMap {
  width: number;
  height: number;
  layers: (
    | { type: 'tilelayer'; name: string; data: number[] }
    | { type: 'objectgroup'; name: string; objects: TiledObject[] }
  )[];
}

interface TiledObject {
  type: string;
  x: number;
  y: number;
  properties?: { name: string; value: string }[];
}

export interface TopDownThing<T> extends Cell {
  value: T;
}

export interface TopDownLevel {
  nav: NavGrid;
  spawn: Cell;
  spawnFacing: TopDownFacing;
  interactables: TopDownThing<Interaction>[];
  lights: TopDownThing<Light>[];
}

const TILE = 16;

/**
 * Reads a map written by tools/assets/build_topdown.py (or edited in Tiled):
 * a hidden "Collision" tile layer and a "Things" object layer holding the
 * spawn point, lights and interactables, one per cell.
 */
export function parseTopDownLevel(map: TiledMap): TopDownLevel {
  const nav = new NavGrid(map.width, map.height);
  const collision = map.layers.find((l) => l.type === 'tilelayer' && l.name === 'Collision');
  if (collision?.type !== 'tilelayer') throw new Error('map has no Collision layer');
  collision.data.forEach((v, i) => {
    if (v) nav.blockCell(i % map.width, Math.floor(i / map.width));
  });

  const things = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'Things');
  const objects = things?.type === 'objectgroup' ? things.objects : [];
  const level: TopDownLevel = {
    nav,
    spawn: { c: 0, r: 0 },
    spawnFacing: 'down',
    interactables: [],
    lights: [],
  };
  for (const o of objects) {
    const props = Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
    const cell = { c: Math.floor(o.x / TILE), r: Math.floor(o.y / TILE) };
    if (o.type === 'spawn') {
      level.spawn = cell;
      level.spawnFacing = (props.facing as TopDownFacing | undefined) ?? 'down';
    } else if (o.type === 'interact' && props.interact) {
      level.interactables.push({ ...cell, value: JSON.parse(props.interact) as Interaction });
    } else if (o.type === 'light') {
      level.lights.push({
        ...cell,
        value: {
          radius: Number(props.radius),
          color: Number(props.color),
          intensity: Number(props.intensity),
          height: Number(props.height),
          flicker: props.flicker === 'True' || props.flicker === 'true',
        },
      });
    }
  }
  return level;
}
