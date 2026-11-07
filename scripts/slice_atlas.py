#!/usr/bin/env python3
"""slice_atlas.py - cut generated sprite sheets into individual transparent PNGs.

Usage: python3 scripts/slice_atlas.py <atlas.json> <sheets_dir> <out_dir>

atlas.json (written by the planner BEFORE generating images):
{
  "sheets": [{
    "file": "sheet-1.png", "cols": 3, "rows": 3, "key": "#00FF00",
    "cells": [
      {"cell": 1, "id": "butterfly", "role": "deco"},
      {"cell": 2, "id": "splash",    "role": "deco"},
      {"id": "scale-run", "flipbook": [3, 4, 5, 6], "role": "anim"}
    ]
  }]
}
cell = 1-based, row-major (1 = top-left). flipbook = ordered cells = frames.
Writes <out_dir>/<id>.png (flipbook: <id>_00.png ...) and <out_dir>/atlas.out.json
with final pixel sizes. Never fails on a bad cell: prints WARN and continues.
"""
import json, os, sys
import numpy as np
from PIL import Image

def hex2rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def key_alpha(rgb, key, tol=70, soft=40):
    d = np.sqrt(((rgb.astype(np.int32) - np.array(key)) ** 2).sum(axis=2))
    a = np.clip((d - tol) / soft, 0, 1)          # 0 at key colour, 1 away from it
    return (a * 255).astype(np.uint8)

def cut(sheet, cols, rows, n):
    W, H = sheet.size
    cw, ch = W // cols, H // rows
    r, c = divmod(n - 1, cols)
    return sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))

def to_rgba(tile, key, has_alpha):
    t = np.array(tile.convert("RGBA"))
    if not has_alpha:
        t[..., 3] = key_alpha(t[..., :3], key)
    return t

def bbox(t, thr=16):
    ys, xs = np.where(t[..., 3] > thr)
    if len(xs) == 0: return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def main():
    atlas_path, sheets_dir, out_dir = sys.argv[1:4]
    atlas = json.load(open(atlas_path)); os.makedirs(out_dir, exist_ok=True)
    out = {"sprites": []}
    for sh in atlas["sheets"]:
        img = Image.open(os.path.join(sheets_dir, sh["file"])).convert("RGBA")
        arr = np.array(img)
        has_alpha = (arr[..., 3] < 250).mean() > 0.02
        if "key" in sh: key = hex2rgb(sh["key"])
        else:
            h, w = arr.shape[:2]
            key = tuple(int(v) for v in np.median(np.array([arr[2, 2], arr[2, w-3], arr[h-3, 2], arr[h-3, w-3]])[:, :3], axis=0))
        cols, rows = sh["cols"], sh["rows"]
        for cell in sh["cells"]:
            nums = cell.get("flipbook") or [cell["cell"]]
            tiles = [to_rgba(cut(img, cols, rows, n), key, has_alpha) for n in nums]
            boxes = [bbox(t) for t in tiles]
            ok = [b for b in boxes if b]
            if not ok:
                print(f"WARN {cell['id']}: empty cell"); continue
            x0 = min(b[0] for b in ok); y0 = min(b[1] for b in ok)
            x1 = max(b[2] for b in ok); y1 = max(b[3] for b in ok)   # union box: no jitter in flipbooks
            th, tw = tiles[0].shape[:2]
            if x0 <= 1 or y0 <= 1 or x1 >= tw - 1 or y1 >= th - 1:
                print(f"WARN {cell['id']}: art touches cell edge (may be clipped)")
            p = 4; x0, y0 = max(0, x0 - p), max(0, y0 - p); x1, y1 = min(tw, x1 + p), min(th, y1 + p)
            files = []
            for i, t in enumerate(tiles):
                name = f"{cell['id']}_{i:02d}.png" if cell.get("flipbook") else f"{cell['id']}.png"
                Image.fromarray(t[y0:y1, x0:x1]).save(os.path.join(out_dir, name)); files.append(name)
            out["sprites"].append({"id": cell["id"], "files": files, "w": int(x1 - x0), "h": int(y1 - y0),
                                   "role": cell.get("role", ""), "flipbook": bool(cell.get("flipbook"))})
    json.dump(out, open(os.path.join(out_dir, "atlas.out.json"), "w"), indent=1)
    print(f"OK {len(out['sprites'])} sprites -> {out_dir}")

if __name__ == "__main__":
    main()