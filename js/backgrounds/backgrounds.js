/* =========================================================
   BACKDROPS — three animated backgrounds, switched live from the display
   menu (bottom-right bubble) and remembered in localStorage "bg-mode":

     lava     the lava lamp (pure CSS; the default)
     neural   neurons firing            } all drawn on the one .neural canvas,
     network  a layered neural network  } each by its own renderer file in
     eeg      scrolling brainwave traces } this folder (see the registry below)

   html[data-bg] holds the current one (css/backgrounds.css shows/hides the lava and
   the canvas from it). setBackground() is the only place that changes it.
   ?bg=lava|neural|network|eeg in the address overrides the saved choice.

   A renderer is { build(), frame(t, dt, colour), poke(x, y, t) }: build lays
   the scene out for the current window size, frame draws one frame, poke is
   the mouse moving at (x, y). They take their colour from --lava-now on the
   nav (read twice a second), so they share its slow colour cycle. This file owns the canvas, the
   animation loop, the colour and the switching; the renderers only draw. The loop
   only runs for a canvas backdrop, and pauses while the tab is hidden or
   accessibility mode is on.
   ========================================================= */
/* THE REGISTRY. To add a backdrop: write js/backgrounds/<name>.js (copy one
   of the existing ones), add its <script> tag in index.html BEFORE this
   file's, add one line here, and add a button with data-bg-choice="<name>"
   to the display menu in index.html. Nothing else needs to know about it. */
const BACKDROP_RENDERERS = {
  neural: neuronRenderer,   // js/backgrounds/neurons.js
  network: networkRenderer, // js/backgrounds/network.js
  eeg: eegRenderer,         // js/backgrounds/eeg.js
};
const BACKDROPS = ["lava", ...Object.keys(BACKDROP_RENDERERS)];
let setBackground = () => {};

function initBackgrounds() {
  const root = document.documentElement;
  const canvas = document.querySelector(".neural");
  const ctx = canvas && canvas.getContext("2d");
  const S = { W: 0, H: 0 }; // canvas size in CSS px, shared with renderers

  // Build one renderer per registered canvas backdrop (none if the browser
  // gave us no canvas, in which case only the lava is available).
  const renderers = {};
  if (ctx) {
    for (const [name, make] of Object.entries(BACKDROP_RENDERERS)) renderers[name] = make(ctx, S);
  }
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
