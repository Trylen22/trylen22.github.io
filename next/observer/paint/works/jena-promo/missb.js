const DY = 40;
const ROSE = "#b5726c", BLUSH = "#e2b3aa", BROWN = "#4a3126", GOLD = "#c9a24a", CREAM = "#fff8ea";
brush.noStroke(); brush.noHatch();
brush.fillBleed(0.45, "out"); brush.fillTexture(0.35, 0.25);
// blush field
brush.fill(BLUSH, 60); brush.circle(540, 380, 280, 0.5);
brush.fill(GOLD, 30); brush.circle(720, 300, 150, 0.55);
brush.translate(0, DY);
// cup body (trapezoid, soft) and saucer
const cup = [[380, 260], [700, 260], [660, 470], [420, 470]];
brush.fill(CREAM, 200); brush.polygon(cup);
brush.fill(ROSE, 120); brush.fillBleed(0.5, "in"); brush.polygon([[395, 300], [685, 300], [660, 380], [420, 380]]);
brush.fillBleed(0.45, "out");
brush.fill(BROWN, 150); brush.polygon([[392, 262], [688, 262], [672, 290], [408, 290]]); // coffee surface
brush.fill(CREAM, 170); brush.polygon(football(540, 500, 480, 70, 0)); // saucer
// outlines
brush.noFill();
for (const w of [2.6, 1.6]) {
  brush.set("2B", BROWN, w);
  brush.spline([[380, 258], [400, 380], [420, 472], [660, 472], [680, 380], [700, 258]], 0.35);
  brush.line(372, 258, 708, 258);
  brush.spline([[698, 300], [800, 285], [812, 405], [668, 432]], 0.6); // handle
  brush.spline([[300, 500], [540, 545], [780, 500]], 0.4); // saucer
}
// steam
brush.set("2B", ROSE, 2.2);
for (const dx of [-70, 0, 70]) brush.spline([[540 + dx, 232], [556 + dx, 205], [528 + dx, 178], [548 + dx, 150]], 0.5);
brush.translate(0, -DY);
// coffee-ring stamps
brush.set("2B", BROWN, 2.2); brush.circle(190, 1000, 70, 0.4);
brush.set("2B", ROSE, 1.4); brush.circle(190, 1000, 62, 0.4);
brush.set("2B", BROWN, 2.0); brush.circle(920, 950, 55, 0.4);
frame(GOLD, 120, 1234);
brush.render();
