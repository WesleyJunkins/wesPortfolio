/* =========================================================
   ACCESSIBILITY MODE
   html.a11y (set pre-paint by the inline <head> script when saved, toggled
   live by the #a11y-toggle button) swaps the liquid-glass presentation for
   a static, high-contrast one — see the css/accessibility.css.
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
