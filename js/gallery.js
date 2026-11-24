/* =========================================================
   GALLERY
   The fullscreen Cover Flow image viewer. Styles: css/gallery.css.
   ========================================================= */

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
