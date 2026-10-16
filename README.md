# Mirrowick

An isometric web game about two parallel worlds that share one name. In the
spirit of Fallout 2, minus the turns: you click to walk, click things to look
at them, pick things up and use them.

**Play in the browser: https://nepsha1986.github.io/Mirrowick/**

This is an early prototype. It has the main menu and one small level, an
abandoned village in the **Lower World**, used to try out the game's look.

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

| Input       | Action                                   |
| ----------- | ---------------------------------------- |
| Left click  | Walk / use an object                     |
| Mouse wheel | Zoom                                     |
| `1`–`5`     | Visual style: Dusk, Ash, Night, Ink, Raw |
| `M`         | Music on/off                             |
| `Esc`       | Pause menu                               |

The visual styles are the playground for picking the final mood. They are
built from colour grading, fog, a vignette, a darkening layer and light glows,
and are defined in `src/render/stylePresets.ts`.

## Stack

- [Phaser 4](https://phaser.io) (WebGL) for the game, TypeScript and Vite for
  the build
- The menus and HUD are plain HTML/CSS laid over the canvas (`src/ui/`)
- The music is synthesised with Web Audio, so there are no audio files

## Layout

```
src/
  core/      isometric maths, navigation grid, A* pathfinding (pure, tested)
  level/     level format and the village level (ASCII ground + props)
  game/      player, game state, interaction rules
  render/    style presets, procedural textures, floating-island underside
  scenes/    Boot → Menu → Game
  ui/        DOM overlay: loader, main menu, HUD, styles
  audio/     procedural ambient music
public/assets/   generated atlases and backdrops (committed)
tools/assets/    asset pipeline (Python)
```

### Levels

A level is a `LevelDef` (`src/level/types.ts`). It has an ASCII ground map
(one glyph per cell, space = void) and a list of props. A prop is placed on a
cell. A wall or fence sits on one edge of its cell (`edge: 'N' | 'E' | 'S' |
'W'`) and blocks only that edge, so buildings have real doorways. Interactions
can give or pick up items and can require an item to work. The tests in
`src/level/village.test.ts` check that every frame exists in the atlas and
that every interactive object can be reached from the spawn point.

### Rebuilding the art

The atlases in `public/assets` are generated from Kenney's CC0 packs:

```bash
pip install -r tools/assets/requirements.txt
tools/assets/fetch_kenney.sh            # sparse clone into .cache/kenney
python3 tools/assets/build_assets.py    # world + hero atlases (WebP)
python3 tools/assets/build_backdrops.py # sky, fog, menu background
```

See [CREDITS.md](CREDITS.md).
