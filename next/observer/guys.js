// The account-mark guys (nightdesk/mods/account-mark): the pixel characters that sit above the prompt and say
// which account a terminal runs. Here they're drawn in ink, each pixel a hand-filled square that re-draws a few
// times a second. They step in place and blink the way they do in the terminal; a click brings the next one.
export async function mountGuys(host) {
  const canvas = host.querySelector('canvas'), label = host.querySelector('.guy-name');
  const guys = await (await fetch(new URL('guys.json', import.meta.url))).json();
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0, tick = 0, since = 0, w = 0, h = 0, dpr = 1, raf = 0, visible = false, last = performance.now();

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); w = host.clientWidth; h = host.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  const rnd = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; };

  function pose(g, walking) {
    if (walking && tick % 2 === 1) {
      if (g.spin) return g.spin;
      const feet = g.grid[g.grid.length - 1];
      return [...g.grid.slice(0, -1), feet.slice(-1) + feet.slice(0, -1)];
    }
    if (g.blink && tick % 12 === 11) { const p = [...g.grid]; p[g.blink[0]] = g.blink[1]; return p; }
    return g.grid;
  }
  function draw() {
    const g = guys[i], grid = pose(g, Math.floor(since / 4) % 2 === 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const cell = Math.floor(Math.min(w * 0.72 / 11, h * 0.5 / 8)), ox = (w - cell * 11) / 2, oy = h * 0.44 - cell * 4;
    const boil = Math.floor(performance.now() / 160);
    ctx.fillStyle = '#efeae2';
    grid.forEach((row, r) => [...row].forEach((c, k) => {
      if (c !== '#') return;
      // a slightly uneven square, as if inked by hand
      const j = (n) => rnd(boil + r * 11 + k, n) * cell * 0.12;
      const x = ox + k * cell, y = oy + r * cell, s = cell * 0.9;
      ctx.beginPath();
      ctx.moveTo(x + j(1), y + j(2)); ctx.lineTo(x + s + j(3), y + j(4));
      ctx.lineTo(x + s + j(5), y + s + j(6)); ctx.lineTo(x + j(7), y + s + j(8)); ctx.closePath(); ctx.fill();
    }));
    label.textContent = g.name;
  }
  function loop(now) {
    const dt = now - last;
    if (dt > 420) { last = now; tick++; since++; if (since > 14) { since = 0; i = (i + 1) % guys.length; } }
    draw();
    if (visible && !reduce) raf = requestAnimationFrame(loop);
  }
  host.addEventListener('click', () => { i = (i + 1) % guys.length; since = 0; draw(); });
  new IntersectionObserver(es => {
    visible = es.some(e => e.isIntersecting); cancelAnimationFrame(raf);
    if (visible && !reduce) raf = requestAnimationFrame(loop);
  }).observe(host);
  new ResizeObserver(() => { size(); draw(); }).observe(host);
  size(); draw();
  host.dataset.ready = '1';
}
