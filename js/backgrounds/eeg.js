/* =========================================================
   BACKGROUND: EEG
   A scrolling multi-channel brainwave recording.
   
   A backdrop renderer is a function (ctx, S) that returns
   { build(), frame(t, dt, colour), poke(x, y, t) }:
     ctx  the shared canvas's 2D context
     S    { W, H }: the canvas size in CSS pixels, kept up to date
     build   lay the scene out for the current size (also on resize)
     frame   draw one frame; colour = { base, hot } as "r,g,b" strings
     poke    the mouse moved to (x, y)
   It is registered in js/backgrounds/backgrounds.js.
   ========================================================= */

/* EEG: a multi-channel brainwave recording scrolling across the
   screen, the kind of trace my research starts from. One row per electrode
   (standard 10-20 names, front of the head at the top), drawn as if on
   slowly moving chart paper: new signal is written at the right edge,
   under a small glowing pen tip, and drifts left.

   It behaves like a RECORDING. Each sample is computed once, at the moment
   the pen writes it, and stored; after that it only scrolls. Nothing
   already on the paper ever changes. So the mouse affects only what is
   being written right now, and what it did stays on the trace as a record
   that slides away to the left.

   The waves are built from the real EEG rhythms rather than random noise:
   slow delta and theta, the ~10 Hz ALPHA rhythm that comes and goes in
   bursts and is strongest at the back of the head (so the lower rows show
   more of it), and small fast beta. Each channel has its own phases, so no
   two rows match.

   The mouse is "attention". While it moves, the channels nearest the
   pointer's HEIGHT stop writing calm alpha and write fast, busy beta
   instead, which is what real EEG does over a part of the brain that
   starts working (event-related desynchronisation); those stretches are
   also drawn brighter. Moving faster reaches more channels, makes the
   waves taller, and stirs every channel a little. A quick flick writes a
   BLINK: the big slow bump that blinks put on the frontal channels. Left
   alone, an occasional blink happens by itself. */
function eegRenderer(ctx, S) {
  const CFG = {
    rowGap: 72,        // px between channels (sets how many fit)
    minRows: 5, maxRows: 15,
    speed: 42,         // px per second the paper moves
    step: 4,           // px between recorded samples (smaller = smoother, slower)
    amp: 0.3,          // wave height as a share of the row gap
    rows: 1.5,         // how many channels above/below the pointer respond
    blinkEvery: 9,     // seconds between idle blinks
    flick: 1.6,        // px per ms the mouse must move to cause a blink
    fast: 1.1,         // px per ms that counts as full-speed movement
    surge: 0.9,        // extra channel reach + wave height at full speed (0 = none)
    arousal: 0.4,      // how much EVERY channel livens up at full speed (0-1)
    trace: 0.5,        // brightness of a resting trace (0-1)
    dim: 0.9,          // overall brightness
  };
  const NAMES = ["Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8", "C3", "Cz", "C4", "P3", "Pz", "P4", "O1", "O2"];
  // scroll = how far the paper has moved (px) = the pen's position on it.
  // written = paper position of the newest recorded sample.
  let chans = [], blinks = [], scroll = 0, written = 0, keep = 0, sinceBlink = 0, lastBlink = -1e9;
  const mouse = { y: -1e4, at: -1e9, px: 0, py: 0, pt: 0, power: 0, energy: 0 };

  function build() {
    const { W, H } = S;
    const n = Math.max(CFG.minRows, Math.min(CFG.maxRows, Math.floor((H - 110) / CFG.rowGap)));
    const gap = (H - 110) / n;
    keep = Math.ceil(W / CFG.step) + 3; // samples that fit on screen
    chans = [];
    for (let c = 0; c < n; c++) {
      const back = n > 1 ? c / (n - 1) : 0.5; // 0 = front of head, 1 = back
      chans.push({
        y: 96 + gap * (c + 0.5),
        gap, back,
        name: NAMES[Math.round(back * (NAMES.length - 1))],
        ph: Array.from({ length: 10 }, () => Math.random() * 6.283),
        // Slightly different rhythm speeds per channel.
        fa: 1 + (Math.random() - 0.5) * 0.08,
        fb: 1 + (Math.random() - 0.5) * 0.12,
        v: [],   // recorded samples (oldest first), in wave units
        hot: [], // how strongly the mouse was acting when each was written
      });
    }
    blinks = []; sinceBlink = CFG.blinkEvery - 2;
    // Start with a screenful of calm recording already on the paper.
    written = scroll - keep * CFG.step;
    record(0, 0);
  }

  // Signal for one channel at paper position x (px), -1…1-ish. m = how
  // strongly the mouse is acting here (0-1).
  function wave(ch, x, m) {
    const p = ch.ph;
    // Alpha arrives in bursts ("spindles"): a slow envelope gates it.
    const burst = Math.max(0, 0.45 + 0.55 * Math.sin(x * 0.0041 + p[0]) * Math.sin(x * 0.0013 + p[1]) + 0.25 * Math.sin(x * 0.0009 + p[9]));
    const alpha = (0.35 + 0.75 * ch.back) * burst * Math.sin(x * 0.165 * ch.fa + p[2]);
    const beta = 0.2 * (0.6 + 0.4 * Math.sin(x * 0.007 + p[3])) * Math.sin(x * 0.37 * ch.fb + p[4]);
    const theta = 0.3 * Math.sin(x * 0.085 + p[5]);
    const delta = 0.22 * Math.sin(x * 0.033 + p[6]);
    const fuzz = 0.07 * (Math.sin(x * 0.61 + p[7]) + Math.sin(x * 1.13 + p[8]));
    return alpha * (1 - 0.88 * m) + beta * (1 + 3.4 * m) + theta * (1 - 0.4 * m) + delta + fuzz
      + m * 0.2 * Math.sin(x * 0.7 + p[1]);
  }

  // A blink is written by the pen as it goes, so it is centred a little
  // AHEAD of the pen: the whole bump gets recorded over the next moments.
  function blink(strength) {
    blinks.push({ x: scroll + 95, a: strength });
    if (blinks.length > 6) blinks.shift();
    sinceBlink = 0;
  }

  // Write every sample the pen has passed since the last frame, using the
  // mouse's state NOW. E = movement energy (0-1), power = mouse presence.
  function record(E, power) {
    const everywhere = CFG.arousal * E;
    while (written + CFG.step <= scroll) {
      written += CFG.step;
      for (const ch of chans) {
        const dr = (mouse.y - ch.y) / (ch.gap * CFG.rows * (1 + 0.6 * CFG.surge * E));
        const local = power * Math.exp(-dr * dr);
        const m = Math.min(1, Math.max(local, everywhere));
        let v = wave(ch, written, m) * (1 + CFG.surge * 0.7 * E * local);
        const front = 1 - ch.back; // blinks are a frontal artifact
        for (const b of blinks) {
          const d = (written - b.x) / 34;
          if (d > -4 && d < 4) v -= b.a * 3.2 * front * front * Math.exp(-d * d);
        }
        ch.v.push(v);
        ch.hot.push(local);
        if (ch.v.length > keep) { ch.v.shift(); ch.hot.shift(); }
      }
    }
  }

  function frame(t, dt, { base, hot }) {
    const { W } = S, D = CFG.dim;
    scroll += CFG.speed * dt;
    sinceBlink += dt;
    if (sinceBlink > CFG.blinkEvery) blink(0.8 + Math.random() * 0.4);
    blinks = blinks.filter((b) => b.x > written - 200);

    // The mouse's effect builds while it moves and ebbs when it rests.
    // energy = how fast it is moving right now; fades in about a second.
    const active = t - mouse.at < 900;
    mouse.power += ((active ? 1 : 0) - mouse.power) * Math.min(1, dt * (active ? 4 : 1.6));
    mouse.energy *= Math.exp(-dt * 1.6);
    record(mouse.energy, mouse.power);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";

    // Chart paper: a tick every five seconds of recording, moving with it.
    ctx.strokeStyle = `rgba(${base},${0.07 * D})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const tick = CFG.speed * 5;
    for (let x = W - (scroll % tick); x > 0; x -= tick) {
      ctx.moveTo(x, 86); ctx.lineTo(x, S.H);
    }
    ctx.stroke();

    for (const ch of chans) {
      const A = ch.gap * CFG.amp, n = ch.v.length;
      if (n < 2) continue;
      // Screen x of sample k: the newest sits just behind the pen (right edge).
      const x0 = W - (scroll - written) - (n - 1) * CFG.step;
      const front = 1 - ch.back;

      // The whole recorded trace.
      ctx.strokeStyle = `rgba(${base},${CFG.trace * (0.75 + 0.25 * front) * D})`;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x0, ch.y + ch.v[0] * A);
      for (let k = 1; k < n; k++) ctx.lineTo(x0 + k * CFG.step, ch.y + ch.v[k] * A);
      ctx.stroke();

      // Stretches written while the mouse was acting, redrawn brighter:
      // a wide soft pass, then a bright core where it was strongest.
      for (let pass = 0; pass < 2; pass++) {
        const floor = pass ? 0.45 : 0.12;
        ctx.strokeStyle = `rgba(${hot},${(pass ? 0.6 : 0.3) * D})`;
        ctx.lineWidth = pass ? 1.6 : 2.2;
        ctx.beginPath();
        let open = false;
        for (let k = 0; k < n; k++) {
          if (ch.hot[k] > floor) {
            const x = x0 + k * CFG.step, y = ch.y + ch.v[k] * A;
            if (open) ctx.lineTo(x, y); else { ctx.moveTo(x, y); open = true; }
          } else open = false;
        }
        ctx.stroke();
      }

      // Pen tip at the right edge, and the electrode name at the left.
      const ty = ch.y + ch.v[n - 1] * A;
      ctx.fillStyle = `rgba(${base},${(0.25 + 0.3 * ch.hot[n - 1]) * D})`;
      ctx.beginPath(); ctx.arc(W - 3, ty, 7 + 4 * ch.hot[n - 1], 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(${hot},${0.9 * D})`;
      ctx.beginPath(); ctx.arc(W - 3, ty, 2.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(${base},${0.5 * D})`;
      ctx.fillText(ch.name, 12, ch.y - ch.gap * 0.34);
    }
  }

  function poke(x, y, t) {
    // Pointer speed: drives the energy, and a fast flick writes a blink.
    const dtm = t - mouse.pt;
    if (dtm > 0 && dtm < 120) {
      const v = Math.hypot(x - mouse.px, y - mouse.py) / dtm;
      mouse.energy = Math.max(mouse.energy, Math.min(1, v / CFG.fast));
      if (v > CFG.flick && t - lastBlink > 1400) {
        lastBlink = t;
        blink(Math.min(1.3, 0.7 + v * 0.15));
      }
    }
    mouse.px = x; mouse.py = y; mouse.pt = t;
    mouse.y = y; mouse.at = t;
  }
  return { build, frame, poke };
}
