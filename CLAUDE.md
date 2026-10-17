# Mirrowick — notes for Claude

A top-down web game about two parallel worlds: the ordinary, sunlit **Upper
World** and the dark **Lower World**, a near-future world on the edge of ruin,
joined by a mirror in a cellar under Victor's shed. It comes out in Chamber 7
of the Facility, a vast abandoned laboratory built round the mirror. Phaser 4 (WebGL), TypeScript, Vite.

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

Code, comments and commit messages are in English; in-game text lives in
`src/i18n/`, in every language.

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
  `'lower'`, `'upper'` or `'cellar'`. Stairs or a mirror restart the scene with
  another realm (`scene.restart`). The camera follows the hero, and a
  darkness texture is refilled every frame with lights erased out of it.
  Objects are culled in chunks.
- `src/lantern/world.ts`: the shapes every place shares: `World`, `Portal`,
  `Thing` (doors too), `Light`, `Realm`.
- `src/lantern/lab.ts`: the Lower World, the Facility, laid out by hand on a
  big map that is mostly solid roof for now: Chamber 7, the corridor, the
  vivarium with caged foes, the checkpoint and the yard. `World.indoors`
  marks where it is always dark.
- `src/lantern/upper.ts`: the Upper World homestead, laid out by hand: Victor's
  house, front yard, back garden and the shed with the hatch, and his glowing
  footprints (`World.trail`).
- `src/lantern/cellar.ts`: the cellar under Victor's shed (realm `'cellar'`):
  stairs up to the shed's hatch, a mirror down to the Lower World.
- `src/lantern/ways.ts`: where each way between the places comes out.
- `src/lantern/ground-art.ts`: roads, paths and beds painted over the ground
  with ragged edges (`World.patches`), and thin walls, posts and fences
  (`World.walls`). Thin walls have their own collision in `Nav`.
- `src/lantern/art.ts`, `house-art.ts`, `upper-art.ts`, `lab-art.ts`,
  `cellar-art.ts`, `foe-art.ts`: every texture is painted
  by code into canvases at start-up. There are no image or sound files, so keep
  it that way.
- `src/lantern/nav.ts`: circle collision, A* and path smoothing over the tile
  grid. Pass the map size: `new Nav(block, w, h)`.
- `src/lantern/items.ts`, `memory.ts`: what the hero can carry, and his
  memory: he leaves things until he learns he needs them (`Thing.hoard`,
  `Portal.lock`), and what he has read.
- `src/lantern/papers.ts`: notes, letters and books to read (`Thing.read`);
  `src/ui/Reader.ts` shows them.
- `src/lantern/util.ts`: tile size (`T = 32`), map sizes, tile ids (`TL`),
  landmark positions, seeded PRNG and noise.
- `src/i18n/`: every word the game shows, one catalog per language (`en.ts`
  is the source and the shape the others must match). Code reads
  `t().menu.play` and `fill(line, { slot })`; never put text in code, and add
  any new line to every language.
- `src/audio/AmbientMusic.ts`: procedural Web Audio score, with
  `setMood('lower' | 'upper')`.
- `src/ui/`: DOM overlay (menu, the intro call, HUD with an action prompt and
  the hero's thoughts).

**Painting: nothing perfectly even.** Whenever you make an object, give it
small, logical imperfections so it looks real and lived-in rather than
stamped out: no perfectly straight edges, a few defects, buildings and things
standing at a slight angle, a car parked a little askew, gravel worn through
to the grass in places, a missing or leaning picket, faded and slipped roof
tiles, ragged path edges, beds that aren't perfect rectangles. Keep them
plausible and subtle, not random noise.

**But mind the map's size.** On a large map, or for things repeated many
times, keep it much simpler: cheap variation (rotation, scale, a few shared
variants) instead of per-object painting, so start-up time and memory stay
low. The detail goes where the player looks closely: small places, interiors,
landmarks.

Conventions: worlds are deterministic (seeded `mulberry32`, never
`Math.random` in generation); tests in `src/lantern/world.test.ts` check
that key places can be reached and caged foes can't get out. Match the surrounding code's style and
comment density.
