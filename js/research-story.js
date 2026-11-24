/* =========================================================
   RESEARCH STORY
   The scroll-driven diagram on the Research page.
   Markup: #research in index.html. Styles: css/research-story.css.
   ========================================================= */

/* Research overview: the scroll story (markup in #research, styles under
   css/research-story.css). The page's scroll position through the
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
