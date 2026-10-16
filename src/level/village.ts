import type { LevelDef, Prop, Side } from './types';

/**
 * The Lower World: an abandoned village. A deliberately small sandbox for
 * trying out the look and feel — a few ruined houses, a chapel, a graveyard
 * with a sealed crypt and one tiny chain of interactions (key → crypt).
 */

// prettier-ignore
const GROUND = [
  '    ......dd......    ',
  '  ........dd........  ',
  ' .ppppp...dd..mmmmm.. ',
  '..ppppp...dd..mummm...',
  '..pphpptttdd..mmmmm.. ',
  '..ppppp...dd..mmmum...',
  '..ppppp...dd..mmmmm...',
  '..........dd....t.... ',
  '........muuuum..t.....',
  '........uuuumu..t.... ',
  'dddddddduussuuddddddd ',
  'dddddddduussuudddddddd',
  '.....tttttuuuu........',
  '.....t..muuuum........',
  '.....t....dd..uuuuuu..',
  '..........dd..uumuuu..',
  '..........ddttuuuuuu..',
  ' .........dd..uuuumu..',
  '..........dd..uuuuuu. ',
  ' .........dd......... ',
  '  ........dd........  ',
  '    ......dd......    ',
];

/**
 * A run of edge pieces along one side of a building. `null` leaves a gap;
 * a frame ending in "Archway" is drawn but stays passable.
 */
function wallRun(side: Side, cells: [number, number][], frames: (string | null)[]): Prop[] {
  const out: Prop[] = [];
  cells.forEach(([c, r], i) => {
    const base = frames[i];
    if (!base) return;
    const prop: Prop = { frame: `${base}_${side}`, c, r, edge: side };
    if (base.endsWith('Archway')) {
      delete prop.edge;
      prop.solid = false;
    }
    out.push(prop);
  });
  return out;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const alongC = (r: number, c0: number, c1: number) =>
  range(c0, c1).map((c) => [c, r] as [number, number]);
const alongR = (c: number, r0: number, r1: number) =>
  range(r0, r1).map((r) => [c, r] as [number, number]);

const WARM = 0xffa451;
const CANDLE = { radius: 120, color: WARM, intensity: 0.75, height: 18, flicker: true };

// --- The carpenter's house (north-west) ------------------------------------
const carpenter: Prop[] = [
  ...wallRun('S', alongC(2, 2, 6), [
    'stoneWallAged',
    'stoneWallWindow',
    'stoneWall',
    'stoneWallBrokenRight',
    'stoneWallHalf',
  ]),
  ...wallRun('E', alongR(2, 2, 6), [
    'stoneWall',
    'stoneWallAged',
    'stoneWallWindow',
    'stoneWallBrokenLeft',
    'stoneWallHalf',
  ]),
  ...wallRun('W', alongR(6, 2, 6), [
    'stoneWallHalf',
    'stoneWallBrokenLeft',
    'stoneWallArchway',
    'stoneWallHalf',
    null,
  ]),
  ...wallRun('N', alongC(6, 2, 6), [
    'stoneWallHalf',
    'stoneWallBroken',
    null,
    'stoneWallHalf',
    'stoneWallBrokenRight',
  ]),
  { frame: 'woodenSupportsBeam_S', c: 4, r: 3 },
  { frame: 'tableChairsBroken_N', c: 3, r: 3 },
  { frame: 'woodenPile_E', c: 3, r: 5 },
  { frame: 'barrel_N', c: 2, r: 6 },
  {
    frame: 'chestClosed_W',
    c: 5,
    r: 2,
    interact: {
      name: 'Carpenter’s chest',
      lines: [
        'Under a mouldy blanket you find a folded letter.',
        'Empty now. Smells of cedar and damp.',
      ],
      gives: {
        id: 'letter',
        name: 'Faded letter',
        description: '“…if the mirror in the crypt starts to fog again, do not wait for me.”',
      },
      usedFrame: 'chestOpen_W',
    },
  },
];

// --- The chapel (north-east) ------------------------------------------------
const chapel: Prop[] = [
  ...wallRun('S', alongC(2, 14, 18), [
    'stoneWallAged',
    'stoneWallWindow',
    'stoneWallColumn',
    'stoneWallWindow',
    'stoneWall',
  ]),
  ...wallRun('E', alongR(14, 2, 6), [
    'stoneWall',
    'stoneWallWindow',
    'stoneWallAged',
    'stoneWallWindow',
    'stoneWallHalf',
  ]),
  ...wallRun('N', alongC(6, 14, 18), [
    'stoneWallHalf',
    'stoneWallBrokenLeft',
    'stoneWallArchway',
    'stoneWallBrokenRight',
    null,
  ]),
  ...wallRun('W', alongR(18, 2, 6), [
    'stoneWallHalf',
    'stoneWallHole',
    null,
    'stoneWallHalf',
    'stoneWallBroken',
  ]),
  {
    frame: 'altarStone_SW',
    c: 16,
    r: 3,
    interact: {
      name: 'Altar',
      lines: [
        'Wax has pooled and hardened over the stone, layer upon layer. Someone kept these candles lit for years.',
        'The wax is still warm.',
      ],
    },
  },
  { frame: 'lanternCandle_SW', c: 17, r: 3, solid: false, light: CANDLE },
  {
    frame: 'detailChalice_SW',
    c: 15,
    r: 3,
    interact: {
      name: 'Tarnished chalice',
      lines: ['A silver chalice, black with tarnish. You take it.'],
      pickup: {
        id: 'chalice',
        name: 'Tarnished chalice',
        description: 'Your reflection in it is a heartbeat late.',
      },
    },
  },
  { frame: 'benchDamaged_SW', c: 15, r: 5 },
  { frame: 'benchDamaged_SW', c: 17, r: 4 },
  { frame: 'stoneColumn_N', c: 14, r: 6 },
];

// --- The tavern (south-east), half collapsed --------------------------------
const tavern: Prop[] = [
  ...wallRun('S', alongC(14, 14, 19), [
    'stoneWall',
    'stoneWallWindow',
    'stoneWallAged',
    'stoneWallBrokenLeft',
    null,
    'stoneWallHalf',
  ]),
  ...wallRun('E', alongR(14, 14, 18), [
    'stoneWall',
    'stoneWallAged',
    'stoneWallArchway',
    'stoneWallBrokenRight',
    'stoneWallHalf',
  ]),
  ...wallRun('N', alongC(18, 14, 19), [
    'stoneWallHalf',
    null,
    'stoneWallBroken',
    'stoneWallHalf',
    null,
    'stoneWallHalf',
  ]),
  ...wallRun('W', alongR(19, 14, 18), [
    'stoneWallHalf',
    'stoneWallBroken',
    null,
    'stoneWallHalf',
    'stoneWallBrokenLeft',
  ]),
  { frame: 'woodenSupportBeams_S', c: 16, r: 16 },
  { frame: 'planksBroken_N', c: 17, r: 16 },
  { frame: 'tableChairsBroken_E', c: 16, r: 15 },
  { frame: 'barrels_N', c: 18, r: 14 },
  { frame: 'woodenCrates_N', c: 15, r: 17 },
  { frame: 'barrel_E', c: 19, r: 15 },
  {
    frame: 'chestClosed_N',
    c: 18,
    r: 17,
    interact: {
      name: 'Tavern strongbox',
      lines: [
        'The lock has rusted through. Inside, wrapped in a rag: a heavy iron key.',
        'Nothing else but dust.',
      ],
      gives: {
        id: 'key',
        name: 'Rusty key',
        description: 'Cold, heavier than it looks. The bow is shaped like a candle flame.',
      },
      usedFrame: 'chestOpen_N',
    },
  },
];

// --- Graveyard (south-west) -------------------------------------------------
const graveyard: Prop[] = [
  ...wallRun('S', alongC(14, 2, 7), [
    'ironFence',
    'ironFence',
    'ironFenceDamaged',
    null,
    'ironFence',
    'ironFence',
  ]).map((p) => ({ ...p, frame: p.frame.replace(/_S$/, '_SW') })),
  ...wallRun('E', alongR(2, 14, 19), [
    'ironFence',
    'ironFence',
    'ironFenceDamaged',
    'ironFence',
    'ironFence',
    'ironFence',
  ]).map((p) => ({ ...p, frame: p.frame.replace(/_E$/, '_SE') })),
  ...wallRun('N', alongC(19, 2, 7), [
    'ironFence',
    'ironFenceDamaged',
    'ironFence',
    null,
    'ironFence',
    'ironFence',
  ]).map((p) => ({ ...p, frame: p.frame.replace(/_N$/, '_NE') })),
  ...wallRun('W', alongR(7, 14, 19), [
    'ironFence',
    'ironFence',
    null,
    'ironFenceDamaged',
    'ironFence',
    'ironFence',
  ]).map((p) => ({ ...p, frame: p.frame.replace(/_W$/, '_NW') })),
  {
    frame: 'crypt_SE',
    c: 3,
    r: 17,
    interact: {
      name: 'Sealed crypt',
      requires: {
        item: 'key',
        missing: [
          'A squat stone crypt. The door is locked; a candle-shaped keyhole is set in the iron.',
          'Still locked. The key must be somewhere in the village.',
        ],
      },
      lines: [
        'The key turns. Cold air breathes out of the dark — and a stair goes down, deeper than the hill it sits on.',
        'Something below is waiting for a light. Not yet. (End of the test level.)',
      ],
    },
  },
  {
    frame: 'gravestoneCross_SE',
    c: 5,
    r: 15,
    interact: {
      name: 'Gravestone',
      lines: ['“Here lies Elske Wick, who kept the lamps.” The date has been chiselled away.'],
    },
  },
  { frame: 'gravestoneRound_SE', c: 3, r: 15 },
  { frame: 'gravestoneBroken_SE', c: 6, r: 17 },
  { frame: 'gravestoneDecorative_SE', c: 5, r: 18 },
  { frame: 'crossWood_SE', c: 6, r: 19 },
  { frame: 'shovelDirt_SE', c: 4, r: 19 },
  { frame: 'lanternCandle_SE', c: 4, r: 15, solid: false, light: CANDLE },
  { frame: 'lanternCandle_SE', c: 6, r: 16, solid: false, light: CANDLE },
  { frame: 'pineCrooked_SE', c: 2, r: 19 },
];

// --- The square and the open village ---------------------------------------
const village: Prop[] = [
  {
    frame: 'town_fountainRound_N',
    c: 10,
    r: 10,
    interact: {
      name: 'Dry fountain',
      lines: [
        'The basin is bone-dry. Coins at the bottom have gone green — all of them minted the same year.',
        'You look at your reflection in a puddle of rainwater. It blinks after you do.',
      ],
    },
  },
  {
    frame: 'fireBasket_SE',
    c: 12,
    r: 8,
    light: { radius: 190, color: 0xff8a3a, intensity: 0.95, height: 22, flicker: true },
    interact: {
      name: 'Fire basket',
      lines: ['Freshly fed embers. Whoever tends this fire walked away only minutes ago.'],
    },
  },
  {
    frame: 'lightpostSingle_SE',
    c: 9,
    r: 13,
    light: { radius: 150, color: WARM, intensity: 0.7, height: 64, flicker: true },
  },
  {
    frame: 'lightpostSingle_SE',
    c: 12,
    r: 18,
    light: { radius: 150, color: WARM, intensity: 0.7, height: 64, flicker: true },
  },
  {
    frame: 'sign_SE',
    c: 12,
    r: 20,
    interact: {
      name: 'Road sign',
      lines: ['“MIRROWICK”. Below it, scratched into the wood: “BOTH OF THEM”.'],
    },
  },
  { frame: 'town_cart_S', c: 11, r: 15 },
  { frame: 'town_wheel_E', c: 12, r: 14 },
  { frame: 'statue_columnDamaged_SE', c: 13, r: 13 },
  { frame: 'town_fenceBroken_W', c: 7, r: 9 },

  // Trees and stones, kept off the roads.
  { frame: 'pineCrooked_SE', c: 7, r: 13 },
  { frame: 'pineCrooked_SW', c: 19, r: 9 },
  { frame: 'pineCrooked_NE', c: 13, r: 20 },
  { frame: 'pine_SE', c: 0, r: 13 },
  { frame: 'pine_SW', c: 20, r: 3 },
  { frame: 'pine_SE', c: 3, r: 20 },
  { frame: 'tree_thin_dark_NE', c: 8, r: 2 },
  { frame: 'tree_thin_dark_SE', c: 20, r: 7 },
  { frame: 'tree_thin_dark_NW', c: 1, r: 8 },
  { frame: 'tree_oak_fall_NE', c: 12, r: 3 },
  { frame: 'tree_oak_fall_SW', c: 20, r: 13 },
  { frame: 'tree_default_dark_SE', c: 8, r: 18 },
  { frame: 'tree_default_dark_NE', c: 19, r: 19 },
  { frame: 'tree_simple_dark_SE', c: 1, r: 3 },
  { frame: 'stump_old_NE', c: 7, r: 7 },
  { frame: 'stump_oldTall_SE', c: 13, r: 6 },
  { frame: 'log_large_NE', c: 20, r: 6 },
  { frame: 'rock_largeA_NE', c: 0, r: 4 },
  { frame: 'rock_smallC_SE', c: 9, r: 19 },
  { frame: 'rock_smallA_NE', c: 21, r: 15 },
  { frame: 'stone_tallB_NE', c: 1, r: 17 },
  { frame: 'plant_bushDetailed_NE', c: 7, r: 8 },
  { frame: 'plant_bushDetailed_SE', c: 21, r: 17 },
  { frame: 'mushroom_tanGroup_NE', c: 9, r: 2 },
  { frame: 'mushroom_redGroup_SE', c: 1, r: 12 },
  { frame: 'debris_SE', c: 8, r: 6 },
  { frame: 'debrisWood_SE', c: 13, r: 17 },
  ...(
    [
      [3, 1],
      [6, 0],
      [13, 1],
      [16, 0],
      [21, 5],
      [1, 6],
      [9, 7],
      [12, 6],
      [4, 9],
      [6, 12],
      [15, 12],
      [19, 12],
      [0, 15],
      [9, 16],
      [13, 15],
      [20, 16],
      [7, 20],
      [12, 19],
      [15, 20],
      [17, 9],
      [4, 11],
      [18, 1],
      [3, 8],
      [21, 8],
    ] as [number, number][]
  ).map(([c, r], i) => ({
    frame: ['grass_large_NE', 'grass_SE', 'grass_leafs_NW', 'grass_large_SW'][i % 4] as string,
    c,
    r,
  })),
];

export const VILLAGE: LevelDef = {
  id: 'lower-village',
  title: 'Mirrowick — the Lower World',
  ground: GROUND,
  spawn: { c: 10, r: 20 },
  spawnFacing: 7,
  props: [...carpenter, ...chapel, ...tavern, ...graveyard, ...village],
  intro: [
    'The road ends here, and so does the map you bought in town.',
    'Mirrowick. Nobody has lived here for years — yet somebody keeps the candles burning.',
  ],
};
