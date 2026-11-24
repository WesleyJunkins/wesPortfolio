/* =========================================================
   SHOWCASES
   The pinned scroll presentations on the featured-project pages
   (BDR-XR, Brain-Drone Race). All timing lives in the HTML, so a new
   showcase needs no changes here. Styles: css/showcase.css.
   ========================================================= */

/* Showcases: pinned scroll presentations driven entirely by markup (see the
   SHOWCASE comment in index.html / css/showcase.css). Same technique as the Research
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
