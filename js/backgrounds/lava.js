/* =========================================================
   BACKGROUND: LAVA
   The lava lamp itself is pure CSS (css/backgrounds.css). This only
   randomises it on each load.
   ========================================================= */

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
