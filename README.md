# wesPortfolio

The source for [wesleyjunkins.com](https://wesleyjunkins.com): a single-page portfolio, hosted on GitHub Pages.

There is no build step and there are no dependencies. The site is plain HTML, CSS and JavaScript; what is in this folder is exactly what is served. To preview it, serve the folder with any static server and open `index.html`.

## What is where

```
index.html            All content and markup. One <section> per page.
css/                  Styles, one file per part of the site (list below).
js/                   Behaviour, one file per feature (list below).
js/backgrounds/       The animated backgrounds, one file each.
projectimages/        Original photos and screenshots, by project.
projectimages/thumbs/ Small copies for tile thumbnails   } generated,
projectimages/web/    Medium copies for galleries/showcases } do not edit
weslogo/              Logo, favicons and app icons.
papers/               PDFs of publications.
tools/make-thumbs.py  Regenerates thumbs/ and web/ from the originals.
docs/                 Working notes (content brief and checklist). Not part of the site.
robots.txt, sitemap.xml, llms.txt, site.webmanifest, CNAME
                      Files crawlers, browsers and GitHub Pages expect at the root.
```

`projectimages/`, `weslogo/` and `papers/` keep their names and locations on purpose: their addresses are public (search engines, shared links, citations), so moving them would break links.

### css/

Loaded in this order by `index.html`. The order matters, because a later file overrides an earlier one.

| File | What it styles |
|---|---|
| `base.css` | Design tokens (colours, glass settings) and the page body. |
| `backgrounds.css` | The lava lamp, its colour palette, and the canvas used by the other backgrounds. |
| `layout.css` | The 12-column page grid, tiles (`.bubble`), un-tiled content (`.free`), the cursor-tilt tiles. |
| `downloads.css` | The Downloads page card. |
| `gallery.css` | Tile thumbnails and the fullscreen image gallery. |
| `research-story.css` | The Research page's scroll diagram. |
| `showcase.css` | The featured-project scroll presentations. |
| `dropdowns.css` | The nav flyout panels (Projects, CV) and the dimmed page behind them. |
| `glass.css` | The standalone glass element used by the glass engine. |
| `chrome.css` | The nav bar, nav links, pill buttons, and the shared glass surface. |
| `responsive.css` | Tablet and phone adjustments, including the mobile menu. |
| `accessibility.css` | Focus styles, the display menu bubbles, and accessibility mode (`html.a11y`). |
| `touch.css` | Lighter effects for touch devices. |

### js/

All files are loaded with `defer`, in the order listed in `index.html`. Every file only *defines* functions; `main.js` runs last and starts everything.

| File | What it does |
|---|---|
| `glass.js` | The liquid-glass refraction engine, and which elements get it. |
| `accessibility.js` | Accessibility mode on/off. |
| `backgrounds/backgrounds.js` | Owns the background canvas, the animation loop and switching. Holds the list of backgrounds. |
| `backgrounds/lava.js`, `neurons.js`, `network.js`, `eeg.js` | One background each. |
| `display-menu.js` | The bubble menu in the bottom-right corner. |
| `navigation.js` | Switching pages, the nav flyouts, the mobile menu. |
| `projects.js` | Copies project tiles onto the featured pages; builds tile thumbnails. |
| `gallery.js` | The fullscreen image gallery. |
| `research-story.js` | The Research page's scroll diagram. |
| `showcase.js` | The featured-project scroll presentations. |
| `tilt.js` | Tiles that turn toward the cursor. |
| `downloads.js` | Live version number, platform highlight and copy button on the Downloads page. |
| `main.js` | Start-up: calls each feature's `init…` function once. |

## How to change things

### Edit text
Everything visible is in `index.html`, grouped by page under comment banners such as `ABOUT` and `EDUCATION`.

### Add or rearrange tiles on a page
Each page is a 12-column grid. A tile is a `<div class="bubble">`; content with no tile around it is a `<div class="free">`. Placement is set on the element itself:

```html
<div class="bubble" style="--w:8; --h:2">   <!-- 8 columns wide, 2 rows tall -->
<div class="bubble" style="--w:4">          <!-- sits beside it -->
<div class="bubble">                        <!-- no style = full width -->
```

`--wm` sets the width on tablets. The full reference is the "Page layout grid" comment in `css/layout.css`.

### Add a project
Add its tile to the **All Projects** section (`<section id="projects-all">`) in `index.html`. That is the only place project tiles are written; the featured pages copy them from there automatically. For images, add `data-images='["projectimages/…", …]'` to the tile, then run the image script (below).

### Add or replace images
Put the original in `projectimages/<project>/`, reference it in `index.html`, then run:

```
python3 -I tools/make-thumbs.py
```

This needs Pillow (`pip install pillow`). It writes the small and medium copies the site actually downloads. Commit `projectimages/thumbs/` and `projectimages/web/` along with the original. Before publishing a screenshot, check it for passwords, usernames and private addresses.

### Add a page
1. Add `<section id="my-page">…</section>` inside `<main>` in `index.html`.
2. Add a nav link with `data-section="my-page"` in both the desktop nav (`.nav__buttons`) and the mobile menu (`.nav__mobile`).

Anything with a `data-section` attribute switches to that page; no script changes are needed.

### Add a featured-project scroll presentation
Copy an existing `.showcase` block in `index.html` and change the content. All the timing is in the markup (`data-in`, `data-out`, `data-fx`, `data-count`), explained in the comment above the BDR-XR showcase. To give it the "other projects" list at the bottom, put `data-featured="<name>"` on its section and `data-project="<name>"` on that project's tile in All Projects.

### Add a background
1. Write `js/backgrounds/<name>.js` (copy an existing one; the header comment explains the three functions it must return).
2. Add its `<script>` tag in `index.html`, above `backgrounds.js`.
3. Add one line to `BACKDROP_RENDERERS` in `js/backgrounds/backgrounds.js`.
4. Add a button with `data-bg-choice="<name>"` to the display menu in `index.html`.

To remove one, undo those four steps. Each background's settings are in the `CFG` block at the top of its file.

### Remove a feature
Delete its line in `js/main.js` and its `<script>` tag in `index.html`. Its stylesheet can go too if nothing else uses it.

### Change the lava colours
The palette is the `lava-color` keyframes in `css/backgrounds.css`, repeated in `lava-now` just below; keep the two in step. The colours are tuned for the brightness set by `--lava-dim` in `css/base.css`.

## Things to know before editing

- **Glass and transforms.** The glass effect is sized from an element's flat box. Animate glass elements with movement and opacity only, never scale. Never put a CSS `filter` on one; it switches the effect off.
- **Refraction is Chromium-only.** Chrome, Edge and Brave get the full refraction; Safari and Firefox get a frosted-glass fallback.
- **Accessibility mode** (`html.a11y`) turns off the backgrounds, glass and motion. New visual features should have a plain fallback there; `css/accessibility.css` is where those rules go.
- **CSS order.** New rules belong in the file for that part of the site. If something does not take effect, check whether a later file in the list sets the same property.
