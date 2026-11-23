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

/* Research overview: the scroll story (markup in #research, styles under
   "RESEARCH OVERVIEW" in index.css). The page's scroll position through the
   tall .story scrubs a paused Web Animations timeline, product-launch-page
   style: every orb, card and line has ONE paused animation spanning the whole
   story (keyframe offsets 0 → 1), and scrolling sets their currentTime, so
   scrolling back plays everything in reverse for free. Rebuilt from the
   stage's size when the page is shown and on resize; cancelled in
   accessibility mode, where the CSS lays the same content out as a column. */
function initResearchStory() {
  const story = document.querySelector(".story");
  if (!story) return;
  const section = story.closest("section");
  const stage = story.querySelector(".story__stage");
  const svg = story.querySelector(".story__lines");
  const hint = story.querySelector(".story__hint");
  const orb = {};
  story.querySelectorAll(".story__orb").forEach((el) => (orb[el.dataset.node] = el));
  const card = {};
  story.querySelectorAll(".story__card").forEach((el) => (card[el.dataset.card] = el));

  const TL = 1000; // virtual ms: currentTime = progress * TL
  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  const a11y = () => document.documentElement.classList.contains("a11y");
  let anims = [];

  /* Timeline: [start, end] as fractions of the scroll through .story. The
     gaps between beats are holds. Each element's keyframes must stay in
     ascending order, so keep draws before fades. */
  const T = {
    hint:           [0.00, 0.05],
    hccUp:          [0.05, 0.13],
    physioOut:      [0.13, 0.22],
    haiOut:         [0.15, 0.24],
    l1:             [0.25, 0.31], // Physio — HAI
    l2:             [0.31, 0.36], // down to the intersection card
    cardInter:      [0.33, 0.39],
    cardInterOut:   [0.43, 0.47], // also fades l2
    sensingOut:     [0.45, 0.53],
    l3:             [0.52, 0.56], // Physio → Sensing
    cardSensing:    [0.53, 0.58],
    cardSensingOut: [0.61, 0.65],
    meaningOut:     [0.63, 0.70],
    evalOut:        [0.65, 0.72],
    l4:             [0.69, 0.73], // HAI → Meaning
    l5:             [0.71, 0.75], // HAI → Evaluation
    cardHai:        [0.72, 0.77],
    cardHaiOut:     [0.80, 0.84],
    treeOut:        [0.80, 0.84], // l1, l3, l4, l5 fade
    parentsOut:     [0.81, 0.87], // HCC, Physio, HAI drift up and fade
    lineup:         [0.84, 0.91], // Sensing / Meaning / Evaluation line up
    l6:             [0.91, 0.94], // Sensing — Meaning
    l7:             [0.94, 0.97], // Meaning — Evaluation
    summary:        [0.95, 1.00],
  };

  function build() {
    for (const a of anims) a.cancel();
    anims = [];
    svg.replaceChildren();
    if (a11y()) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return; // page hidden: built when it is shown
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const X = (f) => f * W, Y = (f) => f * H;
    const r = { child: orb.physio.offsetWidth / 2, leaf: orb.sensing.offsetWidth / 2 };
    // Slots: x from the stage centre, y from its top (px).
    const P = {
      hcc0: [0, Y(0.46)], hcc: [0, Y(0.20)], hccOut: [0, Y(0.10)],
      physio: [X(-0.17), Y(0.42)], hai: [X(0.17), Y(0.42)],
      sensing: [X(-0.22), Y(0.64)], meaning: [X(0.08), Y(0.64)], evaluation: [X(0.32), Y(0.64)],
      lineS: [X(-0.24), Y(0.34)], lineM: [0, Y(0.34)], lineE: [X(0.24), Y(0.34)],
      cardTop: Y(0.72), summaryTop: Y(0.50),
    };
    const up = ([x, y]) => [x, y - Y(0.1)];
    const run = (el, frames) => {
      const a = el.animate(frames, { duration: TL, fill: "both" });
      a.pause();
      anims.push(a);
    };

    // Orbs. Keyframe = [offset, [x, y], opacity]; hidden while fully
    // transparent so an invisible orb costs no backdrop-filter work.
    const orbF = (list) => list.map(([o, p, op]) => ({
      offset: o, easing: EASE,
      transform: `translate(-50%, -50%) translate(${p[0]}px, ${p[1]}px)`,
      opacity: op, visibility: op > 0 ? "visible" : "hidden",
    }));
    run(orb.hcc, orbF([
      [0, P.hcc0, 1], [T.hccUp[0], P.hcc0, 1], [T.hccUp[1], P.hcc, 1],
      [T.parentsOut[0], P.hcc, 1], [T.parentsOut[1], P.hccOut, 0], [1, P.hccOut, 0],
    ]));
    const emerge = (el, from, to, t, out) => run(el, orbF([
      [0, from, 0], [t[0], from, 0], [t[1], to, 1],
      [out[0], to, 1], [out[1], up(to), 0], [1, up(to), 0],
    ]));
    emerge(orb.physio, P.hcc, P.physio, T.physioOut, T.parentsOut);
    emerge(orb.hai, P.hcc, P.hai, T.haiOut, T.parentsOut);
    const leaf = (el, from, to, t, line) => run(el, orbF([
      [0, from, 0], [t[0], from, 0], [t[1], to, 1],
      [T.lineup[0], to, 1], [T.lineup[1], line, 1], [1, line, 1],
    ]));
    leaf(orb.sensing, P.physio, P.sensing, T.sensingOut, P.lineS);
    leaf(orb.meaning, P.hai, P.meaning, T.meaningOut, P.lineM);
    leaf(orb.evaluation, P.hai, P.evaluation, T.evalOut, P.lineE);

    // Cards rise in (and out) at a fixed top.
    const cf = (y, op) => ({
      easing: EASE, transform: `translate(-50%, 0) translate(0, ${y}px)`,
      opacity: op, visibility: op > 0 ? "visible" : "hidden",
    });
    const cardF = (y, tin, tout) => {
      const f = [{ offset: 0, ...cf(y + 28, 0) }, { offset: tin[0], ...cf(y + 28, 0) }, { offset: tin[1], ...cf(y, 1) }];
      if (tout) f.push({ offset: tout[0], ...cf(y, 1) }, { offset: tout[1], ...cf(y - 16, 0) }, { offset: 1, ...cf(y - 16, 0) });
      else f.push({ offset: 1, ...cf(y, 1) });
      return f;
    };
    run(card.intersection, cardF(P.cardTop, T.cardInter, T.cardInterOut));
    run(card.sensing, cardF(P.cardTop, T.cardSensing, T.cardSensingOut));
    run(card.hai, cardF(P.cardTop, T.cardHai, T.cardHaiOut));
    run(card.summary, cardF(P.summaryTop, T.summary, null));
    if (hint) {
      run(hint, [
        { offset: 0, opacity: 1 },
        { offset: T.hint[1], opacity: 0, visibility: "hidden" },
        { offset: 1, opacity: 0, visibility: "hidden" },
      ]);
    }

    // Lines: a dash-offset sweep draws them; some fade out later. Endpoints
    // are centre-relative like the slots. curved = S-curve with vertical
    // tangents (parent → child); otherwise straight.
    const NS = "http://www.w3.org/2000/svg";
    const line = (from, to, draw, fade, curved) => {
      const [x1, y1] = [W / 2 + from[0], from[1]];
      const [x2, y2] = [W / 2 + to[0], to[1]];
      const ym = (y1 + y2) / 2;
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", curved
        ? `M ${x1} ${y1} C ${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2}`
        : `M ${x1} ${y1} L ${x2} ${y2}`);
      svg.appendChild(p);
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}px`;
      const f = [
        { offset: 0, strokeDashoffset: `${len}px`, opacity: 1 },
        { offset: draw[0], strokeDashoffset: `${len}px`, easing: EASE },
        { offset: draw[1], strokeDashoffset: "0px" },
      ];
      if (fade) {
        f.push(
          { offset: fade[0], opacity: 1 },
          { offset: fade[1], opacity: 0, visibility: "hidden" },
          { offset: 1, strokeDashoffset: "0px", opacity: 0, visibility: "hidden" }
        );
      } else {
        f.push({ offset: 1, strokeDashoffset: "0px", opacity: 1 });
      }
      run(p, f);
    };
    line([P.physio[0] + r.child, P.physio[1]], [P.hai[0] - r.child, P.hai[1]], T.l1, T.treeOut, false);
    line([0, P.physio[1]], [0, P.cardTop - 6], T.l2, T.cardInterOut, false);
    line([P.physio[0], P.physio[1] + r.child], [P.sensing[0], P.sensing[1] - r.leaf], T.l3, T.treeOut, true);
    line([P.hai[0], P.hai[1] + r.child], [P.meaning[0], P.meaning[1] - r.leaf], T.l4, T.treeOut, true);
    line([P.hai[0], P.hai[1] + r.child], [P.evaluation[0], P.evaluation[1] - r.leaf], T.l5, T.treeOut, true);
    line([P.lineS[0] + r.leaf, P.lineS[1]], [P.lineM[0] - r.leaf, P.lineM[1]], T.l6, null, false);
    line([P.lineM[0] + r.leaf, P.lineM[1]], [P.lineE[0] - r.leaf, P.lineE[1]], T.l7, null, false);
  }

  // Scroll → progress → currentTime on every animation (one rAF per frame).
  let raf = 0;
  function update() {
    raf = 0;
    if (!anims.length) return;
    const span = story.offsetHeight - window.innerHeight;
    const top = story.getBoundingClientRect().top;
    const p = span > 0 ? Math.min(1, Math.max(0, -top / span)) : 0;
    const t = p * TL;
    for (const a of anims) a.currentTime = t;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener("scroll", schedule, { passive: true });
  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (section.classList.contains("is-active")) { build(); update(); }
    }, 120);
  }, { passive: true });

  // Each visit starts at the top (showSection scrolls to 0): rebuild for the
  // current size, scrub to the start, and float the stage in.
  function enter() {
    build();
    update();
    stage.style.animation = "none";
    void stage.offsetWidth;
    stage.style.animation = "storyIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both";
  }
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(() => {
      if (section.classList.contains("is-active")) enter();
    }).observe(section, { attributes: true, attributeFilter: ["class"] });
    // Accessibility mode toggled on/off: drop or restore the timeline.
    new MutationObserver(() => {
      if (section.classList.contains("is-active")) { build(); update(); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  if (section.classList.contains("is-active")) enter();
}

/* Showcases: pinned scroll presentations driven entirely by markup (see the
   SHOWCASE comment in index.html / index.css). Same technique as the Research
   story: each timed element gets ONE paused Web Animation spanning the whole
   scroll (offsets 0 → 1) and scrolling sets its currentTime, so it plays
   forwards and backwards for free.

     data-in="a b" / data-out="c d"   scroll-progress ranges (0-1)
     data-fx   rise  (default) slides up into place, keeps rising on the way out
               fade  opacity only (leaves the element's own transform alone)
               zoom  scales up slightly as it leaves (text only)
               grow  starts below the fold at half size and grows into place
               left / right  slides in from that side with a slight turn
               cross flies straight across the stage, left to right, from
                     the START of data-in to the END of data-out (constant
                     speed, so two of them with different spans race)
     data-count  counts from 0 to the element's number while its nearest
                 [data-in] ancestor (or itself) arrives

   Rebuilt when the page is shown and on resize; cancelled in accessibility
   mode, where the CSS lays the content out as a column. */
function initShowcases() {
  const TL = 1000; // virtual ms: currentTime = progress * TL
  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  const a11y = () => document.documentElement.classList.contains("a11y");
  const range = (el, name) => {
    const v = (el.dataset[name] || "").trim().split(/\s+/).map(Number);
    return v.length === 2 && v.every(Number.isFinite) && v[1] >= v[0] ? v : null;
  };

  document.querySelectorAll(".showcase").forEach((show) => {
    const section = show.closest("section");
    const stage = show.querySelector(".showcase__stage");
    if (!section || !stage) return;
    const counters = [...stage.querySelectorAll("[data-count]")].map((el) => ({
      el,
      target: parseFloat(el.textContent) || 0,
      span: range(el.closest("[data-in]") || el, "in") || [0, 0],
    }));
    let anims = [];

    function build() {
      for (const a of anims) a.cancel();
      anims = [];
      for (const c of counters) c.el.textContent = c.target; // resting value
      if (a11y()) return;
      const H = stage.clientHeight, W = stage.clientWidth;
      if (!H) return; // page hidden: built when it is shown

      // fx → [state before arriving, state after leaving]; null = no transform.
      const FX = {
        rise: ["translateY(44px)", "translateY(-32px)"],
        fade: [null, null],
        zoom: ["scale(0.9)", "scale(1.2)"],
        grow: [`translateY(${Math.round(H * 0.74)}px) scale(0.5)`, "scale(0.94)"],
        left: [`translateX(${Math.round(-W * 0.7)}px) rotate(-14deg)`, "translateY(-40px) scale(0.92)"],
        right: [`translateX(${Math.round(W * 0.7)}px) rotate(14deg)`, "translateY(-40px) scale(0.92)"],
      };
      stage.querySelectorAll("[data-in], [data-out]").forEach((el) => {
        const tin = range(el, "in"), tout = range(el, "out");
        if (!tin && !tout) return;
        if (el.dataset.fx === "cross" && tin && tout) {
          // Off-screen left → off-screen right at constant speed; hidden
          // outside the span. Travel is measured from the stage centre,
          // where the grid places the element.
          const d = Math.round(W / 2 + el.offsetWidth);
          const at = (x, vis) => ({ transform: `translateX(${x}px)`, visibility: vis ? "visible" : "hidden" });
          const f = [];
          if (tin[0] > 0) f.push({ offset: 0, ...at(-d, false) });
          f.push({ offset: tin[0], ...at(-d, true) }, { offset: tout[1], ...at(d, true) });
          if (tout[1] < 1) f.push({ offset: Math.min(1, tout[1] + 0.0001), ...at(d, false) }, { offset: 1, ...at(d, false) });
          const a = el.animate(f, { duration: TL, fill: "both" });
          a.pause();
          anims.push(a);
          return;
        }
        const fx = el.dataset.fx in FX ? el.dataset.fx : "rise";
        const [before, after] = FX[fx];
        const state = (transform, opacity) => {
          const k = { opacity, visibility: opacity > 0 ? "visible" : "hidden", easing: EASE };
          if (before !== null) k.transform = transform || "none";
          return k;
        };
        const shown = state(null, 1);
        // "grow" waits below the fold fully opaque; everything else fades in.
        const start = state(before, fx === "grow" ? 1 : 0);
        const end = state(after, 0);
        const f = [];
        if (tin) {
          f.push({ offset: 0, ...start });
          if (tin[0] > 0) f.push({ offset: tin[0], ...start });
          f.push({ offset: tin[1], ...shown });
        } else {
          f.push({ offset: 0, ...shown });
        }
        if (tout) {
          if (tout[0] > f[f.length - 1].offset) f.push({ offset: tout[0], ...shown });
          f.push({ offset: tout[1], ...end });
          if (tout[1] < 1) f.push({ offset: 1, ...end });
        } else if (f[f.length - 1].offset < 1) {
          f.push({ offset: 1, ...shown });
        }
        const a = el.animate(f, { duration: TL, fill: "both" });
        a.pause();
        anims.push(a);
      });
    }

    let raf = 0;
    function update() {
      raf = 0;
      if (!anims.length) return;
      const span = show.offsetHeight - window.innerHeight;
      const top = show.getBoundingClientRect().top;
      const p = span > 0 ? Math.min(1, Math.max(0, -top / span)) : 0;
      for (const a of anims) a.currentTime = p * TL;
      for (const c of counters) {
        const [a, b] = c.span;
        const k = b > a ? Math.min(1, Math.max(0, (p - a) / (b - a))) : 1;
        const v = String(Math.round(c.target * (1 - Math.pow(1 - k, 3))));
        if (c.el.textContent !== v) c.el.textContent = v;
      }
    }
    const active = () => section.classList.contains("is-active");
    window.addEventListener("scroll", () => {
      if (!raf && active()) raf = requestAnimationFrame(update);
    }, { passive: true });
    let rt = 0;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (active()) { build(); update(); } }, 120);
    }, { passive: true });

    function enter() {
      build();
      update();
      stage.style.animation = "none";
      void stage.offsetWidth;
      stage.style.animation = "storyIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both";
    }
    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(() => { if (active()) enter(); })
        .observe(section, { attributes: true, attributeFilter: ["class"] });
      new MutationObserver(() => { if (active()) { build(); update(); } })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    }
    if (active()) enter();
  });
}

/* Page switching: show one section, restart its staggered rise-in, sync the
   active highlight on every [data-section] control, and close any dropdown. */
function showSection(name) {
  document.querySelectorAll("main section").forEach((s) =>
    s.classList.toggle("is-active", s.id === name)
  );

  const active = document.getElementById(name);
  if (active) {
    active.querySelectorAll(".bubble, .free").forEach((b, i) => {
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
  document.querySelectorAll(".nav__link.is-current").forEach((b) =>
    b.classList.remove("is-current")
  );
  let current = document.querySelector(
    `.nav__buttons > .nav__link[data-section="${name}"]`
  );
  if (!current) {
    const item = document.querySelector(`.dropdown-item[data-section="${name}"]`);
    if (item) current = item.closest(".dropdown").querySelector(".dropdown-toggle");
  }
  if (current) current.classList.add("is-current");

  setDropdown(null);

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

/* Floating tiles (.float-tiles > .bubble): under a mouse, a tile turns a few
   degrees to FACE the cursor (cursor to the right → the tile turns right),
   and --mx / --my move its highlight. The turn is written to the `rotate`
   property as one axis-angle rotation, leaving `transform` to the rise-in
   animation. Leaving the tile clears it and the CSS transition settles it
   flat. Skipped for touch / pen and in accessibility mode. */
function initTilt() {
  const MAX = 5; // degrees at the tile's edge
  document.querySelectorAll(".float-tiles > .bubble").forEach((el) => {
    let raf = 0, last = null;
    const apply = () => {
      raf = 0;
      if (!last || document.documentElement.classList.contains("a11y")) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // -1 … 1 from the tile's centre.
      const nx = Math.max(-1, Math.min(1, ((last.clientX - r.left) / r.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((last.clientY - r.top) / r.height) * 2 - 1));
      const rx = -ny * MAX; // cursor above → face up
      const ry = nx * MAX;  // cursor right → face right
      const angle = Math.hypot(rx, ry);
      el.style.rotate = angle < 0.01 ? "none" : `${rx} ${ry} 0 ${angle.toFixed(2)}deg`;
      el.style.setProperty("--mx", `${((nx + 1) * 50).toFixed(1)}%`);
      el.style.setProperty("--my", `${((ny + 1) * 50).toFixed(1)}%`);
      el.classList.add("is-tilting");
    };
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener("pointerleave", () => {
      last = null;
      el.classList.remove("is-tilting");
      el.style.rotate = "";
    });
  });
}

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

/* Nav flyouts (Projects, CV). Apple-style: hovering a nav word with a menu
   opens a wide panel under the bar and dims the page (.nav-curtain); moving
   off the bar and the panel closes it after a short grace period. Click and
   keyboard still work: click toggles, Escape / outside click close (Escape
   also closes the mobile menu). setDropdown() is the single place that opens
   and closes, so the curtain and aria-expanded can't drift out of sync. */
function setDropdown(open) {
  const nav = document.querySelector(".nav");
  document.querySelectorAll(".dropdown").forEach((d) => {
    const on = d === open;
    if (on && nav) {
      // Line the links up under the word that opened the panel.
      const x = d.querySelector(".dropdown-toggle").getBoundingClientRect().left -
        nav.getBoundingClientRect().left;
      d.querySelector(".dropdown-menu").style.setProperty("--menu-x", `${Math.max(16, x)}px`);
    }
    d.classList.toggle("is-open", on);
  });
  document.querySelector(".nav-curtain")?.classList.toggle("is-on", !!open);
  syncDropdownAria();
}

function initDropdowns() {
  const nav = document.querySelector(".nav");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  let closeTimer = 0;
  const cancelClose = () => clearTimeout(closeTimer);

  document.querySelectorAll(".dropdown").forEach((dd) => {
    const toggle = dd.querySelector(".dropdown-toggle");
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      // With a mouse the panel is already open from hover: a click keeps it
      // open instead of flickering it shut.
      const keep = canHover.matches && e.detail > 0;
      setDropdown(dd.classList.contains("is-open") && !keep ? null : dd);
    });
    dd.addEventListener("pointerenter", () => {
      if (!canHover.matches) return;
      cancelClose();
      setDropdown(dd);
    });
    // Clicks inside the panel's padding shouldn't count as "outside".
    dd.querySelector(".dropdown-menu").addEventListener("click", (e) => {
      if (!e.target.closest(".dropdown-item")) e.stopPropagation();
    });
  });
  if (nav) {
    // Moving onto a plain nav word closes the panel; leaving the bar (and
    // the panel, which is inside it) closes it after a moment, so crossing
    // the gap between bar and panel doesn't.
    nav.querySelectorAll(".nav__buttons > .nav__link, .nav__logo").forEach((el) =>
      el.addEventListener("pointerenter", () => {
        if (canHover.matches) { cancelClose(); setDropdown(null); }
      })
    );
    nav.addEventListener("pointerenter", cancelClose);
    nav.addEventListener("pointerleave", () => {
      if (!canHover.matches) return;
      cancelClose();
      closeTimer = setTimeout(() => setDropdown(null), 220);
    });
  }
  document.addEventListener("click", () => setDropdown(null));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    setDropdown(null);
    const open = document.querySelector(".nav.is-open");
    if (open) {
      open.classList.remove("is-open");
      open.querySelector(".nav__burger")?.setAttribute("aria-expanded", "false");
    }
  });
}

/* =========================================================
   IMAGES & GALLERY — project/about thumbnails + fullscreen carousel
   (ported from index.js)
   ========================================================= */

/* projectimages/<dir>/<name>.<ext> -> projectimages/thumbs/<dir>/<name>.webp
   (generated offline; see CONTENT-UPDATE-CHECKLIST.md "RAM"). Non-matching
   paths pass through unchanged. */
function thumbFor(src) {
  return src.startsWith("projectimages/")
    ? "projectimages/thumbs/" + src.slice("projectimages/".length).replace(/\.[^./]+$/, ".webp")
    : src;
}

/* Each Featured page (section[data-featured]) ends with the other projects.
   Rather than write them several times, copy them in from the All Projects
   page: every child of #projects-all except [data-all-only] and the tile for
   the page's own project (data-project === data-featured). The copies are
   laid out three across; full-width tiles stay full width. Must run before
   the images, glass and nav are wired up, so the copies get all three. */
function cloneOtherProjects() {
  const from = document.getElementById("projects-all");
  if (!from) return;
  document.querySelectorAll("section[data-featured]").forEach((to) => {
    for (const el of from.children) {
      if (el.hasAttribute("data-all-only")) continue;
      if (el.dataset.project && el.dataset.project === to.dataset.featured) continue;
      const copy = el.cloneNode(true);
      if (copy.style.getPropertyValue("--w")) {
        copy.style.setProperty("--w", "4");
        copy.style.removeProperty("--wm");
      }
      to.appendChild(copy);
    }
  });
}

/* projectimages/<dir>/<name>.<ext> -> projectimages/web/<dir>/<name>.webp:
   the gallery-sized copy (long side <= 1600px WebP, a fraction of the
   original's bytes). Same generator and same fallback rule as thumbFor. */
function webFor(src) {
  return src.startsWith("projectimages/") && !src.startsWith("projectimages/web/")
    ? "projectimages/web/" + src.slice("projectimages/".length).replace(/\.[^./]+$/, ".webp")
    : src;
}

/* Turn any .bubble[data-images] into a "text | thumbnail" row. Multi-image
   docks get a "View all images" button → carousel; single-image docks open the
   image when their thumbnail is clicked. A .free-media[data-images] gets the
   same thumbnail on its own (no tile, no text wrapper). */
function renderProjectImages() {
  document.querySelectorAll(".bubble[data-images], .free-media[data-images]").forEach((bubble) => {
    if (bubble.querySelector(".project-image-container")) return; // already built
    let images;
    try {
      images = JSON.parse(bubble.getAttribute("data-images"));
    } catch {
      return;
    }
    if (!Array.isArray(images) || images.length === 0) return;

    const isTile = bubble.classList.contains("bubble");

    // Wrap the existing text so it's a single flex child beside the image.
    if (isTile) {
      const text = document.createElement("div");
      text.className = "bubble__text";
      while (bubble.firstChild) text.appendChild(bubble.firstChild);
      bubble.appendChild(text);
    }

    // Square thumbnail (first image). RAM: a thumbnail draws at 150–300px but
    // would decode the full 2000px original (~12MB of pixels), so it uses the
    // 640px WebP from projectimages/thumbs/ (same path, .webp) and falls back
    // to the original if the thumb is missing. The gallery keeps the originals.
    const figure = document.createElement("div");
    figure.className = "project-image-container";
    const img = document.createElement("img");
    img.src = thumbFor(images[0]);
    img.onerror = () => { img.onerror = null; img.src = images[0]; };
    img.alt = bubble.dataset.alt || "Project image";
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
        createGalleryModal(images, 0, figure);
      });
      figure.appendChild(btn);
    } else {
      figure.classList.add("is-single");
      figure.addEventListener("click", () => createGalleryModal(images, 0, figure));
    }

    bubble.appendChild(figure);
    if (isTile) bubble.classList.add("has-image");
  });
}

/* Fullscreen "Cover Flow" gallery, styled as site chrome: the control pill
   and the close button are glass (refraction via LiquidGlass on Chromium —
   skipped in accessibility mode, where the CSS shows solid panels). Every
   image is a slide in a 3D stage: the current one sits flat in the middle,
   the others fan out to each side, turned and shrunk (iTunes-style). Slides
   get data-pos = their offset from the current image (-4…4, or "far") and
   the CSS places them from that. Built on demand, removed on close. Closes
   on the ✕, click-outside, or Esc; ← / →, swiping, the arrow pill, or
   clicking a side cover moves the row. The row is linear (no wrap-around),
   like the original.

   Opening from a dock thumbnail (originEl = its square frame) plays a
   two-beat entrance: the current cover starts over the thumbnail (a FLIP
   transform from the thumbnail's rect to the cover's final rect) and zooms
   into place, then the other covers, which were gathered behind it, fan out
   to their positions with a small stagger. Without originEl (or in
   accessibility mode) the modal just pops in as before. */
function createGalleryModal(images, startIndex = 0, originEl = null) {
  document.querySelector(".gallery-modal-overlay")?.remove();
  let i = startIndex;
  const multi = images.length > 1;
  const opener = document.activeElement; // to hand focus back on close
  // Animated open/close only when launched from a dock thumbnail and not in
  // accessibility mode (where motion is off and side covers are hidden).
  const zoom = !!originEl && !document.documentElement.classList.contains("a11y");

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

  const stage = document.createElement("div");
  stage.className = "gallery-modal-stage";
  const slides = images.map((src, k) => {
    const slide = document.createElement("div");
    slide.className = "gallery-modal-slide";
    const im = document.createElement("img");
    im.className = "gallery-modal-image";
    // RAM: no src yet. show() assigns it only to covers in the fan (centre
    // ± 4), so a 12-image gallery decodes 5 full-size images at open instead
    // of 12; the rest load as they step into the fan and then stay loaded.
    im.dataset.src = src;
    im.alt = `Image ${k + 1} of ${images.length}`;
    im.decoding = "async";
    im.draggable = false;
    slide.appendChild(im);
    if (multi) {
      slide.addEventListener("click", () => {
        if (k !== i) show(k); // a side cover jumps to itself
      });
    }
    stage.appendChild(slide);
    return slide;
  });

  const nav = document.createElement("div");
  nav.className = "gallery-modal-nav";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "gallery-modal-btn";
  prevBtn.setAttribute("aria-label", "Previous image");
  prevBtn.innerHTML = "&#9664;";
  const counter = document.createElement("span");
  counter.className = "gallery-modal-counter";
  counter.setAttribute("aria-live", "polite");
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "gallery-modal-btn";
  nextBtn.setAttribute("aria-label", "Next image");
  nextBtn.innerHTML = "&#9654;";
  nav.append(prevBtn, counter, nextBtn);
  if (!multi) prevBtn.style.display = nextBtn.style.display = "none";

  function show(idx) {
    i = Math.max(0, Math.min(images.length - 1, idx));
    slides.forEach((s, k) => {
      const pos = k - i;
      s.dataset.pos = Math.abs(pos) > 4 ? (pos < 0 ? "far-left" : "far-right") : String(pos);
      s.classList.toggle("is-current", pos === 0);
      // Lazy-load the fan (see the slide builder above). Once loaded, keep it.
      if (Math.abs(pos) <= 4) {
        const im = s.firstElementChild;
        if (im && !im.src) {
          // Web-sized copy first; the original only if that copy is missing.
          im.onerror = () => { im.onerror = null; im.src = im.dataset.src; };
          im.src = webFor(im.dataset.src);
        }
      }
      // Only the centre image is "the" image for assistive tech.
      s.setAttribute("aria-hidden", pos === 0 ? "false" : "true");
    });
    counter.textContent = `${i + 1} / ${images.length}`;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === images.length - 1;
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

  let closing = false;
  function close() {
    if (closing) return;
    closing = true;
    document.removeEventListener("keydown", onKey);
    const finish = () => {
      glasses.forEach((g) => g.destroy());
      document.body.style.overflow = ""; // release the scroll lock
      overlay.remove();
      if (opener && opener.focus) opener.focus();
    };
    if (!zoom) { finish(); return; }

    // Exit, quicker than the entrance: (1) every cover but the thumbnail's
    // fades out while that one snaps to the centre and the overlay clears;
    // (2) it then flies back down into its frame on the page and the modal
    // is removed the moment it lands.
    const hero = slides[startIndex];
    hero.classList.add("is-origin");
    stage.classList.add("is-closing");
    overlay.classList.add("is-closing");
    setTimeout(() => {
      // The cover's untransformed rect: centred in the stage, top-aligned
      // (getBoundingClientRect would include any in-flight transform).
      const to = originEl.getBoundingClientRect();
      const st = stage.getBoundingClientRect();
      const w = hero.offsetWidth;
      const h = hero.offsetHeight;
      const fromLeft = st.left + (st.width - w) / 2;
      const fromTop = st.top;
      if (to.width && w) {
        const s = Math.min(to.width / w, to.height / h);
        const dx = to.left + to.width / 2 - (fromLeft + w / 2);
        const dy = to.top + to.height / 2 - (fromTop + h / 2);
        hero.style.transition = "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)";
        hero.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      }
      setTimeout(finish, 290);
    }, 150);
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
  modal.append(stage, nav);
  overlay.append(modal, closeBtn);

  if (zoom) {
    modal.classList.add("is-zooming");   // no pop animation: the cover does the entrance
    stage.classList.add("is-gathering"); // side covers wait behind the centre
  }

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden"; // lock page scroll behind the modal
  closeBtn.focus();

  if (zoom) {
    // FLIP: the centre cover's CSS transform is identity, so its rect now IS
    // its final rect. Start it over the thumbnail (uniform scale, so the image
    // never distorts) and let the transform transition carry it home.
    const hero = slides[i];
    const from = originEl.getBoundingClientRect();
    const to = hero.getBoundingClientRect();
    if (from.width && to.width) {
      const s = Math.min(from.width / to.width, from.height / to.height);
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      hero.style.transition = "none";
      hero.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      void hero.offsetWidth; // commit the start state
      requestAnimationFrame(() => {
        hero.style.transition = "";
        hero.style.transform = "";
      });
    }
    // Beat two: once the cover has landed, release the others. is-fanning
    // adds the per-cover stagger; it's dropped after the fan-out so normal
    // stepping has no delay.
    setTimeout(() => {
      stage.classList.remove("is-gathering");
      stage.classList.add("is-fanning");
      setTimeout(() => stage.classList.remove("is-fanning"), 900);
    }, 420);
  }
}
window.createGalleryModal = createGalleryModal;

/* Randomise the lava on each load: every blob's position + motion, plus the
   colour phase. The colour phase is one shared --color-delay (a negative delay
   that seeks into the 240s cycle), so blobs + nav-button glow start on the SAME
   random hue and stay in sync. Kept within the established slow/large ranges. */
function randomizeLava() {
  const rand = (min, max) => min + Math.random() * (max - min);
  document.documentElement.style.setProperty(
    "--color-delay",
    `${(-rand(0, 240)).toFixed(1)}s`
  );
  document.querySelectorAll(".lava__blob").forEach((blob) => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    blob.style.setProperty("--x", `${rand(18, 82).toFixed(1)}%`);
    blob.style.setProperty("--y", `${rand(32, 68).toFixed(1)}%`);
    blob.style.setProperty("--s", `${Math.round(rand(60, 88))}vmin`);
    blob.style.setProperty("--up", `${-Math.round(rand(28, 46))}vh`);
    blob.style.setProperty("--down", `${Math.round(rand(24, 40))}vh`);
    blob.style.setProperty("--hx", `${dir * Math.round(rand(6, 11))}vw`);
    blob.style.setProperty("--d", `${Math.round(rand(600, 780))}s`);
    blob.style.setProperty("--delay", `${-Math.round(rand(0, 360))}s`);
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
   DOWNLOADS — live version, OS highlight, copy button
   Markup is described in the DOWNLOADS comment in index.html. Everything
   here is best effort: links are static GitHub "latest release" permalinks,
   so the page works with none of this.
   ========================================================= */
function initDownloads() {
  const ua = navigator.userAgent || "";
  // Browsers can't tell Apple Silicon from Intel, so both Mac links light
  // up. iPhone/iPad UAs contain "Mac OS X" and Android ones contain "Linux";
  // neither can run the binaries, so they're excluded.
  const os = /Macintosh/.test(ua) && !/iPhone|iPad/.test(ua) ? "mac"
    : /Linux/.test(ua) && !/Android/.test(ua) ? "linux"
    : null;

  document.querySelectorAll(".download-card").forEach((card) => {
    // Highlight the visitor's OS with the same glow the nav uses for the
    // current page. aria-label tells screen-reader users which ones match.
    if (os) {
      card.querySelectorAll(`.download-card__platform[data-os="${os}"]`).forEach((a) => {
        a.classList.add("is-current");
        a.setAttribute("aria-label", `${a.textContent.trim()} (matches your system)`);
      });
    }

    // Copy the install command. navigator.clipboard needs a secure context
    // (https or localhost); the button just stays quiet elsewhere.
    card.querySelectorAll(".download-card__copy").forEach((btn) => {
      const code = btn.parentElement?.querySelector("code");
      if (!code || !navigator.clipboard) return;
      const label = btn.textContent;
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(code.textContent.trim()).then(() => {
          btn.textContent = "Copied";
          setTimeout(() => (btn.textContent = label), 1500);
        }).catch(() => {});
      });
    });

    // Latest release tag (one unauthenticated API call; GitHub allows 60 per
    // hour per visitor IP). Fails silently for a private repo, offline, or
    // when rate-limited — the version span simply stays empty.
    const repo = (card.dataset.ghRepo || "").trim();
    const version = card.querySelector(".download-card__version");
    if (!version || !/^[\w.-]+\/[\w.-]+$/.test(repo) || typeof fetch !== "function") return;
    fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((rel) => { if (rel?.tag_name) version.textContent = rel.tag_name; })
      .catch(() => {});
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
cloneOtherProjects();
renderProjectImages();
initA11y();
if (!a11yOn()) ensureGlass();
initNav();
initDropdowns();
initMobileNav();
initDownloads();
initResearchStory();
initShowcases();
initTilt();
showSection("about"); // default page

