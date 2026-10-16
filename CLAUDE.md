# Mirrowick — notes for Claude

A top-down web game about two parallel worlds that share one name: the dark,
solitary **Lower World** and the ordinary, sunlit **Upper World**, joined by a
mirror in the windmill's floor. Phaser 4 (WebGL), TypeScript, Vite.

## Read first

The design docs are in `docs/`, written in Russian: they are for the owner,
who speaks Russian. Before working on a feature, read the docs it touches:

- `docs/vision.md`: what the game is, and the pillars every feature is checked against
- `docs/worlds.md`: what is in each world **now** (layout, light, music, controls)
- `docs/lore.md`: settled lore and **open questions**. Don't invent answers to them; ask.
- `docs/decisions.md`: what was decided and why (newest first)
- `docs/ideas.md`: ideas parked for later
- `docs/roadmap.md`: done / next / later

## Keep the docs current

In the same PR as the change:

- a feature that changes what's in the game → update `docs/worlds.md` and `docs/roadmap.md`;
- a design decision (chosen or rejected) → add an entry at the top of `docs/decisions.md`;
- an idea discussed but not built → add it to `docs/ideas.md`;
- new places, names or rules of the world → `docs/lore.md`.

Write the docs in Russian. Talk to the owner in Russian. The in-game UI text,
code, comments and commit messages are in English.

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
