# Mirrowick — notes for Claude

A top-down web game about two parallel worlds that share one name: the dark,
solitary **Lower World** and the ordinary, sunlit **Upper World**, joined by a
mirror in the windmill's floor. Phaser 4 (WebGL), TypeScript, Vite.

## Docs

`docs/` holds a few short notes in Russian, for the owner (who speaks Russian;
talk to them in Russian):

- `docs/vision.md`: what the game is
- `docs/worlds.md`: an index of both worlds
- `docs/locations/`: one file per place, as it is in the game now
- `docs/characters/`: one file per character or group
- `docs/mechanics/`: one file per game system (light, mirror travel…)
- `docs/decisions.md`: what has been decided, newest first
- `docs/tasks/`: what the owner wants done later, one task per file

Keep them **minimal**. Record only what is built or what the owner has
decided, never ideas that were only discussed. Don't create files or folders
for things the game doesn't have yet. When a change adds or alters a place, a
character or a mechanic, update or add its file and link it from
`docs/worlds.md` in the same PR. When the owner makes a decision, add one line
to `docs/decisions.md`. Folder and file names are English; content is
Russian.

### Tasks

When the owner says something should be done later, add a short file to
`docs/tasks/` (or refine the existing one); don't build it until they say
so. When a task is done, in the same PR:

1. delete its file from `docs/tasks/`;
2. go through the docs and update what changed (locations, characters,
   mechanics, `worlds.md`, `decisions.md`).

Write docs and tasks for a human reader first: short and plain, no filler.

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

Merge pull requests into `main` with **squash** (`merge_method: squash`), never
a merge commit or rebase.

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
- `src/lantern/ground-art.ts`: roads, paths and beds painted over the ground
  with ragged edges (`World.patches`), and thin walls, posts and fences
  (`World.walls`). Thin walls have their own collision in `Nav`.
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

**Painting: nothing perfectly even.** Give everything small, logical
imperfections so it looks lived-in rather than stamped out: a car parked a
little askew, gravel worn through to the grass in places, a missing or
leaning picket, faded and slipped roof tiles, ragged path edges, beds that
aren't perfect rectangles. Keep them plausible and subtle, not random noise.

Conventions: worlds are deterministic (seeded `mulberry32`, never
`Math.random` in generation); tests in `src/lantern/world.test.ts` check
that key places can be reached. Match the surrounding code's style and
comment density.
