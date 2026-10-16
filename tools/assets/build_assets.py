#!/usr/bin/env python3
"""Builds the game's texture atlases from the CC0 Kenney packs.

Pipeline: pick sprites -> scale to the game's tile size -> colour-grade the
flat-shaded kits so they sit with the textured dungeon pack -> trim -> pack
into WebP atlas pages with a per-frame pivot on the tile's diamond centre.

Usage:
    tools/assets/fetch_kenney.sh
    python3 tools/assets/build_assets.py          # needs Pillow + numpy

Output goes to public/assets/ and is committed, so the game itself never
needs the raw packs.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
KENNEY = Path(os.environ.get("KENNEY_DIR", ROOT / ".cache" / "kenney"))
OUT = ROOT / "public" / "assets"

DUNGEON = KENNEY / "kenneyDungeonPack_2.3"
NATURE = KENNEY / "kenney_natureKit_2.1" / "Isometric"
GRAVE = KENNEY / "kenney_graveyardkit_3" / "Isometric"
TOWN = KENNEY / "fantasy-town-kit-1.0" / "Isometric"

# The dungeon pack is rendered with a 256px-wide tile; the game uses 128px.
DUNGEON_SCALE = 0.5
DUNGEON_ANCHOR = (128, 437)  # diamond centre inside the 256x512 source
# The 3D kits share one camera: a 130px-wide tile centred at (256, 315.5).
KIT_SCALE = 128 / 130
KIT_ANCHOR = (256, 315.5)

PAGE = 2048
PAD = 2


@dataclass
class Sprite:
    key: str
    image: Image.Image
    anchor: tuple[float, float]  # in the scaled, untrimmed image


def grade(im: Image.Image, sat=0.35, tint=(1.0, 0.86, 0.66), gain=0.85) -> Image.Image:
    """Desaturate and warm a flat-shaded kit sprite towards the sepia palette."""
    a = np.asarray(im.convert("RGBA")).astype(np.float32) / 255
    rgb = a[..., :3]
    lum = (rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32))[..., None]
    rgb = (lum + (rgb - lum) * sat) * np.array(tint, dtype=np.float32) * gain
    a[..., :3] = np.clip(rgb, 0, 1)
    return Image.fromarray((a * 255 + 0.5).astype(np.uint8))


def load(path: Path, scale: float, anchor: tuple[float, float], key: str, graded=None) -> Sprite:
    im = Image.open(path).convert("RGBA")
    if graded is not None:
        im = grade(im, **graded)
    w, h = round(im.width * scale), round(im.height * scale)
    im = im.resize((w, h), Image.LANCZOS)
    return Sprite(key, im, (anchor[0] * scale, anchor[1] * scale))


# --- Selection --------------------------------------------------------------

DUNGEON_ALL_DIRS = [
    "stoneWall", "stoneWallAged", "stoneWallBroken", "stoneWallBrokenLeft",
    "stoneWallBrokenRight", "stoneWallArchway", "stoneWallWindow", "stoneWallHole",
    "stoneWallHalf", "stoneWallColumn", "stoneWallDoorOpen", "woodenSupportsBeam",
    "woodenSupportBeams", "barrels", "barrel", "woodenCrates", "woodenCrate", "woodenPile",
    "chestClosed", "chestOpen", "tableChairsBroken", "tableShort", "chair", "planksBroken",
    "stoneColumn", "stairsAged",
]
DUNGEON_FLOORS = [
    "dirt", "dirtTiles", "stone", "stoneUneven", "stoneMissingTiles", "stoneTile",
    "planks", "planksHole",
]
KIT_SPRITES = {
    # Nature kit
    NATURE: [
        "ground_grass", "ground_pathTile", "tree_thin_dark", "tree_default_dark",
        "tree_oak_fall", "tree_simple_dark", "stump_old", "stump_oldTall", "log", "log_large",
        "grass", "grass_large", "grass_leafs", "rock_largeA", "rock_smallA", "rock_smallC",
        "stone_tallB", "mushroom_tanGroup", "mushroom_redGroup", "plant_bushDetailed", "sign",
        "hanging_moss", "statue_columnDamaged",
    ],
    # Graveyard kit
    GRAVE: [
        "pineCrooked", "pine", "gravestoneCross", "gravestoneBroken", "gravestoneRound",
        "gravestoneDecorative", "crossWood", "crypt", "altarStone", "ironFence", "ironFenceDamaged",
        "fenceDamaged", "fence", "lanternCandle", "lightpostSingle", "fireBasket",
        "debris", "debrisWood", "benchDamaged", "urn", "shovelDirt", "detailChalice",
        "coffinOld", "trunk", "rocksTall",
    ],
}
TOWN_SPRITES = ["cart", "fenceBroken", "fountainRound", "lantern", "stallStool", "wheel"]

# Kit sprites with stone / light content keep more of their value.
KIT_GRADE_OVERRIDES = {
    "lanternCandle": dict(sat=0.6, tint=(1.0, 0.9, 0.7), gain=0.95),
    "fireBasket": dict(sat=0.7, tint=(1.0, 0.9, 0.7), gain=1.0),
    "lightpostSingle": dict(sat=0.5, tint=(1.0, 0.88, 0.7), gain=0.9),
    "lantern": dict(sat=0.6, tint=(1.0, 0.9, 0.7), gain=0.95),
}
KIT_GRADE = dict(sat=0.35, tint=(1.0, 0.86, 0.66), gain=0.85)


def kit_dirs(base: Path, name: str) -> list[tuple[str, Path]]:
    found = []
    for d in ("NE", "NW", "SE", "SW", "N", "E", "S", "W"):
        p = base / f"{name}_{d}.png"
        if p.exists():
            found.append((d, p))
    if not found:
        raise FileNotFoundError(f"{base}/{name}_*.png")
    return found


def world_sprites() -> list[Sprite]:
    sprites: list[Sprite] = []
    iso = DUNGEON / "Isometric"
    for name in DUNGEON_FLOORS:
        sprites.append(load(iso / f"{name}_N.png", DUNGEON_SCALE, DUNGEON_ANCHOR, name))
    for name in DUNGEON_ALL_DIRS:
        for d in "NESW":
            sprites.append(
                load(iso / f"{name}_{d}.png", DUNGEON_SCALE, DUNGEON_ANCHOR, f"{name}_{d}")
            )
    for base, names in KIT_SPRITES.items():
        for name in names:
            g = KIT_GRADE_OVERRIDES.get(name, KIT_GRADE)
            for d, p in kit_dirs(base, name):
                sprites.append(load(p, KIT_SCALE, KIT_ANCHOR, f"{name}_{d}", graded=g))
    for name in TOWN_SPRITES:
        g = KIT_GRADE_OVERRIDES.get(name, KIT_GRADE)
        for d, p in kit_dirs(TOWN, name):
            sprites.append(load(p, KIT_SCALE, KIT_ANCHOR, f"town_{name}_{d}", graded=g))
    return sprites


def hero_sprites() -> list[Sprite]:
    sprites = []
    chars = DUNGEON / "Characters" / "Male"
    for d in range(8):
        for anim, count in (("Idle", 1), ("Run", 10), ("Pickup", 10)):
            for i in range(count):
                p = chars / f"Male_{d}_{anim}{i}.png"
                key = f"hero_{anim.lower()}_{d}_{i}"
                sprites.append(load(p, DUNGEON_SCALE, DUNGEON_ANCHOR, key))
    return sprites


# --- Packing ----------------------------------------------------------------


def pack(sprites: list[Sprite], name: str) -> None:
    """Shelf-pack trimmed sprites into pages and write a Phaser multiatlas."""
    items = []
    for s in sprites:
        bbox = s.image.getbbox()
        if bbox is None:
            raise ValueError(f"empty sprite {s.key}")
        items.append((s, bbox, s.image.crop(bbox)))
    items.sort(key=lambda t: (-t[2].height, -t[2].width))

    pages: list[tuple[Image.Image, list]] = []
    page = Image.new("RGBA", (PAGE, PAGE))
    frames: list = []
    x = y = shelf_h = 0
    used_h = 0
    for s, bbox, im in items:
        w, h = im.width + PAD, im.height + PAD
        if x + w > PAGE:
            x, y, shelf_h = 0, y + shelf_h, 0
        if y + h > PAGE:
            pages.append((page.crop((0, 0, PAGE, used_h)), frames))
            page, frames = Image.new("RGBA", (PAGE, PAGE)), []
            x = y = shelf_h = used_h = 0
        page.paste(im, (x, y))
        sw, sh = s.image.size
        frames.append(
            {
                "filename": s.key,
                "frame": {"x": x, "y": y, "w": im.width, "h": im.height},
                "rotated": False,
                "trimmed": True,
                "spriteSourceSize": {"x": bbox[0], "y": bbox[1], "w": im.width, "h": im.height},
                "sourceSize": {"w": sw, "h": sh},
                "anchor": {"x": round(s.anchor[0] / sw, 5), "y": round(s.anchor[1] / sh, 5)},
            }
        )
        x += w
        shelf_h = max(shelf_h, h)
        used_h = max(used_h, y + h)
    pages.append((page.crop((0, 0, PAGE, used_h)), frames))

    textures = []
    for i, (img, fr) in enumerate(pages):
        fname = f"{name}-{i}.webp"
        img.save(OUT / fname, quality=90, method=6)
        textures.append(
            {"image": fname, "format": "RGBA8888", "size": {"w": img.width, "h": img.height},
             "scale": 1, "frames": fr}
        )
    with open(OUT / f"{name}.json", "w") as f:
        json.dump({"textures": textures, "meta": {"app": "mirrowick build_assets.py"}}, f,
                  separators=(",", ":"))
    total = sum(len(fr) for _, fr in pages)
    print(f"{name}: {total} frames on {len(pages)} page(s)")


def main() -> None:
    if not DUNGEON.exists():
        raise SystemExit(f"Kenney packs not found in {KENNEY}; run tools/assets/fetch_kenney.sh")
    OUT.mkdir(parents=True, exist_ok=True)
    pack(world_sprites(), "world")
    pack(hero_sprites(), "hero")


if __name__ == "__main__":
    main()
