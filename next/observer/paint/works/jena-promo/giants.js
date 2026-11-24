const GOLD = "#d3ab52", FLAME = "#efc95e", PALE = "#f1e2b8", INK = "#0b0907";
// glow field behind the ball
brush.noStroke(); brush.noHatch();
brush.fillBleed(0.45, "out"); brush.fillTexture(0.35, 0.25);
brush.fill(GOLD, 40); brush.circle(540, 760, 265, 0.5);
brush.fill(FLAME, 30); brush.circle(600, 740, 170, 0.55);
// the ball
brush.fill(GOLD, 190); brush.polygon(football(540, 760, 620, 320, -22));
brush.fill(FLAME, 90); brush.polygon(football(560, 742, 500, 220, -22));
brush.fill(PALE, 60); brush.fillBleed(0.55, "in");
brush.polygon(football(560, 732, 380, 105, -22));
// laces, in ink on gold
const a = (-22 * Math.PI) / 180;
const at = (d, off) => [540 + d * Math.cos(a) - off * Math.sin(a), 760 + d * Math.sin(a) + off * Math.cos(a)];
brush.noFill();
for (const w of [2.6, 1.7]) {
  brush.set("2B", INK, w);
  let s = at(-115, -40), e = at(115, -40); brush.line(s[0], s[1], e[0], e[1]);
  for (let d = -80; d <= 80; d += 27) { const p = at(d, -64), q = at(d, -16); brush.line(p[0], p[1], q[0], q[1]); }
}
brush.set("2B", INK, 2.2);
for (const sgn of [-1, 1]) { const s = at(sgn * 280, 0), e = at(sgn * 195, -54); brush.line(s[0], s[1], e[0], e[1]); }
// gold spatter
brush.set("HB", GOLD, 1.4);
for (let i = 0; i < 26; i++) { const x = 160 + ((i * 731) % 760), y = 520 + ((i * 397) % 420); brush.circle(x, y, 2 + (i % 4), 0.5); }
frame(GOLD, 122, 1232);
brush.render();
