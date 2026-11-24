/* =========================================================
   LiquidGlass — reusable glass engine (vanilla, no deps)

   Two modes:
     • CREATE   — new LiquidGlass({ shape:'pill', center:true })
                  builds a standalone floating glass element.
     • DECORATE — LiquidGlass.apply(navEl, { radius:'pill' })
                  attaches refraction to an EXISTING element (nav, tile,
                  button, …) without replacing it. Used to "glassify" real,
                  content-bearing, layout-positioned chrome.

   The refraction recipe (displacement map sized to the element + 3-channel
   chromatic aberration) and the production hardening (measured sizing,
   proportional/capped scale, ResizeObserver resync, Chromium gate) are ported
   from the portfolio's glass.js — see citations inline.

   backdrop-filter: url() is Chromium-only. On Safari/Firefox we bail and the
   CSS frosted-glass fallback (see css/chrome.css) stays in place.
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
  outputBlur: 1.6,    // feGaussianBlur stdDeviation on the final result (0.5 = crisp; raised for a touch of frost)
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
      // (the nav) over-reach past their own height and grab the content
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
  // Dropdown flyouts are solid panels (readability), not glassified.
  // The accessibility orb: full-axis refraction, like a tiny bubble. (In
  // accessibility mode glassify is skipped and the CSS shows it solid.)
  document.querySelectorAll(".a11y-toggle").forEach((el) =>
    LiquidGlass.apply(el, { radius: "pill", intensity: 0.3 })
  );
  // Research-overview orbs: the same round refraction as the accessibility orb.
  document.querySelectorAll(".orb").forEach((el) =>
    LiquidGlass.apply(el, { radius: "pill", intensity: 0.3 })
  );
}
