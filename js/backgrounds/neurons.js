/* =========================================================
   BACKGROUND: NEURONS
   Neurons firing in cascades, led by the mouse.
   
   A backdrop renderer is a function (ctx, S) that returns
   { build(), frame(t, dt, colour), poke(x, y, t) }:
     ctx  the shared canvas's 2D context
     S    { W, H }: the canvas size in CSS pixels, kept up to date
     build   lay the scene out for the current size (also on resize)
     frame   draw one frame; colour = { base, hot } as "r,g,b" strings
     poke    the mouse moved to (x, y)
   It is registered in js/backgrounds/backgrounds.js.
   ========================================================= */

/* Neurons: a small model of neurons firing, not a real simulation.
   Neurons sit on a jittered grid (even coverage, no clumps), sway slowly,
   and are wired to their nearest few neighbours by curved fibres. A neuron
   that FIRES flashes and sends signals down some fibres; an arriving
   signal usually makes that neuron fire too, so activity spreads in short
   cascades (a refractory period stops it bouncing straight back). It is
   mouse-led: the neuron nearest the pointer fires as it passes; away from
   the mouse a random one fires only now and then. */
function neuronRenderer(ctx, S) {
  const CFG = {
    spacing: 150,       // px between neurons (smaller = denser)
    maxNodes: 110,
    links: 3,           // fibres per neuron (to its nearest neighbours)
    maxLink: 2.1,       // ...but none longer than this many spacings
    sway: 16,           // px a neuron drifts around its spot
    speed: 0.28,        // signal speed, in fibre-lengths per second (avg)
    spread: 0.5,        // chance a firing neuron sends a signal down each fibre
    relay: 0.4,         // chance an arriving signal makes the neuron fire
    refractory: 1100,   // ms before a neuron can fire again
    spontaneous: 0.1,   // random firings per second, away from the mouse (rare)
    pokeRadius: 190,    // px: how close the mouse must be to set a neuron off
    pokeEvery: 110,     // ms between mouse-triggered firings
    maxSignals: 70,
    fibre: 0.13,        // brightness of resting fibres (0-1)
    dim: 0.85,          // overall brightness
  };
  let nodes = [], edges = [], signals = [], lastPoke = 0;
  const P = { x: 0, y: 0 };

  function build() {
    const { W, H } = S;
    // Jittered grid, extended past the edges so fibres run off-screen.
    let step = CFG.spacing;
    while (((W / step + 2) * (H / step + 2)) > CFG.maxNodes) step *= 1.08;
    nodes = [];
    for (let gy = -0.5; gy * step < H + step * 0.5; gy++) {
      for (let gx = -0.5; gx * step < W + step * 0.5; gx++) {
        nodes.push({
          hx: (gx + 0.5 + (Math.random() - 0.5) * 0.8) * step,
          hy: (gy + 0.5 + (Math.random() - 0.5) * 0.8) * step,
          x: 0, y: 0,
          z: 0.45 + Math.random() * 0.55,          // depth: 0.45 far … 1 near
          ph: Math.random() * 6.283, ph2: Math.random() * 6.283,
          rate: 0.00012 + Math.random() * 0.00016, // sway speed
          glow: 0, last: -1e9, edges: [],
        });
      }
    }
    // Wire each neuron to its nearest neighbours (each pair once).
    edges = []; signals = [];
    const seen = new Set();
    nodes.forEach((n, i) => {
      nodes
        .map((m, j) => ({ j, d: Math.hypot(m.hx - n.hx, m.hy - n.hy) }))
        .filter((o) => o.j !== i && o.d < step * CFG.maxLink)
        .sort((p, q) => p.d - q.d)
        .slice(0, CFG.links)
        .forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) return;
          seen.add(key);
          nodes[i].edges.push(edges.length);
          nodes[j].edges.push(edges.length);
          edges.push({ a: i, b: j, bend: (Math.random() - 0.5) * 0.5 });
        });
    });
  }

  // Point at t (0-1) along a fibre, from node `from` to its other end.
  function along(e, from, t, out) {
    const A = nodes[from], B = nodes[from === e.a ? e.b : e.a];
    const s = from === e.a ? 1 : -1; // keep the curve the same either way
    const mx = (A.x + B.x) / 2 - (B.y - A.y) * e.bend * s;
    const my = (A.y + B.y) / 2 + (B.x - A.x) * e.bend * s;
    const u = 1 - t;
    out.x = u * u * A.x + 2 * u * t * mx + t * t * B.x;
    out.y = u * u * A.y + 2 * u * t * my + t * t * B.y;
    return out;
  }

  function fire(i, t) {
    const n = nodes[i];
    if (!n || t - n.last < CFG.refractory) return;
    n.last = t;
    n.glow = 1;
    for (const ei of n.edges) {
      if (signals.length >= CFG.maxSignals) break;
      if (Math.random() < CFG.spread) {
        signals.push({ e: ei, from: i, t: 0, v: CFG.speed * (0.7 + Math.random() * 0.6) });
      }
    }
  }

  function frame(t, dt, { base, hot }) {
    const D = CFG.dim;
    if (Math.random() < CFG.spontaneous * dt) fire((Math.random() * nodes.length) | 0, t);
    for (const n of nodes) {
      n.x = n.hx + Math.sin(t * n.rate + n.ph) * CFG.sway;
      n.y = n.hy + Math.cos(t * n.rate * 0.8 + n.ph2) * CFG.sway;
      n.glow = Math.max(0, n.glow - dt * 1.1);
    }
    ctx.lineCap = "round";

    // Fibres. A fibre brightens a little while either end is glowing.
    for (const e of edges) {
      const A = nodes[e.a], B = nodes[e.b];
      const z = (A.z + B.z) / 2;
      const lit = Math.max(A.glow, B.glow);
      ctx.strokeStyle = `rgba(${base},${(CFG.fibre * z + lit * 0.16) * D})`;
      ctx.lineWidth = 0.6 + z * 0.9;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.quadraticCurveTo(
        (A.x + B.x) / 2 - (B.y - A.y) * e.bend,
        (A.y + B.y) / 2 + (B.x - A.x) * e.bend,
        B.x, B.y
      );
      ctx.stroke();
    }

    // Signals: a bright head with a short fading tail.
    for (let k = signals.length - 1; k >= 0; k--) {
      const s = signals[k];
      s.t += s.v * dt;
      const e = edges[s.e];
      if (s.t >= 1) {
        const to = s.from === e.a ? e.b : e.a;
        if (Math.random() < CFG.relay) fire(to, t);
        else nodes[to].glow = Math.max(nodes[to].glow, 0.45);
        signals.splice(k, 1);
        continue;
      }
      for (let q = 5; q >= 0; q--) {
        const tt = s.t - q * 0.035;
        if (tt < 0) continue;
        along(e, s.from, tt, P);
        if (q === 0) {
          ctx.fillStyle = `rgba(${base},${0.22 * D})`;
          ctx.beginPath(); ctx.arc(P.x, P.y, 9, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = `rgba(${hot},${(1 - q / 6) * D * (q === 0 ? 1 : 0.5)})`;
        ctx.beginPath(); ctx.arc(P.x, P.y, q === 0 ? 2.4 : 1.6, 0, 6.283); ctx.fill();
      }
    }

    // Neurons: soft halo (swells when firing) + a core.
    for (const n of nodes) {
      const halo = (7 + 30 * n.glow) * n.z;
      ctx.fillStyle = `rgba(${base},${(0.07 + 0.2 * n.glow) * n.z * D})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, halo, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(${base},${(0.1 + 0.25 * n.glow) * n.z * D})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, halo * 0.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(${n.glow > 0.05 ? hot : base},${(0.45 + 0.55 * n.glow) * n.z * D})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, (1.6 + 1.8 * n.z) * (1 + 0.5 * n.glow), 0, 6.283); ctx.fill();
    }
  }

  function poke(x, y, t) {
    if (t - lastPoke < CFG.pokeEvery) return;
    lastPoke = t;
    let best = -1, bd = CFG.pokeRadius * CFG.pokeRadius;
    nodes.forEach((n, i) => {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) fire(best, t);
  }
  return { build, frame, poke };
}
