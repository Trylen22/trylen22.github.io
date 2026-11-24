// Mortimer, from Papyrus: the ASCII skull companion. His faces are the ones in papyrus/mortimer/assets/skulls.py
// (mortimer.json). Here every character is inked a little off its grid and re-drawn a few times a second, so he
// looks hand-lettered. He blinks, glances about, and now and then says something; a click startles him.
const LINES = [              // placeholders in his voice; Trylen can swap these for real ones
  'Evening.',
  'I remember what you tell me. Mostly.',
  'Yes, I can send the email. No, I will not enjoy it.',
  'Still here. Still a skull.',
  'Ask me something. I have time.',
];

export async function mountMortimer(host) {
  const canvas = host.querySelector('canvas');
  const faces = await (await fetch(new URL('mortimer.json', import.meta.url))).json();
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, raf = 0, visible = false;

  function size() { dpr = Math.min(devicePixelRatio || 1, 2); w = host.clientWidth; h = host.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; }
  const rnd = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; };

  // a small script of moods: [face, seconds]; talking is filled in as he speaks
  let face = 'idle', until = 0, line = 0, said = '', speaking = false, nextTalk = 2.5, t0 = performance.now();
  function plan(t) {
    if (speaking) {
      const text = LINES[line], n = Math.min(text.length, Math.floor((t - speaking) * 22));
      said = text.slice(0, n);
      face = n < text.length ? (Math.floor(t * 7) % 2 ? 'talking_open' : 'talking_closed') : 'idle';
      if (n >= text.length && t - speaking > text.length / 22 + 2.2) { speaking = false; said = ''; line = (line + 1) % LINES.length; nextTalk = t + 4 + Math.random() * 3; }
      return;
    }
    if (t < until) return;
    if (t > nextTalk) { speaking = t; return; }
    const r = Math.random();
    face = r < 0.35 ? 'blink' : r < 0.5 ? 'look_left' : r < 0.65 ? 'look_right' : 'idle';
    until = t + (face === 'blink' ? 0.14 : face === 'idle' ? 1.2 + Math.random() * 1.6 : 0.9);
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const rows = faces[face].split('\n'), cols = Math.max(...rows.map(r => r.length));
    const fs = Math.min(w * 0.82 / (cols * 0.6), h * 0.5 / (rows.length * 1.15));
    const cw = fs * 0.6, lh = fs * 1.15, ox = (w - cols * cw) / 2, oy = h * 0.42 - rows.length * lh / 2;
    const boil = Math.floor(t * 5);
    ctx.fillStyle = '#efeae2'; ctx.textBaseline = 'top';
    ctx.font = `${fs}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
    rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === ' ') return;
      const jx = rnd(boil + r * 31 + c, 1) * fs * 0.08, jy = rnd(boil + r * 31 + c, 2) * fs * 0.08, a = rnd(boil + r * 31 + c, 3) * 0.12;
      ctx.save(); ctx.translate(ox + c * cw + cw / 2 + jx, oy + r * lh + jy); ctx.rotate(a); ctx.fillText(ch, -cw / 2, 0); ctx.restore();
    }));
    if (said) {
      ctx.font = `500 13px "Inter Tight", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(239,234,226,.85)';
      // wrap to the card
      const words = said.split(' '), out = []; let cur = '';
      for (const wd of words) { const tryLine = cur ? cur + ' ' + wd : wd; if (ctx.measureText(tryLine).width > w * 0.8) { out.push(cur); cur = wd; } else cur = tryLine; }
      out.push(cur);
      out.forEach((l, i) => ctx.fillText(l, w / 2, oy + rows.length * lh + 26 + i * 18));
      ctx.textAlign = 'left';
    }
  }
  function loop(now) {
    const t = (now - t0) / 1000;
    plan(t); draw(t);
    if (visible && !reduce) raf = requestAnimationFrame(loop);
  }
  host.addEventListener('click', () => {
    const t = (performance.now() - t0) / 1000;
    speaking = false; said = ''; face = Math.random() < 0.5 ? 'surprised' : 'winking'; until = t + 0.9; nextTalk = t + 1.1;
    if (reduce) draw(t);
  });
  new IntersectionObserver(es => {
    visible = es.some(e => e.isIntersecting); cancelAnimationFrame(raf);
    if (visible && !reduce) raf = requestAnimationFrame(loop);
  }).observe(host);
  new ResizeObserver(() => { size(); draw((performance.now() - t0) / 1000); }).observe(host);
  size(); draw(0);
  host.dataset.ready = '1';
}
