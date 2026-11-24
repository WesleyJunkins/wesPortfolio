/* =========================================================
   NAVIGATION
   Page switching (showSection), the nav links, the flyout menus
   (Projects, CV) and the mobile menu. Styles: css/dropdowns.css and
   css/chrome.css.
   ========================================================= */

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

  // The current-page marker always lands on a TOP-LEVEL nav word: About,
  // Research, etc. map directly; a page inside a flyout (e.g. Education)
  // marks its Projects / CV toggle instead, never the sub-item itself.
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
