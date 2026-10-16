#!/usr/bin/env bash
# Fetches the CC0 Kenney packs used by build_assets.py into .cache/kenney.
# Source: community mirror of https://kenney.nl assets (all CC0 1.0).
set -euo pipefail
DEST="${KENNEY_DIR:-$(dirname "$0")/../../.cache/kenney}"
if [ ! -d "$DEST/.git" ]; then
  git clone --filter=blob:none --no-checkout --depth 1 https://github.com/ETdoFresh/kenney.nl "$DEST"
fi
cd "$DEST"
git sparse-checkout set --no-cone \
  "/kenneyDungeonPack_2.3/Isometric/" \
  "/kenneyDungeonPack_2.3/Characters/" \
  "/kenneyDungeonPack_2.3/License.txt" \
  "/kenney_natureKit_2.1/Isometric/" \
  "/kenney_graveyardkit_3/Isometric/" \
  "/fantasy-town-kit-1.0/Isometric/" \
  "/roguelike-pack/"
git checkout
echo "Kenney packs ready in $DEST"
