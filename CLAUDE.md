# Mirrowick — notes for Claude

A top-down web game about two parallel worlds that share one name: the dark,
solitary **Lower World** and the ordinary, sunlit **Upper World**, joined by a
mirror in the windmill's floor. Phaser 4 (WebGL), TypeScript, Vite.

## Docs

`docs/` holds a few short notes in Russian, for the owner (who speaks Russian;
talk to them in Russian):

- `docs/vision.md`: what the game is
- `docs/worlds.md`: what is in each world now
- `docs/decisions.md`: what has been decided, newest first

Keep them **minimal**. Record only what is built or what the owner has
decided, never ideas that were only discussed. When a change alters what's in
a world, update `docs/worlds.md` in the same PR. When the owner makes a
decision, add one line to `docs/decisions.md`.

Code, comments, commit messages and in-game UI text are in English.

## Commands

```bash
npm run dev        # dev server, http://localhost:5173
npm run typecheck
npm run lint
npm run format     # Prettier; CI runs format:check
npm test           # Vitest
npm run build
```

Before pushing, run typecheck, lint, `format:check` and the tests; CI checks all
four plus the build. `main` deploys to GitHub Pages.

## How the code is laid out

- `src/scenes/LanternScene.ts`: the one game scene. `init({ realm })` picks
  `'lower'` or `'upper'`. Stepping through a mirror restarts the scene with
  the other realm (`scene.restart`). The camera follows the hero, and a
  darkness texture is refilled every frame with lights erased out of it.
  Objects are culled in chunks.
- `src/lantern/world.ts`: the Lower World, generated from a fixed seed.
  Also defines `World`, `Portal`, `Light` and `Realm`. `town.ts` lays out the
  village by hand.
- `src/lantern/upper.ts`: the Upper World homestead, laid out by hand.
- `src/lantern/mill.ts`: the windmill footprint, shared by both worlds.
- `src/lantern/art.ts`, `town-art.ts`, `upper-art.ts`: every texture is painted
  by code into canvases at start-up. There are no image or sound files, so keep
  it that way.
- `src/lantern/nav.ts`: circle collision, A* and path smoothing over the tile
  grid. Pass the map size: `new Nav(block, w, h)`.
- `src/lantern/util.ts`: tile size (`T = 32`), map sizes, tile ids (`TL`),
  landmark positions, seeded PRNG and noise.
- `src/audio/AmbientMusic.ts`: procedural Web Audio score, with
  `setMood('lower' | 'upper')`.
- `src/ui/`: DOM overlay (menu, HUD with an action prompt).

Conventions: worlds are deterministic (seeded `mulberry32`, never
`Math.random` in generation); tests in `src/lantern/world.test.ts` check
that key places can be reached. Match the surrounding code's style and
comment density.
