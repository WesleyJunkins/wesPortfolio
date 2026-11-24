/* =========================================================
   BACKGROUND: NEURAL NETWORK
   A 3D deep network running forward passes on what the mouse paints.
   
   A backdrop renderer is a function (ctx, S) that returns
   { build(), frame(t, dt, colour), poke(x, y, t) }:
     ctx  the shared canvas's 2D context
     S    { W, H }: the canvas size in CSS pixels, kept up to date
     build   lay the scene out for the current size (also on resize)
     frame   draw one frame; colour = { base, hot } as "r,g,b" strings
     poke    the mouse moved to (x, y)
   It is registered in js/backgrounds/backgrounds.js.
   ========================================================= */

/* Neural network: a deep network drawn in 3D, seen from a three-
   quarter angle. Each layer is a sheet of units floating in space, the
   sheets run left to right (top to bottom on tall screens) and shrink
   toward a single column of outputs, like a vision network.

   Wiring is LOCAL, as in a convolutional network: every unit listens to
   the few units directly behind it in the previous sheet (its receptive
   field) plus one random long-range unit. So a patch of activity on the
   input sheet stays a recognisable patch as it travels, drifting and
   reshaping from sheet to sheet, instead of dissolving into noise.

   A PASS carries a pattern through: streaks of light run along the wires
   that carry the most, each sheet lights up from what reached it (a real
   weighted sum per unit), its frame flashes, and at the end the strongest
   output unit gets a ring: the network's answer.

   The mouse does two things. It is the INPUT: the pointer's position
   paints a soft spot on the first sheet, and moving it sends that pattern
   through, so different positions give different answers. And it is the
   CAMERA: the whole network turns slightly to follow the pointer. Left
   alone, the camera drifts slowly and a random pattern goes through every
   few seconds.

   Everything is drawn with additive blending ("lighter"), so overlapping
   light adds up to a glow the way it would on a real display. */
function networkRenderer(ctx, S) {
  const CFG = {
    // [rows, columns] of units per sheet, input first, outputs last.
    sheets: [[7, 7], [6, 6], [8, 4], [6, 6], [5, 4], [5, 1]],
    sheetGap: 190,     // distance between sheets (model units)
    unitGap: 50,       // distance between units on a sheet
    field: 3,          // units of the previous sheet each unit listens to (+1 random)
    yaw: -0.72,        // resting camera angle, radians (0 = side-on, flat)
    pitch: 0.2,
    follow: 0.45,      // how far the camera turns toward the mouse (radians)
    drift: 0.1,        // how far it wanders on its own
    focal: 1700,       // perspective strength (smaller = more dramatic)
    hop: 0.85,         // seconds for a pass to cross from one sheet to the next
    idleEvery: 6,      // seconds between passes when the mouse is still
    pokeEvery: 900,    // ms between mouse-started passes
    maxPasses: 3,
    carry: 0.22,       // a wire shows a streak if it carries more than this
    wire: 0.09,        // brightness of resting wires (0-1)
    dim: 0.95,         // overall brightness
  };
  let sheets = [], passes = [], winner = null;
  let scale = 1, ox = 0, oy = 0, portrait = false, lastPoke = 0, idle = 0;
  const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, at: -1e9 };
  let sprite = null, spriteKey = "";

  function build() {
    const { W, H } = S;
    portrait = H > W * 1.15;
    const n = CFG.sheets.length;
    sheets = CFG.sheets.map(([rows, cols], l) => {
      const units = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          units.push({
            // Model space: X runs through the network, Y is up/down on a
            // sheet, Z is across it.
            X: (l - (n - 1) / 2) * CFG.sheetGap,
            Y: (r - (rows - 1) / 2) * CFG.unitGap,
            Z: (c - (cols - 1) / 2) * CFG.unitGap,
            // Position within the sheet, 0-1, for matching up receptive fields.
            u: rows > 1 ? r / (rows - 1) : 0.5,
            v: cols > 1 ? c / (cols - 1) : 0.5,
            glow: 0, sx: 0, sy: 0, k: 1, fade: 1,
            from: [], // [{ i: index in previous sheet, w: weight }]
          });
        }
      }
      return {
        units, rows, cols, flash: 0,
        hy: ((rows - 1) / 2) * CFG.unitGap + 26,
        hz: ((cols - 1) / 2) * CFG.unitGap + 26,
        X: (l - (n - 1) / 2) * CFG.sheetGap,
        corners: [{}, {}, {}, {}],
      };
    });
    // Receptive fields: the nearest few units behind, plus one wildcard.
    for (let l = 1; l < n; l++) {
      const prev = sheets[l - 1].units;
      for (const t of sheets[l].units) {
        const near = prev
          .map((p, i) => ({ i, d: (p.u - t.u) ** 2 + (p.v - t.v) ** 2 }))
          .sort((p, q) => p.d - q.d)
          .slice(0, CFG.field);
        t.from = near.map(({ i }) => ({ i, w: 0.45 + Math.random() * 0.55 }));
        const wild = (Math.random() * prev.length) | 0;
        if (!t.from.some((f) => f.i === wild)) {
          t.from.push({ i: wild, w: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.5) });
        }
      }
    }
    // Fit and centre: project every sheet's corners with the camera at
    // rest, then scale and shift so that outline fills the window.
    cy_ = Math.cos(CFG.yaw); sy_ = Math.sin(CFG.yaw);
    cp_ = Math.cos(CFG.pitch); sp_ = Math.sin(CFG.pitch);
    scale = 1; ox = 0; oy = 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const pt = {};
    for (const s of sheets) {
      for (const [sy, sz] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
        project(s.X, sy * s.hy, sz * s.hz, pt);
        x0 = Math.min(x0, pt.sx); x1 = Math.max(x1, pt.sx);
        y0 = Math.min(y0, pt.sy); y1 = Math.max(y1, pt.sy);
      }
    }
    // Leave room for the nav at the top and the camera's sway at the sides.
    const top = 84, availW = W * 0.82, availH = (H - top) * 0.84;
    scale = Math.min(availW / (x1 - x0), availH / (y1 - y0));
    ox = -((x0 + x1) / 2 - W / 2) * scale;
    oy = -((y0 + y1) / 2 - H / 2) * scale + top / 2;
    passes = []; winner = null; idle = CFG.idleEvery - 1;
  }

  // Model point → screen. Writes sx, sy, k (perspective size), fade (depth).
  let cy_ = 1, sy_ = 0, cp_ = 1, sp_ = 0;
  function project(X, Y, Z, out) {
    const x = X * cy_ + Z * sy_;
    const z1 = -X * sy_ + Z * cy_;
    const y = Y * cp_ - z1 * sp_;
    const z = Y * sp_ + z1 * cp_;
    const k = CFG.focal / (CFG.focal + z);
    const px = x * k * scale, py = y * k * scale;
    out.sx = S.W / 2 + ox + (portrait ? py : px);
    out.sy = S.H / 2 + oy + (portrait ? px : py);
    out.k = k * scale;
    out.fade = Math.max(0.3, Math.min(1, 0.65 - z / 900));
  }

  // The pattern the pointer paints on the input sheet: a soft spot.
  function spot(cx, cy) {
    return sheets[0].units.map((u) => Math.exp(-(((u.v - cx) ** 2 + (u.u - cy) ** 2) / 0.045)));
  }

  function start(acts) {
    if (passes.length >= CFG.maxPasses || !sheets.length) return;
    sheets[0].units.forEach((u, i) => { u.glow = Math.max(u.glow, acts[i]); });
    sheets[0].flash = 1;
    passes.push({ l: 0, t: 0, acts });
    idle = 0;
  }

  function glowSprite(base) {
    if (spriteKey === base && sprite) return sprite;
    spriteKey = base;
    sprite = sprite || document.createElement("canvas");
    sprite.width = sprite.height = 96;
    const g = sprite.getContext("2d");
    const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    grad.addColorStop(0, `rgba(${base},1)`);
    grad.addColorStop(0.25, `rgba(${base},0.55)`);
    grad.addColorStop(0.6, `rgba(${base},0.12)`);
    grad.addColorStop(1, `rgba(${base},0)`);
    g.clearRect(0, 0, 96, 96);
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 96);
    return sprite;
  }

  function frame(t, dt, { base, hot }) {
    const D = CFG.dim;
    const spr = glowSprite(base);

    // Camera: ease toward the mouse, plus a slow drift of its own.
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 2.2);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 2.2);
    const yaw = CFG.yaw + (mouse.sx - 0.5) * CFG.follow + Math.sin(t * 0.00013) * CFG.drift;
    const pitch = CFG.pitch - (mouse.sy - 0.5) * CFG.follow * 0.6 + Math.cos(t * 0.00011) * CFG.drift * 0.5;
    cy_ = Math.cos(yaw); sy_ = Math.sin(yaw); cp_ = Math.cos(pitch); sp_ = Math.sin(pitch);

    idle += dt;
    if (idle > CFG.idleEvery) start(spot(Math.random(), Math.random()));

    // While the mouse is moving, its spot shows live on the input sheet.
    const live = t - mouse.at < 1500 ? spot(mouse.x, mouse.y) : null;
    sheets.forEach((s, l) => {
      s.flash = Math.max(0, s.flash - dt * 1.6);
      s.units.forEach((u, i) => {
        u.glow = Math.max(0, u.glow - dt * 0.5);
        if (l === 0 && live) u.glow = Math.max(u.glow, live[i] * 0.55);
        project(u.X, u.Y, u.Z, u);
      });
      project(s.X, -s.hy, -s.hz, s.corners[0]);
      project(s.X, -s.hy, s.hz, s.corners[1]);
      project(s.X, s.hy, s.hz, s.corners[2]);
      project(s.X, s.hy, -s.hz, s.corners[3]);
    });
    if (winner) { winner.life -= dt * 0.45; if (winner.life <= 0) winner = null; }

    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    // Sheets: a faint pane with an outline that flashes when a pass lands.
    for (const s of sheets) {
      const c = s.corners;
      ctx.beginPath();
      ctx.moveTo(c[0].sx, c[0].sy);
      for (let q = 1; q < 4; q++) ctx.lineTo(c[q].sx, c[q].sy);
      ctx.closePath();
      ctx.fillStyle = `rgba(${base},${(0.022 + s.flash * 0.05) * D})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${base},${(0.2 + s.flash * 0.45) * D})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Resting wires: one path per pair of sheets.
    ctx.lineWidth = 0.7;
    for (let l = 1; l < sheets.length; l++) {
      const prev = sheets[l - 1].units;
      ctx.strokeStyle = `rgba(${base},${CFG.wire * D})`;
      ctx.beginPath();
      for (const u of sheets[l].units) {
        for (const f of u.from) {
          ctx.moveTo(prev[f.i].sx, prev[f.i].sy);
          ctx.lineTo(u.sx, u.sy);
        }
      }
      ctx.stroke();
    }

    // Passes: streaks along the wires that carry the most.
    for (let k = passes.length - 1; k >= 0; k--) {
      const p = passes[k];
      p.t += dt / CFG.hop;
      const A = sheets[p.l].units, B = sheets[p.l + 1].units;
      const head = Math.min(1, p.t), tail = Math.max(0, head - 0.3);
      for (const u of B) {
        for (const f of u.from) {
          const c = p.acts[f.i] * Math.abs(f.w);
          if (c < CFG.carry) continue;
          const a = A[f.i];
          const x0 = a.sx + (u.sx - a.sx) * tail, y0 = a.sy + (u.sy - a.sy) * tail;
          const x1 = a.sx + (u.sx - a.sx) * head, y1 = a.sy + (u.sy - a.sy) * head;
          const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
          // Tail (dim), front half (bright), then the head.
          ctx.strokeStyle = `rgba(${base},${Math.min(1, c * 0.45) * D})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.stroke();
          ctx.strokeStyle = `rgba(${hot},${Math.min(1, c * 0.8) * D})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(xm, ym); ctx.lineTo(x1, y1); ctx.stroke();
          const r = 7 * u.k;
          ctx.globalAlpha = Math.min(1, c) * D;
          ctx.drawImage(spr, x1 - r, y1 - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
        }
      }
      if (p.t >= 1) {
        // Arrived: each unit = its weighted sum (negatives clipped), then the
        // sheet is stretched to 0-1 so every sheet has clear highs and lows.
        const sums = B.map((u) => Math.max(0, u.from.reduce((acc, f) => acc + f.w * p.acts[f.i], 0)));
        const hi = Math.max(...sums);
        const acts = sums.map((v) => (hi > 1e-6 ? (v / hi) ** 1.4 : 0));
        B.forEach((u, i) => { u.glow = Math.max(u.glow, acts[i]); });
        sheets[p.l + 1].flash = 1;
        if (p.l + 1 >= sheets.length - 1) {
          winner = { u: B[acts.indexOf(Math.max(...acts))], life: 1 };
          passes.splice(k, 1);
        } else {
          p.l += 1; p.t = 0; p.acts = acts;
        }
      }
    }

    // Units: a glow that swells with activation, and a small core.
    for (const s of sheets) {
      for (const u of s.units) {
        const r = (9 + 26 * u.glow) * u.k;
        ctx.globalAlpha = Math.min(1, (0.16 + 0.84 * u.glow) * u.fade * D);
        ctx.drawImage(spr, u.sx - r, u.sy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(${u.glow > 0.3 ? hot : base},${(0.35 + 0.65 * u.glow) * u.fade * D})`;
        ctx.beginPath(); ctx.arc(u.sx, u.sy, (1.5 + 1.8 * u.glow) * u.k + 0.6, 0, 6.283); ctx.fill();
      }
    }

    // The answer: the winning output stays lit inside two expanding rings.
    if (winner) {
      const a = winner.life, u = winner.u;
      u.glow = Math.max(u.glow, a);
      for (let q = 0; q < 2; q++) {
        const grow = (1 - a) * (1 + q * 0.6);
        ctx.strokeStyle = `rgba(${hot},${a * (q ? 0.45 : 0.9) * D})`;
        ctx.lineWidth = 2 - q * 0.8;
        ctx.beginPath(); ctx.arc(u.sx, u.sy, (12 + grow * 34) * u.k, 0, 6.283); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function poke(x, y, t) {
    mouse.x = x / Math.max(1, S.W);
    mouse.y = y / Math.max(1, S.H);
    mouse.at = t;
    if (t - lastPoke < CFG.pokeEvery) return;
    lastPoke = t;
    start(spot(mouse.x, mouse.y));
  }
  return { build, frame, poke };
}
