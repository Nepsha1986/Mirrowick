import * as Phaser from 'phaser';
import { music } from '../audio/AmbientMusic';
import type { Cell } from '../core/iso';
import { findPath } from '../core/pathfinding';
import { GameState } from '../game/GameState';
import { resolveInteraction } from '../game/interactions';
import { TD_TILE, TopDownPlayer } from '../game/TopDownPlayer';
import { useSpots } from '../level/nav';
import {
  parseTopDownLevel,
  type TiledMap,
  type TopDownLevel,
  type TopDownThing,
} from '../level/tiledLevel';
import type { Interaction } from '../level/types';
import { Atmosphere } from '../render/Atmosphere';
import { Hud } from '../ui/Hud';

/** Tile layers drawn under the hero, in order; "Above" goes over it. */
const UNDER = ['Ground', 'Path', 'Objects', 'Details', 'Details2'];
const DEPTH_CURSOR = 900;
const DEPTH_HERO = 1000;
const DEPTH_ABOVE = 2000;
const ZOOMS = [2, 3, 4];

/**
 * The same village seen from above (3/4 view), built from a Tiled map. A
 * prototype for comparing the two camera styles; it reuses the navigation,
 * interaction rules, HUD, music and visual styles of the isometric scene.
 */
export class TopDownScene extends Phaser.Scene {
  private level!: TopDownLevel;
  private map!: Phaser.Tilemaps.Tilemap;
  private player!: TopDownPlayer;
  private state!: GameState;
  private hud!: Hud;
  private atmosphere!: Atmosphere;
  private cursor!: Phaser.GameObjects.Graphics;
  private lockedAttempts = new Map<number, number>();
  /** Interactables picked up and gone, by index. */
  private gone = new Set<number>();
  private zoomIndex = 1;

  constructor() {
    super('topdown');
  }

  create(): void {
    this.state = new GameState();
    this.lockedAttempts.clear();
    this.gone.clear();
    this.level = parseTopDownLevel(this.cache.tilemap.get('td-village').data as TiledMap);

    this.map = this.make.tilemap({ key: 'td-village' });
    const tiles = this.map.addTilesetImage('roguelike', 'td-tiles');
    if (!tiles) throw new Error('tileset missing');
    UNDER.forEach((name, i) => this.map.createLayer(name, tiles)?.setDepth(i));
    this.map.createLayer('Above', tiles)?.setDepth(DEPTH_ABOVE);
    this.cursor = this.add.graphics().setDepth(DEPTH_CURSOR);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    cam.setZoom(ZOOMS[this.zoomIndex] as number);
    cam.setRoundPixels(true);

    this.atmosphere = new Atmosphere(this, { heroGlow: { width: 110, height: 80, lift: 8 } });
    for (const l of this.level.lights) {
      this.atmosphere.addLight(l.c * TD_TILE + TD_TILE / 2, l.r * TD_TILE + TD_TILE - 2, l.value);
    }

    this.player = new TopDownPlayer(this, this.level.spawn, this.level.spawnFacing);
    this.player.sprite.setDepth(DEPTH_HERO);
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);

    this.setupInput();
    this.hud = new Hud('Mirrowick', 'The Lower World · top-down', music.muted, {
      setStyle: (id) => {
        this.atmosphere.applyStyle(id);
        this.hud.setStyle(id);
      },
      toggleMusic: () => {
        music.start();
        return music.toggle();
      },
      pause: (paused) => (paused ? this.scene.pause() : this.scene.resume()),
      mainMenu: () => this.scene.start('menu'),
    });
    this.atmosphere.applyStyle(this.atmosphere.styleId);
    this.hud.setStyle(this.atmosphere.styleId);
    this.hud.message('The road ends here, and so does the map you bought in town.');
    this.hud.message(
      'Top-down prototype: the same village and the same story, seen from above.',
      'hint',
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hud.destroy());
    cam.fadeIn(700, 26, 18, 12);
  }

  update(): void {
    const dt = Math.min(this.game.loop.rawDelta, 100) / 1000;
    this.player.update(dt);
    const hero = this.player.sprite;
    this.atmosphere.update(hero.x, hero.y);
  }

  // --- Input -------------------------------------------------------------------------

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.hover(p));
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      const cell = this.pointerCell(p);
      const thing = this.thingAt(cell);
      if (thing) this.use(thing);
      else this.walkTo(cell);
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        this.zoomIndex = Phaser.Math.Clamp(this.zoomIndex + (dy > 0 ? -1 : 1), 0, ZOOMS.length - 1);
        this.cameras.main.setZoom(ZOOMS[this.zoomIndex] as number);
        this.atmosphere.layout();
      },
    );
  }

  private pointerCell(pointer: Phaser.Input.Pointer): Cell {
    const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return { c: Math.floor(p.x / TD_TILE), r: Math.floor(p.y / TD_TILE) };
  }

  private thingAt(cell: Cell): TopDownThing<Interaction> | undefined {
    return this.level.interactables.find(
      (t, i) => t.c === cell.c && t.r === cell.r && !this.gone.has(i),
    );
  }

  private hover(pointer: Phaser.Input.Pointer): void {
    const cell = this.pointerCell(pointer);
    const thing = this.thingAt(cell);
    this.cursor.clear();
    this.hud.hoverLabel(thing ? thing.value.name : null, pointer.x, pointer.y - 22);
    this.input.setDefaultCursor(thing ? 'pointer' : 'default');
    if (thing || this.level.nav.isWalkable(cell.c, cell.r)) {
      this.cursor.lineStyle(1, thing ? 0xffd2a0 : 0xf08a3c, 0.8);
      this.cursor.strokeRect(
        cell.c * TD_TILE + 0.5,
        cell.r * TD_TILE + 0.5,
        TD_TILE - 1,
        TD_TILE - 1,
      );
    }
  }

  // --- Movement and interaction ------------------------------------------------------

  private walkTo(goal: Cell, onArrive?: () => void): void {
    const start = this.player.nextCell;
    const path = findPath(this.level.nav, start, goal);
    if (!path) return;
    this.player.walk([...(this.player.moving ? [start] : []), ...path], onArrive);
  }

  private use(thing: TopDownThing<Interaction>): void {
    const start = this.player.nextCell;
    let best: Cell[] | null = null;
    for (const spot of useSpots(this.level.nav, thing)) {
      const path = findPath(this.level.nav, start, spot);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) {
      this.hud.message(`You can’t reach the <b>${thing.value.name}</b> from here.`);
      return;
    }
    this.player.walk([...(this.player.moving ? [start] : []), ...best], () => {
      this.player.face(thing.c, thing.r);
      this.interact(thing);
    });
  }

  private interact(thing: TopDownThing<Interaction>): void {
    const it = thing.value;
    const index = this.level.interactables.indexOf(thing);
    const attempts = this.lockedAttempts.get(index) ?? 0;
    const result = resolveInteraction(it, index, this.state, attempts);
    const apply = () => {
      this.hud.message(`<b>${it.name}.</b> ${result.line}`);
      if (!result.unlocked) {
        this.lockedAttempts.set(index, attempts + 1);
        return;
      }
      this.state.markUsed(index);
      if (result.tile) this.map.putTileAt(result.tile, thing.c, thing.r, true, 'Objects');
      if (result.item) {
        this.state.give(result.item);
        this.hud.setItems(this.state.items, result.item.id);
        this.hud.message(`Added to inventory: <b>${result.item.name}</b>.`);
      }
      if (result.removeProp) {
        this.map.removeTileAt(thing.c, thing.r, true, true, 'Objects');
        this.gone.add(index);
        this.hud.hoverLabel(null);
      }
    };
    if (result.grab) this.player.pickup(apply);
    else apply();
  }
}
