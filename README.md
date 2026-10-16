# Mirrowick

A top-down web game about two parallel worlds that share one name. You carry
a lantern through the **Lower World** around the village of Mirrowick, where
the dark is real and only the Wick, a great candle in the square, keeps it
back. Above it lies the **Upper World**: an ordinary, sunlit countryside
where the game begins, at home. The worlds meet in the old windmill — a ruin
upstairs, whole and turning below — through a mirror set in its floor.

**Play in the browser: https://nepsha1986.github.io/Mirrowick/**

This is an early prototype for the game's look and feel: the main menu, the
village and the land around it, the homestead in the Upper World, travel
between the worlds, free movement, light and darkness, and a day–night cycle.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command                           | What it does                    |
| --------------------------------- | ------------------------------- |
| `npm run dev`                     | Dev server with hot reload      |
| `npm run build`                   | Type-check and build to `dist/` |
| `npm run preview`                 | Serve the production build      |
| `npm test`                        | Unit tests (Vitest)             |
| `npm run lint` / `npm run format` | ESLint / Prettier               |

## Controls

| Input            | Action                      |
| ---------------- | --------------------------- |
| Click / hold     | Walk there / steer the hero |
| `WASD` or arrows | Walk                        |
| `E`              | Step into a mirror          |
| `T` (hold)       | Speed time up               |
| `Esc`            | Back to the main menu       |

## How it's made

There are no image files. Every texture is painted by code into canvases when
the game starts:

- `src/lantern/art.ts` paints the ground tiles (grass, roads, water, the
  palisade, the Mirror's black glass…) and the world's objects (trees, rocks,
  carts, ruins, the hero).
- `src/lantern/town-art.ts` paints the village: floors and walls (planks,
  parquet, chequered stone, flagstones, half-timbering), furniture, market
  stalls, villagers, hens, the mosaic square and a roof for every building.
- `src/lantern/world.ts` generates the 100×80 map from a fixed seed: the
  village behind its palisade, roads, a river and a brook, ruined hamlets, the
  forest, the Mirror and the windmill. `src/lantern/town.ts` lays out the
  village by hand.
- `src/lantern/upper.ts` lays out the Upper World's 40×30 homestead: a house
  with five rooms, a car in the drive, the garden, the road and the ruined
  mill; `src/lantern/upper-art.ts` paints its ground and things.

Light works like this: every frame a darkness texture is filled and the
hero's lantern (a pool and a beam), the lamps, lit windows, the Wick and the
glowing shards are erased out of it; tinted glows are added on top. Roofs lift
when you walk into a building and the room lights up.

## Stack

- [Phaser 4](https://phaser.io) (WebGL) for the game, TypeScript and Vite for
  the build
- The menus and HUD are plain HTML/CSS laid over the canvas (`src/ui/`)
- The music is synthesised with Web Audio, so there are no audio files

## Layout

```
src/
  lantern/   world generation, the village, painting, navigation (A*)
  scenes/    Boot → Menu (live backdrop) → Lantern
  ui/        DOM overlay: loader, main menu, HUD, styles
  audio/     procedural ambient music
```

See [CREDITS.md](CREDITS.md).
