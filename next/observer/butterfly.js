// A small ink butterfly that drifts around the observer page.
// Its wings are Nocturne's (paint/butterfly): four rounded wings, an eyespot on each, a hairline contour.
// Flight: it follows a smooth spline through waypoints anywhere on the screen at an unhurried pace, its body
// turning with the curve. Wings beat in bursts with glides between. Now and then the next waypoint is the top
// of a title line: it slows in, lands, fans its wings, and leaves the same smooth way. A pointer that comes
// close makes it pick a new course away from it; nothing ever shoves it.
const canvas = document.createElement('canvas');
canvas.className = 'butterfly';
canvas.setAttribute('aria-hidden', 'true');
document.body.append(canvas);
const ctx = canvas.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const INK = '#111110', PAPER = '#d7d2cb';
const CRUISE = 62;            // px/s

let W = 0, H = 0, dpr = 1;
function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; }
resize(); addEventListener('resize', resize);

let pointer = { x: -1e4, y: -1e4 };
addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
addEventListener('pointerleave', () => { pointer = { x: -1e4, y: -1e4 }; });

const rnd = (a, b) => a + Math.random() * (b - a);
function freePoint(from, away) {
  // somewhere 220–520 px on, inside the screen; if `away` is given, on the far side of it
  for (let i = 0; i < 30; i++) {
    const ang = away ? Math.atan2(from.y - away.y, from.x - away.x) + rnd(-0.9, 0.9) : rnd(0, Math.PI * 2);
    const d = rnd(220, 520), p = { x: from.x + Math.cos(ang) * d, y: from.y + Math.sin(ang) * d };
    if (p.x > 40 && p.x < W - 40 && p.y > 60 && p.y < H - 40) return p;
  }
  return { x: rnd(80, W - 80), y: rnd(100, H - 80) };
}
function perchPoint() {
  const spans = [...document.querySelectorAll('.name h1 span')].map(s => s.getBoundingClientRect()).filter(r => r.bottom > 40 && r.top < H - 40);
  if (!spans.length) return null;
  const r = spans[Math.floor(Math.random() * spans.length)];
  return { x: r.left + r.width * rnd(0.15, 0.7), y: r.top + r.height * 0.15, perch: true };
}

// Catmull-Rom through P[i-1..i+2]
const cr = (a, b, c, d, u) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
const at = (P, u) => ({ x: cr(P[0].x, P[1].x, P[2].x, P[3].x, u), y: cr(P[0].y, P[1].y, P[2].y, P[3].y, u) });
function segLen(P) { let L = 0, q = at(P, 0); for (let i = 1; i <= 16; i++) { const r = at(P, i / 16); L += Math.hypot(r.x - q.x, r.y - q.y); q = r; } return L; }

const start = { x: W * 0.22, y: H * 0.72 };
let P = [start, start, freePoint(start), null]; P[3] = freePoint(P[2]);
let t = 0, u = 0, len = segLen(P), speed = 0, perched = 0, flap = 0, beat = 1, nextGlide = 2, ang = -Math.PI / 2, pos = { ...start }, takeoff = 0;

function advance() {
  P.shift();
  const last = P[P.length - 1];
  let next = (!last.perch && Math.random() < 0.28) ? perchPoint() : null;
  if (!next || Math.hypot(next.x - last.x, next.y - last.y) < 120) next = freePoint(last);
  P.push(next); u = 0; len = segLen(P);
}
let lastReplan = -9;
function replanAway() {
  if (t - lastReplan < 1.5) return;
  lastReplan = t;
  // keep the path continuous: the current segment stays, everything after it turns away from the pointer
  P[2] = freePoint(pos, pointer); P[3] = freePoint(P[2], pointer); len = segLen(P);
}

function wing(j, f, upper) {
  const W_ = upper ? [[1.5, -1], [6, -11], [15, -14], [19, -8], [17, -1], [8, 1.5]] : [[1.5, 1.5], [9, 3], [14, 8], [11, 14], [5, 13], [1, 5]];
  const pts = W_.map(([x, y], i) => [x * f + j(i), y + j(i + 9)]);
  ctx.beginPath(); ctx.moveTo((pts[0][0] + pts[5][0]) / 2, (pts[0][1] + pts[5][1]) / 2);
  for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + c[0]) / 2, (a[1] + c[1]) / 2); }
  ctx.closePath(); ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();   // paper inside, so it shows over the black letters
  const [ex, ey] = upper ? [11, -8] : [8, 8];
  ctx.beginPath(); ctx.arc(ex * f + j(20), ey + j(21), upper ? 2.1 : 1.5, 0, Math.PI * 2); ctx.stroke();
  if (upper) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex * f + j(22), ey + j(23), 0.7, 0, Math.PI * 2); ctx.fill(); }
}
function draw(t, open) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.translate(pos.x, pos.y); ctx.rotate(ang + Math.PI / 2); ctx.scale(1.5, 1.5);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.95; ctx.lineJoin = ctx.lineCap = 'round';
  const boil = Math.floor(t * 6);
  const j = i => { const v = Math.sin(boil * 12.9898 + i * 78.233) * 43758.5453; return (v - Math.floor(v) - 0.5) * 0.5; };
  for (const s of [1, -1]) { ctx.save(); ctx.scale(s, 1); wing(j, open, true); wing(j, open * 0.95, false); ctx.restore(); }
  ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(0.4, 3, 0, 10); ctx.stroke();
  ctx.lineWidth = 0.7; ctx.fillStyle = INK;
  for (const s of [1, -1]) {
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(s * 2, -10, s * 4.5, -13.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 4.6, -13.7, 0.7, 0, Math.PI * 2); ctx.fill();
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  const dest = P[2];
  let open;
  if (perched > 0) {
    perched -= dt;
    flap += dt * 1.4;                                        // slow fanning while it rests
    open = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(flap));
    const near = Math.hypot(pointer.x - pos.x, pointer.y - pos.y) < 110;
    if (perched <= 0 || near) { perched = 0; dest.perch = false; takeoff = 1; if (near) replanAway(); }
  } else {
    // speed: eases in on takeoff, eases out into a perch, otherwise a slow cruise that breathes a little
    const remain = (1 - u) * len;
    let want = CRUISE * (0.85 + 0.15 * Math.sin(t * 0.7));
    if (dest.perch) want *= Math.min(1, 0.15 + remain / 160);
    if (takeoff > 0) { takeoff = Math.max(0, takeoff - dt * 0.8); want *= 1 - 0.7 * takeoff; }
    speed += (want - speed) * Math.min(1, dt * 2.5);
    u += speed * dt / Math.max(1, len);
    if (u >= 1) {
      if (dest.perch) { perched = rnd(4, 7); u = 1; }
      advance();
    }
    const p = at(P, Math.min(u, 1)), q = at(P, Math.min(u + 0.02, 1));
    if (Math.hypot(q.x - p.x, q.y - p.y) > 0.01) {
      const a = Math.atan2(q.y - p.y, q.x - p.x);
      let d = a - ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      ang += d * Math.min(1, dt * 3);                        // body follows the curve, smoothly
    }
    // a light flutter across the line of travel
    const sway = Math.sin(t * 5.1) * 1.6 + Math.sin(t * 2.3) * 1.1;
    pos = { x: p.x - Math.sin(ang) * sway, y: p.y + Math.cos(ang) * sway };
    // wings: bursts of beats, then a short glide with them held open
    if (t > nextGlide) { beat = 0; if (t > nextGlide + rnd(0.5, 0.9)) { beat = 1; nextGlide = t + rnd(1.8, 3.6); } }
    flap += dt * (beat ? 13 : 0);
    const b = 0.5 + 0.5 * Math.cos(flap);
    open = beat ? 0.2 + 0.8 * b : 0.92;
    if (!dest.perch && Math.hypot(pointer.x - pos.x, pointer.y - pos.y) < 120 && u > 0.15) replanAway();
  }
  if (perched > 0) { pos = { x: pos.x + (P[1].x - pos.x) * Math.min(1, dt * 4), y: pos.y + (P[1].y - pos.y) * Math.min(1, dt * 4) };
    let d = -Math.PI / 2 - ang; d = Math.atan2(Math.sin(d), Math.cos(d)); ang += d * Math.min(1, dt * 2); }
  draw(t, open);
  if (!reduce) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
