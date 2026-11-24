"""Regenerate the web-sized copies of the site's images.

For every image referenced in index.html (data-images arrays and showcase
<img> tags) this writes two WebP copies next to the originals' tree:

  projectimages/thumbs/<path>.webp  short side 640 px, q85. Tile thumbnails.
  projectimages/web/<path>.webp     long side <= 1600 px, q80, alpha kept.
                                    Galleries and showcases.

The page only ever downloads these. js/projects.js (thumbFor / webFor) maps an
original's path to them and falls back to the original if a copy is missing,
so the ORIGINALS ARE THE SOURCE, not what visitors load. Run this after adding
or replacing any image, and commit both folders:

    python3 -I tools/make-thumbs.py

Needs Pillow (pip install pillow).
"""
import json, re, sys
from pathlib import Path
from PIL import Image, ImageOps

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
paths = set()
for m in re.finditer(r"data-images='(\[[^\]]*\])'", html):
    paths.update(json.loads(m.group(1)))
gallery = set(paths)
# Showcase images are written in the HTML as their web copy; map back.
for m in re.finditer(r'<img[^>]+src="projectimages/web/([^"]+)\.webp"', html):
    stem = m.group(1)
    hits = [p for p in (root / "projectimages").glob(stem + ".*") if p.suffix.lower() != ".webp"]
    if hits:
        paths.add(str(hits[0].relative_to(root)))
    else:
        print("NO ORIGINAL FOR", stem)

SHORT = 640   # thumbs: short side
LONG = 1600   # web: long side
total = {"thumbs": 0, "web": 0, "orig": 0}
for rel in sorted(paths):
    src = root / rel
    if not src.exists():
        print("MISSING", rel)
        continue
    total["orig"] += src.stat().st_size
    im = ImageOps.exif_transpose(Image.open(src))
    alpha = im.mode in ("RGBA", "LA", "P") and "A" in im.convert("RGBA").getbands() \
        and im.convert("RGBA").getchannel("A").getextrema()[0] < 255
    im = im.convert("RGBA" if alpha else "RGB")
    w, h = im.size
    sub = Path(rel).relative_to("projectimages").with_suffix(".webp")

    jobs = [("web", LONG / max(w, h), 80)]
    if rel in gallery:
        jobs.append(("thumbs", SHORT / min(w, h), 85))
    for kind, scale, q in jobs:
        out = im
        if scale < 1:
            out = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        dst = root / "projectimages" / kind / sub
        dst.parent.mkdir(parents=True, exist_ok=True)
        out.save(dst, "WEBP", quality=q, method=6)
        total[kind] += dst.stat().st_size
        print(f"{dst.stat().st_size // 1024:5d}K  {out.size[0]}x{out.size[1]}  {dst.relative_to(root)}")
print(f"originals {total['orig'] / 1e6:.1f} MB -> web {total['web'] / 1e6:.1f} MB, thumbs {total['thumbs'] / 1e6:.1f} MB")
