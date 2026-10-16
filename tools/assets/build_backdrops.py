#!/usr/bin/env python3
"""Paints the procedural backdrops: watercolour sky, tileable fog, menu art.

    python3 tools/assets/build_backdrops.py      # after fetch_kenney.sh

The menu background is a small diorama of the Lower World village built from
the same Kenney sprites as the game, set on a floating chunk of earth over a
sepia sky, in the spirit of the project's reference art.
"""

from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from build_assets import (
    DUNGEON,
    GRAVE,
    KIT_ANCHOR,
    KIT_GRADE,
    NATURE,
    OUT,
    TOWN,
    grade,
)

W, H = 1920, 1080
rng = np.random.default_rng(7)


def tileable_noise(w: int, h: int, scale: float, seed: int, stretch: float = 1.0) -> np.ndarray:
    """Band-limited noise via FFT; wraps seamlessly on both axes. Range 0..1.

    `stretch` > 1 elongates features horizontally (dry-brush washes)."""
    r = np.random.default_rng(seed)
    white = r.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f2 = (fx * stretch) ** 2 + fy**2
    spectrum = np.fft.fft2(white) * np.exp(-f2 * scale * scale)
    n = np.real(np.fft.ifft2(spectrum))
    n -= n.min()
    return n / n.max()


def fbm(w, h, seed, octaves=((60, 1.0), (24, 0.5), (8, 0.25), (3, 0.12)), stretch=1.0):
    acc = np.zeros((h, w))
    total = 0.0
    for i, (scale, amp) in enumerate(octaves):
        acc += tileable_noise(w, h, scale, seed + i, stretch) * amp
        total += amp
    return acc / total


def lerp_colors(t: np.ndarray, stops: list[tuple[float, tuple[int, int, int]]]) -> np.ndarray:
    out = np.zeros(t.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(t, [s for s, _ in stops], [col[c] for _, col in stops])
    return out


def paint_sky(w: int, h: int, seed: int) -> Image.Image:
    y = np.linspace(0, 1, h)[:, None] * np.ones((1, w))
    base = lerp_colors(
        y,
        [(0.0, (120, 92, 70)), (0.35, (186, 152, 118)), (0.62, (226, 206, 176)),
         (1.0, (150, 118, 90))],
    )
    clouds = fbm(w, h, seed, octaves=((90, 1.0), (40, 0.5), (14, 0.2)), stretch=4.0)
    # Streaky horizontal washes, like the reference's dry-brush clouds.
    streak = tileable_noise(w, h, 22, seed + 9, stretch=9.0)
    wash = np.clip((clouds * 0.75 + streak * 0.45 - 0.5) * 2.6, 0, 1) ** 1.2
    dark = lerp_colors(wash, [(0, (0, 0, 0)), (1, (92, 64, 44))])
    sky = base * (1 - wash[..., None] * 0.42) + dark * wash[..., None] * 0.42
    # Pale highlights where clouds thin out.
    light = np.clip((0.5 - clouds) * 2.5, 0, 1)[..., None]
    sky = sky * (1 - light * 0.25) + np.array([240, 228, 206]) * light * 0.25
    grain = rng.normal(0, 4, (h, w, 1))
    return Image.fromarray(np.clip(sky + grain, 0, 255).astype(np.uint8))


def paint_fog(size=512) -> Image.Image:
    n = fbm(size, size, 31, octaves=((40, 1.0), (14, 0.45), (5, 0.2)))
    a = np.clip((n - 0.35) * 2.2, 0, 1) ** 1.4
    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(rgba)


# --- Menu diorama -------------------------------------------------------------

TILE_W, TILE_H = 256, 128
DUNGEON_ANCHOR = (128, 437)
KIT_SCALE_FULL = 256 / 130


def sprite(path, kit=False, graded=None):
    im = Image.open(path).convert("RGBA")
    if graded:
        im = grade(im, **graded)
    if kit:
        s = KIT_SCALE_FULL
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        return im, (KIT_ANCHOR[0] * s, KIT_ANCHOR[1] * s)
    return im, DUNGEON_ANCHOR


def paint_menu(sky: Image.Image) -> Image.Image:
    canvas = sky.copy().convert("RGBA")
    ox, oy = 1270, 420  # screen position of grid cell (0, 0) centre

    def at(c: float, r: float) -> tuple[float, float]:
        return ox + (c - r) * TILE_W / 2, oy + (c + r) * TILE_H / 2

    cols, rows = 5, 5
    island = {(c, r) for c in range(cols) for r in range(rows)} - {(0, 4), (4, 0), (4, 4)}

    # Earth underside: a jagged mass hanging below the island's front outline.
    front: dict[int, float] = {}
    for c, r in island:
        cx, cy = at(c, r)
        for dx in range(-TILE_W // 2, TILE_W // 2 + 1, 4):
            x = round(cx + dx) // 4 * 4
            y = cy + TILE_H / 2 - abs(dx) / 2 + 22  # bottom of the diamond + slab
            front[x] = max(front.get(x, -1e9), y)
    xs = sorted(front)
    x0, x1 = xs[0], xs[-1]
    random.seed(3)
    tip = x0 + (x1 - x0) * 0.58
    pts = [(x, front[x]) for x in xs]
    jag = 0.0
    for x in reversed(xs[::6]):
        t = 1 - abs(x - tip) / max(tip - x0, x1 - tip)
        jag = jag * 0.6 + random.uniform(-30, 30)
        pts.append((x, front[x] + 40 + max(t, 0) ** 1.6 * 470 + jag))
    under = Image.new("RGBA", canvas.size)
    d = ImageDraw.Draw(under)
    d.polygon(pts, fill=(62, 43, 30, 255))
    # Hand-shaded vertical striation, clipped to the rock mass.
    stria = Image.new("RGBA", canvas.size)
    sd = ImageDraw.Draw(stria)
    for _ in range(420):
        x = random.uniform(x0, x1)
        y0 = front[min(xs, key=lambda v: abs(v - x))] + random.uniform(0, 240)
        sd.line([(x, y0), (x + random.uniform(-6, 6), y0 + random.uniform(30, 220))],
                fill=(26, 18, 12, random.randint(50, 140)), width=random.choice((1, 2, 3)))
    yy = np.linspace(0, 1, H)[:, None] * np.ones((1, W))
    fade = Image.fromarray((np.clip(yy * 1.2, 0, 1) * 150).astype(np.uint8))
    darken = Image.new("RGBA", canvas.size, (20, 13, 9, 255))
    darken.putalpha(fade)
    rock = Image.alpha_composite(under, stria)
    rock = Image.alpha_composite(rock, darken)
    rock.putalpha(under.getchannel("A"))
    canvas.alpha_composite(rock.filter(ImageFilter.GaussianBlur(0.8)))

    iso = DUNGEON / "Isometric"
    random.seed(11)
    for s in range(cols + rows):
        for c in range(cols):
            r = s - c
            if (c, r) not in island:
                continue
            name = random.choice(["dirt", "dirt", "dirt", "dirtTiles", "stoneMissingTiles"])
            im, a = sprite(iso / f"{name}_N.png")
            x, y = at(c, r)
            canvas.alpha_composite(im, (round(x - a[0]), round(y - a[1])))

    # (cell, depth bias, path, kit?, graded?)
    props = [
        ((1, 0), -0.25, iso / "stoneWallAged_S.png", False),
        ((2, 0), -0.25, iso / "stoneWallWindow_S.png", False),
        ((3, 0), -0.25, iso / "stoneWallBrokenLeft_S.png", False),
        ((1, 0), -0.25, iso / "stoneWall_E.png", False),
        ((1, 1), -0.25, iso / "stoneWallArchway_E.png", False),
        ((1, 2), -0.25, iso / "stoneWallBroken_E.png", False),
        ((2, 1), 0, iso / "woodenSupportsBeam_S.png", False),
        ((3, 1), 0, iso / "woodenSupportBeams_S.png", False),
        ((2, 2), 0, iso / "tableChairsBroken_N.png", False),
        ((3, 2), 0, iso / "barrels_N.png", False),
        ((0, 0), 0, GRAVE / "pineCrooked_SE.png", True),
        ((0, 2), 0, NATURE / "tree_thin_dark_NE.png", True),
        ((0, 3), 0, GRAVE / "gravestoneCross_SE.png", True),
        ((1, 3), 0, GRAVE / "gravestoneBroken_SE.png", True),
        ((1, 4), 0, GRAVE / "crossWood_SE.png", True),
        ((3, 3), 0, TOWN / "cart_W.png", True),
        ((4, 2), 0, GRAVE / "lanternCandle_SE.png", True),
        ((2, 4), 0, NATURE / "stump_old_NE.png", True),
        ((3, 4), 0, NATURE / "grass_large_NE.png", True),
        ((4, 1), 0, NATURE / "rock_largeA_NE.png", True),
    ]
    for (c, r), bias, path, kit in sorted(props, key=lambda p: p[0][0] + p[0][1] + p[1]):
        im, a = sprite(path, kit=kit, graded=KIT_GRADE if kit else None)
        x, y = at(c, r)
        canvas.alpha_composite(im, (round(x - a[0]), round(y - a[1])))

    # Ink birds.
    bd = ImageDraw.Draw(canvas)
    for bx, by, s in ((380, 210, 1.0), (450, 260, 0.7), (1650, 160, 0.8), (300, 330, 0.55)):
        bd.line([(bx - 14 * s, by - 4 * s), (bx - 5 * s, by), (bx, by + 3 * s), (bx + 5 * s, by),
                 (bx + 14 * s, by - 6 * s)], fill=(28, 20, 14, 230), width=max(2, round(3 * s)),
                joint="curve")

    # Warm vignette towards the edges and a darker band where the menu sits.
    yy, xx = np.mgrid[0:H, 0:W]
    v = ((xx - W * 0.62) / (W * 0.75)) ** 2 + ((yy - H * 0.45) / (H * 0.8)) ** 2
    vig = np.clip(v, 0, 1) ** 1.3
    shade = np.zeros((H, W, 4), dtype=np.uint8)
    shade[..., :3] = (36, 24, 16)
    shade[..., 3] = (vig * 200).astype(np.uint8)
    canvas.alpha_composite(Image.fromarray(shade))
    return canvas.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sky = paint_sky(W, H, 5)
    sky.save(OUT / "sky.webp", quality=82, method=6)
    paint_fog().save(OUT / "fog.png", optimize=True)
    paint_menu(sky).save(OUT / "menu-bg.webp", quality=84, method=6)
    print("backdrops: sky.webp, fog.png, menu-bg.webp")


if __name__ == "__main__":
    main()
