/* =========================================================
   LiquidGlass — reusable glass engine (vanilla, no deps)

   Two modes:
     • CREATE   — new LiquidGlass({ shape:'pill', center:true })
                  builds a standalone floating glass element.
     • DECORATE — LiquidGlass.apply(navEl, { radius:'pill' })
                  attaches refraction to an EXISTING element (nav, footer,
                  button, …) without replacing it. Used to "glassify" real,
                  content-bearing, layout-positioned chrome.

   The refraction recipe (displacement map sized to the element + 3-channel
   chromatic aberration) and the production hardening (measured sizing,
   proportional/capped scale, ResizeObserver resync, Chromium gate) are ported
   from the portfolio's glass.js — see citations inline.

   backdrop-filter: url() is Chromium-only. On Safari/Firefox we bail and the
   CSS frosted-glass fallback (see index.css) stays in place.
   ========================================================= */

const SVGNS = "http://www.w3.org/2000/svg";

/* Shared look — mirrors glass.js TUNING. The three you'll reach for most:
   scaleRatio (bend strength), border (rim thickness), blur (rim softness). */
const TUNING = {
  // Displacement STRENGTH is proportional to the short side (capped) — how hard
  // the edge bends, calibrated to the 80px pill (scale 180).
  scaleRatio: 2.25,   // |scale| = scaleRatio * min(w,h)  (= 180 at 80px)
  maxScale: 180,      // cap so big panels don't over-bend
  refScale: 180,      // reference scale for proportional chroma offsets

  // Refraction band WIDTH is ABSOLUTE px from the edge (NOT proportional to the
  // shape), so a big dock gets the same thin rim near its edge with a large
  // clear centre — instead of refracting halfway to the middle. Override per
  // element with the `band` option.
  band: 10,           // px: edge → clear-centre transition distance

  lightness: 50,      // block-out grey: 50% = neutral (no displacement)
  alpha: 0.93,        // block-out opacity
  blend: "difference",// how the blue (Y) gradient blends over the red (X)
  chroma: { r: 0, g: 10, b: 20 }, // per-channel offsets AT refScale = aberration
  outputBlur: 0.5,    // feGaussianBlur stdDeviation on the final result
  saturate: 1.5,      // layered after url() in the backdrop-filter shorthand
  brightness: 1.06,
};

/* CREATE-mode geometry presets. Spread under explicit options. */
const SHAPES = {
  dock:   { width: 336, height: 96,  radius: 24 },
  pill:   { width: 240, height: 64,  radius: "pill" },
  bubble: { width: 150, height: 150, radius: 75 },
};

const CHANNEL_MATRIX = {
  r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
};

/* Chromium feature gate. CSS.supports alone is NOT enough: Safari parses
   `backdrop-filter: url()` and answers true, but can't render SVG-referenced
   backdrop filters — on a cold load it paints the raw displacement maps as
   stretched magenta shapes over the nav/buttons/docks. Require a Chromium
   signal too (navigator.userAgentData is Chromium-only but HTTPS-only, so
   window.chrome covers plain-HTTP previews; Safari and Firefox expose
   neither), so non-Chromium always gets the CSS frost fallback. */
const IS_CHROMIUM = !!(navigator.userAgentData || window.chrome);
const SUPPORTED = !!(IS_CHROMIUM && window.CSS && CSS.supports && (
  CSS.supports("backdrop-filter", "url(#l)") ||
  CSS.supports("-webkit-backdrop-filter", "url(#l)")
));

/* Flag the document when the url() refraction engine is active, so the CSS
   can give browsers WITHOUT it (Safari/Firefox) a heavier frosted fallback
   where the faint 2px frost isn't enough (e.g. the dropdown menus). */
if (SUPPORTED) document.documentElement.classList.add("lg-refract");

let glassCount = 0;
const svgEl = (name, attrs) => {
  const n = document.createElementNS(SVGNS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/* |scale| grows with the element but is capped, then negated (inward bend).
   (glass.js computeScale 61-64.) */
const computeScale = (w, h) =>
  -Math.min(TUNING.maxScale, TUNING.scaleRatio * Math.min(w, h));

/* Displacement map sized to the element. `band` is the ABSOLUTE refraction-band
   width (px from the edge): a small hard rim (`inset`) + a feathered falloff
   (`blur`). Clamped so the clear centre can't vanish on tiny shapes. Not
   proportional → big and small shapes share the same edge band. */
function buildMapDataUri(w, h, r, band, axis) {
  const t = TUNING;
  const b = Math.min(band, Math.min(w, h) * 0.45); // clamp on tiny elements
  const inset = b * 0.2;  // hard rim before the feather
  const blur = b * 0.8;   // feathered falloff inward
  const innerW = Math.max(0, w - inset * 2);
  const innerH = Math.max(0, h - inset * 2);

  // Neutral grey block-out over the centre (R~B~128 = no displacement), so the
  // refraction only happens in the edge band.
  const blockOut =
    `<rect x="${inset}" y="${inset}" width="${innerW}" height="${innerH}" rx="${r}" ` +
      `fill="hsl(0 0% ${t.lightness}% / ${t.alpha})" style="filter:blur(${blur}px)"/>`;

  // axis 'y' = vertical-only: hold R neutral (128, no horizontal displacement)
  // and let B carry the vertical gradient. Kills the left/right end smear on
  // thin wide bars. Default uses both the red (X) and blue (Y) gradients.
  const map =
    axis === "y"
      ? `<defs>` +
          `<linearGradient id="yband" x1="0%" y1="0%" x2="0%" y2="100%">` +
            `<stop offset="0%" stop-color="rgb(128,0,0)"/>` +
            `<stop offset="100%" stop-color="rgb(128,0,255)"/>` +
          `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="${w}" height="${h}" fill="rgb(128,0,128)"/>` +
        `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#yband)"/>`
      : `<defs>` +
          `<linearGradient id="red" x1="100%" y1="0%" x2="0%" y2="0%">` +
            `<stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="red"/>` +
          `</linearGradient>` +
          `<linearGradient id="blue" x1="0%" y1="0%" x2="0%" y2="100%">` +
            `<stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="blue"/>` +
          `</linearGradient>` +
        `</defs>` +
        `<rect x="0" y="0" width="${w}" height="${h}" fill="black"/>` +
        `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#red)"/>` +
        `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#blue)" style="mix-blend-mode:${t.blend}"/>`;

  const svg =
    `<svg viewBox="0 0 ${w} ${h}" xmlns="${SVGNS}">` +
      map +
      blockOut +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ---- shared resize scheduler (glass.js 235-260) -------------------------- */
const elToInstance = new WeakMap();
const dirty = new Set();
let scheduled = false;
function schedule(inst) {
  dirty.add(inst);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const items = [...dirty];
    dirty.clear();
    for (const i of items) if (i.el && i.el.isConnected) i._refresh();
  });
}
const ro = typeof ResizeObserver !== "undefined"
  ? new ResizeObserver((entries) => {
      for (const e of entries) {
        const inst = elToInstance.get(e.target);
        if (inst) schedule(inst);
      }
    })
  : null;

/* Viewport gate. backdrop-filter:url() is very expensive, so a surface only
   carries the filter while it's on (or near) screen; off-screen it drops back
   to the cheap CSS frost. This caps the number of live filters no matter how
   many docks a page has — the main performance lever. */
const io = typeof IntersectionObserver !== "undefined"
  ? new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const inst = elToInstance.get(e.target);
          if (!inst) continue;
          inst._inView = e.isIntersecting;
          schedule(inst);
        }
      },
      { rootMargin: "300px 0px" } // arm slightly before a dock scrolls in
    )
  : null;

class LiquidGlass {
  constructor(options = {}) {
    this.config = { ...options };
    this.id = `lg-${++glassCount}`;
    this._sizeKey = null;
    this._inView = false;   // set by the IntersectionObserver
    this._filterOn = false; // whether backdrop-filter is currently applied

    if (options.target) {
      this.mode = "decorate";
      this.el = options.target;
    } else {
      this.mode = "create";
      this._createElement();
    }
    this._setup();
  }

  /* Glassify an existing element. */
  static apply(target, options = {}) {
    return new LiquidGlass({ ...options, target });
  }

  /* ---- CREATE-mode element ---- */
  _createElement() {
    const c = this.config;
    const preset = c.shape ? SHAPES[c.shape] || {} : {};
    const geo = { ...preset, ...c };

    const el = document.createElement("div");
    el.className = "glass";
    if (c.shape) el.classList.add(`glass--${c.shape}`);
    if (c.interactive) el.classList.add("glass--interactive");
    if (c.className) el.classList.add(...c.className.split(/\s+/));
    if (c.id) el.id = c.id;

    const content = document.createElement("div");
    content.className = "glass__content";
    content.innerHTML = c.content || "";
    el.appendChild(content);
    this.content = content;

    if (geo.width != null) el.style.setProperty("--w", geo.width);
    if (geo.height != null) el.style.setProperty("--h", geo.height);
    if (typeof geo.radius === "number") el.style.setProperty("--r", geo.radius);
    this.config.radius = geo.radius; // resolved (number | 'pill' | undefined)

    this.el = el;
    this._applyPosition();
    (c.parent || document.body).appendChild(el);
  }

  /* ---- wire up filter + observers (both modes) ---- */
  _setup() {
    if (!SUPPORTED) return; // CSS frost fallback shows instead

    if (this.mode === "decorate" &&
        getComputedStyle(this.el).position === "static") {
      this.el.style.position = "relative"; // anchor the absolute filter svg
    }

    this._injectFilter();
    elToInstance.set(this.el, this);
    if (ro) ro.observe(this.el); // size changes → rebuild
    if (io) {
      io.observe(this.el); // visibility changes → apply/drop the filter
    } else {
      this._inView = true; // no IO support → always on
      this._refresh();
    }
  }

  /* Per-instance filter, nested in the element and sized to it (its 100%
     viewport is what lets feImage resolve correctly — the lesson from the
     pill prototype). result/in names are local to each <filter>.

     `chromatic: false` builds a single displacement pass (no per-channel
     isolation + blends) — ~3x cheaper. Used for the large content docks; the
     small chrome keeps the full 3-channel aberration where the fringe reads. */
  _injectFilter() {
    const f = this.id;
    const lite = this.config.chromatic === false;
    const svg = svgEl("svg", { class: "glass__filter", "aria-hidden": "true" });
    const defs = svgEl("defs", {});
    const filter = svgEl("filter", { id: f, "color-interpolation-filters": "sRGB" });

    const feImage = svgEl("feImage", {
      x: "0", y: "0", width: "100%", height: "100%", result: "map",
    });
    filter.appendChild(feImage);

    // Each entry pairs a displacement pass with its chroma scale offset. Lite =
    // one pass at offset 0 (no aberration); full = R/G/B at TUNING.chroma.
    this._dispMaps = [];
    if (lite) {
      const disp = svgEl("feDisplacementMap", {
        in: "SourceGraphic", in2: "map", scale: 0,
        xChannelSelector: "R", yChannelSelector: "B", result: "output",
      });
      filter.appendChild(disp);
      this._dispMaps.push({ node: disp, offset: 0 });
    } else {
      const out = { r: "red", g: "green", b: "blue" };
      for (const key of ["r", "g", "b"]) {
        const disp = svgEl("feDisplacementMap", {
          in: "SourceGraphic", in2: "map", scale: 0,
          xChannelSelector: "R", yChannelSelector: "B", result: `disp${key}`,
        });
        filter.appendChild(disp);
        filter.appendChild(svgEl("feColorMatrix", {
          in: `disp${key}`, type: "matrix", values: CHANNEL_MATRIX[key], result: out[key],
        }));
        this._dispMaps.push({ node: disp, offset: TUNING.chroma[key] });
      }
      filter.appendChild(svgEl("feBlend", { in: "red", in2: "green", mode: "screen", result: "rg" }));
      filter.appendChild(svgEl("feBlend", { in: "rg", in2: "blue", mode: "screen", result: "output" }));
    }
    filter.appendChild(svgEl("feGaussianBlur", { in: "output", stdDeviation: TUNING.outputBlur }));

    defs.appendChild(filter);
    svg.appendChild(defs);
    this.el.insertBefore(svg, this.el.firstChild); // first child → content stays on top
    this.filterSvg = svg;
    this.feImage = feImage;
  }

  /* Measure the rendered element. border:none on every glass surface means the
     border box == padding box, so the map (from the border box) aligns with the
     filter svg's viewport. */
  _measure() {
    const rect = this.el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    let r;
    if (this.config.radius === "pill") r = Math.min(w, h) / 2;
    else if (typeof this.config.radius === "number") r = this.config.radius;
    else r = parseFloat(getComputedStyle(this.el).borderTopLeftRadius) || 0;
    r = Math.round(Math.min(r, Math.min(w, h) / 2)); // clamp to a pill at most
    return { w, h, r };
  }

  /* Gate the (expensive) filter by visibility, and rebuild the map only when
     the size changed. Driven by both observers via schedule(). */
  _refresh() {
    if (!this.feImage) return;
    const { w, h, r } = this._measure();
    const visible = this._inView && w >= 2 && h >= 2;

    if (!visible) {
      // Off-screen / collapsed: drop the filter so it costs nothing. The CSS
      // frost fallback stays (invisible when off-screen anyway).
      if (this._filterOn) {
        this.el.style.backdropFilter = "";
        this.el.style.webkitBackdropFilter = "";
        this._filterOn = false;
      }
      return;
    }

    // (re)build the displacement map only when the size actually changed
    const key = `${w}x${h}x${r}`;
    if (key !== this._sizeKey) {
      this._sizeKey = key;
      const uri = buildMapDataUri(w, h, r, this.config.band ?? TUNING.band, this.config.axis);
      // href only: the engine is Chromium-gated, and every Chromium with
      // backdrop-filter:url() reads href — no need to store each map twice.
      this.feImage.setAttribute("href", uri);

      // `intensity` (default 1) scales the displacement down. Thin wide bars
      // (nav/footer) over-reach past their own height and grab the content
      // scrolling under them (distorted text/edges); a low intensity keeps a
      // gentle refraction instead of a harsh smear.
      const base = computeScale(w, h) * (this.config.intensity ?? 1);
      const k = Math.abs(base) / TUNING.refScale; // shrink chroma with base
      for (const m of this._dispMaps) {
        m.node.setAttribute("scale", base + m.offset * k);
      }

      if (this.config.radius === "pill") this.el.style.borderRadius = `${r}px`;
    }

    if (!this._filterOn) {
      const bf = `url(#${this.id}) saturate(${TUNING.saturate}) brightness(${TUNING.brightness})`;
      this.el.style.backdropFilter = bf;
      this.el.style.webkitBackdropFilter = bf;
      this._filterOn = true;
    }
  }

  /* Place a CREATE-mode element (no-op in decorate mode; CSS positions it). */
  _applyPosition() {
    if (this.mode !== "create") return;
    const c = this.config;
    const s = this.el.style;
    const coord = (v) => (typeof v === "number" ? `${v}px` : v);
    s.position = c.position || "fixed";

    ["top", "left", "right", "bottom"].forEach((k) => (s[k] = ""));
    let translate = c.translate || "";
    const hasCoord = ["top", "left", "right", "bottom"].some((k) => c[k] != null);

    if (c.center) {
      s.top = c.top != null ? coord(c.top) : "50%";
      s.left = c.left != null ? coord(c.left) : "50%";
      if (!translate) translate = "-50% -50%";
    } else if (hasCoord) {
      if (c.top != null) s.top = coord(c.top);
      if (c.left != null) s.left = coord(c.left);
      if (c.right != null) s.right = coord(c.right);
      if (c.bottom != null) s.bottom = coord(c.bottom);
    } else {
      s.top = "50%"; s.left = "50%"; translate = "-50% -50%";
    }
    s.translate = translate;
  }

  /* ---- runtime API ---- */
  set(partial) {
    Object.assign(this.config, partial);
    const s = this.el.style;
    if (this.mode === "create") {
      if (partial.width != null) s.setProperty("--w", partial.width);
      if (partial.height != null) s.setProperty("--h", partial.height);
      if (typeof partial.radius === "number") s.setProperty("--r", partial.radius);
    }
    this._sizeKey = null; // force rebuild
    this._refresh();
    return this;
  }

  setSize(width, height, radius) {
    return this.set({ width, height, radius });
  }

  moveTo(coords) {
    Object.assign(this.config, coords);
    this._applyPosition();
    return this;
  }

  setContent(html) {
    if (this.content) this.content.innerHTML = html;
    return this;
  }

  destroy() {
    if (ro) ro.unobserve(this.el);
    if (io) io.unobserve(this.el);
    elToInstance.delete(this.el);
    if (this.filterSvg) this.filterSvg.remove();
    if (this.mode === "create") {
      this.el.remove();
    } else {
      this.el.style.backdropFilter = "";
      this.el.style.webkitBackdropFilter = "";
    }
  }
}

window.LiquidGlass = LiquidGlass;

/* =========================================================
   SITE — glassify surfaces, page switching, dropdowns, clock
   ========================================================= */

/* Glassify the chrome (pills) and the content docks/menus (rounded rects,
   radius read from their computed border-radius). Docks in hidden sections
   build their map lazily once shown — the ResizeObserver fires on the
   display:none → block change. */
function glassifySurfaces() {
  document.querySelectorAll(".nav").forEach((el) =>
    LiquidGlass.apply(el, { radius: "pill", intensity: 0.3, axis: "x" })
  );
  document.querySelectorAll(".btn").forEach((el) =>
    LiquidGlass.apply(el, { radius: "pill", intensity: 0.3, axis: "x" })
  );
  // Content docks: displacement refraction (chromatic-lite = single pass), with
  // a wider refraction band than the chrome (2x the default 10px).
  document.querySelectorAll(".bubble").forEach((el) =>
    LiquidGlass.apply(el, { chromatic: false, band: 8 })
  );
  document.querySelectorAll(".dropdown-menu").forEach((el) =>
    LiquidGlass.apply(el)
  );
  // The accessibility orb: full-axis refraction, like a tiny bubble. (In
  // accessibility mode glassify is skipped and the CSS shows it solid.)
  document.querySelectorAll(".a11y-toggle").forEach((el) =>
    LiquidGlass.apply(el, { radius: "pill", intensity: 0.3 })
  );
}

/* Page switching: show one section, restart its staggered rise-in, sync the
   active highlight on every [data-section] control, and close any dropdown. */
function showSection(name) {
  document.querySelectorAll("main section").forEach((s) =>
    s.classList.toggle("is-active", s.id === name)
  );

  const active = document.getElementById(name);
  if (active) {
    active.querySelectorAll(".bubble").forEach((b, i) => {
      b.style.animation = "none";
      void b.offsetWidth; // reflow → restart the animation on every visit
      b.style.animation =
        `riseIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${i * 55}ms both`;
    });
    window.scrollTo(0, 0); // start each page at the top
  }

  document.querySelectorAll("[data-section]").forEach((el) => {
    const on = el.dataset.section === name;
    el.classList.toggle("is-active", on);
    // Expose the active page to assistive tech, not just visually.
    if (on) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });

  // Selected-page GLOW always lands on a TOP-LEVEL nav button: About / My Links
  // map directly; a dropdown sub-page (e.g. Education) lights its Résumé /
  // Research toggle instead, never the sub-item itself.
  document.querySelectorAll(".btn.is-current").forEach((b) =>
    b.classList.remove("is-current")
  );
  let current = document.querySelector(
    `.nav__buttons > .btn[data-section="${name}"]`
  );
  if (!current) {
    const item = document.querySelector(`.dropdown-item[data-section="${name}"]`);
    if (item) current = item.closest(".dropdown").querySelector(".dropdown-toggle");
  }
  if (current) current.classList.add("is-current");

  document.querySelectorAll(".dropdown.is-open").forEach((d) =>
    d.classList.remove("is-open")
  );
  syncDropdownAria();

  // Close the mobile menu after navigating.
  const navEl = document.querySelector(".nav");
  if (navEl) {
    navEl.classList.remove("is-open");
    navEl
      .querySelector(".nav__burger")
      ?.setAttribute("aria-expanded", "false");
  }
}
window.showSection = showSection;

/* Any control with data-section switches page. */
function initNav() {
  document.querySelectorAll("[data-section]").forEach((el) =>
    el.addEventListener("click", () => showSection(el.dataset.section))
  );
}

/* Keep each toggle's aria-expanded in step with its dropdown's is-open state,
   wherever the state is changed from. */
function syncDropdownAria() {
  document.querySelectorAll(".dropdown-toggle").forEach((t) =>
    t.setAttribute(
      "aria-expanded",
      String(t.closest(".dropdown").classList.contains("is-open"))
    )
  );
}

/* Résumé / Research dropdowns: toggle on click, close others + on outside
   click or Escape (Escape also closes the mobile menu). */
function initDropdowns() {
  document.querySelectorAll(".dropdown-toggle").forEach((toggle) => {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = toggle.closest(".dropdown");
      const wasOpen = dd.classList.contains("is-open");
      document.querySelectorAll(".dropdown.is-open").forEach((d) =>
        d.classList.remove("is-open")
      );
      dd.classList.toggle("is-open", !wasOpen);
      syncDropdownAria();
    });
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".dropdown.is-open").forEach((d) =>
      d.classList.remove("is-open")
    );
    syncDropdownAria();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".dropdown.is-open").forEach((d) =>
      d.classList.remove("is-open")
    );
    syncDropdownAria();
    const nav = document.querySelector(".nav.is-open");
    if (nav) {
      nav.classList.remove("is-open");
      nav.querySelector(".nav__burger")?.setAttribute("aria-expanded", "false");
    }
  });
}

/* =========================================================
   IMAGES & GALLERY — project/about thumbnails + fullscreen carousel
   (ported from index.js)
   ========================================================= */

/* Turn any .bubble[data-images] into a "text | thumbnail" row. Multi-image
   docks get a "View all images" button → carousel; single-image docks open the
   image when their thumbnail is clicked. */
function renderProjectImages() {
  document.querySelectorAll(".bubble[data-images]").forEach((bubble) => {
    if (bubble.querySelector(".project-image-container")) return; // already built
    let images;
    try {
      images = JSON.parse(bubble.getAttribute("data-images"));
    } catch {
      return;
    }
    if (!Array.isArray(images) || images.length === 0) return;

    // Wrap the existing text so it's a single flex child beside the image.
    const text = document.createElement("div");
    text.className = "bubble__text";
    while (bubble.firstChild) text.appendChild(bubble.firstChild);
    bubble.appendChild(text);

    // Square thumbnail (first image).
    const figure = document.createElement("div");
    figure.className = "project-image-container";
    const img = document.createElement("img");
    img.src = images[0];
    img.alt = "Project image";
    img.loading = "lazy";
    img.decoding = "async"; // decode off the main thread — no scroll jank
    figure.appendChild(img);

    if (images.length > 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "view-images-btn";
      btn.textContent = `View all ${images.length} images`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        createGalleryModal(images, 0);
      });
      figure.appendChild(btn);
    } else {
      figure.classList.add("is-single");
      figure.addEventListener("click", () => createGalleryModal(images, 0));
    }

    bubble.appendChild(figure);
    bubble.classList.add("has-image");
  });
}

/* Fullscreen image carousel, styled as site chrome: the control pill and the
   close button are glass (refraction via LiquidGlass on Chromium — skipped in
   accessibility mode, where the CSS shows solid panels), the image sits in a
   dock-like rimmed frame. Built on demand, removed on close. Closes on the ✕,
   click-outside, or Esc; ← / → and swiping step through when there's more
   than one. */
function createGalleryModal(images, startIndex = 0) {
  document.querySelector(".gallery-modal-overlay")?.remove();
  let i = startIndex;
  const multi = images.length > 1;
  const opener = document.activeElement; // to hand focus back on close

  const overlay = document.createElement("div");
  overlay.className = "gallery-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Image gallery");

  const modal = document.createElement("div");
  modal.className = "gallery-modal";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "gallery-modal-close";
  closeBtn.setAttribute("aria-label", "Close gallery");
  closeBtn.innerHTML = "&times;";

  const figure = document.createElement("div");
  figure.className = "gallery-modal-figure";
  const img = document.createElement("img");
  img.className = "gallery-modal-image";
  img.decoding = "async";
  figure.appendChild(img);

  const nav = document.createElement("div");
  nav.className = "gallery-modal-nav";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "gallery-modal-btn";
  prevBtn.setAttribute("aria-label", "Previous image");
  prevBtn.innerHTML = "&#9664;";
  const counter = document.createElement("span");
  counter.className = "gallery-modal-counter";
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "gallery-modal-btn";
  nextBtn.setAttribute("aria-label", "Next image");
  nextBtn.innerHTML = "&#9654;";
  nav.append(prevBtn, counter, nextBtn);
  if (!multi) prevBtn.style.display = nextBtn.style.display = "none";

  function show(idx) {
    i = (idx + images.length) % images.length;
    img.src = images[i];
    img.alt = `Image ${i + 1} of ${images.length}`;
    counter.textContent = `${i + 1} / ${images.length}`;
    if (multi) {
      // Warm the neighbours so stepping feels instant.
      new Image().src = images[(i + 1) % images.length];
      new Image().src = images[(i - 1 + images.length) % images.length];
    }
  }

  // Glassify the gallery chrome like the site chrome (no-op off Chromium;
  // skipped in accessibility mode). Destroyed with the modal.
  const glasses = [];
  if (!document.documentElement.classList.contains("a11y")) {
    glasses.push(
      LiquidGlass.apply(nav, { radius: "pill", intensity: 0.3, axis: "x" }),
      LiquidGlass.apply(closeBtn, { radius: "pill", intensity: 0.3, axis: "x" })
    );
  }

  function close() {
    document.removeEventListener("keydown", onKey);
    glasses.forEach((g) => g.destroy());
    document.body.style.overflow = ""; // release the scroll lock
    overlay.remove();
    if (opener && opener.focus) opener.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
    else if (multi && e.key === "ArrowLeft") show(i - 1);
    else if (multi && e.key === "ArrowRight") show(i + 1);
  }

  prevBtn.addEventListener("click", () => show(i - 1));
  nextBtn.addEventListener("click", () => show(i + 1));
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);

  // Swipe left/right steps through on touch screens.
  let touchX = null;
  overlay.addEventListener(
    "touchstart",
    (e) => { touchX = e.touches[0].clientX; },
    { passive: true }
  );
  overlay.addEventListener(
    "touchend",
    (e) => {
      if (touchX == null || !multi) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    },
    { passive: true }
  );

  show(i);
  modal.append(figure, nav);
  overlay.append(modal, closeBtn);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden"; // lock page scroll behind the modal
  closeBtn.focus();
}
window.createGalleryModal = createGalleryModal;

/* Randomise the lava on each load: every blob's position + motion, plus the
   colour phase. The colour phase is one shared --color-delay (a negative delay
   that seeks into the 120s cycle), so blobs + nav-button glow start on the SAME
   random hue and stay in sync. Kept within the established slow/large ranges. */
function randomizeLava() {
  const rand = (min, max) => min + Math.random() * (max - min);
  document.documentElement.style.setProperty(
    "--color-delay",
    `${(-rand(0, 120)).toFixed(1)}s`
  );
  document.querySelectorAll(".lava__blob").forEach((blob) => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    blob.style.setProperty("--x", `${rand(18, 82).toFixed(1)}%`);
    blob.style.setProperty("--y", `${rand(32, 68).toFixed(1)}%`);
    blob.style.setProperty("--s", `${Math.round(rand(60, 88))}vmin`);
    blob.style.setProperty("--up", `${-Math.round(rand(28, 46))}vh`);
    blob.style.setProperty("--down", `${Math.round(rand(24, 40))}vh`);
    blob.style.setProperty("--hx", `${dir * Math.round(rand(6, 11))}vw`);
    blob.style.setProperty("--d", `${Math.round(rand(400, 520))}s`);
    blob.style.setProperty("--delay", `${-Math.round(rand(0, 240))}s`);
  });
}

/* Mobile hamburger: toggle the menu; close on outside click. Selecting an item
   navigates (data-section) and showSection() also closes the menu. */
function initMobileNav() {
  const nav = document.querySelector(".nav");
  const burger = nav?.querySelector(".nav__burger");
  if (!nav || !burger) return;
  burger.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("is-open") && !nav.contains(e.target)) {
      nav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Open menu");
    }
  });
}

/* =========================================================
   ACCESSIBILITY MODE
   html.a11y (set pre-paint by the inline <head> script when saved, toggled
   live by the #a11y-toggle button) swaps the liquid-glass presentation for
   a static, high-contrast one — see the ACCESSIBILITY section of index.css.
   While it's on we also skip building the (expensive) refraction engine;
   it's built on demand the first time the mode is switched off.
   ========================================================= */
const a11yOn = () => document.documentElement.classList.contains("a11y");

let glassified = false;
function ensureGlass() {
  if (glassified || !SUPPORTED) return;
  glassified = true;
  glassifySurfaces();
}

function initA11y() {
  const btn = document.getElementById("a11y-toggle");
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(a11yOn()));
  btn.addEventListener("click", () => {
    const on = document.documentElement.classList.toggle("a11y");
    try {
      localStorage.setItem("a11y-mode", on ? "1" : "0");
    } catch (e) {}
    if (!on) ensureGlass(); // returning to the full design needs the engine
    btn.setAttribute("aria-pressed", String(on));
  });
}

randomizeLava();
renderProjectImages();
initA11y();
if (!a11yOn()) ensureGlass();
initNav();
initDropdowns();
initMobileNav();
showSection("objective"); // default page

