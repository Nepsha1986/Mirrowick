#!/usr/bin/env python3
"""Top-down prototype: graded tileset, pixel-art hero and the village map.

    python3 tools/assets/build_topdown.py     # after fetch_kenney.sh

The level is authored below as an ASCII ground map plus placed stamps and
props, and written as a Tiled map (public/assets/topdown/village.tmj) that can
be opened and edited in https://www.mapeditor.org. Houses are copied as stamps
from the sample map that ships with Kenney's Roguelike RPG pack.
"""

from __future__ import annotations

import base64
import json
import re
import struct
import zlib

from PIL import Image

from build_assets import KENNEY, ROOT, grade

PACK = KENNEY / "roguelike-pack"
SHEET = PACK / "Spritesheet" / "roguelikeSheet_transparent.png"
SAMPLE = PACK / "Map" / "sample_map.tmx"
OUT = ROOT / "public" / "assets" / "topdown"

COLS = 57  # tiles per sheet row (16px + 1px spacing)
W, H = 40, 30


def g(c: int, r: int) -> int:
    """Tiled gid of the sheet tile at column c, row r."""
    return r * COLS + c + 1


# --- Tiles --------------------------------------------------------------------

GRASS = g(5, 1)
# Dirt path, 9-slice plus inner corners (derived from the sample map).
PATH = {
    "TL": g(7, 9), "T": g(8, 9), "TR": g(9, 9),
    "L": g(7, 10), "C": g(8, 10), "R": g(9, 10),
    "BL": g(7, 11), "B": g(8, 11), "BR": g(9, 11),
    "iSE": g(5, 9), "iSW": g(6, 9), "iNE": g(5, 10), "iNW": g(6, 10),
}
TREES = {  # (top, bottom)
    "oak": (g(13, 10), g(13, 11)),
    "autumn": (g(14, 10), g(14, 11)),
    "dark": (g(15, 10), g(15, 11)),
    "pine": (g(16, 10), g(16, 11)),
    "pineAutumn": (g(17, 10), g(17, 11)),
    "pineDark": (g(18, 10), g(18, 11)),
}
BUSH = g(15, 9)
DEAD = [g(27, 9), g(27, 10), g(27, 11)]  # three one-tile dead trees
GRAVES = [g(51, 9), g(52, 9), g(53, 9), g(51, 10), g(52, 10), g(53, 10), g(51, 11), g(52, 11)]
STATUE = (g(50, 10), g(50, 11))
CHEST, CHEST_OPEN = g(38, 10), g(38, 11)
TORCH = g(17, 7)
CAMPFIRE = g(14, 8)
BARRELS = [g(22, 0), g(23, 0)]
SIGN = g(19, 0)
GOBLET = g(55, 14)
ROCKS = [g(54, 21), g(55, 19), g(56, 19)]
STUMP = g(51, 19)
FENCE = [g(48, 23), g(49, 23)]
FLOWERS = [g(29, 9), g(28, 9)]
TUFT = g(22, 10)

# Tiles that never block movement.
WALKABLE = {GOBLET, TUFT, *FLOWERS}


# --- Sample-map stamps -------------------------------------------------------------


def load_sample() -> dict[str, list[list[int]]]:
    s = SAMPLE.read_text()
    sw = int(re.search(r'<map[^>]*\swidth="(\d+)"', s).group(1))
    layers = {}
    for name, data in re.findall(r'<layer name="([^"]+)".*?<data[^>]*>\s*([^<]+?)\s*</data>', s, re.S):
        raw = struct.unpack("<%dI" % (len(zlib.decompress(base64.b64decode(data))) // 4),
                            zlib.decompress(base64.b64decode(data)))
        layers[name] = [[v & 0x1FFFFFFF for v in raw[r * sw:(r + 1) * sw]] for r in range(len(raw) // sw)]
    return layers


# name: (c0, r0, c1, r1) inclusive, in sample-map cells.
STAMPS = {
    "house_big": (26, 33, 31, 39),
    "house_tall": (33, 32, 35, 36),
    "house_small": (47, 27, 48, 30),
    "shed": (26, 27, 27, 30),
}
STAMP_LAYERS = ("Objects", "Doors/windows/roof", "Roof object")


# --- Map builder --------------------------------------------------------------------


class Level:
    def __init__(self) -> None:
        self.ground = [[GRASS] * W for _ in range(H)]
        self.path = [[False] * W for _ in range(H)]
        # Object layers drawn under the hero, then one drawn over it.
        self.layers = {name: [[0] * W for _ in range(H)] for name in ("Objects", "Details", "Details2", "Above")}
        self.solid = [[False] * W for _ in range(H)]
        self.objects: list[dict] = []
        self.sample = load_sample()

    def free(self, c: int, r: int) -> bool:
        return 0 <= c < W and 0 <= r < H and not self.solid[r][c] and not self.path[r][c] \
            and not any(L[r][c] for L in self.layers.values())

    def put(self, c: int, r: int, gid: int, layer="Objects", solid=None) -> None:
        if not (0 <= c < W and 0 <= r < H):
            return
        self.layers[layer][r][c] = gid
        if solid if solid is not None else (layer != "Above" and gid not in WALKABLE):
            self.solid[r][c] = True

    def tree(self, c: int, r: int, kind="pine") -> None:
        if kind == "dead":
            self.put(c, r, DEAD[(c * 7 + r) % len(DEAD)])
            return
        top, bottom = TREES[kind]
        self.put(c, r, bottom)
        self.put(c, r - 1, top, "Above")

    def stamp(self, name: str, c: int, r: int) -> None:
        c0, r0, c1, r1 = STAMPS[name]
        targets = ("Objects", "Details", "Details2")
        for dr in range(r1 - r0 + 1):
            for dc in range(c1 - c0 + 1):
                for src, dst in zip(STAMP_LAYERS, targets):
                    v = self.sample[src][r0 + dr][c0 + dc]
                    if v:
                        self.put(c + dc, r + dr, v, dst, solid=True)

    def road(self, c0: int, r0: int, c1: int, r1: int) -> None:
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                self.path[r][c] = True

    def thing(self, kind: str, c: int, r: int, **props) -> None:
        """A Tiled object on a cell: an interactable, a light or the spawn."""
        self.objects.append({"kind": kind, "c": c, "r": r, **props})

    def path_layer(self) -> list[list[int]]:
        p = self.path
        on = lambda c, r: 0 <= c < W and 0 <= r < H and p[r][c]  # noqa: E731
        out = [[0] * W for _ in range(H)]
        for r in range(H):
            for c in range(W):
                if not p[r][c]:
                    continue
                n, s, w, e = on(c, r - 1), on(c, r + 1), on(c - 1, r), on(c + 1, r)
                key = {
                    (False, True, False, True): "TL", (False, True, True, True): "T",
                    (False, True, True, False): "TR", (True, True, False, True): "L",
                    (True, True, True, False): "R", (True, False, False, True): "BL",
                    (True, False, True, True): "B", (True, False, True, False): "BR",
                }.get((n, s, w, e), "C")
                if key == "C":
                    for diag, (dc, dr) in (("iSE", (1, 1)), ("iSW", (-1, 1)), ("iNE", (1, -1)), ("iNW", (-1, -1))):
                        if not on(c + dc, r + dr):
                            key = diag
                out[r][c] = PATH[key]
        return out


def build_village() -> Level:
    L = Level()

    # Roads (two tiles wide so the path autotiles read as a lane).
    L.road(19, 0, 20, H - 1)
    L.road(2, 13, 37, 14)
    L.road(6, 9, 7, 12)       # carpenter's door
    L.road(28, 8, 29, 12)     # chapel door
    L.road(21, 21, 33, 22)    # tavern lane
    L.road(9, 15, 10, 20)     # graveyard path

    # Buildings.
    L.stamp("house_big", 3, 3)      # the carpenter's house, door at (7, 8)
    L.stamp("house_tall", 27, 3)    # the chapel, door at (28, 7)
    L.stamp("house_small", 28, 17)  # the tavern
    L.stamp("house_small", 31, 17)
    L.stamp("shed", 4, 19)          # the crypt

    # Forest border: a staggered wall of trees, broken only where roads leave.
    kinds = ["pine", "pineDark", "dead", "pine", "dark", "pineDark", "pineAutumn"]
    for i, c in enumerate(range(0, W)):
        if c not in (19, 20):
            L.tree(c, 1, kinds[i % len(kinds)])
            L.tree(c, H - 1, kinds[(i + 3) % len(kinds)])
    for i, r in enumerate(range(3, H - 1, 2)):
        if r not in (13, 15):
            for c in (0, W - 1):
                L.tree(c, r, kinds[(i + c) % len(kinds)])
                L.tree(1 if c == 0 else W - 2, r + 1, kinds[(i + 2) % len(kinds)])
    # The roads out are blocked.
    for c, r in ((19, 1), (20, 0), (19, H - 1), (20, H - 2)):
        L.put(c, r, ROCKS[(c + r) % len(ROCKS)])
    for r in (13, 14):
        L.put(1, r, ROCKS[r % 2])
        L.put(W - 2, r, ROCKS[(r + 1) % 2])

    # Graveyard: fence along the top with a gate, stones, a crypt.
    for c in range(2, 13):
        if c not in (9, 10):
            L.put(c, 17, FENCE[c % 2])
    for i, (c, r) in enumerate(((8, 19), (11, 19), (12, 21), (8, 23), (11, 23), (3, 24), (6, 24), (12, 25), (8, 26))):
        L.put(c, r, GRAVES[i % len(GRAVES)])
    L.tree(2, 22, "dead")
    L.tree(13, 19, "pineDark")
    L.tree(13, 25, "dead")

    # The square.
    L.put(23, 11, STATUE[1])
    L.put(23, 10, STATUE[0], "Above")
    L.put(16, 11, CAMPFIRE)
    L.put(18, 11, TORCH)
    L.put(21, 16, TORCH)

    # Tavern yard and the rest of the village.
    L.put(34, 20, BARRELS[0])
    L.put(35, 20, BARRELS[1])
    L.put(27, 20, BARRELS[0])
    L.put(30, 23, CHEST)
    L.put(10, 7, CHEST)
    L.put(21, 25, SIGN)
    L.put(26, 9, GOBLET, solid=False)
    L.put(26, 7, TORCH)
    L.put(30, 7, TORCH)
    for c in range(31, 37):
        L.put(c, 11, FENCE[c % 2])
    for c, r, kind in ((12, 5, "dead"), (14, 8, "autumn"), (24, 5, "dark"), (34, 4, "pineAutumn"),
                       (35, 8, "dead"), (16, 19, "oak"), (24, 18, "dead"), (25, 26, "pineDark"),
                       (14, 26, "dark"), (36, 25, "autumn"), (33, 15, "dead"), (4, 11, "dark")):
        L.tree(c, r, kind)
    for c, r in ((13, 4), (22, 7), (25, 16), (17, 23), (34, 26), (3, 15), (12, 11)):
        L.put(c, r, DEAD[(c + r) % len(DEAD)])
    for c, r in ((15, 4), (33, 9), (24, 24), (6, 16), (36, 17)):
        L.put(c, r, BUSH)
    for c, r in ((11, 2), (25, 13), (33, 24), (16, 26)):
        L.put(c, r, STUMP if (c + r) % 2 else ROCKS[0])
    for i, (c, r) in enumerate(((12, 9), (17, 6), (24, 8), (30, 15), (15, 21), (22, 27), (36, 14), (3, 12),
                               (26, 14), (11, 16), (34, 22), (8, 25), (5, 25))):
        if L.free(c, r):
            L.put(c, r, TUFT if i % 3 else FLOWERS[i % 2], solid=False)

    # Interactables, lights, spawn.
    warm = 0xFFA451
    torch = {"radius": 46, "color": warm, "intensity": 0.7, "height": 6, "flicker": True}
    for c, r in ((18, 11), (21, 16), (26, 7), (30, 7)):
        L.thing("light", c, r, **torch)
    L.thing("light", 16, 11, radius=70, color=0xFF8A3A, intensity=0.85, height=4, flicker=True)
    L.thing("spawn", 19, 22, facing="up")
    interact = lambda c, r, **it: L.thing("interact", c, r, interact=it)  # noqa: E731
    interact(10, 7, name="Carpenter’s chest",
             lines=["Under a mouldy blanket you find a folded letter.", "Empty now. Smells of cedar and damp."],
             gives={"id": "letter", "name": "Faded letter",
                    "description": "“…if the mirror in the crypt starts to fog again, do not wait for me.”"},
             usedTile=CHEST_OPEN)
    interact(30, 23, name="Tavern strongbox",
             lines=["The lock has rusted through. Inside, wrapped in a rag: a heavy iron key.", "Nothing else but dust."],
             gives={"id": "key", "name": "Rusty key",
                    "description": "Cold, heavier than it looks. The bow is shaped like a candle flame."},
             usedTile=CHEST_OPEN)
    interact(26, 9, name="Tarnished chalice", lines=["A silver chalice lies in the grass by the chapel. You take it."],
             pickup={"id": "chalice", "name": "Tarnished chalice",
                     "description": "Your reflection in it is a heartbeat late."})
    interact(5, 22, name="Sealed crypt",
             requires={"item": "key", "missing": [
                 "A squat crypt with an iron door. A candle-shaped keyhole is set in the lock.",
                 "Still locked. The key must be somewhere in the village."]},
             lines=["The key turns. Cold air breathes out of the dark — and a stair goes down, deeper than the hill it sits on.",
                    "Something below is waiting for a light. Not yet. (End of the test level.)"])
    interact(8, 19, name="Gravestone",
             lines=["“Here lies Elske Wick, who kept the lamps.” The date has been chiselled away."])
    interact(23, 11, name="Statue of the lamp-keeper",
             lines=["A stone woman holding up a lantern. Her face has been worn smooth — except the eyes.",
                    "From this side the statue seems to be looking at you. From the other, at someone behind you."])
    interact(16, 11, name="Campfire",
             lines=["Freshly fed embers. Whoever tends this fire walked away only minutes ago."])
    interact(21, 25, name="Road sign", lines=["“MIRROWICK”. Below it, scratched into the wood: “BOTH OF THEM”."])
    return L


# --- Output -------------------------------------------------------------------------


def tmj(L: Level) -> dict:
    def tile_layer(name, data, visible=True, lid=0):
        return {"type": "tilelayer", "name": name, "id": lid, "width": W, "height": H, "x": 0, "y": 0,
                "opacity": 1, "visible": visible, "data": [v for row in data for v in row]}

    layers = [
        tile_layer("Ground", L.ground, lid=1),
        tile_layer("Path", L.path_layer(), lid=2),
        tile_layer("Objects", L.layers["Objects"], lid=3),
        tile_layer("Details", L.layers["Details"], lid=4),
        tile_layer("Details2", L.layers["Details2"], lid=5),
        tile_layer("Above", L.layers["Above"], lid=6),
        tile_layer("Collision", [[1 if s else 0 for s in row] for row in L.solid], visible=False, lid=7),
    ]
    objects = []
    for i, o in enumerate(L.objects, start=1):
        props = [{"name": k, "type": "string", "value": json.dumps(v) if isinstance(v, dict) else str(v)}
                 for k, v in o.items() if k not in ("kind", "c", "r")]
        objects.append({"id": i, "name": o["kind"], "type": o["kind"], "x": o["c"] * 16, "y": o["r"] * 16,
                        "width": 16, "height": 16, "rotation": 0, "visible": True, "properties": props})
    layers.append({"type": "objectgroup", "name": "Things", "id": 8, "x": 0, "y": 0, "opacity": 1,
                   "visible": True, "draworder": "topdown", "objects": objects})
    return {
        "type": "map", "version": "1.10", "tiledversion": "1.10.2", "orientation": "orthogonal",
        "renderorder": "right-down", "width": W, "height": H, "tilewidth": 16, "tileheight": 16,
        "infinite": False, "nextlayerid": 9, "nextobjectid": len(objects) + 1, "layers": layers,
        "tilesets": [{"firstgid": 1, "name": "roguelike", "image": "tiles.png", "imagewidth": 968,
                      "imageheight": 526, "tilewidth": 16, "tileheight": 16, "spacing": 1, "margin": 0,
                      "columns": COLS, "tilecount": COLS * 31}],
    }


# --- Hero -----------------------------------------------------------------------------

PALETTE = {
    "k": (26, 20, 24), "c": (59, 50, 66), "C": (88, 76, 96), "f": (217, 195, 160), "e": (26, 20, 24),
    "l": (107, 90, 58), "L": (255, 207, 106), "b": (42, 32, 24),
}
# A hooded figure carrying a lantern. Rows 0-12 per facing; legs are added per frame.
BODY = {
    "down": [
        "................", "......kkkk......", ".....kCCCCk.....", "....kCccccCk....",
        "....kcffffck....", "....kfeffefk....", "....kcffffck....", "...kkccccccktl..",
        "..kcCcccccccCkL.", "..kcCcccccccckl.", "..kcccccccccck..", "..kccCcccccccck.",
        "...kcccccccck...",
    ],
    "up": [
        "................", "......kkkk......", ".....kCCCCk.....", "....kCCCCCCk....",
        "....kCccccCk....", "....kccccccck...", "....kcccccck....", "..lkkccccccckk..",
        ".lLkCcccccccCk..", "..lkcccccccCck..", "..kcccccccccck..", "..kccccccCccck..",
        "...kcccccccck...",
    ],
    "left": [
        "................", "......kkkk......", ".....kCCCCk.....", "....kCCcccCk....",
        "....kffccccck...", "....kefccccck...", "....kffcccck....", "...kkccccccck....",
        ".lkcccCcccccCk..", ".Lkcccccccccck..", ".lkcccccccccck..", "..kccccCcccck...",
        "...kcccccccck...",
    ],
}
LEGS = {
    "stand": ["...kccckkccck...", "....kbbk.kbbk...", "....kkk...kkk..."],
    "stepA": ["...kccck.kcck...", "...kbbk...kbbk..", "...kkk.....kkk.."],
    "stepB": ["....kcckkccck...", ".....kbbkbbk....", ".....kkkkkk....."],
}


def hero_sheet() -> Image.Image:
    """4 rows (down, left, right, up) x 3 frames (stand, stepA, stepB), 16x16 each."""
    rows = [("down", False), ("left", False), ("left", True), ("up", False)]
    sheet = Image.new("RGBA", (16 * 3, 16 * 4))
    for ri, (facing, mirror) in enumerate(rows):
        for fi, legs in enumerate(("stand", "stepA", "stepB")):
            art = [row[:16].ljust(16, ".") for row in BODY[facing] + LEGS[legs]]
            img = Image.new("RGBA", (16, 16))
            px = img.load()
            for y, row in enumerate(art):
                for x, ch in enumerate(row):
                    if ch in PALETTE:
                        px[x, y] = (*PALETTE[ch], 255)
            if mirror:
                img = img.transpose(Image.FLIP_LEFT_RIGHT)
            sheet.paste(img, (fi * 16, ri * 16))
    return sheet


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Same desaturated, warm grade as the isometric kits: the Lower World is muted.
    sheet = grade(Image.open(SHEET), sat=0.45, tint=(1.0, 0.9, 0.74), gain=0.82)
    sheet.save(OUT / "tiles.png", optimize=True)
    hero_sheet().save(OUT / "hero.png", optimize=True)
    level = build_village()
    with open(OUT / "village.tmj", "w") as f:
        json.dump(tmj(level), f, separators=(",", ":"))
    print(f"topdown: tiles.png, hero.png, village.tmj ({W}x{H}, {len(level.objects)} objects)")


if __name__ == "__main__":
    main()
