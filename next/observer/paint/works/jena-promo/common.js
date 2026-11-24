// Shared setup for both fliers (p5.brush standalone).
const W = 1080, H = 1350;
const SEED = Number(new URLSearchParams(location.search).get("seed")) || 8241926;
brush.createCanvas(W, H, { parent: "#paint" });
brush.seed(SEED); brush.noiseSeed(SEED);
brush.scaleBrushes(5);
brush.angleMode(brush.DEGREES);
brush.translate(-W / 2, -H / 2); // standalone origin is the centre

function football(cx, cy, len, girth, tilt, n = 48) {
  const pts = [], a = (tilt * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * len / 2;
    const y = Math.sin(t) * girth / 2 * Math.sqrt(1 - Math.pow(Math.abs(Math.cos(t)), 6));
    pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  return pts;
}
function frame(col, top, bottom) {
  brush.noFill(); brush.set("HB", col, 2.2);
  brush.line(120, top, 960, top); brush.line(120, bottom, 960, bottom);
  for (const [x, y, sx, sy] of [[60, 60, 1, 1], [1020, 60, -1, 1], [60, 1290, 1, -1], [1020, 1290, -1, -1]]) {
    brush.line(x, y, x + 70 * sx, y); brush.line(x, y, x, y + 70 * sy);
  }
}
