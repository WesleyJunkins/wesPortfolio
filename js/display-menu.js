/* =========================================================
   DISPLAY MENU
   The bubble in the bottom-right corner. Styles: css/accessibility.css.
   ========================================================= */

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
