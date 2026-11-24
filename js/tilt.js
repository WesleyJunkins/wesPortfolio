/* =========================================================
   TILT
   Tiles that turn to face the cursor, on pages marked class="float-tiles".
   Styles: FLOATING TILES in css/layout.css.
   ========================================================= */

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
