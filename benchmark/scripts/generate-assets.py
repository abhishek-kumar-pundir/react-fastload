import os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

random.seed(42)
np.random.seed(42)

OUT = "../public"

def make_photo(path, w, h, seed, quality=78):
    rng = np.random.default_rng(seed)
    # Smooth gradient base (cheap to generate, compresses realistically)
    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    xv, yv = np.meshgrid(x, y)
    c1 = rng.integers(30, 220, size=3)
    c2 = rng.integers(30, 220, size=3)
    base = (xv[..., None] * c1 + (1 - xv[..., None]) * c2)
    # Add real per-pixel noise so JPEG can't trivially compress it away —
    # keeps file sizes realistic instead of near-zero flat-color JPEGs.
    noise = rng.normal(0, 18, size=(h, w, 3))
    arr = np.clip(base + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, mode="RGB")

    draw = ImageDraw.Draw(img)
    # A few random shapes for visual variety / to defeat trivial dedup.
    for _ in range(6):
        x0, y0 = rng.integers(0, w), rng.integers(0, h)
        x1, y1 = x0 + rng.integers(20, w // 3), y0 + rng.integers(20, h // 3)
        color = tuple(int(v) for v in rng.integers(0, 255, size=3))
        draw.ellipse([x0, y0, x1, y1], outline=color, width=3)

    img.save(path, "JPEG", quality=quality, optimize=True)
    return os.path.getsize(path)

total = 0

# Hero
total += make_photo(f"{OUT}/hero.jpg", 1600, 900, seed=1, quality=85)

# Gallery: mirror buildGallery()'s dimension logic (id = 100+i, large every 7th)
for i in range(50):
    large = (i % 7 == 0)
    w, h = (1600, 1000) if large else (600, 400)
    make_photo(f"{OUT}/gallery/{100+i}.jpg", w, h, seed=100 + i, quality=78)

# Video posters
for i in range(5):
    make_photo(f"{OUT}/posters/{1040+i}.jpg", 1280, 720, seed=1040 + i, quality=80)

print("done")

import json

manifest = {
    "hero": os.path.getsize(f"{OUT}/hero.jpg"),
    "gallery": {str(100 + i): os.path.getsize(f"{OUT}/gallery/{100+i}.jpg") for i in range(50)},
    "posters": {str(1040 + i): os.path.getsize(f"{OUT}/posters/{1040+i}.jpg") for i in range(5)},
}
with open("../src/asset-sizes.json", "w") as f:
    json.dump(manifest, f, indent=2)
print("manifest written")
