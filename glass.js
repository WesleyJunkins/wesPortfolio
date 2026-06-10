/* ============================================================================
   Liquid Glass — per-element SVG displacement refraction
   ----------------------------------------------------------------------------
   Faithful port of the EXAMPLE pen (EXAMPLE.html / EXAMPLE.css / EXAMPLE.js) to
   the portfolio.

   How it works (same recipe as EXAMPLE):
     1. For each glass surface we generate an SVG *displacement map* sized to that
        element's exact width/height/corner-radius. The map is a black backdrop
        (neutral) + a horizontal red gradient (encodes X shift) + a vertical blue
        gradient (encodes Y shift), with a mid-grey "block-out" rectangle blurred
        over the centre so only a thin ring near the edges actually displaces.
     2. That map feeds an SVG <filter> whose three feDisplacementMap passes (one
        per colour channel, at slightly different scales) bend the backdrop and
        add a faint chromatic-aberration fringe, then blend + soften.
     3. The element's `backdrop-filter` points at that filter via url(#id).

   Because the map matches the element's real geometry, the lens bends at the
   true edges — unlike the old approach, which stretched ONE 200x200 map across
   every element and smeared the result.

   backdrop-filter: url(#svg) is a Chromium-only feature. On Safari/Firefox we
   bail out immediately and the CSS frosted-glass fallback (index.css) is shown
   instead.

   Reference: EXAMPLE.js buildDisplacementImage (84-147), EXAMPLE.html filter
   chain (16-91), EXAMPLE.css .effect (159-193).
   ========================================================================== */
(() => {
    'use strict';

    // ---- Tuning knobs (mirror EXAMPLE.js `base`) ----------------------------
    // The three you'll reach for most: `scale` (refraction strength, px),
    // `border` (edge-ring thickness as a fraction of the short side), and `blur`
    // (how soft that ring is).
    const TUNING = {
        // Displacement strength is PROPORTIONAL to the element's short side, not a
        // flat pixel value. EXAMPLE used a flat scale (-180) because its targets are
        // small ~140-340px chips; the portfolio's bubbles are large and sometimes
        // short/wide, where a flat -180 over-displaces — the edge ring samples more
        // than half the element, so the backdrop reaches past centre and visibly
        // mirrors ("flips upside down"). Scaling to min(w,h) reproduces EXAMPLE's
        // rim-lens look at every size. Raise scaleRatio for a stronger bend.
        scaleRatio: 0.5,    // |scale| = scaleRatio * min(w,h) ...
        maxScale: 180,      // ... capped at EXAMPLE's value so big panels don't over-bend
        refScale: 180,      // EXAMPLE's reference scale, for proportional chroma offsets
        border: 0.07,       // edge-ring thickness = min(w,h) * border * 0.5
        lightness: 50,      // block-out grey: 50% = neutral (no displacement)
        alpha: 0.93,        // block-out opacity
        blur: 11,           // INPUT blur on the block-out (softens the ring)
        blend: 'difference',// how the blue (Y) gradient blends over the red (X)
        chroma: { r: 0, g: 10, b: 20 }, // per-channel offsets AT refScale = aberration
        outputBlur: 0.5,    // feGaussianBlur stdDeviation on the final result
        // Extras layered after the url() lens in the backdrop-filter shorthand:
        saturate: 1.5,
        brightness: 1.06,
    };

    // |scale| grows with the element but is capped, then negated (inward bend).
    // Because filters are keyed by size, every same-size pane gets the same scale.
    function computeScale(w, h) {
        const t = TUNING;
        return -Math.min(t.maxScale, t.scaleRatio * Math.min(w, h));
    }

    // Stage 1: navigation bar + content bubbles only.
    // Later stages append: .button, .dropdown-menu, .mobile-nav-buttons,
    // .mobile-submenu, .footer-scroll-bubble, .footer-datetime-bubble,
    // .gallery-modal, .password-modal
    const SELECTOR = '.top-nav, .bubble';

    const SVGNS = 'http://www.w3.org/2000/svg';

    // ---- Chromium feature gate ----------------------------------------------
    // If url() backdrop filters aren't supported, do nothing — the CSS frosted
    // fallback declared on each surface in index.css stays in place.
    const supported = !!(window.CSS && CSS.supports && (
        CSS.supports('backdrop-filter', 'url(#l)') ||
        CSS.supports('-webkit-backdrop-filter', 'url(#l)')
    ));
    if (!supported) return;

    // ---- Shared <defs> that holds every generated <filter> ------------------
    function getDefs() {
        let defs = document.querySelector('svg.lg-filters defs');
        if (!defs) {
            const svg = document.createElementNS(SVGNS, 'svg');
            svg.setAttribute('class', 'lg-filters');
            svg.setAttribute('aria-hidden', 'true');
            svg.style.cssText =
                'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
            defs = document.createElementNS(SVGNS, 'defs');
            svg.appendChild(defs);
            document.body.appendChild(svg);
        }
        return defs;
    }

    // ---- Displacement map (port of EXAMPLE.js buildDisplacementImage) --------
    function buildDisplacementDataUri(w, h, r) {
        const t = TUNING;
        const border = Math.min(w, h) * (t.border * 0.5);
        const innerW = Math.max(0, w - border * 2);
        const innerH = Math.max(0, h - border * 2);
        const svg =
            `<svg viewBox="0 0 ${w} ${h}" xmlns="${SVGNS}">` +
                `<defs>` +
                    `<linearGradient id="red" x1="100%" y1="0%" x2="0%" y2="0%">` +
                        `<stop offset="0%" stop-color="#000"/>` +
                        `<stop offset="100%" stop-color="red"/>` +
                    `</linearGradient>` +
                    `<linearGradient id="blue" x1="0%" y1="0%" x2="0%" y2="100%">` +
                        `<stop offset="0%" stop-color="#000"/>` +
                        `<stop offset="100%" stop-color="blue"/>` +
                    `</linearGradient>` +
                `</defs>` +
                `<rect x="0" y="0" width="${w}" height="${h}" fill="black"/>` +
                `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#red)"/>` +
                `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#blue)" ` +
                    `style="mix-blend-mode:${t.blend}"/>` +
                `<rect x="${border}" y="${border}" width="${innerW}" height="${innerH}" rx="${r}" ` +
                    `fill="hsl(0 0% ${t.lightness}% / ${t.alpha})" ` +
                    `style="filter:blur(${t.blur}px)"/>` +
            `</svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    // ---- SVG <filter> (port of EXAMPLE.html chromatic chain) ------------------
    const CHANNEL_MATRIX = {
        r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
        g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
        b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
    };

    function svgEl(name, attrs) {
        const node = document.createElementNS(SVGNS, name);
        for (const k in attrs) node.setAttribute(k, attrs[k]);
        return node;
    }

    function buildFilter(id, w, h, r) {
        const t = TUNING;
        // No explicit region on <filter> (matches EXAMPLE) so the default
        // bounding box drives the primitive percentages.
        const filter = svgEl('filter', {
            id,
            'color-interpolation-filters': 'sRGB',
        });

        const feImage = svgEl('feImage', {
            x: '0', y: '0', width: '100%', height: '100%', result: 'map',
        });
        feImage.setAttribute('href', buildDisplacementDataUri(w, h, r));
        filter.appendChild(feImage);

        const base = computeScale(w, h);          // proportional, inward bend
        const k = Math.abs(base) / t.refScale;    // shrink chroma offsets with base
        const channels = [
            { key: 'r', scale: base + t.chroma.r * k, disp: 'dispR', out: 'red' },
            { key: 'g', scale: base + t.chroma.g * k, disp: 'dispG', out: 'green' },
            { key: 'b', scale: base + t.chroma.b * k, disp: 'dispB', out: 'blue' },
        ];
        for (const c of channels) {
            filter.appendChild(svgEl('feDisplacementMap', {
                in: 'SourceGraphic', in2: 'map', scale: c.scale,
                xChannelSelector: 'R', yChannelSelector: 'B', result: c.disp,
            }));
            filter.appendChild(svgEl('feColorMatrix', {
                in: c.disp, type: 'matrix', values: CHANNEL_MATRIX[c.key], result: c.out,
            }));
        }
        filter.appendChild(svgEl('feBlend', { in: 'red', in2: 'green', mode: 'screen', result: 'rg' }));
        filter.appendChild(svgEl('feBlend', { in: 'rg', in2: 'blue', mode: 'screen', result: 'output' }));
        filter.appendChild(svgEl('feGaussianBlur', { in: 'output', stdDeviation: t.outputBlur }));
        return filter;
    }

    // ---- Filter pool, deduped by size key + ref-counted ----------------------
    // Many elements share a size (e.g. equal buttons), so they share one filter.
    // Ref-counting lets us drop filters that go unused (e.g. during a window
    // resize that walks the nav through dozens of widths) instead of leaking.
    const defs = getDefs();
    const pool = new Map();         // sizeKey -> { node, id, count }
    const currentKey = new WeakMap(); // element -> the sizeKey it's using

    const keyFor = (w, h, r) => `${w}x${h}x${r}`;

    function acquire(w, h, r) {
        const k = keyFor(w, h, r);
        let rec = pool.get(k);
        if (!rec) {
            const id = `lg-${k}`;
            const node = buildFilter(id, w, h, r);
            defs.appendChild(node);
            rec = { node, id, count: 0 };
            pool.set(k, rec);
        }
        rec.count++;
        return rec;
    }

    function release(k) {
        const rec = pool.get(k);
        if (!rec) return;
        rec.count--;
        if (rec.count <= 0) {
            rec.node.remove();
            pool.delete(k);
        }
    }

    function refresh(elem) {
        const rect = elem.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (w < 2 || h < 2) return; // hidden / collapsed — skip

        const cs = getComputedStyle(elem);
        let r = parseFloat(cs.borderTopLeftRadius) || 0;
        r = Math.min(r, Math.min(w, h) / 2); // clamp to a pill at most
        r = Math.round(r);

        const k = keyFor(w, h, r);
        const prev = currentKey.get(elem);
        if (prev === k) return; // unchanged → nothing to rebuild

        const rec = acquire(w, h, r);
        elem.style.backdropFilter = elem.style.webkitBackdropFilter =
            `url(#${rec.id}) saturate(${TUNING.saturate}) brightness(${TUNING.brightness})`;
        currentKey.set(elem, k);
        if (prev) release(prev);
    }

    // ---- Scheduling: batch measurements/builds into a single frame -----------
    const dirty = new Set();
    let scheduled = false;
    function schedule(elem) {
        dirty.add(elem);
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            const items = Array.from(dirty);
            dirty.clear();
            for (const e of items) {
                if (e.isConnected) refresh(e);
            }
        });
    }

    const ro = new ResizeObserver((entries) => {
        for (const entry of entries) schedule(entry.target);
    });

    const registered = new WeakSet();
    function register(elem) {
        if (registered.has(elem)) return;
        registered.add(elem);
        ro.observe(elem);   // fires once immediately → initial build
    }

    function scan() {
        document.querySelectorAll(SELECTOR).forEach(register);
    }

    function start() {
        scan();
        // Bubbles can be injected/removed by index.js — pick up new ones.
        const mo = new MutationObserver(() => scan());
        mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
