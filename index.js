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

/* =========================================================
   BACKDROPS — three animated backgrounds, switched live from the display
   menu (bottom-right bubble) and remembered in localStorage "bg-mode":

     lava     the lava lamp (pure CSS; the default)
     neural   neurons firing            } all drawn on the one .neural
     network  a layered neural network  } canvas, by the renderers below
     eeg      scrolling brainwave traces }

   html[data-bg] holds the current one (index.css shows/hides the lava and
   the canvas from it). setBackground() is the only place that changes it.
   ?bg=lava|neural|network|eeg in the address overrides the saved choice.

   A renderer is { build(), frame(t, dt, colour), poke(x, y, t) }: build lays
   the scene out for the current window size, frame draws one frame, poke is
   the mouse moving at (x, y). Both take their colour from --lava-now on the
   nav (read twice a second), so they share its slow colour cycle. The loop
   only runs for a canvas backdrop, and pauses while the tab is hidden or
   accessibility mode is on.
   ========================================================= */
const BACKDROPS = ["lava", "neural", "network", "eeg"];
let setBackground = () => {};

function initBackgrounds() {
  const root = document.documentElement;
  const canvas = document.querySelector(".neural");
  const ctx = canvas && canvas.getContext("2d");
  const S = { W: 0, H: 0 }; // canvas size in CSS px, shared with renderers

  /* ---- Neurons: a small model of neurons firing, not a real simulation.
     Neurons sit on a jittered grid (even coverage, no clumps), sway slowly,
     and are wired to their nearest few neighbours by curved fibres. A neuron
     that FIRES flashes and sends signals down some fibres; an arriving
     signal usually makes that neuron fire too, so activity spreads in short
     cascades (a refractory period stops it bouncing straight back). It is
     mouse-led: the neuron nearest the pointer fires as it passes; away from
     the mouse a random one fires only now and then. ---- */
  function neuronRenderer() {
    const CFG = {
      spacing: 150,       // px between neurons (smaller = denser)
      maxNodes: 110,
      links: 3,           // fibres per neuron (to its nearest neighbours)
      maxLink: 2.1,       // ...but none longer than this many spacings
      sway: 16,           // px a neuron drifts around its spot
      speed: 0.28,        // signal speed, in fibre-lengths per second (avg)
      spread: 0.5,        // chance a firing neuron sends a signal down each fibre
      relay: 0.4,         // chance an arriving signal makes the neuron fire
      refractory: 1100,   // ms before a neuron can fire again
      spontaneous: 0.1,   // random firings per second, away from the mouse (rare)
      pokeRadius: 190,    // px: how close the mouse must be to set a neuron off
      pokeEvery: 110,     // ms between mouse-triggered firings
      maxSignals: 70,
      fibre: 0.13,        // brightness of resting fibres (0-1)
      dim: 0.85,          // overall brightness
    };
    let nodes = [], edges = [], signals = [], lastPoke = 0;
    const P = { x: 0, y: 0 };

    function build() {
      const { W, H } = S;
      // Jittered grid, extended past the edges so fibres run off-screen.
      let step = CFG.spacing;
      while (((W / step + 2) * (H / step + 2)) > CFG.maxNodes) step *= 1.08;
      nodes = [];
      for (let gy = -0.5; gy * step < H + step * 0.5; gy++) {
        for (let gx = -0.5; gx * step < W + step * 0.5; gx++) {
          nodes.push({
            hx: (gx + 0.5 + (Math.random() - 0.5) * 0.8) * step,
            hy: (gy + 0.5 + (Math.random() - 0.5) * 0.8) * step,
            x: 0, y: 0,
            z: 0.45 + Math.random() * 0.55,          // depth: 0.45 far … 1 near
            ph: Math.random() * 6.283, ph2: Math.random() * 6.283,
            rate: 0.00012 + Math.random() * 0.00016, // sway speed
            glow: 0, last: -1e9, edges: [],
          });
        }
      }
      // Wire each neuron to its nearest neighbours (each pair once).
      edges = []; signals = [];
      const seen = new Set();
      nodes.forEach((n, i) => {
        nodes
          .map((m, j) => ({ j, d: Math.hypot(m.hx - n.hx, m.hy - n.hy) }))
          .filter((o) => o.j !== i && o.d < step * CFG.maxLink)
          .sort((p, q) => p.d - q.d)
          .slice(0, CFG.links)
          .forEach(({ j }) => {
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (seen.has(key)) return;
            seen.add(key);
            nodes[i].edges.push(edges.length);
            nodes[j].edges.push(edges.length);
            edges.push({ a: i, b: j, bend: (Math.random() - 0.5) * 0.5 });
          });
      });
    }

    // Point at t (0-1) along a fibre, from node `from` to its other end.
    function along(e, from, t, out) {
      const A = nodes[from], B = nodes[from === e.a ? e.b : e.a];
      const s = from === e.a ? 1 : -1; // keep the curve the same either way
      const mx = (A.x + B.x) / 2 - (B.y - A.y) * e.bend * s;
      const my = (A.y + B.y) / 2 + (B.x - A.x) * e.bend * s;
      const u = 1 - t;
      out.x = u * u * A.x + 2 * u * t * mx + t * t * B.x;
      out.y = u * u * A.y + 2 * u * t * my + t * t * B.y;
      return out;
    }

    function fire(i, t) {
      const n = nodes[i];
      if (!n || t - n.last < CFG.refractory) return;
      n.last = t;
      n.glow = 1;
      for (const ei of n.edges) {
        if (signals.length >= CFG.maxSignals) break;
        if (Math.random() < CFG.spread) {
          signals.push({ e: ei, from: i, t: 0, v: CFG.speed * (0.7 + Math.random() * 0.6) });
        }
      }
    }

    function frame(t, dt, { base, hot }) {
      const D = CFG.dim;
      if (Math.random() < CFG.spontaneous * dt) fire((Math.random() * nodes.length) | 0, t);
      for (const n of nodes) {
        n.x = n.hx + Math.sin(t * n.rate + n.ph) * CFG.sway;
        n.y = n.hy + Math.cos(t * n.rate * 0.8 + n.ph2) * CFG.sway;
        n.glow = Math.max(0, n.glow - dt * 1.1);
      }
      ctx.lineCap = "round";

      // Fibres. A fibre brightens a little while either end is glowing.
      for (const e of edges) {
        const A = nodes[e.a], B = nodes[e.b];
        const z = (A.z + B.z) / 2;
        const lit = Math.max(A.glow, B.glow);
        ctx.strokeStyle = `rgba(${base},${(CFG.fibre * z + lit * 0.16) * D})`;
        ctx.lineWidth = 0.6 + z * 0.9;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.quadraticCurveTo(
          (A.x + B.x) / 2 - (B.y - A.y) * e.bend,
          (A.y + B.y) / 2 + (B.x - A.x) * e.bend,
          B.x, B.y
        );
        ctx.stroke();
      }

      // Signals: a bright head with a short fading tail.
      for (let k = signals.length - 1; k >= 0; k--) {
        const s = signals[k];
        s.t += s.v * dt;
        const e = edges[s.e];
        if (s.t >= 1) {
          const to = s.from === e.a ? e.b : e.a;
          if (Math.random() < CFG.relay) fire(to, t);
          else nodes[to].glow = Math.max(nodes[to].glow, 0.45);
          signals.splice(k, 1);
          continue;
        }
        for (let q = 5; q >= 0; q--) {
          const tt = s.t - q * 0.035;
          if (tt < 0) continue;
          along(e, s.from, tt, P);
          if (q === 0) {
            ctx.fillStyle = `rgba(${base},${0.22 * D})`;
            ctx.beginPath(); ctx.arc(P.x, P.y, 9, 0, 6.283); ctx.fill();
          }
          ctx.fillStyle = `rgba(${hot},${(1 - q / 6) * D * (q === 0 ? 1 : 0.5)})`;
          ctx.beginPath(); ctx.arc(P.x, P.y, q === 0 ? 2.4 : 1.6, 0, 6.283); ctx.fill();
        }
      }

      // Neurons: soft halo (swells when firing) + a core.
      for (const n of nodes) {
        const halo = (7 + 30 * n.glow) * n.z;
        ctx.fillStyle = `rgba(${base},${(0.07 + 0.2 * n.glow) * n.z * D})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, halo, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${base},${(0.1 + 0.25 * n.glow) * n.z * D})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, halo * 0.5, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${n.glow > 0.05 ? hot : base},${(0.45 + 0.55 * n.glow) * n.z * D})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, (1.6 + 1.8 * n.z) * (1 + 0.5 * n.glow), 0, 6.283); ctx.fill();
      }
    }

    function poke(x, y, t) {
      if (t - lastPoke < CFG.pokeEvery) return;
      lastPoke = t;
      let best = -1, bd = CFG.pokeRadius * CFG.pokeRadius;
      nodes.forEach((n, i) => {
        const d = (n.x - x) ** 2 + (n.y - y) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) fire(best, t);
    }
    return { build, frame, poke };
  }

  /* ---- Neural network: a deep network drawn in 3D, seen from a three-
     quarter angle. Each layer is a sheet of units floating in space, the
     sheets run left to right (top to bottom on tall screens) and shrink
     toward a single column of outputs, like a vision network.

     Wiring is LOCAL, as in a convolutional network: every unit listens to
     the few units directly behind it in the previous sheet (its receptive
     field) plus one random long-range unit. So a patch of activity on the
     input sheet stays a recognisable patch as it travels, drifting and
     reshaping from sheet to sheet, instead of dissolving into noise.

     A PASS carries a pattern through: streaks of light run along the wires
     that carry the most, each sheet lights up from what reached it (a real
     weighted sum per unit), its frame flashes, and at the end the strongest
     output unit gets a ring: the network's answer.

     The mouse does two things. It is the INPUT: the pointer's position
     paints a soft spot on the first sheet, and moving it sends that pattern
     through, so different positions give different answers. And it is the
     CAMERA: the whole network turns slightly to follow the pointer. Left
     alone, the camera drifts slowly and a random pattern goes through every
     few seconds.

     Everything is drawn with additive blending ("lighter"), so overlapping
     light adds up to a glow the way it would on a real display. ---- */
  function networkRenderer() {
    const CFG = {
      // [rows, columns] of units per sheet, input first, outputs last.
      sheets: [[7, 7], [6, 6], [8, 4], [6, 6], [5, 4], [5, 1]],
      sheetGap: 190,     // distance between sheets (model units)
      unitGap: 50,       // distance between units on a sheet
      field: 3,          // units of the previous sheet each unit listens to (+1 random)
      yaw: -0.72,        // resting camera angle, radians (0 = side-on, flat)
      pitch: 0.2,
      follow: 0.45,      // how far the camera turns toward the mouse (radians)
      drift: 0.1,        // how far it wanders on its own
      focal: 1700,       // perspective strength (smaller = more dramatic)
      hop: 0.85,         // seconds for a pass to cross from one sheet to the next
      idleEvery: 6,      // seconds between passes when the mouse is still
      pokeEvery: 900,    // ms between mouse-started passes
      maxPasses: 3,
      carry: 0.22,       // a wire shows a streak if it carries more than this
      wire: 0.09,        // brightness of resting wires (0-1)
      dim: 0.95,         // overall brightness
    };
    let sheets = [], passes = [], winner = null;
    let scale = 1, ox = 0, oy = 0, portrait = false, lastPoke = 0, idle = 0;
    const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, at: -1e9 };
    let sprite = null, spriteKey = "";

    function build() {
      const { W, H } = S;
      portrait = H > W * 1.15;
      const n = CFG.sheets.length;
      sheets = CFG.sheets.map(([rows, cols], l) => {
        const units = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            units.push({
              // Model space: X runs through the network, Y is up/down on a
              // sheet, Z is across it.
              X: (l - (n - 1) / 2) * CFG.sheetGap,
              Y: (r - (rows - 1) / 2) * CFG.unitGap,
              Z: (c - (cols - 1) / 2) * CFG.unitGap,
              // Position within the sheet, 0-1, for matching up receptive fields.
              u: rows > 1 ? r / (rows - 1) : 0.5,
              v: cols > 1 ? c / (cols - 1) : 0.5,
              glow: 0, sx: 0, sy: 0, k: 1, fade: 1,
              from: [], // [{ i: index in previous sheet, w: weight }]
            });
          }
        }
        return {
          units, rows, cols, flash: 0,
          hy: ((rows - 1) / 2) * CFG.unitGap + 26,
          hz: ((cols - 1) / 2) * CFG.unitGap + 26,
          X: (l - (n - 1) / 2) * CFG.sheetGap,
          corners: [{}, {}, {}, {}],
        };
      });
      // Receptive fields: the nearest few units behind, plus one wildcard.
      for (let l = 1; l < n; l++) {
        const prev = sheets[l - 1].units;
        for (const t of sheets[l].units) {
          const near = prev
            .map((p, i) => ({ i, d: (p.u - t.u) ** 2 + (p.v - t.v) ** 2 }))
            .sort((p, q) => p.d - q.d)
            .slice(0, CFG.field);
          t.from = near.map(({ i }) => ({ i, w: 0.45 + Math.random() * 0.55 }));
          const wild = (Math.random() * prev.length) | 0;
          if (!t.from.some((f) => f.i === wild)) {
            t.from.push({ i: wild, w: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.5) });
          }
        }
      }
      // Fit and centre: project every sheet's corners with the camera at
      // rest, then scale and shift so that outline fills the window.
      cy_ = Math.cos(CFG.yaw); sy_ = Math.sin(CFG.yaw);
      cp_ = Math.cos(CFG.pitch); sp_ = Math.sin(CFG.pitch);
      scale = 1; ox = 0; oy = 0;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const pt = {};
      for (const s of sheets) {
        for (const [sy, sz] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
          project(s.X, sy * s.hy, sz * s.hz, pt);
          x0 = Math.min(x0, pt.sx); x1 = Math.max(x1, pt.sx);
          y0 = Math.min(y0, pt.sy); y1 = Math.max(y1, pt.sy);
        }
      }
      // Leave room for the nav at the top and the camera's sway at the sides.
      const top = 84, availW = W * 0.82, availH = (H - top) * 0.84;
      scale = Math.min(availW / (x1 - x0), availH / (y1 - y0));
      ox = -((x0 + x1) / 2 - W / 2) * scale;
      oy = -((y0 + y1) / 2 - H / 2) * scale + top / 2;
      passes = []; winner = null; idle = CFG.idleEvery - 1;
    }

    // Model point → screen. Writes sx, sy, k (perspective size), fade (depth).
    let cy_ = 1, sy_ = 0, cp_ = 1, sp_ = 0;
    function project(X, Y, Z, out) {
      const x = X * cy_ + Z * sy_;
      const z1 = -X * sy_ + Z * cy_;
      const y = Y * cp_ - z1 * sp_;
      const z = Y * sp_ + z1 * cp_;
      const k = CFG.focal / (CFG.focal + z);
      const px = x * k * scale, py = y * k * scale;
      out.sx = S.W / 2 + ox + (portrait ? py : px);
      out.sy = S.H / 2 + oy + (portrait ? px : py);
      out.k = k * scale;
      out.fade = Math.max(0.3, Math.min(1, 0.65 - z / 900));
    }

    // The pattern the pointer paints on the input sheet: a soft spot.
    function spot(cx, cy) {
      return sheets[0].units.map((u) => Math.exp(-(((u.v - cx) ** 2 + (u.u - cy) ** 2) / 0.045)));
    }

    function start(acts) {
      if (passes.length >= CFG.maxPasses || !sheets.length) return;
      sheets[0].units.forEach((u, i) => { u.glow = Math.max(u.glow, acts[i]); });
      sheets[0].flash = 1;
      passes.push({ l: 0, t: 0, acts });
      idle = 0;
    }

    function glowSprite(base) {
      if (spriteKey === base && sprite) return sprite;
      spriteKey = base;
      sprite = sprite || document.createElement("canvas");
      sprite.width = sprite.height = 96;
      const g = sprite.getContext("2d");
      const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
      grad.addColorStop(0, `rgba(${base},1)`);
      grad.addColorStop(0.25, `rgba(${base},0.55)`);
      grad.addColorStop(0.6, `rgba(${base},0.12)`);
      grad.addColorStop(1, `rgba(${base},0)`);
      g.clearRect(0, 0, 96, 96);
      g.fillStyle = grad;
      g.fillRect(0, 0, 96, 96);
      return sprite;
    }

    function frame(t, dt, { base, hot }) {
      const D = CFG.dim;
      const spr = glowSprite(base);

      // Camera: ease toward the mouse, plus a slow drift of its own.
      mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 2.2);
      mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 2.2);
      const yaw = CFG.yaw + (mouse.sx - 0.5) * CFG.follow + Math.sin(t * 0.00013) * CFG.drift;
      const pitch = CFG.pitch - (mouse.sy - 0.5) * CFG.follow * 0.6 + Math.cos(t * 0.00011) * CFG.drift * 0.5;
      cy_ = Math.cos(yaw); sy_ = Math.sin(yaw); cp_ = Math.cos(pitch); sp_ = Math.sin(pitch);

      idle += dt;
      if (idle > CFG.idleEvery) start(spot(Math.random(), Math.random()));

      // While the mouse is moving, its spot shows live on the input sheet.
      const live = t - mouse.at < 1500 ? spot(mouse.x, mouse.y) : null;
      sheets.forEach((s, l) => {
        s.flash = Math.max(0, s.flash - dt * 1.6);
        s.units.forEach((u, i) => {
          u.glow = Math.max(0, u.glow - dt * 0.5);
          if (l === 0 && live) u.glow = Math.max(u.glow, live[i] * 0.55);
          project(u.X, u.Y, u.Z, u);
        });
        project(s.X, -s.hy, -s.hz, s.corners[0]);
        project(s.X, -s.hy, s.hz, s.corners[1]);
        project(s.X, s.hy, s.hz, s.corners[2]);
        project(s.X, s.hy, -s.hz, s.corners[3]);
      });
      if (winner) { winner.life -= dt * 0.45; if (winner.life <= 0) winner = null; }

      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      // Sheets: a faint pane with an outline that flashes when a pass lands.
      for (const s of sheets) {
        const c = s.corners;
        ctx.beginPath();
        ctx.moveTo(c[0].sx, c[0].sy);
        for (let q = 1; q < 4; q++) ctx.lineTo(c[q].sx, c[q].sy);
        ctx.closePath();
        ctx.fillStyle = `rgba(${base},${(0.022 + s.flash * 0.05) * D})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${base},${(0.2 + s.flash * 0.45) * D})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Resting wires: one path per pair of sheets.
      ctx.lineWidth = 0.7;
      for (let l = 1; l < sheets.length; l++) {
        const prev = sheets[l - 1].units;
        ctx.strokeStyle = `rgba(${base},${CFG.wire * D})`;
        ctx.beginPath();
        for (const u of sheets[l].units) {
          for (const f of u.from) {
            ctx.moveTo(prev[f.i].sx, prev[f.i].sy);
            ctx.lineTo(u.sx, u.sy);
          }
        }
        ctx.stroke();
      }

      // Passes: streaks along the wires that carry the most.
      for (let k = passes.length - 1; k >= 0; k--) {
        const p = passes[k];
        p.t += dt / CFG.hop;
        const A = sheets[p.l].units, B = sheets[p.l + 1].units;
        const head = Math.min(1, p.t), tail = Math.max(0, head - 0.3);
        for (const u of B) {
          for (const f of u.from) {
            const c = p.acts[f.i] * Math.abs(f.w);
            if (c < CFG.carry) continue;
            const a = A[f.i];
            const x0 = a.sx + (u.sx - a.sx) * tail, y0 = a.sy + (u.sy - a.sy) * tail;
            const x1 = a.sx + (u.sx - a.sx) * head, y1 = a.sy + (u.sy - a.sy) * head;
            const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
            // Tail (dim), front half (bright), then the head.
            ctx.strokeStyle = `rgba(${base},${Math.min(1, c * 0.45) * D})`;
            ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.stroke();
            ctx.strokeStyle = `rgba(${hot},${Math.min(1, c * 0.8) * D})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(xm, ym); ctx.lineTo(x1, y1); ctx.stroke();
            const r = 7 * u.k;
            ctx.globalAlpha = Math.min(1, c) * D;
            ctx.drawImage(spr, x1 - r, y1 - r, r * 2, r * 2);
            ctx.globalAlpha = 1;
          }
        }
        if (p.t >= 1) {
          // Arrived: each unit = its weighted sum (negatives clipped), then the
          // sheet is stretched to 0-1 so every sheet has clear highs and lows.
          const sums = B.map((u) => Math.max(0, u.from.reduce((acc, f) => acc + f.w * p.acts[f.i], 0)));
          const hi = Math.max(...sums);
          const acts = sums.map((v) => (hi > 1e-6 ? (v / hi) ** 1.4 : 0));
          B.forEach((u, i) => { u.glow = Math.max(u.glow, acts[i]); });
          sheets[p.l + 1].flash = 1;
          if (p.l + 1 >= sheets.length - 1) {
            winner = { u: B[acts.indexOf(Math.max(...acts))], life: 1 };
            passes.splice(k, 1);
          } else {
            p.l += 1; p.t = 0; p.acts = acts;
          }
        }
      }

      // Units: a glow that swells with activation, and a small core.
      for (const s of sheets) {
        for (const u of s.units) {
          const r = (9 + 26 * u.glow) * u.k;
          ctx.globalAlpha = Math.min(1, (0.16 + 0.84 * u.glow) * u.fade * D);
          ctx.drawImage(spr, u.sx - r, u.sy - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(${u.glow > 0.3 ? hot : base},${(0.35 + 0.65 * u.glow) * u.fade * D})`;
          ctx.beginPath(); ctx.arc(u.sx, u.sy, (1.5 + 1.8 * u.glow) * u.k + 0.6, 0, 6.283); ctx.fill();
        }
      }

      // The answer: the winning output stays lit inside two expanding rings.
      if (winner) {
        const a = winner.life, u = winner.u;
        u.glow = Math.max(u.glow, a);
        for (let q = 0; q < 2; q++) {
          const grow = (1 - a) * (1 + q * 0.6);
          ctx.strokeStyle = `rgba(${hot},${a * (q ? 0.45 : 0.9) * D})`;
          ctx.lineWidth = 2 - q * 0.8;
          ctx.beginPath(); ctx.arc(u.sx, u.sy, (12 + grow * 34) * u.k, 0, 6.283); ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function poke(x, y, t) {
      mouse.x = x / Math.max(1, S.W);
      mouse.y = y / Math.max(1, S.H);
      mouse.at = t;
      if (t - lastPoke < CFG.pokeEvery) return;
      lastPoke = t;
      start(spot(mouse.x, mouse.y));
    }
    return { build, frame, poke };
  }

  /* ---- EEG: a multi-channel brainwave recording scrolling across the
     screen, the kind of trace my research starts from. One row per electrode
     (standard 10-20 names, front of the head at the top), drawn as if on
     slowly moving chart paper: new signal is written at the right edge,
     under a small glowing pen tip, and drifts left.

     It behaves like a RECORDING. Each sample is computed once, at the moment
     the pen writes it, and stored; after that it only scrolls. Nothing
     already on the paper ever changes. So the mouse affects only what is
     being written right now, and what it did stays on the trace as a record
     that slides away to the left.

     The waves are built from the real EEG rhythms rather than random noise:
     slow delta and theta, the ~10 Hz ALPHA rhythm that comes and goes in
     bursts and is strongest at the back of the head (so the lower rows show
     more of it), and small fast beta. Each channel has its own phases, so no
     two rows match.

     The mouse is "attention". While it moves, the channels nearest the
     pointer's HEIGHT stop writing calm alpha and write fast, busy beta
     instead, which is what real EEG does over a part of the brain that
     starts working (event-related desynchronisation); those stretches are
     also drawn brighter. Moving faster reaches more channels, makes the
     waves taller, and stirs every channel a little. A quick flick writes a
     BLINK: the big slow bump that blinks put on the frontal channels. Left
     alone, an occasional blink happens by itself. ---- */
  function eegRenderer() {
    const CFG = {
      rowGap: 72,        // px between channels (sets how many fit)
      minRows: 5, maxRows: 15,
      speed: 42,         // px per second the paper moves
      step: 4,           // px between recorded samples (smaller = smoother, slower)
      amp: 0.3,          // wave height as a share of the row gap
      rows: 1.5,         // how many channels above/below the pointer respond
      blinkEvery: 9,     // seconds between idle blinks
      flick: 1.6,        // px per ms the mouse must move to cause a blink
      fast: 1.1,         // px per ms that counts as full-speed movement
      surge: 0.9,        // extra channel reach + wave height at full speed (0 = none)
      arousal: 0.4,      // how much EVERY channel livens up at full speed (0-1)
      trace: 0.5,        // brightness of a resting trace (0-1)
      dim: 0.9,          // overall brightness
    };
    const NAMES = ["Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8", "C3", "Cz", "C4", "P3", "Pz", "P4", "O1", "O2"];
    // scroll = how far the paper has moved (px) = the pen's position on it.
    // written = paper position of the newest recorded sample.
    let chans = [], blinks = [], scroll = 0, written = 0, keep = 0, sinceBlink = 0, lastBlink = -1e9;
    const mouse = { y: -1e4, at: -1e9, px: 0, py: 0, pt: 0, power: 0, energy: 0 };

    function build() {
      const { W, H } = S;
      const n = Math.max(CFG.minRows, Math.min(CFG.maxRows, Math.floor((H - 110) / CFG.rowGap)));
      const gap = (H - 110) / n;
      keep = Math.ceil(W / CFG.step) + 3; // samples that fit on screen
      chans = [];
      for (let c = 0; c < n; c++) {
        const back = n > 1 ? c / (n - 1) : 0.5; // 0 = front of head, 1 = back
        chans.push({
          y: 96 + gap * (c + 0.5),
          gap, back,
          name: NAMES[Math.round(back * (NAMES.length - 1))],
          ph: Array.from({ length: 10 }, () => Math.random() * 6.283),
          // Slightly different rhythm speeds per channel.
          fa: 1 + (Math.random() - 0.5) * 0.08,
          fb: 1 + (Math.random() - 0.5) * 0.12,
          v: [],   // recorded samples (oldest first), in wave units
          hot: [], // how strongly the mouse was acting when each was written
        });
      }
      blinks = []; sinceBlink = CFG.blinkEvery - 2;
      // Start with a screenful of calm recording already on the paper.
      written = scroll - keep * CFG.step;
      record(0, 0);
    }

    // Signal for one channel at paper position x (px), -1…1-ish. m = how
    // strongly the mouse is acting here (0-1).
    function wave(ch, x, m) {
      const p = ch.ph;
      // Alpha arrives in bursts ("spindles"): a slow envelope gates it.
      const burst = Math.max(0, 0.45 + 0.55 * Math.sin(x * 0.0041 + p[0]) * Math.sin(x * 0.0013 + p[1]) + 0.25 * Math.sin(x * 0.0009 + p[9]));
      const alpha = (0.35 + 0.75 * ch.back) * burst * Math.sin(x * 0.165 * ch.fa + p[2]);
      const beta = 0.2 * (0.6 + 0.4 * Math.sin(x * 0.007 + p[3])) * Math.sin(x * 0.37 * ch.fb + p[4]);
      const theta = 0.3 * Math.sin(x * 0.085 + p[5]);
      const delta = 0.22 * Math.sin(x * 0.033 + p[6]);
      const fuzz = 0.07 * (Math.sin(x * 0.61 + p[7]) + Math.sin(x * 1.13 + p[8]));
      return alpha * (1 - 0.88 * m) + beta * (1 + 3.4 * m) + theta * (1 - 0.4 * m) + delta + fuzz
        + m * 0.2 * Math.sin(x * 0.7 + p[1]);
    }

    // A blink is written by the pen as it goes, so it is centred a little
    // AHEAD of the pen: the whole bump gets recorded over the next moments.
    function blink(strength) {
      blinks.push({ x: scroll + 95, a: strength });
      if (blinks.length > 6) blinks.shift();
      sinceBlink = 0;
    }

    // Write every sample the pen has passed since the last frame, using the
    // mouse's state NOW. E = movement energy (0-1), power = mouse presence.
    function record(E, power) {
      const everywhere = CFG.arousal * E;
      while (written + CFG.step <= scroll) {
        written += CFG.step;
        for (const ch of chans) {
          const dr = (mouse.y - ch.y) / (ch.gap * CFG.rows * (1 + 0.6 * CFG.surge * E));
          const local = power * Math.exp(-dr * dr);
          const m = Math.min(1, Math.max(local, everywhere));
          let v = wave(ch, written, m) * (1 + CFG.surge * 0.7 * E * local);
          const front = 1 - ch.back; // blinks are a frontal artifact
          for (const b of blinks) {
            const d = (written - b.x) / 34;
            if (d > -4 && d < 4) v -= b.a * 3.2 * front * front * Math.exp(-d * d);
          }
          ch.v.push(v);
          ch.hot.push(local);
          if (ch.v.length > keep) { ch.v.shift(); ch.hot.shift(); }
        }
      }
    }

    function frame(t, dt, { base, hot }) {
      const { W } = S, D = CFG.dim;
      scroll += CFG.speed * dt;
      sinceBlink += dt;
      if (sinceBlink > CFG.blinkEvery) blink(0.8 + Math.random() * 0.4);
      blinks = blinks.filter((b) => b.x > written - 200);

      // The mouse's effect builds while it moves and ebbs when it rests.
      // energy = how fast it is moving right now; fades in about a second.
      const active = t - mouse.at < 900;
      mouse.power += ((active ? 1 : 0) - mouse.power) * Math.min(1, dt * (active ? 4 : 1.6));
      mouse.energy *= Math.exp(-dt * 1.6);
      record(mouse.energy, mouse.power);

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "middle";

      // Chart paper: a tick every five seconds of recording, moving with it.
      ctx.strokeStyle = `rgba(${base},${0.07 * D})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const tick = CFG.speed * 5;
      for (let x = W - (scroll % tick); x > 0; x -= tick) {
        ctx.moveTo(x, 86); ctx.lineTo(x, S.H);
      }
      ctx.stroke();

      for (const ch of chans) {
        const A = ch.gap * CFG.amp, n = ch.v.length;
        if (n < 2) continue;
        // Screen x of sample k: the newest sits just behind the pen (right edge).
        const x0 = W - (scroll - written) - (n - 1) * CFG.step;
        const front = 1 - ch.back;

        // The whole recorded trace.
        ctx.strokeStyle = `rgba(${base},${CFG.trace * (0.75 + 0.25 * front) * D})`;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(x0, ch.y + ch.v[0] * A);
        for (let k = 1; k < n; k++) ctx.lineTo(x0 + k * CFG.step, ch.y + ch.v[k] * A);
        ctx.stroke();

        // Stretches written while the mouse was acting, redrawn brighter:
        // a wide soft pass, then a bright core where it was strongest.
        for (let pass = 0; pass < 2; pass++) {
          const floor = pass ? 0.45 : 0.12;
          ctx.strokeStyle = `rgba(${hot},${(pass ? 0.6 : 0.3) * D})`;
          ctx.lineWidth = pass ? 1.6 : 2.2;
          ctx.beginPath();
          let open = false;
          for (let k = 0; k < n; k++) {
            if (ch.hot[k] > floor) {
              const x = x0 + k * CFG.step, y = ch.y + ch.v[k] * A;
              if (open) ctx.lineTo(x, y); else { ctx.moveTo(x, y); open = true; }
            } else open = false;
          }
          ctx.stroke();
        }

        // Pen tip at the right edge, and the electrode name at the left.
        const ty = ch.y + ch.v[n - 1] * A;
        ctx.fillStyle = `rgba(${base},${(0.25 + 0.3 * ch.hot[n - 1]) * D})`;
        ctx.beginPath(); ctx.arc(W - 3, ty, 7 + 4 * ch.hot[n - 1], 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${hot},${0.9 * D})`;
        ctx.beginPath(); ctx.arc(W - 3, ty, 2.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${base},${0.5 * D})`;
        ctx.fillText(ch.name, 12, ch.y - ch.gap * 0.34);
      }
    }

    function poke(x, y, t) {
      // Pointer speed: drives the energy, and a fast flick writes a blink.
      const dtm = t - mouse.pt;
      if (dtm > 0 && dtm < 120) {
        const v = Math.hypot(x - mouse.px, y - mouse.py) / dtm;
        mouse.energy = Math.max(mouse.energy, Math.min(1, v / CFG.fast));
        if (v > CFG.flick && t - lastBlink > 1400) {
          lastBlink = t;
          blink(Math.min(1.3, 0.7 + v * 0.15));
        }
      }
      mouse.px = x; mouse.py = y; mouse.pt = t;
      mouse.y = y; mouse.at = t;
    }
    return { build, frame, poke };
  }

  const renderers = ctx ? { neural: neuronRenderer(), network: networkRenderer(), eeg: eegRenderer() } : {};
  let current = null;        // the active renderer (null = lava)
  let rgb = [108, 124, 247]; // live colour, from --lava-now
  let raf = 0, prev = 0, colourAt = -1e9;

  function resize() {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    S.W = window.innerWidth; S.H = window.innerHeight;
    canvas.width = Math.round(S.W * dpr); canvas.height = Math.round(S.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (current) current.build();
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - prev) / 1000 || 0);
    prev = t;
    if (t - colourAt > 500) { // follow the nav's live colour
      colourAt = t;
      const nav = document.querySelector(".nav");
      const m = nav && getComputedStyle(nav).getPropertyValue("--lava-now").match(/[\d.]+/g);
      if (m && m.length >= 3) {
        const c = m.slice(0, 3).map(Number);
        const next = c.every((v) => v <= 1) ? c.map((v) => v * 255) : c; // color(srgb …) form
        if (next.some((v) => v < 250)) rgb = next; // ignore the white fallback
      }
    }
    const [r, g, b] = rgb;
    const colour = {
      base: `${Math.round(r)},${Math.round(g)},${Math.round(b)}`,
      // A lighter tint for the brightest parts.
      hot: `${Math.round(r + (255 - r) * 0.6)},${Math.round(g + (255 - g) * 0.6)},${Math.round(b + (255 - b) * 0.6)}`,
    };
    ctx.clearRect(0, 0, S.W, S.H);
    current.frame(t, dt, colour);
  }

  function sync() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (current && !document.hidden && !root.classList.contains("a11y")) {
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  setBackground = (mode, save = true) => {
    if (!BACKDROPS.includes(mode) || (mode !== "lava" && !renderers[mode])) mode = "lava";
    root.dataset.bg = mode;
    if (save) { try { localStorage.setItem("bg-mode", mode); } catch (e) {} }
    current = renderers[mode] || null;
    if (current) resize();
    else if (ctx) ctx.clearRect(0, 0, S.W, S.H);
    sync();
    document.querySelectorAll("[data-bg-choice]").forEach((el) =>
      el.setAttribute("aria-pressed", String(el.dataset.bgChoice === mode))
    );
  };

  document.addEventListener("visibilitychange", sync);
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["class"] });
  }
  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 200);
  }, { passive: true });
  window.addEventListener("pointermove", (ev) => {
    if (current && raf && ev.pointerType === "mouse") current.poke(ev.clientX, ev.clientY, performance.now());
  }, { passive: true });

  // Start-up: ?bg= beats the saved choice (already on <html> from the inline
  // head script), which beats the default. A ?bg= visit is not saved.
  const want = new URLSearchParams(location.search).get("bg");
  if (BACKDROPS.includes(want)) setBackground(want, false);
  else setBackground(root.dataset.bg || "lava", false);
}

/* Display menu: the bubble in the bottom-right corner opens a short column
   of bubbles above it: accessibility mode, then one per backdrop (wired by
   data-bg-choice → setBackground). Stays open while you try backdrops;
   closes on the bubble again, an outside click, or Escape. */
function initDisplayMenu() {
  const menu = document.getElementById("display-menu");
  const main = document.getElementById("display-menu-toggle");
  if (!menu || !main) return;
  const set = (open) => {
    menu.classList.toggle("is-open", open);
    main.setAttribute("aria-expanded", String(open));
  };
  main.addEventListener("click", (e) => {
    e.stopPropagation();
    set(!menu.classList.contains("is-open"));
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => set(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) { set(false); main.focus(); }
  });
  menu.querySelectorAll("[data-bg-choice]").forEach((el) =>
    el.addEventListener("click", () => setBackground(el.dataset.bgChoice))
  );
}

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
initBackgrounds();
initDisplayMenu();
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

