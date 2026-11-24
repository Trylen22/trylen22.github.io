// Nocturne — a butterfly on black. Minimal: glazes, breath of trails, one cream accent.
const W = 1200, H = 1500;
const SEED = Number(new URLSearchParams(location.search).get("seed")) || 777;
brush.createCanvas(W, H, { parent: "#paint" });
brush.seed(SEED); brush.noiseSeed(SEED);
brush.scaleBrushes(5.5);
brush.angleMode(brush.DEGREES);
brush.translate(-W / 2, -H / 2);
brush.clear("#04050a");

const CX = 600, CY = 740;
const TEAL = "#3fd2c7", CYAN = "#9ff3ea", MAG = "#c4568f", VIOLET = "#5b3fae", BLUE = "#23409c", CREAM = "#f4ecd8", INK = "#04050a";
const mirror = (pts) => pts.map(([x, y]) => [2 * CX - x, y]);
const rnd = (a, b) => a + Math.random() * (b - a);
const shrink = (pts, k, dy = 0) => pts.map(([x, y]) => [CX + (x - CX) * k, CY + (y - CY) * k + dy]);

const fore = [[CX + 10, CY - 150], [CX + 120, CY - 330], [CX + 300, CY - 470], [CX + 470, CY - 450], [CX + 540, CY - 330],
  [CX + 510, CY - 180], [CX + 420, CY - 60], [CX + 250, CY - 10], [CX + 60, CY - 20]];
const hind = [[CX + 40, CY + 10], [CX + 220, CY + 20], [CX + 400, CY + 90], [CX + 440, CY + 240], [CX + 360, CY + 400],
  [CX + 250, CY + 470], [CX + 140, CY + 420], [CX + 60, CY + 300], [CX + 20, CY + 120]];
const wings = [fore, hind, mirror(fore), mirror(hind)];

// 1. a breath of flow trails, kept to the edges and very quiet
brush.field("seabed"); brush.noFill(); brush.noHatch();
for (let i = 0; i < 34; i++) {
  brush.set("HB", i % 2 ? VIOLET : TEAL, rnd(0.5, 1.0));
  const x = rnd(40, W - 40), y = rnd(60, H - 60);
  if (Math.hypot(x - CX, y - CY) < 420) continue; // keep the centre clear
  brush.flowLine(x, y, rnd(60, 200), rnd(0, 360));
}
brush.noField();
for (let i = 0; i < 90; i++) { brush.set("HB", CREAM, rnd(0.3, 0.8)); brush.circle(rnd(0, W), rnd(0, H), rnd(0.5, 1.6), 0.5); }

// 2. halo — one soft violet breath behind everything
brush.noStroke(); brush.fillBleed(0.7, "out"); brush.fillTexture(0.45, 0.25);
brush.fill(VIOLET, 60); brush.circle(CX, CY - 40, 520, 0.6);

// 3. wings — translucent glazes, no outline, edges left to bleed
for (const p of wings) {
  brush.fillBleed(0.22, "out"); brush.fillTexture(0.28, 0.2);
  brush.fill(BLUE, 235); brush.polygon(p);
  brush.fillBleed(0.35, "out");
  brush.fill(TEAL, 160); brush.polygon(shrink(p, 0.86, 8));
  brush.fillBleed(0.45, "out");
  brush.fill(MAG, 110); brush.polygon(shrink(p, 0.6, 18));
}

// 3b. one thin cream contour — structure, not ornament
brush.noFill();
brush.set("HB", CREAM, 0.9);
for (const p of wings) brush.spline([...p, p[0], p[1]], 0.5);
brush.noStroke();

// 4. one accent per wing — a soft cream eyespot, nothing more
brush.fillBleed(0.35, "out"); brush.fillTexture(0.3, 0.15);
for (const s of [1, -1]) {
  brush.fill(INK, 200); brush.circle(CX + s * 380, CY - 300, 52, 0.3);
  brush.fill(CREAM, 170); brush.circle(CX + s * 380, CY - 300, 26, 0.3);
  brush.fill(INK, 200); brush.circle(CX + s * 300, CY + 250, 38, 0.3);
  brush.fill(CREAM, 150); brush.circle(CX + s * 300, CY + 250, 17, 0.3);
}

// 5. body — a dark silhouette, thin antennae in cream
brush.fill(INK, 245); brush.fillBleed(0.2, "out");
brush.polygon([[CX - 22, CY - 165], [CX + 22, CY - 165], [CX + 18, CY + 60], [CX + 8, CY + 300], [CX - 8, CY + 300], [CX - 18, CY + 60]]);
brush.circle(CX, CY - 190, 26, 0.3);
brush.noFill();
for (const s of [1, -1]) {
  brush.set("HB", CREAM, 1.1);
  brush.spline([[CX + s * 6, CY - 210], [CX + s * 70, CY - 350], [CX + s * 170, CY - 430]], 0.6);
}
brush.render();
