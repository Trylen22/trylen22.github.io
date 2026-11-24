/**
 * Scene painter: turns a parsePrompt() plan into a watercolor scene with
 * p5.brush. Every subject is built from a few washes + a light pencil line.
 * Uses p5's seeded random(), so prompt + seed → the same painting.
 */

const PAPER = "#f4efe4";
const INK = "#2a241c";
let SC = null; // scene state while painting

/* ---------------- palettes ---------------- */

const MOOD_PAL = {
  happy: { pal: ["#f3c94a", "#f08a5d", "#7cc36e", "#5fb3e0", "#e86a8a"], sky: "#ffd98a", amt: 0.18 },
  sad: { pal: ["#7d8ca3", "#5a6b85", "#a3adbd", "#3f4a63", "#9aa6b8"], sky: "#8592a3", amt: 0.5 },
  angry: { pal: ["#c1272d", "#e0512b", "#4a1a1a", "#f08a3a", "#8a1c1c"], sky: "#d0482f", amt: 0.4 },
  calm: { pal: ["#7fb8b0", "#a9cfc4", "#9db6d6", "#6a9ab8", "#d7c9a6"], sky: "#b9dcd6", amt: 0.25 },
  spooky: { pal: ["#5b3a7a", "#7f9a3a", "#e07b2a", "#2b1d3a", "#9a8ab0"], sky: "#4b2a5e", amt: 0.45 },
  love: { pal: ["#e57a9a", "#f2b5c4", "#c13b5a", "#f6d0d8", "#d65a7a"], sky: "#f4b6c8", amt: 0.35 },
  stressed: { pal: ["#8c8f96", "#c13b4a", "#3c3f45", "#e9c46a", "#6f7378"], sky: "#9a9ca3", amt: 0.45 },
  excited: { pal: ["#ff8a2a", "#f3d660", "#3dbbe0", "#e0509a", "#7cc36e"], sky: "#ffc070", amt: 0.2 },
  magic: { pal: ["#9b7fd8", "#e4b8f0", "#6fd0e0", "#f6e3a0", "#c47fc0"], sky: "#c9b2ee", amt: 0.38 },
  hungry: { pal: ["#e9a23b", "#c8372d", "#f3d660", "#7b8a45", "#b9783f"], sky: "#f5c58a", amt: 0.2 },
};

const SKY = {
  day: ["#8fbfe2", "#b5d5ea", "#dcebf0"],
  dawn: ["#b9a6d6", "#f2bba8", "#fbe3c0"],
  sunset: ["#4b4a8a", "#c8607a", "#f08a5a", "#f6c066"],
  night: ["#0c1230", "#1a2450", "#2c3b70"],
  space: ["#06070f", "#0d1024", "#141a38"],
};

function tone(c) {
  if (!SC || !c || c[0] !== "#") return c;
  let out = c;
  if (SC.toneTo) out = mixHex(out, SC.toneTo, SC.toneAmt);
  return out;
}

/* ---------------- primitives ---------------- */

// p5.brush keeps fill/stroke state between calls; a solid wash must clear
// the fill first or the last watercolour colour bleeds into it.
function flatWash(col, a = 255) {
  brush.noStroke();
  brush.noFill();
  brush.noHatch();
  brush.wash(col, a);
}

function ellP(cx, cy, rx, ry, rot = 0, n = 22, j = 0.035) {
  const pts = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + random(-j, j);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}
function fillC(col, a = 120, bleed = 0.14, tex = 0.4) {
  brush.noStroke();
  brush.noWash();
  brush.fill(tone(col), a);
  brush.fillBleed(bleed, "out");
  brush.fillTexture(tex, 0.3);
}
// knock = lay paper down first so the subject reads on dark grounds
function shape(pts, col, a = 125, bleed = 0.12, knock = false) {
  if (knock && SC && SC.knock) {
    // a flat underpainting in a pale version of the colour: hides what's
    // behind and keeps the hue rich once the textured wash goes on top
    brush.noStroke();
    flatWash(tone(mixHex(col[0] === "#" ? col : "#f4efe4", PAPER, 0.3)), 255);
    brush.polygon(pts);
    brush.noWash();
  }
  fillC(col, a, bleed);
  brush.polygon(pts);
}
// ground / water areas: solid base close to the colour, then texture
function groundFill(pts, col, a = 200, bleed = 0.12) {
  brush.noStroke();
  flatWash(mixHex(col, PAPER, 0.12), 255);
  brush.polygon(pts);
  brush.noWash();
  fillC(col, a, bleed, 0.5);
  brush.polygon(pts);
}
function oval(cx, cy, rx, ry, col, a = 125, rot = 0, knock = false, bleed = 0.12) {
  shape(ellP(cx, cy, rx, ry, rot), col, a, bleed, knock);
}
function solid(pts, col, a = 225) {
  brush.noStroke();
  flatWash(tone(col), a);
  brush.polygon(pts);
  brush.noWash();
}
function pip(x, y, r, col, a = 235) {
  brush.noStroke();
  flatWash(tone(col), a);
  brush.circle(x, y, Math.max(1.2, r));
  brush.noWash();
}
function pen(col, w = 1, type = "HB") {
  brush.noFill();
  brush.noWash();
  brush.set(type, tone(col), w);
}
function ln(x1, y1, x2, y2, col = INK, w = 1, type = "HB") {
  pen(col, w, type);
  brush.line(x1, y1, x2, y2);
}
function sp(pts, col = INK, w = 1, type = "HB", k = 0.5) {
  pen(col, w, type);
  brush.spline(pts, k);
}
function outline(pts, col = INK, w = 0.7) {
  if (!SC || SC.lines === false) return;
  sp(pts.concat([pts[0], pts[1]]), col, w, "HB", 0.5);
}
function rectP(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}
function limbP(x1, y1, x2, y2, w1, w2) {
  const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [[x1 + c * w1, y1 + s * w1], [x2 + c * w2, y2 + s * w2], [x2 - c * w2, y2 - s * w2], [x1 - c * w1, y1 - s * w1]];
}
function limb(x1, y1, x2, y2, w1, w2, col, a = 135) {
  shape(limbP(x1, y1, x2, y2, w1, w2), col, a, 0.08, true);
}
function triP(x1, y1, x2, y2, x3, y3) {
  return [[x1, y1], [x2, y2], [x3, y3]];
}
function eye(x, y, r, col = INK) {
  pip(x, y, r, col);
  pip(x - r * 0.35, y - r * 0.35, r * 0.32, "#fbf8f0", 220);
}
function darker(c, t = 0.3) {
  return mixHex(c, "#1c1d22", t);
}
function lighter(c, t = 0.4) {
  return mixHex(c, "#ffffff", t);
}
function pickc(list) {
  return list[Math.floor(random(list.length))];
}
function heartP(cx, cy, s) {
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([cx + (x * s) / 16, cy + (y * s) / 16]);
  }
  return pts;
}
function starP(cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
function sparkle(x, y, r, col) {
  ln(x - r, y, x + r, y, col, 1.1);
  ln(x, y - r, x, y + r, col, 1.1);
  ln(x - r * 0.45, y - r * 0.45, x + r * 0.45, y + r * 0.45, col, 0.6);
  ln(x - r * 0.45, y + r * 0.45, x + r * 0.45, y - r * 0.45, col, 0.6);
}
function waveLine(x1, x2, y, amp, col, w = 0.9) {
  const pts = [];
  for (let x = x1; x <= x2; x += 18) pts.push([x, y + Math.sin(x * 0.08 + random(6)) * amp]);
  if (pts.length > 1) sp(pts, col, w);
}

/* ---------------- four-legged animals ---------------- */

const QUAD = {
  dog: { len: 1, leg: 0.75, neck: 0.35, ear: "flop", tail: "up", cols: ["#a8743a", "#d9b07a", "#6b4a30", "#e8d6b8", "#3a3330", "#c98a4a"], snout: 1.1 },
  cat: { len: 0.9, leg: 0.6, neck: 0.15, ear: "point", tail: "curl", cols: ["#e98a3a", "#8c8f96", "#3a3330", "#e8d6b8", "#c9a77c"], snout: 0.5, whisk: 1 },
  fox: { len: 0.95, leg: 0.6, neck: 0.25, ear: "point", tail: "bushy", cols: ["#d9733a"], belly: "#f4ead0", snout: 1.25 },
  wolf: { len: 1.1, leg: 0.8, neck: 0.3, ear: "point", tail: "bushy", cols: ["#8c8f96", "#6f7378"], snout: 1.25 },
  horse: { len: 1.25, leg: 1.2, neck: 0.95, ear: "point", tail: "hair", mane: 1, cols: ["#8a5a3c", "#5e3a26", "#c9a77c", "#3a3330"], snout: 1.3, headTilt: 0.5 },
  unicorn: { len: 1.2, leg: 1.15, neck: 0.95, ear: "point", tail: "hair", mane: 1, horn: 1, cols: ["#fbf8f0"], maneCol: "rainbow", snout: 1.3, headTilt: 0.5 },
  pegasus: { len: 1.2, leg: 1.15, neck: 0.95, ear: "point", tail: "hair", mane: 1, wings: 1, cols: ["#fbf8f0"], maneCol: "#b8a6dc", snout: 1.3, headTilt: 0.5 },
  cow: { len: 1.3, leg: 0.75, neck: 0.2, ear: "side", horns: 1, tail: "rope", cols: ["#f4f0e6"], spots: "#2b2622", snout: 0.9, snoutCol: "#efb8c0" },
  pig: { len: 1.05, leg: 0.42, neck: 0.05, ear: "point", tail: "curl", cols: ["#efa9b4"], snout: 0.6, flatSnout: 1, girth: 1.15 },
  sheep: { len: 1, leg: 0.6, neck: 0.15, ear: "side", tail: "short", cols: ["#f4f0e6"], wool: 1, headCol: "#3a3330", snout: 0.7 },
  goat: { len: 1, leg: 0.8, neck: 0.4, ear: "side", horns: 2, tail: "short", cols: ["#e8e0d0", "#c9b8a6"], snout: 1, beard: 1 },
  deer: { len: 1, leg: 1.1, neck: 0.7, ear: "side", antler: 1, tail: "short", cols: ["#b98a5e"], spotsWhite: 1, snout: 1.1 },
  bear: { len: 1.2, leg: 0.6, neck: 0.12, ear: "round", tail: "short", cols: ["#6b4a30", "#4a3426"], snout: 0.9, girth: 1.35 },
  polar: { len: 1.25, leg: 0.6, neck: 0.15, ear: "round", tail: "short", cols: ["#f6f4ee"], snout: 1, girth: 1.3 },
  panda: { len: 1.1, leg: 0.55, neck: 0.1, ear: "round", tail: "short", cols: ["#f6f4ee"], panda: 1, snout: 0.6, girth: 1.35 },
  koala: { len: 0.8, leg: 0.5, neck: 0.1, ear: "big", tail: "short", cols: ["#9a9ca3"], snout: 0.4, girth: 1.3 },
  lion: { len: 1.15, leg: 0.8, neck: 0.2, ear: "round", tail: "tuft", mane: 2, cols: ["#d9a650"], maneCol: "#9a5a2a", snout: 0.9 },
  tiger: { len: 1.2, leg: 0.75, neck: 0.15, ear: "round", tail: "long", stripes: 1, cols: ["#e98a3a"], snout: 0.9 },
  cheetah: { len: 1.15, leg: 0.9, neck: 0.2, ear: "round", tail: "long", spots: "#3a3330", cols: ["#e3b45a"], snout: 0.8 },
  zebra: { len: 1.2, leg: 1.1, neck: 0.85, ear: "point", tail: "hair", mane: 1, stripes: 2, cols: ["#f6f4ee"], maneCol: "#2b2622", snout: 1.3, headTilt: 0.5 },
  giraffe: { len: 1.1, leg: 1.6, neck: 2.6, ear: "point", tail: "tuft", ossicone: 1, cols: ["#e3b45a"], spots: "#9a5a2a", snout: 1.2, headTilt: 0.2 },
  elephant: { len: 1.35, leg: 0.95, neck: 0.05, ear: "fan", tail: "rope", trunk: 1, cols: ["#9a9ca3", "#8f8796"], snout: 0, girth: 1.55 },
  hippo: { len: 1.3, leg: 0.4, neck: 0.05, ear: "round", tail: "short", cols: ["#8f8796", "#7a6f86"], snout: 1.1, flatSnout: 1, girth: 1.45 },
  rabbit: { len: 0.7, leg: 0.38, neck: 0.15, ear: "long", tail: "puff", cols: ["#c9b8a6", "#f4f0e6", "#8a7a6a"], snout: 0.4 },
  mouse: { len: 0.55, leg: 0.25, neck: 0.05, ear: "big", tail: "thin", cols: ["#9a9ca3", "#c9b8a6"], snout: 0.8 },
  raccoon: { len: 0.85, leg: 0.45, neck: 0.1, ear: "point", tail: "ring", mask: 1, cols: ["#8c8f96"], snout: 0.9 },
  squirrel: { len: 0.6, leg: 0.4, neck: 0.1, ear: "point", tail: "huge", cols: ["#b0683a", "#8a5a3c"], snout: 0.6 },
  dino: { len: 1.45, leg: 0.95, neck: 1.1, ear: "none", tail: "dino", spikes: 1, cols: ["#6f9a4a", "#4f8a6a", "#8aa05a"], snout: 0.9, headTilt: 0.3 },
  dragon: { len: 1.4, leg: 0.9, neck: 1.1, ear: "horn", tail: "dino", spikes: 1, wings: 1, cols: ["#b8372d", "#3f7a4a", "#5a4a8a"], snout: 1.1, headTilt: 0.3 },
  camel: { len: 1.15, leg: 1.2, neck: 0.95, ear: "side", tail: "rope", hump: 1, cols: ["#c9a77c"], snout: 1.2, headTilt: 0.4 },
  monkey: { len: 0.75, leg: 0.75, neck: 0.15, ear: "big", tail: "monkey", cols: ["#8a5a3c", "#6b4a30"], face: "#e3c9a6", snout: 0.5 },
};

function mQuad(x, gy, s, t, f) {
  let kind = t.o.kind;
  if (kind === "pet") kind = ["dog", "cat", "rabbit"][SC.hash % 3];
  const q = QUAD[kind] || QUAD.dog;
  const u = 58 * s;
  const len = q.len;
  const girth = q.girth || 1;
  const rx = 0.95 * u * len;
  const ry = 0.42 * u * girth;
  const legH = q.leg * u;
  const by = gy - legH - ry * 0.55;
  const col = t.color && t.color !== "rainbow" ? t.color : t.o.col || pickc(q.cols);
  const c2 = darker(col, 0.25);
  const legW = 0.105 * u * Math.max(0.8, girth * 0.85);
  // jointed leg: thigh → knee → paw, so legs don't read as posts
  const leg = (x0, y0, x1, y1, c, a, back) => {
    const kx = x0 + (x1 - x0) * 0.5 - (back ? -1 : 1) * f * legW * 0.6;
    const ky = y0 + (y1 - y0) * 0.55;
    limb(x0, y0, kx, ky, legW * 1.35, legW * 0.85, c, a);
    limb(kx, ky, x1, y1, legW * 0.85, legW * 0.7, c, a);
  };

  // wings behind
  if (q.wings || t.act === "fly") {
    const wc = q.wings ? (kind === "dragon" ? darker(col, 0.15) : "#e8e4f4") : "#eef2f8";
    const wx = x - f * rx * 0.1;
    const wy = by - ry * 0.6;
    shape([[wx, wy], [wx - f * u * 0.7, wy - u * 1.3], [wx + f * u * 0.4, wy - u * 1.05], [wx + f * u * 0.35, wy - u * 0.2]], wc, 110, 0.1, true);
    outline([[wx, wy], [wx - f * u * 0.7, wy - u * 1.3], [wx + f * u * 0.4, wy - u * 1.05]], INK, 0.5);
  }
  // tail
  const tx = x - f * rx * 0.92;
  const ty = by - ry * 0.25;
  const tailCol = q.maneCol && q.maneCol !== "rainbow" ? q.maneCol : col;
  if (q.tail === "bushy" || q.tail === "huge") {
    const big = q.tail === "huge" ? 1.6 : 1;
    oval(tx - f * u * 0.35 * big, ty - u * 0.15 * big, u * 0.45 * big, u * 0.2 * big * (big > 1 ? 1.6 : 1), col, 130, f * -0.5, true);
    if (q.tail === "bushy") oval(tx - f * u * 0.65, ty - u * 0.28, u * 0.12, u * 0.1, "#f4ead0", 160);
  } else if (q.tail === "dino") {
    shape([[tx + f * u * 0.2, ty - ry * 0.4], [tx - f * u * 1.2, ty + u * 0.25], [tx + f * u * 0.1, ty + ry * 0.6]], col, 130, 0.1, true);
  } else if (q.tail === "hair") {
    const tc = q.maneCol === "rainbow" ? "#c3a3d6" : tailCol;
    shape([[tx, ty - 4], [tx - f * u * 0.35, ty + u * 0.2], [tx - f * u * 0.25, ty + u * 0.8], [tx - f * u * 0.05, ty + u * 0.35]], darker(tc, 0.1), 140, 0.1, true);
  } else if (q.tail === "puff") {
    oval(tx, ty, u * 0.14, u * 0.13, "#fbf8f0", 170, 0, true);
  } else if (q.tail === "curl") {
    sp([[tx, ty], [tx - f * u * 0.35, ty - u * 0.1], [tx - f * u * 0.45, ty - u * 0.55], [tx - f * u * 0.25, ty - u * 0.75]], darker(col, 0.15), 2.2, "2B");
  } else if (q.tail === "monkey") {
    sp([[tx, ty], [tx - f * u * 0.5, ty + u * 0.1], [tx - f * u * 0.75, ty - u * 0.5], [tx - f * u * 0.5, ty - u * 0.8], [tx - f * u * 0.35, ty - u * 0.6]], darker(col, 0.1), 2.6, "2B");
  } else if (q.tail === "ring") {
    limb(tx, ty, tx - f * u * 0.7, ty - u * 0.3, u * 0.12, u * 0.1, col);
    for (let i = 1; i < 4; i++) ln(tx - f * u * 0.18 * i, ty - u * 0.08 * i - u * 0.1, tx - f * u * 0.18 * i, ty - u * 0.08 * i + u * 0.1, INK, 1.4, "2B");
  } else if (q.tail === "thin") {
    sp([[tx, ty], [tx - f * u * 0.5, ty + u * 0.15], [tx - f * u * 0.75, ty - u * 0.1]], "#c99a9a", 1.2);
  } else if (q.tail !== "short") {
    sp([[tx, ty], [tx - f * u * 0.3, ty - (q.tail === "up" ? u * 0.4 : -u * 0.1)], [tx - f * u * 0.45, ty - (q.tail === "up" ? u * 0.65 : -u * 0.35)]], darker(col, 0.1), 2.4, "2B");
    if (q.tail === "tuft") oval(tx - f * u * 0.45, ty + u * 0.35, u * 0.07, u * 0.09, darker(col, 0.4), 180);
  }
  // far legs
  const legCol = q.panda ? "#2b2622" : c2;
  for (const lx of [-0.62, 0.5]) leg(x + f * lx * rx + f * 9 * s, by + ry * 0.2, x + f * lx * rx + f * 12 * s, gy - 3, legCol, 140, lx < 0);
  // body
  const body = ellP(x, by, rx, ry, 0, 24, 0.03);
  if (q.wool) {
    shape(body, col, 60, 0.1, true);
    for (let i = 0; i < 9; i++) oval(x + random(-rx * 0.8, rx * 0.8), by + random(-ry * 0.7, ry * 0.5), u * 0.24, u * 0.2, "#f8f5ee", 130);
  } else {
    shape(body, col, 135, 0.1, true);
    if (q.belly) oval(x + f * rx * 0.1, by + ry * 0.4, rx * 0.6, ry * 0.4, q.belly, 150);
    oval(x - f * rx * 0.1, by - ry * 0.35, rx * 0.75, ry * 0.4, lighter(col, 0.3), 60);
  }
  if (q.hump) oval(x - f * rx * 0.1, by - ry * 0.9, rx * 0.45, ry * 0.65, col, 140, 0, true);
  if (q.spikes) {
    for (let i = 0; i < 6; i++) {
      const sx = x - f * rx * 0.8 + f * i * rx * 0.3;
      const sy = by - ry * (0.8 + 0.25 * Math.sin((i / 5) * Math.PI));
      solid(triP(sx - u * 0.1, sy + 4, sx, sy - u * 0.22, sx + u * 0.1, sy + 4), darker(col, 0.25), 200);
    }
  }
  if (q.spots) for (let i = 0; i < 7; i++) oval(x + random(-rx * 0.75, rx * 0.75), by + random(-ry * 0.6, ry * 0.5), u * random(0.08, 0.16), u * random(0.06, 0.12), q.spots, 170);
  if (q.spotsWhite) for (let i = 0; i < 6; i++) pip(x + random(-rx * 0.6, rx * 0.4), by + random(-ry * 0.6, 0), u * 0.04, "#fbf8f0", 200);
  if (q.stripes) {
    for (let i = 0; i < 7; i++) {
      const sx = x - rx * 0.75 + (i / 6) * rx * 1.5;
      sp([[sx, by - ry * 0.95], [sx + random(-6, 6), by - ry * 0.2], [sx + random(-5, 5), by + ry * 0.5]], q.stripes === 2 ? "#1c1d22" : "#3a2418", 2.6, "2B");
    }
  }
  if (q.panda) oval(x - f * rx * 0.05, by - ry * 0.1, rx * 0.35, ry * 1.02, "#2b2622", 190);
  outline(body, INK, 0.6);
  // near legs
  for (const lx of [-0.5, 0.62]) {
    const lx0 = x + f * lx * rx;
    const lift = t.act === "run" ? random(-0.35, 0.35) * u : 0;
    leg(lx0, by + ry * 0.2, lx0 + lift, gy, q.panda ? "#2b2622" : col, 145, lx < 0);
    oval(lx0 + lift + f * legW * 0.4, gy - legW * 0.35, legW * 1.05, legW * 0.5, darker(col, 0.3), 160);
  }
  // neck + head
  const tilt = q.headTilt || 0;
  const hx = x + f * (rx * 0.95 + 0.18 * u + q.neck * u * 0.35);
  const hy = by - ry * 0.45 - q.neck * u * 0.9;
  const hr = 0.34 * u * (q.ear === "fan" ? 1.15 : 1) * (girth > 1.3 ? 1.1 : 1);
  if (q.neck > 0.12) limb(x + f * rx * 0.62, by - ry * 0.25, hx - f * hr * 0.2, hy + hr * 0.3, u * 0.26 * Math.min(1, girth), u * 0.16, col, 140);
  if (q.mane === 1) {
    const mc = q.maneCol === "rainbow" ? null : q.maneCol || darker(col, 0.35);
    for (let i = 0; i < 5; i++) {
      const tt = i / 4;
      const mx = x + f * rx * 0.55 + (hx - f * hr * 0.3 - (x + f * rx * 0.55)) * tt;
      const my = by - ry * 0.8 + (hy - hr * 0.6 - (by - ry * 0.8)) * tt;
      oval(mx - f * u * 0.08, my, u * 0.13, u * 0.2, mc || ["#e59bb3", "#f3d660", "#8fd6c0", "#8f9be0", "#c3a3d6"][i], 150, f * 0.6);
    }
  }
  if (q.mane === 2) oval(hx - f * hr * 0.15, hy, hr * 1.75, hr * 1.7, q.maneCol, 150, 0, true);
  // ears behind head
  const earCol = q.panda ? "#2b2622" : q.headCol || col;
  if (q.ear === "point") {
    for (const e of [-0.55, 0.15]) solid(triP(hx + f * hr * e - hr * 0.28, hy - hr * 0.55, hx + f * hr * e, hy - hr * 1.45, hx + f * hr * e + hr * 0.28, hy - hr * 0.55), darker(earCol, 0.1), 215);
  } else if (q.ear === "round" || q.ear === "big") {
    const er = q.ear === "big" ? hr * 0.55 : hr * 0.32;
    for (const e of [-0.6, 0.45]) oval(hx + f * hr * e, hy - hr * 0.8, er, er, darker(earCol, 0.12), 170, 0, true);
    if (q.ear === "big") for (const e of [-0.6, 0.45]) oval(hx + f * hr * e, hy - hr * 0.8, er * 0.55, er * 0.55, "#efb8c0", 120);
  } else if (q.ear === "long") {
    for (const e of [-0.4, 0.15]) oval(hx + f * hr * e, hy - hr * 1.5, hr * 0.22, hr * 0.85, earCol, 160, f * (e < 0 ? -0.25 : 0.1), true);
    for (const e of [-0.4, 0.15]) oval(hx + f * hr * e, hy - hr * 1.45, hr * 0.1, hr * 0.6, "#efb8c0", 120, f * (e < 0 ? -0.25 : 0.1));
  } else if (q.ear === "fan") {
    oval(hx - f * hr * 0.65, hy + hr * 0.1, hr * 0.85, hr * 1.05, darker(col, 0.12), 150, 0, true);
  } else if (q.ear === "horn") {
    for (const e of [-0.5, 0.1]) solid(triP(hx + f * hr * e - 4, hy - hr * 0.6, hx + f * hr * (e - 0.5), hy - hr * 1.5, hx + f * hr * e + 6, hy - hr * 0.6), "#e8d6b8", 220);
  }
  // head
  const hcol = q.headCol || col;
  const head = ellP(hx, hy, hr * 1.05, hr * 0.92, f * tilt * 0.3);
  shape(head, hcol, 145, 0.1, true);
  if (q.mane === 2) outline(head, INK, 0.5);
  // snout
  const sx = hx + f * hr * (0.75 + q.snout * 0.35);
  const sy = hy + hr * (0.25 + tilt * 0.35);
  if (q.trunk) {
    limb(hx + f * hr * 0.7, hy + hr * 0.1, hx + f * hr * 1.3, hy + hr * 1.3, hr * 0.28, hr * 0.18, hcol, 150);
    limb(hx + f * hr * 1.3, hy + hr * 1.3, hx + f * hr * 1.55, hy + hr * 1.9, hr * 0.18, hr * 0.14, hcol, 150);
    solid(triP(hx + f * hr * 0.8, hy + hr * 0.6, hx + f * hr * 1.3, hy + hr * 0.9, hx + f * hr * 0.85, hy + hr * 0.75), "#f6f0dc", 230);
  } else if (q.snout > 0) {
    const sr = hr * (0.3 + q.snout * 0.18);
    oval(sx - f * sr * 0.2, sy, sr, sr * 0.75, q.snoutCol || (q.flatSnout ? lighter(hcol, 0.15) : lighter(hcol, 0.2)), 160, 0, true);
    if (q.flatSnout) {
      pip(sx - f * sr * 0.05, sy - 2, sr * 0.14, darker(hcol, 0.5));
      pip(sx + f * sr * 0.35, sy - 2, sr * 0.14, darker(hcol, 0.5));
    } else pip(sx + f * sr * 0.6, sy - sr * 0.25, Math.max(2.5, sr * 0.22), INK);
    if (!q.flatSnout) sp([[sx + f * sr * 0.55, sy + sr * 0.15], [sx + f * sr * 0.1, sy + sr * 0.45], [sx - f * sr * 0.3, sy + sr * 0.3]], INK, 0.8);
  }
  if (q.face) oval(hx + f * hr * 0.25, hy + hr * 0.1, hr * 0.62, hr * 0.6, q.face, 160);
  if (q.mask) oval(hx + f * hr * 0.3, hy - hr * 0.1, hr * 0.7, hr * 0.25, "#2b2622", 170);
  if (q.panda) {
    oval(hx + f * hr * 0.15, hy - hr * 0.1, hr * 0.22, hr * 0.28, "#2b2622", 210, f * 0.4);
    oval(hx + f * hr * 0.65, hy - hr * 0.1, hr * 0.2, hr * 0.26, "#2b2622", 210, -f * 0.4);
  }
  if (q.ear === "flop") {
    oval(hx - f * hr * 0.55, hy + hr * 0.05, hr * 0.32, hr * 0.7, darker(col, 0.3), 170, f * 0.35, true);
  } else if (q.ear === "side") {
    oval(hx - f * hr * 0.55, hy - hr * 0.35, hr * 0.42, hr * 0.17, darker(earCol, 0.1), 175, f * -0.35, true);
  }
  if (q.horns === 1) for (const e of [-0.45, 0.25]) sp([[hx + f * hr * e, hy - hr * 0.7], [hx + f * hr * (e - 0.2), hy - hr * 1.15], [hx + f * hr * (e + 0.05), hy - hr * 1.35]], "#c9b8a6", 2.6, "2B");
  if (q.horns === 2) for (const e of [-0.4, 0.15]) sp([[hx + f * hr * e, hy - hr * 0.7], [hx - f * hr * (0.3 - e), hy - hr * 1.4], [hx - f * hr * (0.8 - e), hy - hr * 1.2]], "#8a7a6a", 2.4, "2B");
  if (q.beard) solid(triP(sx - f * hr * 0.35, sy + hr * 0.25, sx - f * hr * 0.15, sy + hr * 0.95, sx - f * hr * 0.05, sy + hr * 0.25), "#c9b8a6", 220);
  if (q.antler) {
    for (const e of [-0.45, 0.2]) {
      const ax = hx + f * hr * e;
      const ay = hy - hr * 0.7;
      sp([[ax, ay], [ax - f * hr * 0.25, ay - hr * 0.9], [ax - f * hr * 0.1, ay - hr * 1.7]], "#6b4a30", 2, "2B");
      ln(ax - f * hr * 0.2, ay - hr * 0.7, ax + f * hr * 0.25, ay - hr * 1.1, "#6b4a30", 1.6, "2B");
      ln(ax - f * hr * 0.15, ay - hr * 1.2, ax - f * hr * 0.55, ay - hr * 1.55, "#6b4a30", 1.6, "2B");
    }
  }
  if (q.ossicone) for (const e of [-0.3, 0.1]) {
    ln(hx + f * hr * e, hy - hr * 0.7, hx + f * hr * e, hy - hr * 1.3, "#6b4a30", 2.2, "2B");
    pip(hx + f * hr * e, hy - hr * 1.32, 4 * s, "#6b4a30");
  }
  if (q.horn) solid(triP(hx + f * hr * 0.15, hy - hr * 0.75, hx + f * hr * 0.6, hy - hr * 2.1, hx + f * hr * 0.5, hy - hr * 0.7), "#e1b83f", 230);
  // eye
  const ex = hx + f * hr * 0.32;
  const ey = hy - hr * 0.2;
  if (t.act === "sleep") sp([[ex - hr * 0.15, ey], [ex, ey + hr * 0.08], [ex + hr * 0.15, ey]], INK, 1);
  else eye(ex, ey, Math.max(2.4, hr * 0.13), q.panda ? "#fbf8f0" : INK);
  if (q.whisk) for (const d of [-1, 1]) ln(sx + f * hr * 0.1, sy + d * 2, sx + f * hr * 0.75, sy + d * hr * 0.25, INK, 0.5);
  outline(head, INK, 0.5);
  return { head: [sx + f * hr * 0.5, sy + hr * 0.2], top: Math.min(hy - hr * 1.6, by - ry), hand: [sx + f * hr * 0.45, sy + hr * 0.35], w: rx * 2 + hr * 2, seat: [x - f * rx * 0.05, by - ry * 0.75] };
}

/* ---------------- birds ---------------- */

function mBird(x, gy, s, t, f) {
  const kind = t.o.kind;
  const u = 50 * s;
  const fly = t.flying;
  const pal = {
    bird: ["#3a6cb8", "#c13b4a", "#e1b83f", "#8a5a3c", "#5d8a4a"], crow: ["#25262b"], owl: ["#8a6a4a", "#a8845a"],
    duck: ["#fbf8f0", "#8a6a4a"], swan: ["#fbf8f0"], chicken: ["#fbf8f0", "#c98a4a"], eagle: ["#6b4a30"],
    parrot: ["#c8372d", "#2f8f68", "#3a6cb8"], penguin: ["#25262b"], flamingo: ["#f19cc4"], peacock: ["#2a4fa8"],
    gull: ["#f6f4ee", "#c2c6cf"], phoenix: ["#e0512b"], bat: ["#2b2633"],
  };
  const col = t.color && t.color !== "rainbow" ? t.color : t.o.col || pickc(pal[kind] || pal.bird);
  const beak = kind === "duck" || kind === "penguin" || kind === "flamingo" || kind === "swan" ? "#f08a2c" : kind === "eagle" || kind === "chicken" ? "#e1b83f" : "#3a3330";

  if (kind === "owl") {
    const cy = gy - u * 0.95;
    const body = ellP(x, cy, u * 0.62, u * 0.85);
    shape(body, col, 140, 0.1, true);
    oval(x, cy + u * 0.25, u * 0.4, u * 0.5, "#e8d6b8", 140);
    for (const e of [-1, 1]) solid(triP(x + e * u * 0.25, cy - u * 0.65, x + e * u * 0.55, cy - u * 1.15, x + e * u * 0.55, cy - u * 0.55), darker(col, 0.2), 220);
    for (const e of [-1, 1]) {
      oval(x + e * u * 0.25, cy - u * 0.35, u * 0.22, u * 0.22, "#f6f0dc", 200, 0, true);
      pip(x + e * u * 0.25, cy - u * 0.35, u * 0.12, t.act === "sleep" ? "#8a6a4a" : INK);
    }
    solid(triP(x - u * 0.07, cy - u * 0.15, x + u * 0.07, cy - u * 0.15, x, cy + u * 0.02), "#e1b83f");
    for (let i = 0; i < 4; i++) sp([[x - u * 0.2 + i * u * 0.13, cy + u * 0.1], [x - u * 0.15 + i * u * 0.13, cy + u * 0.18]], darker(col, 0.3), 0.8);
    outline(body, INK, 0.6);
    ln(x - u * 0.15, gy, x - u * 0.15, cy + u * 0.8, "#e1b83f", 1.4);
    ln(x + u * 0.15, gy, x + u * 0.15, cy + u * 0.8, "#e1b83f", 1.4);
    return { head: [x, cy - u * 0.1], top: cy - u * 1.2, hand: [x + f * u * 0.5, cy], w: u * 1.3 };
  }
  if (kind === "penguin") {
    const cy = gy - u * 0.95;
    const body = ellP(x, cy, u * 0.5, u * 0.95);
    shape(body, col, 170, 0.1, true);
    oval(x + f * u * 0.08, cy + u * 0.15, u * 0.33, u * 0.7, "#fbf8f0", 200, 0, true);
    eye(x + f * u * 0.18, cy - u * 0.55, u * 0.06);
    solid(triP(x + f * u * 0.35, cy - u * 0.5, x + f * u * 0.7, cy - u * 0.42, x + f * u * 0.35, cy - u * 0.36), beak);
    oval(x - u * 0.2, gy - 3, u * 0.18, u * 0.07, "#f08a2c", 200);
    oval(x + u * 0.2, gy - 3, u * 0.18, u * 0.07, "#f08a2c", 200);
    oval(x - f * u * 0.45, cy, u * 0.12, u * 0.45, darker(col, 0.1), 170, -f * 0.3);
    outline(body, INK, 0.6);
    return { head: [x + f * u * 0.6, cy - u * 0.4], top: cy - u, hand: [x + f * u * 0.55, cy], w: u * 1.1 };
  }
  if (kind === "flamingo" && !fly) {
    const by = gy - u * 1.7;
    ln(x, gy, x + u * 0.05, by + u * 0.2, "#e07a9a", 1.6);
    sp([[x - u * 0.1, gy - u * 0.9], [x + u * 0.2, gy - u * 1.1], [x + u * 0.05, by + u * 0.2]], "#e07a9a", 1.6);
    const body = ellP(x, by, u * 0.55, u * 0.32, f * -0.2);
    shape(body, col, 150, 0.1, true);
    sp([[x + f * u * 0.4, by - u * 0.1], [x + f * u * 0.7, by - u * 0.6], [x + f * u * 0.4, by - u * 1.0], [x + f * u * 0.55, by - u * 1.35]], col, 4.5, "marker");
    oval(x + f * u * 0.6, by - u * 1.4, u * 0.15, u * 0.13, col, 170, 0, true);
    solid(triP(x + f * u * 0.7, by - u * 1.45, x + f * u * 0.95, by - u * 1.3, x + f * u * 0.72, by - u * 1.32), "#2b2622");
    pip(x + f * u * 0.62, by - u * 1.43, 2.4, INK);
    outline(body, INK, 0.5);
    return { head: [x + f * u * 0.85, by - u * 1.35], top: by - u * 1.6, hand: [x + f * u * 0.6, by], w: u * 1.4 };
  }
  // generic: perched / swimming / flying
  const swim = kind === "duck" || kind === "swan";
  const cy = fly ? gy : swim ? gy - u * 0.25 : gy - u * 0.75;
  const bodyRx = u * (kind === "eagle" ? 0.62 : kind === "chicken" ? 0.5 : 0.55);
  const bodyRy = u * (kind === "chicken" ? 0.45 : 0.33);
  if (kind === "peacock") {
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.28 - f * 0.25;
      const px = x - f * u * 0.2 + Math.cos(a) * u * 1.1;
      const py = cy + Math.sin(a) * u * 1.2;
      oval(px, py, u * 0.28, u * 0.38, i % 2 ? "#2f8a8a" : "#3e9e7a", 120, a + Math.PI / 2, true);
      pip(px, py, u * 0.09, "#25438f");
      pip(px, py, u * 0.04, "#e1b83f");
    }
  }
  // wings
  if (fly || kind === "bat") {
    const wc = kind === "bat" ? col : darker(col, 0.12);
    const wy = cy - bodyRy * 0.2;
    for (const side of [-1, 1]) {
      const pts = kind === "bat"
        ? [[x, wy], [x + side * u * 0.5, wy - u * 0.6], [x + side * u * 1.3, wy - u * 0.4], [x + side * u * 1.0, wy - u * 0.1], [x + side * u * 0.75, wy + u * 0.05], [x + side * u * 0.5, wy - u * 0.05], [x + side * u * 0.25, wy + u * 0.1]]
        : [[x - side * u * 0.05, wy], [x + side * u * 0.45, wy - u * 0.75], [x + side * u * 1.25, wy - u * 0.85], [x + side * u * 0.7, wy - u * 0.25], [x + side * u * 0.3, wy + u * 0.1]];
      shape(pts, wc, 145, 0.1, true);
      outline(pts, INK, 0.45);
    }
  }
  // tail
  const tx = x - f * bodyRx * 0.85;
  if (kind !== "bat") {
    const tailPts = kind === "chicken"
      ? [[tx, cy - u * 0.05], [tx - f * u * 0.35, cy - u * 0.7], [tx - f * u * 0.05, cy - u * 0.5], [tx + f * u * 0.1, cy - u * 0.1]]
      : [[tx + f * u * 0.1, cy - u * 0.08], [tx - f * u * 0.55, cy - u * (swim ? 0.25 : -0.1)], [tx - f * u * 0.5, cy + u * (swim ? -0.05 : 0.25)], [tx + f * u * 0.1, cy + u * 0.1]];
    shape(tailPts, kind === "chicken" ? "#3a3330" : kind === "phoenix" ? "#f3d660" : kind === "parrot" ? "#3a6cb8" : darker(col, 0.2), 150, 0.1, true);
  }
  const body = ellP(x, cy, bodyRx, bodyRy, f * (swim ? 0 : -0.15));
  shape(body, col, 150, 0.1, true);
  if (kind === "bird" && !t.color) oval(x + f * bodyRx * 0.25, cy + bodyRy * 0.3, bodyRx * 0.5, bodyRy * 0.55, "#f4ead0", 140);
  if (!fly && kind !== "bat") oval(x - f * bodyRx * 0.15, cy - bodyRy * 0.05, bodyRx * 0.6, bodyRy * 0.55, darker(col, 0.18), 140, f * -0.2);
  outline(body, INK, 0.55);
  // head + neck
  const neckUp = kind === "swan" ? u * 0.95 : 0;
  const hx = x + f * bodyRx * (swim ? 0.75 : 0.85);
  const hy = cy - bodyRy * 0.75 - neckUp;
  if (kind === "swan") sp([[x + f * bodyRx * 0.6, cy - bodyRy * 0.3], [x + f * bodyRx * 1.15, cy - u * 0.5], [x + f * bodyRx * 0.7, cy - u * 0.9], [hx, hy]], col, 5, "marker");
  const hr = u * (kind === "eagle" ? 0.25 : kind === "bat" ? 0.22 : 0.24);
  const head = ellP(hx, hy, hr, hr * 0.92);
  shape(head, kind === "eagle" ? "#f6f4ee" : kind === "duck" && col === "#8a6a4a" ? "#2f8f68" : col, 165, 0.1, true);
  if (kind === "bat") {
    for (const e of [-0.6, 0.6]) solid(triP(hx + e * hr - 4, hy - hr * 0.5, hx + e * hr * 1.1, hy - hr * 1.5, hx + e * hr + 4, hy - hr * 0.5), col, 230);
  }
  if (kind === "chicken") {
    for (let i = 0; i < 3; i++) pip(hx - f * hr * 0.3 + f * i * hr * 0.3, hy - hr * 0.95, hr * 0.22, "#c8372d");
    oval(hx + f * hr * 0.6, hy + hr * 0.6, hr * 0.15, hr * 0.25, "#c8372d", 200);
  }
  const bk = kind === "duck" || kind === "swan"
    ? [[hx + f * hr * 0.7, hy - hr * 0.15], [hx + f * hr * 1.65, hy + hr * 0.05], [hx + f * hr * 0.7, hy + hr * 0.35]]
    : kind === "parrot" || kind === "eagle"
      ? [[hx + f * hr * 0.7, hy - hr * 0.35], [hx + f * hr * 1.5, hy + hr * 0.2], [hx + f * hr * 0.75, hy + hr * 0.45]]
      : [[hx + f * hr * 0.8, hy - hr * 0.2], [hx + f * hr * 1.6, hy + hr * 0.08], [hx + f * hr * 0.8, hy + hr * 0.3]];
  solid(bk, beak, 235);
  if (t.act === "sleep") sp([[hx + f * hr * 0.1, hy - hr * 0.1], [hx + f * hr * 0.3, hy], [hx + f * hr * 0.5, hy - hr * 0.1]], INK, 0.9);
  else eye(hx + f * hr * 0.3, hy - hr * 0.15, Math.max(2.2, hr * 0.2), kind === "bat" ? "#f3d660" : INK);
  outline(head, INK, 0.45);
  if (!fly && !swim && kind !== "bat") {
    const lc = kind === "eagle" || kind === "chicken" ? "#e1b83f" : "#6b4a30";
    ln(x - u * 0.08, cy + bodyRy * 0.8, x - u * 0.12, gy, lc, 1.3);
    ln(x + u * 0.12, cy + bodyRy * 0.8, x + u * 0.1, gy, lc, 1.3);
    ln(x - u * 0.12, gy, x - u * 0.12 + f * u * 0.15, gy, lc, 1.1);
    ln(x + u * 0.1, gy, x + u * 0.1 + f * u * 0.15, gy, lc, 1.1);
  }
  if (kind === "phoenix") for (let i = 0; i < 4; i++) oval(tx - f * u * (0.5 + i * 0.25), cy + random(-12, 12), u * 0.25, u * 0.08, ["#f3d660", "#f08a2c", "#e0512b"][i % 3], 120, f * 0.2);
  return { head: [hx + f * hr * 1.5, hy + hr * 0.1], top: hy - hr - (fly ? u * 0.85 : 0), hand: [hx + f * hr * 1.4, hy + hr * 0.2], w: bodyRx * 2 + hr * 3 };
}

/* ---------------- water creatures ---------------- */

function mFish(x, cy, s, t, f) {
  const kind = t.o.kind;
  const u = 50 * s;
  const pal = { fish: ["#f08a2c", "#e1b83f", "#3fbfb7", "#e57a9a", "#7d5ab0"], whale: ["#33507a", "#2c3e5c"], shark: ["#8c96a3"], dolphin: ["#8fa3b8"], octopus: ["#d96a6a", "#b85aa0", "#e98a3a"], jelly: ["#c3a3d6", "#f2b5c4", "#8fd6c0"] };
  const col = t.color && t.color !== "rainbow" ? t.color : t.o.col || pickc(pal[kind] || pal.fish);
  if (kind === "octopus") {
    for (let i = 0; i < 6; i++) {
      const bx = x + (i - 2.5) * u * 0.22;
      const pts = [[bx, cy + u * 0.3]];
      for (let k = 1; k <= 4; k++) pts.push([bx + Math.sin(k * 1.4 + i) * u * 0.25 + (i - 2.5) * u * 0.12 * k, cy + u * 0.3 + k * u * 0.28]);
      for (let k = 0; k < 4; k++) limb(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], u * (0.13 - k * 0.025), u * (0.105 - k * 0.025), k % 2 ? col : darker(col, 0.08), 160);
      for (let k = 1; k < 4; k++) pip(pts[k][0], pts[k][1] + 2, u * 0.03, lighter(col, 0.5), 200);
    }
    const head = ellP(x, cy - u * 0.1, u * 0.6, u * 0.62);
    shape(head, col, 160, 0.1, true);
    eye(x - u * 0.2, cy, u * 0.09);
    eye(x + u * 0.2, cy, u * 0.09);
    outline(head, INK, 0.5);
    return { head: [x, cy + u * 0.2], top: cy - u * 0.75, hand: [x + u * 0.6, cy + u * 0.8], w: u * 1.5 };
  }
  if (kind === "jelly") {
    for (let i = 0; i < 5; i++) {
      const bx = x + (i - 2) * u * 0.18;
      sp([[bx, cy], [bx + 8, cy + u * 0.5], [bx - 6, cy + u * 0.9], [bx + 6, cy + u * 1.3]], col, 1.2);
    }
    const dome = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      dome.push([x + Math.cos(a) * u * 0.6, cy + Math.sin(a) * u * 0.55]);
    }
    shape(dome, col, 140, 0.18, true);
    oval(x, cy - u * 0.25, u * 0.25, u * 0.15, lighter(col, 0.5), 120);
    return { head: [x, cy], top: cy - u * 0.6, hand: [x + u * 0.5, cy], w: u * 1.3 };
  }
  const big = kind === "whale" ? 2.1 : kind === "shark" ? 1.5 : kind === "dolphin" ? 1.3 : 1;
  const rx = u * 0.7 * big;
  const ry = u * (kind === "whale" ? 0.32 : 0.3) * big * (kind === "fish" ? 1.3 : 1);
  // tail
  const tx = x - f * rx * 0.9;
  const tail = kind === "whale" || kind === "dolphin"
    ? [[tx + f * 6, cy], [tx - f * u * 0.5 * big, cy - u * 0.45 * big], [tx - f * u * 0.3 * big, cy], [tx - f * u * 0.5 * big, cy + u * 0.25 * big]]
    : [[tx + f * 8, cy], [tx - f * u * 0.55 * big, cy - u * 0.4 * big], [tx - f * u * 0.4 * big, cy], [tx - f * u * 0.55 * big, cy + u * 0.4 * big]];
  shape(tail, darker(col, 0.12), 150, 0.1, true);
  if (kind === "shark" || kind === "dolphin") solid(triP(x - f * rx * 0.2, cy - ry * 0.8, x - f * rx * 0.45, cy - ry * 1.9, x + f * rx * 0.15, cy - ry * 0.8), darker(col, 0.15), 230);
  const body = ellP(x, cy, rx, ry, 0, 24, 0.02);
  shape(body, col, 155, 0.1, true);
  oval(x + f * rx * 0.05, cy + ry * 0.45, rx * 0.8, ry * 0.4, lighter(col, 0.45), 120);
  if (kind === "fish") {
    for (let i = 0; i < 3; i++) sp([[x - f * rx * 0.3 + f * i * rx * 0.25, cy - ry * 0.7], [x - f * rx * 0.15 + f * i * rx * 0.25, cy], [x - f * rx * 0.3 + f * i * rx * 0.25, cy + ry * 0.7]], darker(col, 0.25), 0.8);
    solid(triP(x - f * rx * 0.2, cy - ry * 0.9, x + f * rx * 0.2, cy - ry * 0.95, x - f * rx * 0.1, cy - ry * 1.6), darker(col, 0.1), 200);
  }
  if (kind === "whale") {
    for (let i = 0; i < 4; i++) ln(x + f * rx * 0.2 + f * i * 9, cy + ry * 0.3, x + f * rx * 0.1 + f * i * 9, cy + ry * 0.85, darker(col, 0.2), 0.8);
    for (const d of [-1, 0, 1]) sp([[x + f * rx * 0.3, cy - ry * 1.05], [x + f * rx * 0.3 + d * u * 0.25, cy - ry * 1.05 - u * 0.5], [x + f * rx * 0.3 + d * u * 0.4, cy - ry * 1.05 - u * 0.45]], "#8cc1e6", 1.2);
  }
  eye(x + f * rx * 0.62, cy - ry * 0.2, Math.max(2.4, u * 0.07 * Math.sqrt(big)));
  sp([[x + f * rx * 0.95, cy + ry * 0.15], [x + f * rx * 0.75, cy + ry * 0.3]], INK, 0.8);
  outline(body, INK, 0.55);
  return { head: [x + f * rx * 1.05, cy + ry * 0.1], top: cy - ry * 1.5, hand: [x + f * rx * 1.05, cy + ry * 0.1], w: rx * 2.6 };
}

/* ---------------- bugs + critters ---------------- */

function mBug(x, cy, s, t, f) {
  const kind = t.o.kind;
  const u = 34 * s;
  const col = t.color && t.color !== "rainbow" ? t.color : t.o.col || pickc(kind === "butterfly" ? ["#f08a2c", "#7d5ab0", "#3fbfb7", "#e57a9a", "#f3d660"] : kind === "ladybug" ? ["#c8372d"] : kind === "bee" ? ["#f3c94a"] : kind === "dragonfly" ? ["#3fbfb7"] : ["#3a3330"]);
  if (kind === "butterfly") {
    for (const side of [-1, 1]) {
      oval(x + side * u * 0.62, cy - u * 0.4, u * 0.62, u * 0.5, col, 150, side * 0.5, true);
      oval(x + side * u * 0.45, cy + u * 0.4, u * 0.4, u * 0.35, darker(col, 0.15), 150, -side * 0.4, true);
      pip(x + side * u * 0.75, cy - u * 0.5, u * 0.12, "#fbf8f0", 200);
      pip(x + side * u * 0.45, cy + u * 0.45, u * 0.08, INK, 200);
    }
    limb(x, cy - u * 0.5, x, cy + u * 0.6, u * 0.08, u * 0.06, "#3a3330", 220);
    sp([[x, cy - u * 0.55], [x - u * 0.15, cy - u * 0.95], [x - u * 0.3, cy - u * 1.05]], INK, 0.8);
    sp([[x, cy - u * 0.55], [x + u * 0.15, cy - u * 0.95], [x + u * 0.3, cy - u * 1.05]], INK, 0.8);
    return { head: [x, cy - u * 0.6], top: cy - u * 1.1, hand: [x, cy], w: u * 2.6 };
  }
  if (kind === "bee") {
    for (const side of [-1, 1]) oval(x - f * u * 0.1 + side * u * 0.15, cy - u * 0.55, u * 0.35, u * 0.22, "#e8f1f6", 140, side * 0.6, true);
    const body = ellP(x, cy, u * 0.6, u * 0.42);
    shape(body, col, 170, 0.1, true);
    for (let i = -1; i <= 1; i++) ln(x + i * u * 0.25, cy - u * 0.4, x + i * u * 0.25 + 3, cy + u * 0.4, INK, 2.6, "2B");
    pip(x + f * u * 0.6, cy - u * 0.05, u * 0.24, "#2b2622");
    outline(body, INK, 0.5);
    return { head: [x + f * u * 0.8, cy], top: cy - u * 0.9, hand: [x + f * u * 0.8, cy], w: u * 1.6 };
  }
  if (kind === "ladybug") {
    const body = ellP(x, cy, u * 0.6, u * 0.5);
    shape(body, col, 180, 0.1, true);
    ln(x, cy - u * 0.5, x, cy + u * 0.5, INK, 1.2);
    for (let i = 0; i < 6; i++) pip(x + random(-u * 0.4, u * 0.4), cy + random(-u * 0.3, u * 0.3), u * 0.09, INK);
    pip(x + f * u * 0.62, cy, u * 0.25, "#2b2622");
    outline(body, INK, 0.5);
    return { head: [x + f * u * 0.8, cy], top: cy - u * 0.6, hand: [x + f * u * 0.8, cy], w: u * 1.4 };
  }
  if (kind === "dragonfly") {
    for (const side of [-1, 1]) {
      oval(x - u * 0.2 + side * u * 0.5, cy - u * 0.25, u * 0.55, u * 0.15, "#d8eef4", 120, side * 0.3, true);
      oval(x + u * 0.2 + side * u * 0.45, cy - u * 0.2, u * 0.5, u * 0.14, "#d8eef4", 120, -side * 0.3, true);
    }
    limb(x - f * u * 1.2, cy, x + f * u * 0.3, cy, u * 0.04, u * 0.09, col, 200);
    pip(x + f * u * 0.4, cy, u * 0.13, darker(col, 0.3));
    return { head: [x + f * u * 0.5, cy], top: cy - u * 0.5, hand: [x, cy], w: u * 2.2 };
  }
  // spider / ant
  const n = kind === "spider" ? 4 : 3;
  for (let i = 0; i < n; i++) {
    for (const side of [-1, 1]) {
      const lx = x + (i - (n - 1) / 2) * u * 0.25;
      sp([[lx, cy], [lx + (i - 1) * u * 0.25, cy + side * u * 0.45], [lx + (i - 1) * u * 0.5, cy + side * u * 0.2 + u * 0.4]], INK, 1);
    }
  }
  if (kind === "spider") {
    pip(x - f * u * 0.2, cy, u * 0.45, col);
    pip(x + f * u * 0.35, cy - 2, u * 0.25, col);
    pip(x + f * u * 0.42, cy - 6, 2, "#c8372d");
  } else {
    pip(x - f * u * 0.4, cy, u * 0.25, col);
    pip(x, cy, u * 0.15, col);
    pip(x + f * u * 0.32, cy - 2, u * 0.18, col);
  }
  return { head: [x + f * u * 0.5, cy], top: cy - u * 0.5, hand: [x + f * u * 0.5, cy], w: u * 1.4 };
}

function mCritter(x, gy, s, t, f) {
  const kind = t.o.kind;
  const u = 50 * s;
  const pal = { frog: ["#6fa04a"], turtle: ["#5d8a4a"], crab: ["#d9573a"], snake: ["#6f9a4a", "#c9a03a", "#c8372d"], snail: ["#c98a4a"], lizard: ["#7aa05a", "#4f8a6a"], hedgehog: ["#8a6a4a"] };
  const col = t.color && t.color !== "rainbow" ? t.color : t.o.col || pickc(pal[kind] || ["#6f9a4a"]);
  if (kind === "frog") {
    const cy = gy - u * 0.45;
    for (const e of [-1, 1]) oval(x + e * u * 0.55, gy - u * 0.15, u * 0.35, u * 0.15, darker(col, 0.15), 150, 0, true);
    const body = ellP(x, cy, u * 0.7, u * 0.48);
    shape(body, col, 160, 0.1, true);
    oval(x, cy + u * 0.18, u * 0.45, u * 0.25, "#e3e8b5", 130);
    for (const e of [-1, 1]) {
      oval(x + e * u * 0.35, cy - u * 0.45, u * 0.2, u * 0.2, col, 170, 0, true);
      eye(x + e * u * 0.35, cy - u * 0.47, u * 0.09);
    }
    sp([[x - u * 0.3, cy + u * 0.02], [x, cy + u * 0.14], [x + u * 0.3, cy + u * 0.02]], INK, 0.9);
    outline(body, INK, 0.5);
    return { head: [x + u * 0.1, cy + u * 0.1], top: cy - u * 0.7, hand: [x + f * u * 0.6, cy + u * 0.2], w: u * 1.6 };
  }
  if (kind === "turtle" || kind === "hedgehog") {
    const cy = gy - u * 0.4;
    for (const e of [-0.45, 0.45]) oval(x + e * u, gy - u * 0.1, u * 0.14, u * 0.14, kind === "turtle" ? "#8aa05a" : "#6b4a30", 170);
    oval(x + f * u * 0.75, cy + u * 0.05, u * 0.24, u * 0.2, kind === "turtle" ? "#8aa05a" : "#d9b07a", 170, 0, true);
    eye(x + f * u * 0.85, cy - u * 0.02, u * 0.05);
    const shell = [];
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI + (i / 18) * Math.PI;
      shell.push([x + Math.cos(a) * u * 0.7, cy + u * 0.2 + Math.sin(a) * u * 0.6]);
    }
    shape(shell, col, 160, 0.1, true);
    if (kind === "turtle") {
      for (const [dx, dy] of [[0, -0.15], [-0.35, 0.05], [0.35, 0.05]]) outline(ellP(x + dx * u, cy + dy * u, u * 0.16, u * 0.13, 0, 6, 0), darker(col, 0.4), 0.8);
    } else {
      for (let i = 0; i < 14; i++) {
        const a = Math.PI + 0.2 + (i / 13) * (Math.PI - 0.4);
        ln(x + Math.cos(a) * u * 0.45, cy + u * 0.2 + Math.sin(a) * u * 0.4, x + Math.cos(a) * u * 0.8, cy + u * 0.2 + Math.sin(a) * u * 0.75, "#3a3330", 1);
      }
    }
    outline(shell, INK, 0.5);
    return { head: [x + f * u * 1.0, cy + u * 0.05], top: cy - u * 0.45, hand: [x + f * u * 0.95, cy + u * 0.1], w: u * 1.8 };
  }
  if (kind === "crab") {
    const cy = gy - u * 0.4;
    for (const e of [-1, 1]) for (let i = 0; i < 3; i++) sp([[x + e * u * 0.3, cy + u * 0.1], [x + e * u * (0.6 + i * 0.12), cy + u * 0.1 - i * 4], [x + e * u * (0.7 + i * 0.12), gy]], darker(col, 0.15), 1.4);
    for (const e of [-1, 1]) {
      limb(x + e * u * 0.4, cy - u * 0.1, x + e * u * 0.75, cy - u * 0.55, u * 0.06, u * 0.06, col);
      oval(x + e * u * 0.8, cy - u * 0.7, u * 0.2, u * 0.15, col, 170, e * 0.5, true);
    }
    const body = ellP(x, cy, u * 0.55, u * 0.35);
    shape(body, col, 170, 0.1, true);
    for (const e of [-1, 1]) {
      ln(x + e * u * 0.15, cy - u * 0.3, x + e * u * 0.18, cy - u * 0.55, INK, 1);
      eye(x + e * u * 0.18, cy - u * 0.58, u * 0.06);
    }
    outline(body, INK, 0.5);
    return { head: [x, cy - u * 0.2], top: cy - u * 0.9, hand: [x + f * u * 0.85, cy - u * 0.7], w: u * 2 };
  }
  if (kind === "snail") {
    const cy = gy - u * 0.5;
    limb(x - f * u * 0.6, gy - u * 0.08, x + f * u * 0.75, gy - u * 0.12, u * 0.1, u * 0.14, "#c9b8a6", 160);
    oval(x + f * u * 0.75, gy - u * 0.3, u * 0.14, u * 0.22, "#c9b8a6", 160, 0, true);
    for (const e of [0, 0.15]) {
      ln(x + f * u * (0.72 + e), gy - u * 0.5, x + f * u * (0.8 + e * 2), gy - u * 0.8, INK, 0.8);
      pip(x + f * u * (0.8 + e * 2), gy - u * 0.8, 2.5, INK);
    }
    oval(x - f * u * 0.05, cy, u * 0.5, u * 0.48, col, 160, 0, true);
    const pts = [];
    for (let i = 0; i < 26; i++) {
      const a = i * 0.45;
      const r = u * 0.42 * (1 - i / 28);
      pts.push([x - f * u * 0.05 + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    sp(pts.reverse(), darker(col, 0.4), 1.2);
    return { head: [x + f * u * 0.85, gy - u * 0.3], top: cy - u * 0.5, hand: [x + f * u * 0.9, gy - u * 0.3], w: u * 1.8 };
  }
  // snake / lizard
  const lizard = kind === "lizard";
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const tt = i / n;
    pts.push([x - f * u * 1.2 + f * tt * u * 2.2, gy - u * 0.2 - Math.sin(tt * Math.PI * 2.2 + 0.5) * u * (lizard ? 0.08 : 0.25)]);
  }
  for (let i = 0; i < n; i++) {
    const w0 = u * (lizard ? 0.04 + 0.18 * Math.sin((i / n) * Math.PI * 0.9) : 0.07 + 0.08 * (i / n));
    const w1 = u * (lizard ? 0.04 + 0.18 * Math.sin(((i + 1) / n) * Math.PI * 0.9) : 0.07 + 0.08 * ((i + 1) / n));
    shape(limbP(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w0, w1), col, 150, 0.06, true);
  }
  if (lizard) for (const e of [0.35, 0.65]) {
    const p = pts[Math.round(e * n)];
    ln(p[0], p[1], p[0] - f * u * 0.15, gy, darker(col, 0.2), 2, "2B");
    ln(p[0], p[1], p[0] + f * u * 0.15, gy, darker(col, 0.2), 2, "2B");
  }
  const h = pts[n];
  oval(h[0] + f * u * 0.12, h[1] - u * 0.02, u * 0.22, u * 0.15, col, 170, 0, true);
  eye(h[0] + f * u * 0.15, h[1] - u * 0.08, u * 0.05);
  if (!lizard) {
    ln(h[0] + f * u * 0.32, h[1], h[0] + f * u * 0.5, h[1] + 3, "#c8372d", 1);
    for (let i = 1; i < n; i += 2) pip(pts[i][0], pts[i][1], u * 0.04, darker(col, 0.4));
  }
  return { head: [h[0] + f * u * 0.35, h[1]], top: gy - u * 0.6, hand: [h[0] + f * u * 0.35, h[1]], w: u * 2.6 };
}

/* ---------------- people ---------------- */

const SKIN = ["#f1d0b5", "#e0b08a", "#c68a5e", "#9a6440", "#6e4630", "#f5d9c4"];
const HAIR = ["#2b2622", "#5e3a26", "#8a5a3c", "#c9a03a", "#a8532f", "#1c1d22"];
const CLOTH = ["#3a6cb8", "#c13b4a", "#2f8f68", "#e1b83f", "#7a4a9a", "#e98a3a", "#3fbfb7", "#e57a9a"];

function mPerson(x, gy, s, t, f) {
  const kind = t.o.kind;
  const u = 52 * s;
  const h = (t.name ? strHash(t.name) : Math.floor(random(1e6)));
  let skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >>> 3) % HAIR.length];
  let cloth = t.color && t.color !== "rainbow" ? t.color : CLOTH[(h >>> 5) % CLOTH.length];
  const legs = darker(CLOTH[(h >>> 7) % CLOTH.length], 0.35);

  if (kind === "ghost") {
    const cy = gy - u * 1.6;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI;
      pts.push([x + Math.cos(a) * u * 0.6, cy + Math.sin(a) * u * 0.65]);
    }
    for (let i = 0; i <= 6; i++) pts.push([x + u * 0.6 - (i / 6) * u * 1.2, cy + u * 1.2 + (i % 2 ? -u * 0.18 : 0)]);
    shape(pts, t.color || "#f6f8fb", 200, 0.15, true);
    outline(pts, "#8592a3", 0.6);
    oval(x - u * 0.2, cy - u * 0.05, u * 0.09, u * 0.15, INK, 220);
    oval(x + u * 0.2, cy - u * 0.05, u * 0.09, u * 0.15, INK, 220);
    oval(x, cy + u * 0.3, u * 0.12, u * 0.15, INK, 200);
    return { head: [x, cy + u * 0.3], top: cy - u * 0.7, hand: [x + f * u * 0.65, cy + u * 0.5], w: u * 1.3 };
  }
  if (kind === "snowman") {
    const rs = [0.62, 0.46, 0.34];
    let y = gy;
    const cs = [];
    for (const r of rs) {
      const cy = y - r * u;
      cs.push(cy);
      oval(x, cy, r * u, r * u * 0.95, "#f6f8fb", 220, 0, true);
      outline(ellP(x, cy, r * u, r * u * 0.95), "#8fa3b8", 0.6);
      y = cy - r * u * 0.8;
    }
    eye(x - u * 0.12, cs[2] - u * 0.08, u * 0.05);
    eye(x + u * 0.12, cs[2] - u * 0.08, u * 0.05);
    solid(triP(x, cs[2], x + f * u * 0.4, cs[2] + u * 0.06, x, cs[2] + u * 0.1), "#f08a2c");
    for (const yy of [cs[1] - u * 0.15, cs[1] + u * 0.1]) pip(x, yy, u * 0.05, INK);
    ln(x - u * 0.4, cs[1] - u * 0.1, x - u * 0.95, cs[1] - u * 0.55, "#6b4a30", 1.4, "2B");
    ln(x + u * 0.4, cs[1] - u * 0.1, x + u * 0.95, cs[1] - u * 0.55, "#6b4a30", 1.4, "2B");
    solid(rectP(x - u * 0.38, cs[2] - u * 0.5, u * 0.76, u * 0.1), INK, 230);
    solid(rectP(x - u * 0.24, cs[2] - u * 0.95, u * 0.48, u * 0.47), INK, 230);
    oval(x, cs[1] - u * 0.42, u * 0.38, u * 0.08, cloth, 190);
    return { head: [x + f * u * 0.3, cs[2] + u * 0.05], top: cs[2] - u, hand: [x + f * u * 0.95, cs[1] - u * 0.55], w: u * 1.6 };
  }
  if (kind === "robot") {
    const metal = t.color || "#a8b0bd";
    const legH = u * 0.75;
    for (const e of [-1, 1]) shape(rectP(x + e * u * 0.22 - u * 0.09, gy - legH, u * 0.18, legH), darker(metal, 0.2), 170, 0.05, true);
    const by = gy - legH - u * 1.0;
    const body = rectP(x - u * 0.45, by, u * 0.9, u * 1.0);
    shape(body, metal, 170, 0.06, true);
    for (let i = 0; i < 3; i++) pip(x - u * 0.2 + i * u * 0.2, by + u * 0.35, u * 0.07, ["#c8372d", "#e1b83f", "#3fbfb7"][i]);
    solid(rectP(x - u * 0.25, by + u * 0.6, u * 0.5, u * 0.18), "#5f6b7a", 200);
    for (const e of [-1, 1]) limb(x + e * u * 0.48, by + u * 0.15, x + e * u * 0.8, by + u * 0.75, u * 0.08, u * 0.08, darker(metal, 0.15), 170);
    const head = rectP(x - u * 0.33, by - u * 0.62, u * 0.66, u * 0.55);
    shape(head, metal, 180, 0.06, true);
    for (const e of [-1, 1]) pip(x + e * u * 0.14, by - u * 0.36, u * 0.08, t.act === "sleep" ? "#5f6b7a" : "#3dd6f5");
    ln(x - u * 0.15, by - u * 0.2, x + u * 0.15, by - u * 0.2, INK, 1);
    ln(x, by - u * 0.62, x, by - u * 0.85, INK, 1);
    pip(x, by - u * 0.88, u * 0.06, "#c8372d");
    outline(body, INK, 0.5);
    outline(head, INK, 0.5);
    return { head: [x, by - u * 0.2], top: by - u * 0.9, hand: [x + f * u * 0.85, by + u * 0.8], w: u * 1.6 };
  }
  if (kind === "alien") skin = t.color || "#8fd06a";
  if (kind === "zombie") skin = "#9ab07a";
  if (kind === "vampire") skin = "#e8e4ea";
  if (kind === "astronaut") cloth = "#f2f2f0";
  if (kind === "santa") cloth = "#c8372d";
  if (kind === "chef") cloth = "#f6f4ee";
  if (kind === "wizard") cloth = t.color || "#4b3a8a";
  if (kind === "knight") cloth = "#a8b0bd";
  const mermaid = kind === "mermaid";
  const riding = t.act === "ride";
  const legH = u * 0.95;
  const torsoH = u * 0.95;
  // riding: gy is the saddle, hips sit on it
  const by = riding ? gy : gy - legH;
  const lift = t.act === "run" || t.act === "dance" ? u * 0.35 : 0;
  // legs
  if (riding) {
    const lc = kind === "astronaut" ? "#e8e8e4" : legs;
    for (const d of [0, 1]) {
      const kx = x + f * u * (0.38 + d * 0.06);
      const ky = by + u * 0.12;
      limb(x + f * u * 0.05, by - u * 0.02, kx, ky, u * 0.12, u * 0.1, d ? lc : darker(lc, 0.15), 165);
      limb(kx, ky, kx - f * u * 0.05, ky + u * 0.55, u * 0.1, u * 0.085, d ? lc : darker(lc, 0.15), 165);
      oval(kx + f * u * 0.02, ky + u * 0.58, u * 0.14, u * 0.07, INK, 200);
    }
  } else if (mermaid) {
    const tc = t.color || "#3fbfb7";
    shape([[x - u * 0.3, by], [x + u * 0.3, by], [x + f * u * 0.2, gy - u * 0.2], [x + f * u * 0.6, gy], [x - f * u * 0.1, gy - u * 0.05]], tc, 160, 0.1, true);
  } else if (kind === "wizard" || kind === "royal" && h % 2 === 0) {
    shape([[x - u * 0.25, by - torsoH * 0.6], [x + u * 0.25, by - torsoH * 0.6], [x + u * 0.5, gy], [x - u * 0.5, gy]], cloth, 160, 0.08, true);
  } else {
    const lc = kind === "astronaut" ? "#e8e8e4" : kind === "knight" ? "#8c96a3" : legs;
    limb(x - u * 0.15, by, x - u * 0.2 - lift * 0.5 * f, gy, u * 0.11, u * 0.09, lc, 160);
    limb(x + u * 0.15, by, x + u * 0.2 + lift * f, gy - lift * 0.3, u * 0.11, u * 0.09, lc, 160);
    oval(x - u * 0.2 - lift * 0.5 * f + f * u * 0.06, gy - 3, u * 0.14, u * 0.07, INK, 200);
    oval(x + u * 0.2 + lift * f + f * u * 0.06, gy - 3 - lift * 0.3, u * 0.14, u * 0.07, INK, 200);
  }
  // cape
  if (kind === "hero" || kind === "vampire") shape([[x - u * 0.25, by - torsoH], [x + u * 0.25, by - torsoH], [x - f * u * 0.2 + u * 0.5, gy - u * 0.2], [x - f * u * 0.6, gy - u * 0.1]], kind === "vampire" ? "#2b1d3a" : "#c8372d", 160, 0.1, true);
  // torso
  const torso = [[x - u * 0.3, by - torsoH], [x + u * 0.3, by - torsoH], [x + u * 0.36, by + u * 0.05], [x - u * 0.36, by + u * 0.05]];
  shape(torso, cloth, 160, 0.08, true);
  if (kind === "hero") solid(starP(x, by - torsoH * 0.55, u * 0.15, u * 0.07), "#f3d660");
  if (kind === "santa") solid(rectP(x - u * 0.34, by - torsoH * 0.35, u * 0.68, u * 0.1), INK);
  if (kind === "pirate") for (let i = 0; i < 3; i++) solid(rectP(x - u * 0.3, by - torsoH + i * u * 0.3 + u * 0.1, u * 0.6, u * 0.1), "#fbf8f0", 200);
  outline(torso, INK, 0.5);
  // arms
  const armUp = t.act === "dance" || t.act === "fly" || t.held || kind === "hero";
  const shY = by - torsoH + u * 0.12;
  const handF = [x + f * u * 0.7, armUp ? shY - u * 0.35 : by - u * 0.25];
  const handB = [x - f * u * 0.6, t.act === "dance" ? shY - u * 0.45 : by - u * 0.2];
  limb(x - f * u * 0.28, shY, handB[0], handB[1], u * 0.08, u * 0.07, cloth, 160);
  limb(x + f * u * 0.28, shY, handF[0], handF[1], u * 0.08, u * 0.07, cloth, 160);
  pip(handB[0], handB[1], u * 0.08, kind === "astronaut" ? "#e8e8e4" : skin);
  pip(handF[0], handF[1], u * 0.08, kind === "astronaut" ? "#e8e8e4" : skin);
  if (kind === "wizard") {
    ln(handB[0], handB[1] + u * 0.6, handB[0] + f * u * 0.05, handB[1] - u * 0.6, "#6b4a30", 1.8, "2B");
    sparkle(handB[0] + f * u * 0.05, handB[1] - u * 0.65, u * 0.15, "#e1b83f");
  }
  if (kind === "knight") ln(handF[0], handF[1], handF[0] + f * u * 0.2, handF[1] - u * 0.9, "#8c96a3", 2.2, "2B");
  // head
  const hr = u * 0.27;
  const hx = x;
  const hy = by - torsoH - hr * 0.95;
  if (kind === "astronaut") {
    oval(hx, hy, hr * 1.45, hr * 1.4, "#f2f2f0", 210, 0, true);
    oval(hx + f * hr * 0.15, hy, hr * 1.0, hr * 0.85, "#2c3b70", 210);
    oval(hx + f * hr * 0.45, hy - hr * 0.3, hr * 0.25, hr * 0.15, "#c9d6f0", 180, 0.6);
    outline(ellP(hx, hy, hr * 1.45, hr * 1.4), INK, 0.5);
    return { head: [hx + f * hr, hy + hr * 0.5], top: hy - hr * 1.5, hand: handF, w: u * 1.5 };
  }
  // hair behind
  if (kind !== "alien" && kind !== "robot") {
    if (h % 3 === 0) oval(hx - f * hr * 0.25, hy + hr * 0.15, hr * 1.12, hr * 1.15, hair, 170, 0, true);
  }
  const head = ellP(hx, hy, hr * (kind === "alien" ? 1.25 : 1), hr * (kind === "alien" ? 1.15 : 1.08));
  shape(head, skin, 170, 0.08, true);
  if (kind !== "alien" && kind !== "zombie" || kind === "zombie") {
    if (kind !== "alien") oval(hx - f * hr * 0.1, hy - hr * 0.6, hr * 1.02, hr * 0.5, kind === "santa" ? "#fbf8f0" : hair, 185, 0, false);
  }
  if (kind === "alien") {
    for (const e of [-1, 1]) {
      ln(hx + e * hr * 0.4, hy - hr, hx + e * hr * 0.7, hy - hr * 1.8, INK, 1);
      pip(hx + e * hr * 0.7, hy - hr * 1.8, hr * 0.15, "#e1b83f");
      oval(hx + e * hr * 0.4, hy - hr * 0.05, hr * 0.28, hr * 0.38, INK, 220, e * 0.4);
    }
  } else if (t.act === "sleep") {
    for (const e of [-1, 1]) sp([[hx + e * hr * 0.35 - hr * 0.15, hy], [hx + e * hr * 0.35, hy + hr * 0.08], [hx + e * hr * 0.35 + hr * 0.15, hy]], INK, 0.8);
  } else {
    eye(hx + f * hr * 0.15 - hr * 0.3, hy, hr * 0.12);
    eye(hx + f * hr * 0.15 + hr * 0.3, hy, hr * 0.12);
  }
  const sad = SC.moodSet.has("sad") || t.act === "cry";
  const angry = SC.moodSet.has("angry") || SC.moodSet.has("stressed");
  if (kind !== "alien") {
    if (sad) sp([[hx - hr * 0.3, hy + hr * 0.5], [hx, hy + hr * 0.38], [hx + hr * 0.3, hy + hr * 0.5]], INK, 0.9);
    else if (angry) ln(hx - hr * 0.3, hy + hr * 0.45, hx + hr * 0.3, hy + hr * 0.42, INK, 0.9);
    else sp([[hx - hr * 0.35, hy + hr * 0.35], [hx, hy + hr * 0.55], [hx + hr * 0.35, hy + hr * 0.35]], INK, 0.9);
    pip(hx - hr * 0.55, hy + hr * 0.25, hr * 0.13, "#e88972", 90);
    pip(hx + hr * 0.55, hy + hr * 0.25, hr * 0.13, "#e88972", 90);
  }
  if (kind === "zombie") for (const e of [-1, 1]) pip(hx + e * hr * 0.3, hy, hr * 0.14, "#c8372d");
  if (kind === "vampire") for (const e of [-1, 1]) solid(triP(hx + e * hr * 0.12 - 2, hy + hr * 0.42, hx + e * hr * 0.12 + 2, hy + hr * 0.42, hx + e * hr * 0.12, hy + hr * 0.62), "#fbf8f0");
  outline(head, INK, 0.5);
  // hats
  if (kind === "wizard") shape([[hx - hr * 1.3, hy - hr * 0.6], [hx + hr * 1.3, hy - hr * 0.6], [hx + f * hr * 0.4, hy - hr * 3.2]], cloth, 180, 0.06, true);
  if (kind === "wizard") solid(starP(hx, hy - hr * 1.5, hr * 0.25, hr * 0.11), "#e1b83f");
  if (kind === "royal" || kind === "santa" === false && kind === "royal") {}
  if (kind === "royal") solid([[hx - hr * 0.8, hy - hr * 0.75], [hx - hr * 0.8, hy - hr * 1.5], [hx - hr * 0.4, hy - hr * 1.1], [hx, hy - hr * 1.7], [hx + hr * 0.4, hy - hr * 1.1], [hx + hr * 0.8, hy - hr * 1.5], [hx + hr * 0.8, hy - hr * 0.75]], "#e1b83f", 235);
  if (kind === "pirate") solid([[hx - hr * 1.3, hy - hr * 0.7], [hx + hr * 1.3, hy - hr * 0.7], [hx + hr * 0.7, hy - hr * 1.5], [hx, hy - hr * 1.2], [hx - hr * 0.7, hy - hr * 1.5]], "#2b2622", 235);
  if (kind === "santa") {
    shape([[hx - hr * 1.05, hy - hr * 0.6], [hx + hr * 1.05, hy - hr * 0.6], [hx - f * hr * 1.2, hy - hr * 1.6]], "#c8372d", 190, 0.05, true);
    pip(hx - f * hr * 1.2, hy - hr * 1.6, hr * 0.25, "#fbf8f0");
    oval(hx, hy + hr * 0.75, hr * 0.85, hr * 0.6, "#fbf8f0", 200);
  }
  if (kind === "chef") {
    oval(hx, hy - hr * 1.4, hr * 0.85, hr * 0.7, "#fbf8f0", 220, 0, true);
    outline(ellP(hx, hy - hr * 1.4, hr * 0.85, hr * 0.7), "#8592a3", 0.5);
  }
  if (kind === "cowboy") {
    solid([[hx - hr * 1.6, hy - hr * 0.55], [hx + hr * 1.6, hy - hr * 0.55], [hx + hr * 0.7, hy - hr * 0.8], [hx + hr * 0.6, hy - hr * 1.6], [hx - hr * 0.6, hy - hr * 1.6], [hx - hr * 0.7, hy - hr * 0.8]], "#8a5a3c", 230);
  }
  if (kind === "knight") solid([[hx - hr * 1.05, hy + hr * 0.2], [hx - hr * 1.05, hy - hr * 0.7], [hx, hy - hr * 1.3], [hx + hr * 1.05, hy - hr * 0.7], [hx + hr * 1.05, hy + hr * 0.2]], "#8c96a3", 200);
  if (kind === "knight") ln(hx - hr * 0.7, hy - hr * 0.1, hx + hr * 0.7, hy - hr * 0.1, INK, 1.4);
  if (kind === "clown") {
    pip(hx + f * hr * 0.15, hy + hr * 0.2, hr * 0.22, "#c8372d");
    for (const e of [-1, 1]) oval(hx + e * hr * 1.0, hy - hr * 0.4, hr * 0.4, hr * 0.4, "#e0509a", 190);
  }
  if (kind === "fairy") for (const e of [-1, 1]) {
    oval(x + e * u * 0.55, by - torsoH * 0.8, u * 0.4, u * 0.25, "#e4f0f8", 120, e * -0.6, true);
    outline(ellP(x + e * u * 0.55, by - torsoH * 0.8, u * 0.4, u * 0.25, e * -0.6), "#8fa3b8", 0.5);
  }
  if (t.act === "cry") for (let i = 0; i < 3; i++) pip(hx + f * hr * 0.45, hy + hr * 0.3 + i * hr * 0.3, hr * 0.08, "#5fb3e0", 200);
  return { head: [hx + f * hr * 1.1, hy + hr * 0.4], top: hy - hr * (kind === "wizard" ? 3.2 : 1.6), hand: handF, w: u * 1.4 };
}

/* ---------------- plants ---------------- */

function mTree(x, gy, s, t) {
  const kind = t.o.kind;
  const u = 60 * s;
  const season = SC.season;
  let leaf = t.color && t.color !== "rainbow" ? [t.color, darker(t.color, 0.15)] : ["#5d8a4a", "#4e6a40", "#7a9a52"];
  if (!t.color && season === "autumn") leaf = ["#e08a3a", "#c8572d", "#e1b83f"];
  if (!t.color && season === "winter" && kind !== "pine") leaf = null;
  if (!t.color && (kind === "blossom" || season === "spring" && kind === "round")) leaf = ["#f2b5c4", "#e59bb3", "#fbe0e6"];
  if (kind === "pine") {
    const h = u * 3;
    solid(rectP(x - u * 0.1, gy - u * 0.5, u * 0.2, u * 0.5), "#6b4a30");
    const c = t.color && t.color !== "rainbow" ? t.color : "#2f5a35";
    for (let i = 0; i < 4; i++) {
      const y0 = gy - u * 0.35 - i * h * 0.2;
      const w = u * (1.0 - i * 0.2);
      const tri = [[x - w, y0], [x + w, y0], [x, y0 - h * 0.38]];
      shape(tri, i % 2 ? c : darker(c, 0.1), 160, 0.1, true);
      if (season === "winter" || SC.weather.includes("snow")) oval(x, y0 - h * 0.3, w * 0.35, u * 0.08, "#f6f8fb", 200);
    }
    if (SC.christmas) for (let i = 0; i < 9; i++) pip(x + random(-u * 0.6, u * 0.6) * (1 - i / 12), gy - u * 0.5 - random(h * 0.65), u * 0.07, pickc(["#c8372d", "#e1b83f", "#3a6cb8"]));
    if (SC.christmas) solid(starP(x, gy - u * 0.35 - h * 0.98, u * 0.2, u * 0.09), "#e1b83f");
    return { top: gy - h, w: u * 2 };
  }
  if (kind === "palm") {
    const tx = x + u * 0.5;
    const ty = gy - u * 3;
    for (let i = 0; i < 6; i++) {
      const p0 = [x + (tx - x) * (i / 6) * (i / 6), gy - (gy - ty) * (i / 6)];
      const p1 = [x + (tx - x) * ((i + 1) / 6) * ((i + 1) / 6), gy - (gy - ty) * ((i + 1) / 6)];
      limb(p0[0], p0[1], p1[0], p1[1], u * 0.16, u * 0.14, i % 2 ? "#a8845a" : "#8a6a4a", 160);
    }
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + (i / 6) * Math.PI + random(-0.15, 0.15);
      const len = u * random(1.2, 1.6);
      const ex = tx + Math.cos(a) * len;
      const ey = ty + Math.sin(a) * len * 0.5 + len * 0.35;
      shape([[tx, ty], [tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.6 - u * 0.15], [ex, ey], [tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.6 + u * 0.05]], leaf ? leaf[i % 2] : "#5d8a4a", 160, 0.08, true);
    }
    for (const d of [-1, 1]) pip(tx + d * u * 0.12, ty + u * 0.15, u * 0.12, "#6b4a30");
    return { top: ty - u * 0.6, w: u * 3 };
  }
  if (kind === "cactus") {
    const c = t.color && t.color !== "rainbow" ? t.color : "#5f9a5a";
    const body = [[x - u * 0.3, gy], [x - u * 0.3, gy - u * 1.9], [x, gy - u * 2.2], [x + u * 0.3, gy - u * 1.9], [x + u * 0.3, gy]];
    shape(body, c, 170, 0.06, true);
    limb(x - u * 0.3, gy - u * 0.9, x - u * 0.75, gy - u * 0.9, u * 0.14, u * 0.14, c, 170);
    limb(x - u * 0.75, gy - u * 0.85, x - u * 0.75, gy - u * 1.5, u * 0.14, u * 0.13, c, 170);
    limb(x + u * 0.3, gy - u * 1.2, x + u * 0.7, gy - u * 1.2, u * 0.13, u * 0.13, c, 170);
    limb(x + u * 0.7, gy - u * 1.15, x + u * 0.7, gy - u * 1.7, u * 0.13, u * 0.12, c, 170);
    for (let i = 0; i < 3; i++) ln(x - u * 0.12 + i * u * 0.12, gy - u * 0.1, x - u * 0.12 + i * u * 0.12, gy - u * 2.0, darker(c, 0.3), 0.7);
    outline(body, INK, 0.5);
    if (SC.season === "spring" || SC.moodSet.has("happy")) pip(x, gy - u * 2.2, u * 0.12, "#e0509a");
    return { top: gy - u * 2.2, w: u * 1.6 };
  }
  if (kind === "cypress") {
    cypress(x, gy, u * 3.2);
    return { top: gy - u * 3.2, w: u };
  }
  if (kind === "bush") {
    for (let i = 0; i < 4; i++) oval(x + random(-u * 0.6, u * 0.6), gy - u * random(0.3, 0.6), u * random(0.45, 0.65), u * random(0.35, 0.5), leaf ? leaf[i % leaf.length] : "#7a8a6a", 140, 0, true);
    if (SC.season === "spring" || t.color) for (let i = 0; i < 5; i++) pip(x + random(-u * 0.8, u * 0.8), gy - u * random(0.2, 0.9), u * 0.07, "#e57a9a");
    return { top: gy - u, w: u * 2 };
  }
  // round / blossom / bare
  const trunk = [[x - u * 0.16, gy], [x - u * 0.1, gy - u * 1.6], [x + u * 0.1, gy - u * 1.6], [x + u * 0.16, gy]];
  shape(trunk, "#6b4a30", 175, 0.05, true);
  ln(x, gy - u * 1.4, x - u * 0.6, gy - u * 2.2, "#6b4a30", 2.4, "2B");
  ln(x, gy - u * 1.5, x + u * 0.55, gy - u * 2.3, "#6b4a30", 2.4, "2B");
  ln(x, gy - u * 1.6, x + u * 0.05, gy - u * 2.6, "#6b4a30", 2.2, "2B");
  if (!leaf) {
    ln(x - u * 0.6, gy - u * 2.2, x - u * 0.9, gy - u * 2.6, "#6b4a30", 1.3);
    ln(x + u * 0.55, gy - u * 2.3, x + u * 0.85, gy - u * 2.7, "#6b4a30", 1.3);
    oval(x, gy - u * 2.5, u * 0.7, u * 0.12, "#f6f8fb", 180);
    return { top: gy - u * 2.7, w: u * 1.8 };
  }
  const blobs = [[0, 2.45, 0.95, 0.8], [-0.6, 2.15, 0.65, 0.55], [0.62, 2.2, 0.65, 0.55], [0.1, 2.95, 0.6, 0.5]];
  for (let i = 0; i < blobs.length; i++) {
    const [dx, dy, rx, ry] = blobs[i];
    oval(x + dx * u + random(-5, 5), gy - dy * u, rx * u, ry * u, leaf[i % leaf.length], 130, 0, true, 0.2);
  }
  oval(x - u * 0.25, gy - u * 2.7, u * 0.45, u * 0.3, lighter(leaf[0], 0.3), 90);
  if (kind === "round" && (t.label === "apple" || SC.season === "autumn" && random() < 0.3)) for (let i = 0; i < 6; i++) pip(x + random(-u * 0.8, u * 0.8), gy - u * random(1.9, 3), u * 0.08, "#c8372d");
  return { top: gy - u * 3.4, w: u * 2.4 };
}

function mFlower(x, gy, s, t) {
  const kind = t.o.kind;
  const u = 40 * s;
  const col = t.color && t.color !== "rainbow" ? t.color : null;
  if (kind === "mushroom") {
    const c = col || pickc(["#c8372d", "#c98a4a"]);
    shape([[x - u * 0.25, gy], [x - u * 0.2, gy - u * 1.1], [x + u * 0.2, gy - u * 1.1], [x + u * 0.25, gy]], "#f4ead0", 180, 0.05, true);
    const cap = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      cap.push([x + Math.cos(a) * u * 0.9, gy - u * 1.05 + Math.sin(a) * u * 0.75]);
    }
    shape(cap, c, 175, 0.08, true);
    if (c === "#c8372d") for (let i = 0; i < 5; i++) pip(x + random(-u * 0.6, u * 0.6), gy - u * random(1.25, 1.6), u * 0.1, "#fbf8f0");
    outline(cap, INK, 0.5);
    return { top: gy - u * 1.8, w: u * 2 };
  }
  if (kind === "grass") {
    for (let i = 0; i < 9; i++) {
      const bx = x + random(-u, u);
      shape(bladePoints(bx, gy, Math.PI + random(-0.5, 0.5), u * random(0.8, 1.6), u * 0.08), col || pickc(["#5d8a4a", "#7a9a52", "#4e6a40"]), 140, 0.08);
    }
    return { top: gy - u * 1.5, w: u * 2 };
  }
  if (kind === "sunflower") {
    const fh = u * 3.2;
    ln(x, gy, x + u * 0.1, gy - fh, "#4e6a40", 2.4, "2B");
    shape(bladePoints(x + 2, gy - fh * 0.4, Math.PI * 1.25, u * 0.9, u * 0.22), "#5d8a4a", 150, 0.08);
    shape(bladePoints(x + 2, gy - fh * 0.55, Math.PI * 0.75, u * 0.8, u * 0.2), "#5d8a4a", 150, 0.08);
    const cx = x + u * 0.1;
    const cy = gy - fh;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      oval(cx + Math.cos(a) * u * 0.6, cy + Math.sin(a) * u * 0.6, u * 0.38, u * 0.14, col || "#f3c94a", 160, a, true);
    }
    oval(cx, cy, u * 0.45, u * 0.45, "#6b4a30", 200, 0, true);
    for (let i = 0; i < 6; i++) pip(cx + random(-u * 0.25, u * 0.25), cy + random(-u * 0.25, u * 0.25), 1.6, "#2b2622");
    return { top: cy - u, w: u * 2 };
  }
  // cluster of blooms
  const n = kind === "flower" ? 3 : 1;
  let top = gy;
  for (let k = 0; k < n; k++) {
    const fx = x + (n > 1 ? (k - 1) * u * 0.9 + random(-6, 6) : 0);
    const fh = u * (n > 1 ? random(1.4, 2.4) : 2.6);
    const fy = gy - fh;
    top = Math.min(top, fy - u);
    sp([[fx, gy], [fx + random(-8, 8), gy - fh * 0.5], [fx, fy]], "#4e6a40", 1.8, "2B");
    shape(bladePoints(fx, gy - fh * 0.3, Math.PI + (k % 2 ? 0.7 : -0.7), u * 0.7, u * 0.18), "#6f8a55", 140, 0.08);
    const c = col || (kind === "rose" ? "#c13b4a" : kind === "tulip" ? pickc(["#e0509a", "#c8372d", "#f3c94a", "#7d5ab0"]) : pickc(["#e57a9a", "#f3c94a", "#7d5ab0", "#fbf8f0", "#e98a3a", "#5fb3e0"]));
    if (kind === "tulip") {
      const cup = [[fx - u * 0.45, fy - u * 0.6], [fx - u * 0.2, fy - u * 0.25], [fx, fy - u * 0.6], [fx + u * 0.2, fy - u * 0.25], [fx + u * 0.45, fy - u * 0.6], [fx + u * 0.4, fy + u * 0.1], [fx, fy + u * 0.25], [fx - u * 0.4, fy + u * 0.1]];
      shape(cup, c, 175, 0.08, true);
      outline(cup, INK, 0.5);
    } else if (kind === "rose") {
      oval(fx, fy, u * 0.55, u * 0.5, c, 170, 0, true);
      const pts = [];
      for (let i = 0; i < 22; i++) {
        const a = i * 0.55;
        const r = u * 0.45 * (1 - i / 24);
        pts.push([fx + Math.cos(a) * r, fy + Math.sin(a) * r * 0.9]);
      }
      sp(pts.reverse(), darker(c, 0.35), 1);
    } else {
      const petals = 5 + (k % 2);
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2 + random(0.3);
        oval(fx + Math.cos(a) * u * 0.38, fy + Math.sin(a) * u * 0.38, u * 0.32, u * 0.2, c, 150, a, true);
      }
      pip(fx, fy, u * 0.16, c === "#f3c94a" ? "#8a5a3c" : "#f3c94a");
    }
  }
  return { top, w: u * 3 };
}

/* ---------------- buildings ---------------- */

function mBuilding(x, gy, s, t) {
  const kind = t.o.kind;
  const u = 60 * s;
  const col = t.color && t.color !== "rainbow" ? t.color : null;
  const night = SC.time === "night";
  const win = night ? "#f3d660" : "#cfe0ec";
  if (kind === "tower") {
    const w = u * 1.1;
    const h = u * (2.6 + (SC.hash % 3) * 0.4);
    const c = col || pickc(["#8c96a3", "#b9ad9e", "#9aa6b8", "#c9a77c"]);
    const body = rectP(x - w / 2, gy - h, w, h);
    shape(body, c, 170, 0.04, true);
    for (let r = 0; r < Math.floor(h / (u * 0.35)) - 1; r++) for (let k = 0; k < 3; k++) solid(rectP(x - w / 2 + u * 0.15 + k * w * 0.3, gy - h + u * 0.2 + r * u * 0.35, u * 0.17, u * 0.2), night && random() < 0.4 ? "#3a4060" : win, 210);
    solid(rectP(x - u * 0.15, gy - u * 0.4, u * 0.3, u * 0.4), darker(c, 0.4));
    outline(body, INK, 0.5);
    return { top: gy - h, w };
  }
  if (kind === "lighthouse") {
    const h = u * 3;
    const pts = [[x - u * 0.4, gy], [x - u * 0.25, gy - h], [x + u * 0.25, gy - h], [x + u * 0.4, gy]];
    shape(pts, "#fbf8f0", 200, 0.04, true);
    for (let i = 0; i < 3; i++) {
      const y0 = gy - h * (0.15 + i * 0.3);
      solid([[x - u * 0.37 + i * 0.05 * u, y0], [x + u * 0.37 - i * 0.05 * u, y0], [x + u * 0.35 - i * 0.05 * u, y0 - h * 0.12], [x - u * 0.35 + i * 0.05 * u, y0 - h * 0.12]], col || "#c8372d", 210);
    }
    solid(rectP(x - u * 0.22, gy - h - u * 0.4, u * 0.44, u * 0.4), "#f3d660", 230);
    solid(triP(x - u * 0.32, gy - h - u * 0.4, x + u * 0.32, gy - h - u * 0.4, x, gy - h - u * 0.75), "#2b2622");
    if (night) for (const d of [-1, 1]) shape([[x, gy - h - u * 0.2], [x + d * u * 3, gy - h - u * 0.7], [x + d * u * 3, gy - h + u * 0.3]], "#fff3b0", 60, 0.3);
    outline(pts, INK, 0.5);
    return { top: gy - h - u * 0.8, w: u };
  }
  if (kind === "tent") {
    const c = col || pickc(["#e98a3a", "#2f8f68", "#c8372d"]);
    const pts = [[x - u * 1.1, gy], [x, gy - u * 1.3], [x + u * 1.1, gy]];
    shape(pts, c, 175, 0.06, true);
    solid(triP(x - u * 0.3, gy, x, gy - u * 0.9, x + u * 0.3, gy), darker(c, 0.45));
    outline(pts, INK, 0.5);
    if (SC.time === "night" || SC.time === "sunset") mObj(x + u * 1.6, gy, s * 0.7, { o: { kind: "fire" } });
    return { top: gy - u * 1.3, w: u * 2.2 };
  }
  if (kind === "igloo") {
    const dome = [];
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI + (i / 18) * Math.PI;
      dome.push([x + Math.cos(a) * u * 1.1, gy + Math.sin(a) * u * 0.95]);
    }
    shape(dome, "#eef4fa", 200, 0.08, true);
    for (let r = 1; r < 4; r++) sp([[x - u * 1.05 + r * 0.06 * u, gy - r * u * 0.25], [x, gy - r * u * 0.25 - 3], [x + u * 1.05 - r * 0.06 * u, gy - r * u * 0.25]], "#9ab0c8", 0.7);
    oval(x + u * 0.5, gy - u * 0.25, u * 0.3, u * 0.28, "#3a4a63", 200);
    outline(dome, INK, 0.5);
    return { top: gy - u, w: u * 2.2 };
  }
  if (kind === "pyramid") {
    const pts = [[x - u * 1.6, gy], [x, gy - u * 1.9], [x + u * 1.6, gy]];
    shape(pts, col || "#dcc394", 175, 0.06, true);
    solid([[x, gy - u * 1.9], [x + u * 1.6, gy], [x + u * 0.4, gy]], "#b9a070", 130);
    for (let r = 1; r < 6; r++) ln(x - u * 1.6 + r * u * 0.27, gy - r * u * 0.32, x + u * 1.6 - r * u * 0.27, gy - r * u * 0.32, "#a8906a", 0.6);
    return { top: gy - u * 1.9, w: u * 3.2 };
  }
  if (kind === "windmill") {
    const pts = [[x - u * 0.5, gy], [x - u * 0.3, gy - u * 2], [x + u * 0.3, gy - u * 2], [x + u * 0.5, gy]];
    shape(pts, col || "#e8d6b8", 175, 0.05, true);
    const hx = x;
    const hy = gy - u * 2;
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + 0.4;
      shape(limbP(hx, hy, hx + Math.cos(a) * u * 1.5, hy + Math.sin(a) * u * 1.5, u * 0.08, u * 0.22), "#f6f0dc", 190, 0.05, true);
      ln(hx, hy, hx + Math.cos(a) * u * 1.5, hy + Math.sin(a) * u * 1.5, "#6b4a30", 1);
    }
    pip(hx, hy, u * 0.1, "#6b4a30");
    return { top: hy - u * 1.5, w: u * 3 };
  }
  if (kind === "bridge") {
    const w = u * 3.4;
    const pts = [[x - w / 2, gy - u * 0.9], [x + w / 2, gy - u * 0.9], [x + w / 2, gy], [x + w * 0.3, gy], [x + w * 0.3, gy - u * 0.3], [x, gy - u * 0.65], [x - w * 0.3, gy - u * 0.3], [x - w * 0.3, gy], [x - w / 2, gy]];
    shape(pts, col || "#b9ad9e", 175, 0.05, true);
    outline(pts, INK, 0.5);
    return { top: gy - u * 0.9, w };
  }
  if (kind === "castle") {
    const c = col || "#b9ad9e";
    const w = u * 2.2;
    const h = u * 1.4;
    const wall = rectP(x - w / 2, gy - h, w, h);
    shape(wall, c, 175, 0.04, true);
    for (const e of [-1, 1]) {
      const tw = rectP(x + e * w / 2 - u * 0.3, gy - h * 1.7, u * 0.6, h * 1.7);
      shape(tw, darker(c, 0.08), 180, 0.04, true);
      solid(triP(x + e * w / 2 - u * 0.4, gy - h * 1.7, x + e * w / 2 + u * 0.4, gy - h * 1.7, x + e * w / 2, gy - h * 2.4), "#3a4a8a");
      ln(x + e * w / 2, gy - h * 2.4, x + e * w / 2, gy - h * 2.75, INK, 1);
      solid([[x + e * w / 2, gy - h * 2.75], [x + e * w / 2 + u * 0.35, gy - h * 2.65], [x + e * w / 2, gy - h * 2.55]], "#c8372d");
      solid(rectP(x + e * w / 2 - u * 0.08, gy - h * 1.3, u * 0.16, u * 0.25), INK, 200);
    }
    for (let i = 0; i < 5; i++) solid(rectP(x - w / 2 + u * 0.3 + i * (w - u * 0.6) / 5, gy - h - u * 0.2, u * 0.22, u * 0.22), c, 200);
    const door = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      door.push([x + Math.cos(a) * u * 0.32, gy - u * 0.5 + Math.sin(a) * u * 0.32]);
    }
    door.push([x + u * 0.32, gy], [x - u * 0.32, gy]);
    solid(door, "#4a3426");
    outline(wall, INK, 0.5);
    return { top: gy - h * 2.75, w: w + u * 0.8 };
  }
  // house / barn / church / school
  const barn = kind === "barn";
  const school = kind === "school";
  const church = kind === "church";
  const w = u * (school ? 2.8 : barn ? 1.9 : 1.6);
  const h = u * (school ? 1.2 : 1.1);
  const c = col || (barn ? "#b8372d" : school ? "#b9654a" : church ? "#f2ead8" : pickc(["#f2ead8", "#e8b09a", "#cfe0c8", "#f3d9a0", "#c9d6e8"]));
  const roofC = barn ? "#6b2a24" : school ? "#4a3a3a" : pickc(["#8a3a2c", "#3a4a63", "#5e3a26"]);
  const wall = rectP(x - w / 2, gy - h, w, h);
  shape(wall, c, 175, 0.04, true);
  const roof = barn
    ? [[x - w / 2 - u * 0.1, gy - h], [x - w * 0.35, gy - h - u * 0.6], [x, gy - h - u * 0.95], [x + w * 0.35, gy - h - u * 0.6], [x + w / 2 + u * 0.1, gy - h]]
    : [[x - w / 2 - u * 0.15, gy - h], [x, gy - h - u * (school ? 0.6 : 0.9)], [x + w / 2 + u * 0.15, gy - h]];
  shape(roof, roofC, 180, 0.05, true);
  if (church || school) {
    const tx = church ? x : x;
    const ty = gy - h - u * (school ? 0.55 : 0.85);
    solid(rectP(tx - u * 0.22, ty - u * 0.7, u * 0.44, u * 0.75), c, 230);
    solid(triP(tx - u * 0.3, ty - u * 0.7, tx + u * 0.3, ty - u * 0.7, tx, ty - u * 1.4), roofC);
    if (church) {
      ln(tx, ty - u * 1.4, tx, ty - u * 1.8, INK, 1.4);
      ln(tx - u * 0.12, ty - u * 1.65, tx + u * 0.12, ty - u * 1.65, INK, 1.4);
    } else {
      pip(tx, ty - u * 0.35, u * 0.12, "#e1b83f");
      ln(tx, ty - u * 1.4, tx, ty - u * 1.9, INK, 1);
      solid([[tx, ty - u * 1.9], [tx + u * 0.4, ty - u * 1.78], [tx, ty - u * 1.66]], "#3a6cb8");
    }
  }
  if (barn) {
    solid(rectP(x - u * 0.38, gy - u * 0.85, u * 0.76, u * 0.85), "#fbf8f0", 200);
    ln(x - u * 0.38, gy - u * 0.85, x + u * 0.38, gy, "#fbf8f0", 1.2);
    solid(rectP(x - u * 0.33, gy - u * 0.8, u * 0.66, u * 0.8), "#8a2a24", 200);
    ln(x - u * 0.33, gy - u * 0.8, x + u * 0.33, gy, "#fbf8f0", 1.6, "2B");
    ln(x + u * 0.33, gy - u * 0.8, x - u * 0.33, gy, "#fbf8f0", 1.6, "2B");
  } else {
    const nWin = school ? 4 : 2;
    for (let i = 0; i < nWin; i++) {
      const wx = x - w / 2 + (w / (nWin + 1)) * (i + 1) + (i >= nWin / 2 ? u * 0.25 : -u * 0.25) * (school ? 0.3 : 1);
      solid(rectP(wx - u * 0.17, gy - h * 0.72, u * 0.34, u * 0.32), win, 220);
      ln(wx, gy - h * 0.72, wx, gy - h * 0.72 + u * 0.32, INK, 0.6);
    }
    const dc = church ? "#6b4a30" : pickc(["#3a4a63", "#8a3a2c", "#2f5a35", "#6b4a30"]);
    solid(rectP(x - u * 0.16 + (school ? 0 : w * 0.18), gy - u * 0.55, u * 0.32, u * 0.55), dc);
    if (!school && !church) {
      solid(rectP(x + w * 0.22, gy - h - u * 0.75, u * 0.2, u * 0.45), darker(c, 0.3));
      if (SC.season === "winter" || SC.time === "night") for (let i = 0; i < 3; i++) oval(x + w * 0.32 + i * 8, gy - h - u * 0.9 - i * 14, u * 0.12 + i * 3, u * 0.08 + i * 2, "#c2c6cf", 70);
    }
  }
  outline(wall, INK, 0.5);
  outline(roof, INK, 0.5);
  return { top: gy - h - u * 1.6, w: w + u * 0.3 };
}

/* ---------------- vehicles ---------------- */

function wheel(x, y, r) {
  pip(x, y, r, "#2b2622");
  pip(x, y, r * 0.45, "#c2c6cf");
}
function mVehicle(x, gy, s, t, f) {
  const kind = t.o.kind;
  const u = 50 * s;
  const night = SC.time === "night";
  const col = t.color && t.color !== "rainbow" ? t.color : t.o.col || pickc(kind === "bus" ? ["#f3c94a"] : kind === "tractor" ? ["#3f8a3a", "#c8372d"] : ["#c13b4a", "#3a6cb8", "#e1b83f", "#2f8f68", "#7a4a9a", "#e98a3a", "#5f6b7a"]);
  const glass = night ? "#f3d660" : "#cfe0ec";
  const wr = u * 0.28;
  if (kind === "bike") {
    const r = u * 0.5;
    for (const e of [-1, 1]) {
      outline(ellP(x + e * u * 0.75, gy - r, r, r, 0, 18, 0), INK, 1.2);
      pip(x + e * u * 0.75, gy - r, 2.5, INK);
    }
    const fr = col;
    ln(x - u * 0.75, gy - r, x - u * 0.05, gy - r, fr, 2.4, "2B");
    ln(x - u * 0.05, gy - r, x + u * 0.35, gy - r - u * 0.6, fr, 2.4, "2B");
    ln(x - u * 0.75, gy - r, x - u * 0.25, gy - r - u * 0.6, fr, 2.4, "2B");
    ln(x - u * 0.25, gy - r - u * 0.6, x + u * 0.35, gy - r - u * 0.6, fr, 2.4, "2B");
    ln(x + u * 0.35, gy - r - u * 0.6, x + u * 0.75, gy - r, fr, 2.4, "2B");
    ln(x - u * 0.25, gy - r - u * 0.6, x - u * 0.3, gy - r - u * 0.8, INK, 1.6, "2B");
    ln(x - u * 0.45, gy - r - u * 0.8, x - u * 0.15, gy - r - u * 0.8, INK, 2.6, "2B");
    ln(x + u * 0.35, gy - r - u * 0.6, x + u * 0.3, gy - r - u * 0.95, INK, 1.6, "2B");
    return { top: gy - r - u, w: u * 2.6, seat: [x - u * 0.3, gy - r - u * 0.8] };
  }
  if (kind === "train") {
    const len = u * 1.6;
    for (let k = 0; k < 3; k++) {
      const cx = x - f * k * (len + u * 0.15);
      const c = k === 0 ? col : pickc(["#3a6cb8", "#2f8f68", "#e1b83f", "#c13b4a"]);
      const body = rectP(cx - len / 2, gy - u * 1.15, len, u * 0.85);
      shape(body, c, 175, 0.04, true);
      if (k === 0) {
        solid(rectP(cx - f * len * 0.1 - u * 0.25, gy - u * 1.75, u * 0.5, u * 0.65), darker(c, 0.15));
        solid(rectP(cx + f * len * 0.3 - u * 0.1, gy - u * 1.6, u * 0.2, u * 0.45), INK);
        for (let i = 0; i < 3; i++) oval(cx + f * len * 0.3 + i * 6 * -f, gy - u * 1.8 - i * 16, u * 0.18 + i * 4, u * 0.12 + i * 3, "#c2c6cf", 90);
      } else for (let i = 0; i < 2; i++) solid(rectP(cx - len * 0.35 + i * len * 0.4, gy - u * 1.0, u * 0.45, u * 0.3), glass, 220);
      wheel(cx - len * 0.3, gy - wr * 0.9, wr * 0.9);
      wheel(cx + len * 0.3, gy - wr * 0.9, wr * 0.9);
      outline(body, INK, 0.5);
    }
    ln(x - u * 6, gy, x + u * 2, gy, "#5f6b7a", 1.4, "2B");
    return { top: gy - u * 1.9, w: u * 5.3 };
  }
  if (kind === "tractor") {
    wheel(x - f * u * 0.5, gy - u * 0.55, u * 0.55);
    const body = rectP(x - u * 0.2, gy - u * 0.95, u * 1.0, u * 0.55);
    shape(body, col, 175, 0.04, true);
    solid(rectP(x - f * u * 0.25 - u * 0.35, gy - u * 1.7, u * 0.7, u * 0.85), col, 210);
    solid(rectP(x - f * u * 0.25 - u * 0.25, gy - u * 1.6, u * 0.5, u * 0.4), glass, 220);
    wheel(x + f * u * 0.6, gy - u * 0.3, u * 0.3);
    pip(x - f * u * 0.5, gy - u * 0.55, u * 0.3, "#e1b83f");
    outline(body, INK, 0.5);
    return { top: gy - u * 1.7, w: u * 2.2 };
  }
  const isTruck = kind === "truck";
  const isBus = kind === "bus";
  const len = u * (isBus ? 3.2 : isTruck ? 2.9 : 2.3);
  const bodyH = u * (isBus ? 1.25 : isTruck ? 0.75 : 0.55);
  const by = gy - wr * 1.3;
  if (isTruck) {
    const cargo = rectP(x - f * len * 0.5 - (f > 0 ? 0 : -len * 0.62), by - u * 1.25, len * 0.62, u * 1.25);
    const cx0 = f > 0 ? x - len * 0.5 : x + len * 0.5 - len * 0.62;
    const box = rectP(cx0, by - u * 1.25, len * 0.62, u * 1.25);
    shape(box, t.o.cargo || (t.color ? lighter(col, 0.08) : "#e8e4dc"), 190, 0.04, true);
    outline(box, INK, 0.5);
    const cabX = f > 0 ? x - len * 0.5 + len * 0.64 : x - len * 0.5;
    const cab = [[cabX, by], [cabX, by - u * 1.0], [cabX + len * 0.36 * (f > 0 ? 0.55 : 1), by - u * 1.0], [cabX + len * 0.36, by - u * 0.45], [cabX + len * 0.36, by]];
    const cabPts = f > 0 ? cab : cab.map(([px, py]) => [cabX + len * 0.36 - (px - cabX), py]);
    shape(cabPts, col, 180, 0.04, true);
    const wxp = f > 0 ? cabX + len * 0.12 : cabX + len * 0.04;
    solid(rectP(wxp, by - u * 0.88, len * 0.18, u * 0.35), glass, 220);
    outline(cabPts, INK, 0.5);
    if (t.color === undefined) {}
    wheel(x - f * len * 0.32, gy - wr, wr);
    wheel(x - f * len * 0.12, gy - wr, wr);
    wheel(x + f * len * 0.32, gy - wr, wr);
    pip(x + f * len * 0.5, by - u * 0.25, u * 0.08, night ? "#fff3b0" : "#f3d660");
    return { top: by - u * 1.3, w: len, seat: [x + f * len * 0.3, by - u * 0.9] };
  }
  const body = [[x - len / 2, by], [x - len / 2, by - bodyH], [x + len / 2, by - bodyH * (isBus ? 1 : 0.85)], [x + len / 2, by]];
  shape(body, col, 180, 0.04, true);
  if (isBus) {
    for (let i = 0; i < 5; i++) solid(rectP(x - len / 2 + u * 0.2 + i * len * 0.18, by - bodyH + u * 0.15, len * 0.14, u * 0.4), glass, 220);
    var busSeat = [f > 0 ? x - len / 2 + u * 0.2 + 4 * len * 0.18 + len * 0.07 : x - len / 2 + u * 0.2 + len * 0.07, by - bodyH + u * 0.38];
    solid(rectP(x - len / 2, by - u * 0.4, len, u * 0.08), INK, 160);
  } else {
    const cab = [[x - len * 0.3, by - bodyH + 2], [x - len * 0.18, by - bodyH - u * 0.5], [x + len * 0.15, by - bodyH - u * 0.5], [x + len * 0.3, by - bodyH + 2]];
    const cabP = f > 0 ? cab : cab.map(([px, py]) => [2 * x - px, py]);
    shape(cabP, col, 180, 0.04, true);
    solid([[x - len * 0.24, by - bodyH], [x - len * 0.15, by - bodyH - u * 0.42], [x - len * 0.02, by - bodyH - u * 0.42], [x - len * 0.02, by - bodyH]].map(([px, py]) => [f > 0 ? px : 2 * x - px, py]), glass, 220);
    solid([[x + len * 0.02, by - bodyH], [x + len * 0.02, by - bodyH - u * 0.42], [x + len * 0.13, by - bodyH - u * 0.42], [x + len * 0.23, by - bodyH]].map(([px, py]) => [f > 0 ? px : 2 * x - px, py]), glass, 220);
    outline(cabP, INK, 0.5);
  }
  wheel(x - len * 0.3, gy - wr, wr);
  wheel(x + len * 0.3, gy - wr, wr);
  pip(x + f * len * 0.48, by - bodyH * 0.6, u * 0.09, night ? "#fff3b0" : "#f3d660");
  if (night) shape([[x + f * len * 0.5, by - bodyH * 0.6], [x + f * (len * 0.5 + u * 2.5), by - bodyH * 0.6 - u * 0.4], [x + f * (len * 0.5 + u * 2.5), by + u * 0.1]], "#fff3b0", 50, 0.3);
  outline(body, INK, 0.5);
  return { top: by - bodyH - u * 0.5, w: len, seat: isBus ? busSeat : [x - f * len * 0.08, by - bodyH - u * 0.2] };
}

function mBoat(x, wy, s, t, f) {
  const kind = t.o.kind;
  const u = 50 * s;
  const col = t.color && t.color !== "rainbow" ? t.color : pickc(["#c13b4a", "#3a6cb8", "#fbf8f0", "#e1b83f", "#6b4a30"]);
  if (kind === "sub") {
    const body = ellP(x, wy + u * 0.4, u * 1.4, u * 0.5);
    shape(body, t.color || "#f3c94a", 180, 0.05, true);
    solid(rectP(x - u * 0.3, wy - u * 0.25, u * 0.6, u * 0.35), t.color || "#e1b83f");
    ln(x + u * 0.1, wy - u * 0.25, x + u * 0.1, wy - u * 0.6, INK, 1.4);
    for (let i = 0; i < 3; i++) pip(x - u * 0.6 + i * u * 0.6, wy + u * 0.4, u * 0.15, "#5fb3e0");
    outline(body, INK, 0.5);
    return { top: wy - u * 0.6, w: u * 2.8 };
  }
  const ship = kind === "ship" || kind === "pirate";
  const L = u * (ship ? 3.2 : 2.2);
  const hull = [[x - L / 2, wy - u * 0.4], [x + L / 2 + u * 0.2, wy - u * 0.5], [x + L * 0.38, wy + u * 0.25], [x - L * 0.4, wy + u * 0.25]];
  const hc = kind === "pirate" ? "#5e3a26" : col;
  if (kind === "sail" || kind === "pirate") {
    const n = kind === "pirate" ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const mx = x + (n > 1 ? (k - 0.5) * L * 0.4 : 0);
      ln(mx, wy - u * 0.4, mx, wy - u * 2.9, "#6b4a30", 1.8, "2B");
      const sailC = kind === "pirate" ? "#2b2622" : t.color ? "#fbf8f0" : pickc(["#fbf8f0", "#f6e3a0", "#e57a9a"]);
      const sail = kind === "pirate" ? rectP(mx - u * 0.7, wy - u * 2.6, u * 1.4, u * 1.6) : [[mx + 3, wy - u * 2.8], [mx + 3, wy - u * 0.6], [mx + u * 1.3, wy - u * 0.6]];
      shape(sail, sailC, 190, 0.06, true);
      outline(sail, INK, 0.5);
      if (kind === "sail") shape([[mx - 3, wy - u * 2.5], [mx - 3, wy - u * 0.65], [mx - u * 0.9, wy - u * 0.65]], lighter(sailC, 0.1), 170, 0.06, true);
      if (kind === "pirate") {
        pip(mx, wy - u * 1.9, u * 0.22, "#fbf8f0");
        ln(mx - u * 0.25, wy - u * 1.55, mx + u * 0.25, wy - u * 1.35, "#fbf8f0", 1.4);
        ln(mx + u * 0.25, wy - u * 1.55, mx - u * 0.25, wy - u * 1.35, "#fbf8f0", 1.4);
      }
    }
  }
  if (kind === "ship") {
    solid(rectP(x - L * 0.3, wy - u * 1.05, L * 0.6, u * 0.65), "#fbf8f0", 230);
    for (let i = 0; i < 5; i++) pip(x - L * 0.24 + i * L * 0.12, wy - u * 0.75, u * 0.07, "#3a6cb8");
    for (let i = 0; i < 2; i++) {
      solid(rectP(x - L * 0.12 + i * L * 0.2, wy - u * 1.65, u * 0.32, u * 0.62), i ? "#c13b4a" : "#2b2622", 225);
      oval(x - L * 0.08 + i * L * 0.2 - 10, wy - u * 2.0, u * 0.3, u * 0.15, "#c2c6cf", 80);
    }
  }
  shape(hull, hc, 185, 0.05, true);
  if (kind !== "pirate") solid([[x - L / 2 + 3, wy - u * 0.4], [x + L / 2 + u * 0.15, wy - u * 0.48], [x + L / 2, wy - u * 0.32], [x - L / 2 + 5, wy - u * 0.26]], "#fbf8f0", 180);
  outline(hull, INK, 0.5);
  return { top: wy - u * 2.9, w: L + u * 0.4, seat: [x, wy - u * 0.5] };
}

function mAir(x, y, s, t, f) {
  const kind = t.o.kind;
  const u = 50 * s;
  const col = t.color && t.color !== "rainbow" ? t.color : null;
  if (kind === "rocket") {
    const c = col || "#fbf8f0";
    for (let i = 0; i < 3; i++) oval(x, y + u * (1.25 + i * 0.35), u * (0.28 - i * 0.05), u * (0.4 - i * 0.05), ["#f3d660", "#f08a2c", "#e0512b"][i], 170, 0, true);
    for (const e of [-1, 1]) solid([[x + e * u * 0.35, y + u * 0.3], [x + e * u * 0.75, y + u * 1.05], [x + e * u * 0.35, y + u * 0.85]], "#c13b4a");
    const body = [[x - u * 0.38, y + u], [x - u * 0.38, y - u * 0.4], [x, y - u * 1.3], [x + u * 0.38, y - u * 0.4], [x + u * 0.38, y + u]];
    shape(body, c, 190, 0.05, true);
    solid([[x - u * 0.3, y - u * 0.55], [x, y - u * 1.3], [x + u * 0.3, y - u * 0.55]], "#c13b4a", 220);
    oval(x, y - u * 0.05, u * 0.2, u * 0.2, "#5fb3e0", 220, 0, true);
    outline(body, INK, 0.5);
    return { top: y - u * 1.3, w: u * 1.6 };
  }
  if (kind === "ufo") {
    shape([[x - u * 0.5, y + u * 0.1], [x + u * 0.5, y + u * 0.1], [x + u * 1.3, y + u * 2.5], [x - u * 1.3, y + u * 2.5]], "#f6f0a0", 55, 0.35);
    oval(x, y - u * 0.25, u * 0.55, u * 0.45, "#bfe8f0", 170, 0, true);
    const disk = ellP(x, y + u * 0.05, u * 1.3, u * 0.32);
    shape(disk, col || "#a8b0bd", 190, 0.05, true);
    for (let i = 0; i < 5; i++) pip(x - u * 0.9 + i * u * 0.45, y + u * 0.1, u * 0.08, "#f3d660");
    outline(disk, INK, 0.5);
    return { top: y - u * 0.7, w: u * 2.6 };
  }
  if (kind === "hotair") {
    const c = col || pickc(["#c13b4a", "#e98a3a", "#3a6cb8"]);
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = u * (Math.sin(a) > 0 ? 1 - Math.sin(a) * 0.35 : 1);
      pts.push([x + Math.cos(a) * r, y - u * 0.3 + Math.sin(a) * u * 1.1 * (Math.sin(a) > 0 ? 1 : 1)]);
    }
    shape(pts, c, 175, 0.06, true);
    for (const e of [-0.5, 0, 0.5]) sp([[x + e * u * 0.3, y - u * 1.4], [x + e * u * 1.2, y - u * 0.4], [x + e * u * 0.45, y + u * 0.75]], e === 0 ? "#f3d660" : "#fbf8f0", 2.4, "2B");
    ln(x - u * 0.35, y + u * 0.75, x - u * 0.25, y + u * 1.15, INK, 0.8);
    ln(x + u * 0.35, y + u * 0.75, x + u * 0.25, y + u * 1.15, INK, 0.8);
    solid(rectP(x - u * 0.28, y + u * 1.15, u * 0.56, u * 0.35), "#8a5a3c");
    outline(pts, INK, 0.5);
    return { top: y - u * 1.4, w: u * 2 };
  }
  if (kind === "balloon") {
    const n = t.count > 1 ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const bx = x + (i - (n - 1) / 2) * u * 0.7 + random(-6, 6);
      const by = y - (i % 2) * u * 0.4;
      const c = col || pickc(["#c13b4a", "#f3c94a", "#3a6cb8", "#e0509a", "#2f8f68"]);
      sp([[bx, by + u * 0.6], [bx + 6, by + u * 1.2], [x, y + u * 2]], INK, 0.7);
      const b = ellP(bx, by, u * 0.42, u * 0.55);
      shape(b, c, 180, 0.06, true);
      oval(bx - u * 0.13, by - u * 0.2, u * 0.08, u * 0.14, "#fbf8f0", 160, 0.4);
      solid(triP(bx - 4, by + u * 0.62, bx + 4, by + u * 0.62, bx, by + u * 0.5), c);
    }
    return { top: y - u, w: u * 2 };
  }
  if (kind === "kite") {
    const c = col || pickc(["#c13b4a", "#f3c94a", "#3a6cb8", "#e0509a"]);
    const k = [[x, y - u * 0.9], [x + u * 0.6, y - u * 0.1], [x, y + u * 0.9], [x - u * 0.6, y - u * 0.1]];
    shape(k, c, 185, 0.05, true);
    ln(x, y - u * 0.9, x, y + u * 0.9, INK, 0.7);
    ln(x - u * 0.6, y - u * 0.1, x + u * 0.6, y - u * 0.1, INK, 0.7);
    sp([[x, y + u * 0.9], [x - u * 0.3, y + u * 1.5], [x + u * 0.2, y + u * 2.0], [x - u * 0.2, y + u * 2.6]], INK, 0.8);
    for (let i = 0; i < 3; i++) solid(triP(x - u * 0.2 + i * 4, y + u * (1.3 + i * 0.45), x + u * 0.1, y + u * (1.4 + i * 0.45), x - u * 0.05, y + u * (1.2 + i * 0.45)), pickc(["#f3c94a", "#3a6cb8", "#e0509a"]));
    return { top: y - u * 0.9, w: u * 1.3 };
  }
  if (kind === "heli") {
    const c = col || "#c13b4a";
    const body = ellP(x, y, u * 0.75, u * 0.45);
    limb(x - f * u * 0.5, y - u * 0.05, x - f * u * 1.7, y - u * 0.25, u * 0.14, u * 0.06, c);
    shape(body, c, 185, 0.05, true);
    oval(x + f * u * 0.35, y - u * 0.08, u * 0.3, u * 0.25, "#cfe0ec", 210);
    ln(x, y - u * 0.45, x, y - u * 0.65, INK, 1.4);
    ln(x - u * 1.5, y - u * 0.67, x + u * 1.5, y - u * 0.63, INK, 1.6, "2B");
    ln(x - u * 0.5, y + u * 0.6, x + u * 0.6, y + u * 0.6, INK, 1.4);
    outline(body, INK, 0.5);
    return { top: y - u * 0.7, w: u * 3.2 };
  }
  // plane
  const c = col || pickc(["#fbf8f0", "#c2c6cf", "#3a6cb8"]);
  shape([[x - f * u * 0.1, y], [x - f * u * 0.6, y - u * 0.9], [x - f * u * 0.25, y - u * 0.9], [x + f * u * 0.5, y]], darker(c, 0.15), 180, 0.05, true);
  const body = ellP(x, y + u * 0.05, u * 1.5, u * 0.28);
  shape(body, c, 190, 0.05, true);
  shape([[x - f * u * 1.2, y], [x - f * u * 1.6, y - u * 0.7], [x - f * u * 1.35, y - u * 0.7], [x - f * u * 0.9, y]], darker(c, 0.1), 185, 0.05, true);
  shape([[x - f * u * 0.1, y + u * 0.1], [x - f * u * 0.6, y + u * 0.8], [x - f * u * 0.25, y + u * 0.8], [x + f * u * 0.5, y + u * 0.1]], darker(c, 0.05), 185, 0.05, true);
  for (let i = 0; i < 6; i++) pip(x - f * u * 0.6 + f * i * u * 0.25, y, u * 0.06, "#3a6cb8");
  outline(body, INK, 0.5);
  sp([[x - f * u * 1.6, y + u * 0.05], [x - f * u * 3, y + u * 0.15], [x - f * u * 4.5, y + u * 0.1]], "#fbf8f0", 2.2, "2B");
  return { top: y - u * 0.9, w: u * 3.2 };
}

/* ---------------- food ---------------- */

function mFood(x, gy, s, t, f) {
  const kind = t.o.kind;
  const u = 44 * s;
  const col = t.color && t.color !== "rainbow" ? t.color : null;
  const cy = gy - u * 0.6;
  if (kind === "pizza") {
    const tip = [x + f * u * 0.1, gy - u * 0.05];
    const crustL = [x - u * 0.85, gy - u * 1.45];
    const crustR = [x + u * 0.85, gy - u * 1.45];
    const slice = [tip, crustR, [x + u * 0.4, gy - u * 1.6], [x - u * 0.4, gy - u * 1.6], crustL];
    shape(slice, col || "#f3d070", 185, 0.08, true);
    limb(crustL[0], crustL[1] - 3, crustR[0], crustR[1] - 3, u * 0.17, u * 0.17, "#c98a4a", 190);
    for (const [dx, dy] of [[-0.25, -1.1], [0.3, -1.05], [0, -0.65], [-0.05, -1.35]]) pip(x + dx * u, gy + dy * u, u * 0.13, "#b8372d");
    for (let i = 0; i < 4; i++) pip(x + random(-u * 0.4, u * 0.4), gy - u * random(0.6, 1.3), u * 0.04, "#4e6a40");
    sp([[x - u * 0.2, gy - u * 0.6], [x - u * 0.25, gy - u * 0.35], [x - u * 0.18, gy - u * 0.2]], "#f3d070", 2.4, "2B");
    outline(slice, INK, 0.5);
    return { top: gy - u * 1.75, w: u * 1.9 };
  }
  if (kind === "cake") {
    const c = col || pickc(["#f2b5c4", "#f6e3a0", "#fbf8f0", "#8a5a3c"]);
    const w = u * 1.6;
    const layers = [[gy, u * 0.6, darker(c, 0.05)], [gy - u * 0.6, u * 0.55, c]];
    for (const [ly, lh, lc] of layers) {
      const p = rectP(x - w / 2, ly - lh, w, lh);
      shape(p, lc, 180, 0.04, true);
      outline(p, INK, 0.4);
    }
    for (let i = 0; i < 7; i++) oval(x - w / 2 + (i / 6) * w, gy - u * 1.12, u * 0.14, u * 0.12, "#fbf8f0", 200);
    for (let i = 0; i < 4; i++) {
      const cxp = x - w * 0.3 + i * w * 0.2;
      solid(rectP(cxp - 3, gy - u * 1.55, 6, u * 0.4), pickc(["#5fb3e0", "#e0509a", "#f3d660"]), 230);
      oval(cxp, gy - u * 1.68, 4, 8, "#f3a33a", 220);
    }
    pip(x, gy - u * 0.65, u * 0.1, "#c13b4a");
    return { top: gy - u * 1.8, w: w };
  }
  if (kind === "donut") {
    const ring = ellP(x, cy, u * 0.85, u * 0.72);
    shape(ring, "#d9a066", 185, 0.06, true);
    shape(ellP(x, cy - 3, u * 0.75, u * 0.6), col || pickc(["#f19cc4", "#8a5a3c", "#fbf8f0"]), 190, 0.06);
    solid(ellP(x, cy - 2, u * 0.26, u * 0.2), SC.bgAt ? SC.bgAt : PAPER, 255);
    for (let i = 0; i < 10; i++) {
      const a = random(Math.PI * 2);
      const r = u * random(0.38, 0.65);
      ln(x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, x + Math.cos(a) * r + 4, cy + Math.sin(a) * r * 0.8 + 3, pickc(["#5fb3e0", "#f3d660", "#fbf8f0", "#7cc36e"]), 1.6, "2B");
    }
    outline(ring, INK, 0.5);
    return { top: cy - u * 0.8, w: u * 1.8 };
  }
  if (kind === "icecream") {
    const cone = [[x - u * 0.45, gy - u * 1.2], [x + u * 0.45, gy - u * 1.2], [x, gy]];
    shape(cone, "#d9a066", 185, 0.05, true);
    for (let i = 1; i < 4; i++) {
      ln(x - u * 0.45 + i * u * 0.2, gy - u * 1.2, x - u * 0.1 + i * u * 0.1, gy - u * 0.4, "#a8743a", 0.6);
      ln(x + u * 0.45 - i * u * 0.2, gy - u * 1.2, x + u * 0.1 - i * u * 0.1, gy - u * 0.4, "#a8743a", 0.6);
    }
    const scoops = [col || "#f2b5c4", "#f6e8c4", "#8a5a3c"];
    for (let i = 0; i < 2; i++) oval(x + (i ? u * 0.05 : 0), gy - u * (1.45 + i * 0.5), u * (0.5 - i * 0.06), u * 0.4, scoops[i], 185, 0, true);
    pip(x + u * 0.05, gy - u * 2.25, u * 0.12, "#c13b4a");
    outline(cone, INK, 0.5);
    return { top: gy - u * 2.35, w: u * 1.1 };
  }
  if (kind === "burger") {
    const w = u * 1.6;
    const layers = [["#d9a066", 0.25], ["#6b3a26", 0.25], ["#f3c94a", 0.08], ["#7cc36e", 0.1]];
    let y = gy;
    const bottom = rectP(x - w / 2, y - u * 0.3, w, u * 0.3);
    shape(bottom, "#d9a066", 185, 0.05, true);
    y -= u * 0.3;
    for (const [c, h] of layers.slice(1)) {
      shape([[x - w / 2 - 4, y], [x + w / 2 + 4, y], [x + w / 2 + 2, y - h * u * 1.4], [x - w / 2 - 2, y - h * u * 1.4]], c, 190, 0.04, true);
      y -= h * u * 1.4;
    }
    const top = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      top.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * u * 0.7]);
    }
    shape(top, col || "#d9a066", 190, 0.05, true);
    for (let i = 0; i < 6; i++) pip(x + random(-w * 0.3, w * 0.3), y - random(u * 0.15, u * 0.5), 2, "#fbf0c8");
    outline(top, INK, 0.5);
    return { top: y - u * 0.7, w };
  }
  if (kind === "mug") {
    const c = col || pickc(["#fbf8f0", "#3a6cb8", "#c13b4a", "#e1b83f"]);
    sp([[x + u * 0.5, gy - u * 1.0], [x + u * 0.9, gy - u * 0.85], [x + u * 0.85, gy - u * 0.4], [x + u * 0.5, gy - u * 0.35]], c === "#fbf8f0" ? "#8592a3" : c, 3, "2B");
    const m = rectP(x - u * 0.55, gy - u * 1.2, u * 1.1, u * 1.2);
    shape(m, c, 190, 0.04, true);
    oval(x, gy - u * 1.2, u * 0.55, u * 0.12, "#6f4e37", 210);
    for (const d of [-1, 0, 1]) sp([[x + d * u * 0.25, gy - u * 1.4], [x + d * u * 0.25 + 8, gy - u * 1.7], [x + d * u * 0.25 - 4, gy - u * 2.0]], "#a8b0bd", 1.1);
    if (SC.moodSet.has("love")) solid(heartP(x, gy - u * 0.6, u * 0.25), "#c13b5a");
    outline(m, INK, 0.5);
    return { top: gy - u * 2, w: u * 1.6 };
  }
  if (kind === "cookie") {
    const c = ellP(x, cy, u * 0.75, u * 0.7);
    shape(c, col || "#c98a4a", 185, 0.06, true);
    for (let i = 0; i < 7; i++) pip(x + random(-u * 0.45, u * 0.45), cy + random(-u * 0.4, u * 0.4), u * 0.08, "#4a2c1a");
    outline(c, INK, 0.5);
    return { top: cy - u * 0.75, w: u * 1.5 };
  }
  if (kind === "taco") {
    const shell = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      shell.push([x + Math.cos(a) * u * 0.95, gy - u * 0.1 + Math.sin(a) * u * 0.95]);
    }
    for (let i = 0; i < 6; i++) oval(x - u * 0.7 + i * u * 0.28, gy - u * 0.75 - random(6), u * 0.18, u * 0.14, ["#7cc36e", "#c13b4a", "#f3d660"][i % 3], 190);
    shape(shell, col || "#efc66a", 190, 0.05, true);
    outline(shell, INK, 0.5);
    return { top: gy - u * 1.1, w: u * 1.9 };
  }
  if (kind === "bowl") {
    const bowl = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      bowl.push([x + Math.cos(a) * u * 0.95, gy - u * 0.75 + Math.sin(a) * u * 0.7]);
    }
    for (let i = 0; i < 5; i++) sp([[x - u * 0.6 + i * u * 0.3, gy - u * 0.75], [x - u * 0.5 + i * u * 0.3, gy - u * 0.95], [x - u * 0.6 + i * u * 0.3, gy - u * 1.05]], "#f3d070", 2.2, "2B");
    oval(x + u * 0.3, gy - u * 0.85, u * 0.18, u * 0.14, "#fbf8f0", 200);
    pip(x + u * 0.3, gy - u * 0.85, u * 0.08, "#f3c94a");
    ln(x - u * 0.2, gy - u * 0.75, x + u * 0.6, gy - u * 1.6, "#8a5a3c", 1.6, "2B");
    ln(x - u * 0.1, gy - u * 0.75, x + u * 0.7, gy - u * 1.55, "#8a5a3c", 1.6, "2B");
    shape(bowl, col || pickc(["#3a6cb8", "#c13b4a", "#fbf8f0"]), 190, 0.05, true);
    outline(bowl, INK, 0.5);
    return { top: gy - u * 1.6, w: u * 1.9 };
  }
  if (kind === "fries") {
    for (let i = 0; i < 7; i++) solid(rectP(x - u * 0.45 + i * u * 0.14, gy - u * (1.3 + random(0.4)), u * 0.1, u * 0.9), "#f3c94a", 230);
    const box = [[x - u * 0.55, gy - u * 1.0], [x + u * 0.55, gy - u * 1.0], [x + u * 0.45, gy], [x - u * 0.45, gy]];
    shape(box, col || "#c13b4a", 190, 0.04, true);
    outline(box, INK, 0.5);
    return { top: gy - u * 1.7, w: u * 1.2 };
  }
  if (kind === "hotdog") {
    oval(x, cy, u * 1.0, u * 0.35, "#d9a066", 185, 0, true);
    oval(x, cy - u * 0.15, u * 1.1, u * 0.18, "#b8573a", 200);
    sp([[x - u * 0.8, cy - u * 0.25], [x - u * 0.5, cy - u * 0.32], [x - u * 0.2, cy - u * 0.22], [x + u * 0.1, cy - u * 0.32], [x + u * 0.4, cy - u * 0.22], [x + u * 0.7, cy - u * 0.3]], "#e1b83f", 2, "2B");
    return { top: cy - u * 0.4, w: u * 2.2 };
  }
  if (kind === "candy") {
    ln(x, gy, x, gy - u * 1.2, "#fbf8f0", 2.4, "2B");
    ln(x, gy, x, gy - u * 1.2, "#c2c6cf", 0.8);
    oval(x, gy - u * 1.6, u * 0.55, u * 0.55, col || "#e0509a", 180, 0, true);
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const a = i * 0.5;
      const r = u * 0.5 * (1 - i / 30);
      pts.push([x + Math.cos(a) * r, gy - u * 1.6 + Math.sin(a) * r]);
    }
    sp(pts.reverse(), "#fbf8f0", 2, "2B");
    return { top: gy - u * 2.15, w: u * 1.1 };
  }
  if (kind === "cheese") {
    const w = [[x - u * 0.8, gy], [x + u * 0.8, gy], [x + u * 0.8, gy - u * 0.7], [x - u * 0.8, gy - u * 0.3]];
    shape(w, col || "#f3c94a", 190, 0.05, true);
    for (let i = 0; i < 4; i++) pip(x + random(-u * 0.6, u * 0.6), gy - random(u * 0.1, u * 0.35), u * 0.09, "#d9a03a");
    outline(w, INK, 0.5);
    return { top: gy - u * 0.7, w: u * 1.6 };
  }
  if (kind === "egg") {
    const e = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      e.push([x + Math.cos(a) * u * (0.8 + random(-0.15, 0.15)), cy + Math.sin(a) * u * (0.55 + random(-0.1, 0.1))]);
    }
    shape(e, "#fbf8f0", 210, 0.08, true);
    oval(x, cy, u * 0.3, u * 0.28, col || "#f3b33a", 220, 0, true);
    outline(e, "#8592a3", 0.5);
    return { top: cy - u * 0.6, w: u * 1.6 };
  }
  if (kind === "bread") {
    const loaf = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      loaf.push([x + Math.cos(a) * u * 1.0, gy + Math.sin(a) * u * 0.8]);
    }
    shape(loaf, col || "#d9a066", 190, 0.06, true);
    for (let i = 0; i < 3; i++) sp([[x - u * 0.5 + i * u * 0.4, gy - u * 0.45], [x - u * 0.35 + i * u * 0.4, gy - u * 0.65]], "#a8743a", 1.4);
    outline(loaf, INK, 0.5);
    return { top: gy - u * 0.8, w: u * 2 };
  }
  if (kind === "carrot") {
    const c = [[x - u * 0.2, gy - u * 1.4], [x + u * 0.2, gy - u * 1.4], [x + u * 0.03, gy]];
    for (let i = 0; i < 3; i++) shape(bladePoints(x, gy - u * 1.4, Math.PI + (i - 1) * 0.4, u * 0.6, u * 0.08), "#5d8a4a", 150, 0.05);
    shape(c, col || "#f08a2c", 190, 0.04, true);
    outline(c, INK, 0.5);
    return { top: gy - u * 2, w: u * 0.8 };
  }
  if (kind === "pumpkin") {
    const c = col || "#e98a3a";
    for (const [dx, rx] of [[-0.45, 0.55], [0.45, 0.55], [0, 0.6]]) oval(x + dx * u, cy - u * 0.05, rx * u, u * 0.6, dx === 0 ? c : darker(c, 0.08), 185, 0, true);
    limb(x, cy - u * 0.6, x + u * 0.1, cy - u * 0.95, u * 0.08, u * 0.06, "#5d6a3a");
    if (SC.halloween || SC.moodSet.has("spooky")) {
      solid(triP(x - u * 0.35, cy - u * 0.15, x - u * 0.15, cy - u * 0.15, x - u * 0.25, cy - u * 0.35), INK);
      solid(triP(x + u * 0.35, cy - u * 0.15, x + u * 0.15, cy - u * 0.15, x + u * 0.25, cy - u * 0.35), INK);
      solid([[x - u * 0.4, cy + u * 0.1], [x + u * 0.4, cy + u * 0.1], [x + u * 0.25, cy + u * 0.3], [x, cy + u * 0.2], [x - u * 0.25, cy + u * 0.3]], INK);
    }
    return { top: cy - u, w: u * 2 };
  }
  if (kind === "feast") {
    mFood(x - u * 0.6, gy, s * 0.6, { o: { kind: "burger" } }, f);
    mFood(x + u * 0.6, gy, s * 0.6, { o: { kind: "apple" } }, f);
    return { top: gy - u, w: u * 2.2 };
  }
  if (kind === "banana") {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 0.15 + (i / 12) * Math.PI * 0.7;
      pts.push([x + Math.cos(a) * u * 0.9, gy - u * 1.15 + Math.sin(a) * u * 0.9]);
    }
    for (let i = 12; i >= 0; i--) {
      const a = Math.PI * 0.2 + (i / 12) * Math.PI * 0.6;
      pts.push([x + Math.cos(a) * u * 0.75, gy - u * 1.35 + Math.sin(a) * u * 0.95]);
    }
    shape(pts, col || "#f3d660", 190, 0.05, true);
    outline(pts, INK, 0.5);
    return { top: gy - u * 0.8, w: u * 1.8 };
  }
  if (kind === "watermelon") {
    const w = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      w.push([x + Math.cos(a) * u * 1.0, gy - u * 0.9 + Math.sin(a) * u * 0.85]);
    }
    shape(w, "#3f8a3a", 190, 0.05, true);
    const inner = w.map(([px, py]) => [x + (px - x) * 0.85, gy - u * 0.9 + (py - gy + u * 0.9) * 0.82]);
    shape(inner, col || "#e0505a", 200, 0.05);
    for (let i = 0; i < 6; i++) pip(x + random(-u * 0.5, u * 0.5), gy - u * random(0.55, 0.8), 2.4, INK);
    return { top: gy - u, w: u * 2 };
  }
  if (kind === "grapes") {
    for (let r = 0; r < 4; r++) for (let k = 0; k <= 3 - r; k++) pip(x - (3 - r) * u * 0.17 + k * u * 0.34, gy - u * (1.6 - r * 0.32), u * 0.2, col || pickc(["#7a4a9a", "#6a3d8a"]));
    ln(x, gy - u * 1.75, x + 4, gy - u * 2.1, "#6b4a30", 1.4);
    return { top: gy - u * 2.1, w: u * 1.4 };
  }
  // round fruit: apple / orange / lemon / strawberry / cherry
  if (kind === "cherry") {
    for (const d of [-1, 1]) {
      sp([[x + d * u * 0.35, gy - u * 0.45], [x + d * u * 0.15, gy - u * 1.1], [x + u * 0.05, gy - u * 1.6]], "#4e6a40", 1.4);
      oval(x + d * u * 0.35, gy - u * 0.38, u * 0.34, u * 0.32, col || "#b0263a", 200, 0, true);
    }
    return { top: gy - u * 1.6, w: u * 1.6 };
  }
  if (kind === "strawberry") {
    const b = [[x - u * 0.6, gy - u * 1.1], [x + u * 0.6, gy - u * 1.1], [x + u * 0.45, gy - u * 0.5], [x, gy], [x - u * 0.45, gy - u * 0.5]];
    shape(b, col || "#d8304a", 190, 0.08, true);
    for (let i = 0; i < 9; i++) pip(x + random(-u * 0.4, u * 0.4), gy - u * random(0.3, 1.0), 1.6, "#f6e3a0");
    for (let i = 0; i < 4; i++) shape(bladePoints(x, gy - u * 1.1, Math.PI + (i - 1.5) * 0.6, u * 0.4, u * 0.1), "#4e6a40", 170, 0.04);
    return { top: gy - u * 1.5, w: u * 1.3 };
  }
  const fc = col || (kind === "orange" ? "#f08a2c" : kind === "lemon" ? "#f3d660" : pickc(["#c8372d", "#b0263a", "#8fbf4a"]));
  const fr = ellP(x, cy - u * 0.05, u * (kind === "lemon" ? 0.8 : 0.7), u * (kind === "lemon" ? 0.55 : 0.65));
  shape(fr, fc, 190, 0.06, true);
  oval(x - u * 0.25, cy - u * 0.3, u * 0.15, u * 0.1, lighter(fc, 0.5), 150, -0.5);
  if (kind === "apple") {
    ln(x, cy - u * 0.6, x + u * 0.05, cy - u * 0.95, "#6b4a30", 1.6, "2B");
    shape(bladePoints(x + u * 0.05, cy - u * 0.8, Math.PI * 1.35, u * 0.4, u * 0.12), "#5d8a4a", 170, 0.04);
  }
  if (kind === "orange") for (let i = 0; i < 8; i++) pip(x + random(-u * 0.45, u * 0.45), cy + random(-u * 0.45, u * 0.35), 1.4, darker(fc, 0.15));
  outline(fr, INK, 0.5);
  return { top: cy - u, w: u * 1.6 };
}

/* ---------------- sky things ---------------- */

function mSky(x, y, s, t) {
  const kind = t.o.kind;
  const u = 50 * s;
  const col = t.color && t.color !== "rainbow" ? t.color : null;
  if (kind === "sun") {
    const c = col || (SC.time === "sunset" ? "#f08a3a" : "#f3c94a");
    oval(x, y, u * 1.3, u * 1.3, "#fffaf0", 110, 0, false, 0.45);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ln(x + Math.cos(a) * u * 0.95, y + Math.sin(a) * u * 0.95, x + Math.cos(a) * u * 1.35, y + Math.sin(a) * u * 1.35, c, 1.8, "2B");
    }
    oval(x, y, u * 0.75, u * 0.75, c, 200, 0, true, 0.1);
    if (SC.moodSet.has("happy") && !SC.place.startsWith("space")) {
      eye(x - u * 0.25, y - u * 0.1, u * 0.07);
      eye(x + u * 0.25, y - u * 0.1, u * 0.07);
      sp([[x - u * 0.3, y + u * 0.2], [x, y + u * 0.38], [x + u * 0.3, y + u * 0.2]], INK, 1);
    }
    return { top: y - u * 1.4, w: u * 2.8 };
  }
  if (kind === "moon") {
    const c = col || "#f6eec8";
    oval(x, y, u * 1.5, u * 1.5, "#f3e4b4", 40, 0, false, 0.5);
    const crescent = SC.hash % 2 === 0 || t.label === "crescent";
    if (crescent) {
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const a = -Math.PI / 2 + (i / 18) * Math.PI;
        pts.push([x - u * 0.2 + Math.cos(a) * u * 0.85, y + Math.sin(a) * u * 0.85]);
      }
      for (let i = 18; i >= 0; i--) {
        const a = -Math.PI / 2 + (i / 18) * Math.PI;
        pts.push([x - u * 0.2 + Math.cos(a) * u * 0.4, y + Math.sin(a) * u * 0.8]);
      }
      solid(pts, c, 240);
    } else {
      solid(ellP(x, y, u * 0.8, u * 0.8, 0, 26, 0.01), c, 240);
      for (let i = 0; i < 4; i++) pip(x + random(-u * 0.45, u * 0.45), y + random(-u * 0.45, u * 0.45), u * random(0.08, 0.16), "#d8ceac", 160);
    }
    return { top: y - u, w: u * 2 };
  }
  if (kind === "stars") {
    for (let i = 0; i < 8; i++) solid(starP(x + random(-u * 2, u * 2), y + random(-u, u), u * random(0.12, 0.25), u * 0.06), col || pickc(["#f3d660", "#fff6d8"]), 230);
    return { top: y - u, w: u * 4 };
  }
  if (kind === "planet" || kind === "mars" || kind === "earth") {
    const c = col || (kind === "mars" ? "#c8573a" : kind === "earth" ? "#3a6cb8" : pickc(["#e1b83f", "#c98a6a", "#8f9be0", "#3fbfb7"]));
    const r = u * 0.9;
    if (kind === "planet") {
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + (i / 7) * Math.PI;
        ln(x + Math.cos(a) * r * 1.8, y + Math.sin(a) * r * 0.35, x + Math.cos(a + 0.45) * r * 1.8, y + Math.sin(a + 0.45) * r * 0.35, "#d8c08a", 2.2, "2B");
      }
    }
    const ball = ellP(x, y, r, r, 0, 26, 0.01);
    shape(ball, c, 200, 0.08, true);
    if (kind === "earth") for (let i = 0; i < 3; i++) oval(x + random(-r * 0.5, r * 0.5), y + random(-r * 0.5, r * 0.5), r * random(0.25, 0.4), r * random(0.2, 0.3), "#5d8a4a", 200);
    else for (let i = 0; i < 3; i++) oval(x, y - r * 0.5 + i * r * 0.45, r * 0.85, r * 0.08, darker(c, 0.15), 120);
    oval(x - r * 0.3, y - r * 0.3, r * 0.3, r * 0.2, lighter(c, 0.5), 110, -0.5);
    if (kind === "planet") {
      for (let i = 0; i < 8; i++) {
        const a = (i / 7) * Math.PI;
        ln(x + Math.cos(a) * r * 1.8, y + Math.sin(a) * r * 0.35, x + Math.cos(a + 0.45) * r * 1.8, y + Math.sin(a + 0.45) * r * 0.35, "#d8c08a", 2.2, "2B");
      }
    }
    return { top: y - r, w: r * 3.6 };
  }
  if (kind === "comet") {
    for (let i = 0; i < 5; i++) ln(x, y, x - u * (2.5 - i * 0.3), y - u * (1.2 - i * 0.35), "#f6e3a0", 1.4 - i * 0.15, "2B");
    pip(x, y, u * 0.22, "#fff6d8");
    return { top: y - u, w: u * 3 };
  }
  if (kind === "galaxy") {
    oval(x, y, u * 2, u * 0.9, "#7d5ab0", 60, -0.3, false, 0.5);
    for (let arm = 0; arm < 2; arm++) {
      const pts = [];
      for (let i = 0; i < 18; i++) {
        const a = arm * Math.PI + i * 0.32;
        const r = u * 0.12 * i;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45]);
      }
      sp(pts, "#e4b8f0", 2.2, "2B");
    }
    oval(x, y, u * 0.35, u * 0.22, "#fff6d8", 200);
    for (let i = 0; i < 20; i++) pip(x + random(-u * 2, u * 2), y + random(-u * 0.8, u * 0.8), 1.4, "#fff6d8");
    return { top: y - u, w: u * 4 };
  }
  if (kind === "rainbow") {
    const cols = ["#c8372d", "#f08a2c", "#f3d660", "#5d8a4a", "#3a6cb8", "#7a4a9a"];
    const R = u * 3.2;
    for (let i = 0; i < cols.length; i++) {
      const pts = [];
      const r = R - i * u * 0.22;
      for (let k = 0; k <= 18; k++) {
        const a = Math.PI + (k / 18) * Math.PI;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      sp(pts, cols[i], 5.5, "marker");
    }
    return { top: y - R, w: R * 2 };
  }
  if (kind === "cloud") {
    cloud(x, y, u * 1.3, col || (SC.weather.includes("rain") || SC.weather.includes("storm") ? "#8c96a3" : "#ffffff"), 170);
    if (SC.moodSet.has("happy") && !SC.weather.length) {
      eye(x - u * 0.3, y, u * 0.06);
      eye(x + u * 0.3, y, u * 0.06);
    }
    return { top: y - u, w: u * 3 };
  }
  return { top: y, w: u };
}
function cloud(x, y, r, col, a = 150) {
  const blobs = [[0, 0, 1, 0.6], [-0.7, 0.15, 0.6, 0.42], [0.75, 0.15, 0.62, 0.42], [0.25, -0.3, 0.6, 0.45], [-0.35, -0.2, 0.5, 0.4]];
  for (const [dx, dy, rx, ry] of blobs) oval(x + dx * r, y + dy * r, rx * r, ry * r, col, a, 0, true, 0.2);
}

/* ---------------- objects ---------------- */

function mObj(x, gy, s, t, f = 1) {
  const kind = t.o.kind;
  const u = 44 * s;
  const col = t.color && t.color !== "rainbow" ? t.color : null;
  const cy = gy - u * 0.75;
  switch (kind) {
    case "heart": {
      const p = heartP(x, cy - u * 0.1, u * 0.9);
      shape(p, col || "#d84a6a", 200, 0.08, true);
      oval(x - u * 0.35, cy - u * 0.4, u * 0.15, u * 0.1, "#fbe0e6", 150, -0.6);
      outline(p, INK, 0.5);
      return { top: cy - u, w: u * 2 };
    }
    case "books": {
      const cols = [col || "#c13b4a", "#3a6cb8", "#2f8f68", "#e1b83f"];
      let y = gy;
      for (let i = 0; i < 4; i++) {
        const w = u * (1.6 - (i % 2) * 0.2);
        const h = u * 0.32;
        const dx = random(-u * 0.12, u * 0.12);
        const p = rectP(x - w / 2 + dx, y - h, w, h);
        shape(p, cols[i], 190, 0.03, true);
        solid(rectP(x - w / 2 + dx + w * 0.82, y - h + 3, w * 0.12, h - 6), "#f6f0dc", 220);
        outline(p, INK, 0.4);
        y -= h;
      }
      if (SC.moodSet.has("stressed")) for (let i = 0; i < 3; i++) shape(rectP(x - u * 0.4 + i * u * 0.4 + random(-8, 8), y - u * 0.5 - i * 6, u * 0.5, u * 0.65), "#fbf8f0", 200, 0.02, true);
      return { top: y - u * 0.3, w: u * 1.7 };
    }
    case "paper": {
      for (let i = 0; i < 3; i++) {
        const px = x + (i - 1) * u * 0.25;
        const py = gy - i * 5;
        const p = rectP(px - u * 0.55, py - u * 1.5, u * 1.1, u * 1.5);
        shape(p, "#fbf8f0", 230, 0.02, true);
        outline(p, "#8592a3", 0.5);
        if (i === 2) {
          for (let k = 0; k < 5; k++) ln(px - u * 0.4, py - u * 1.2 + k * u * 0.22, px + u * 0.35, py - u * 1.2 + k * u * 0.22, "#8592a3", 0.6);
          const grade = SC.moodSet.has("stressed") || SC.moodSet.has("sad") ? "F" : "A";
          pen("#c8372d", 1.6, "2B");
          if (grade === "A") {
            brush.line(px + u * 0.1, py - u * 0.25, px + u * 0.22, py - u * 0.65);
            brush.line(px + u * 0.22, py - u * 0.65, px + u * 0.34, py - u * 0.25);
            brush.line(px + u * 0.15, py - u * 0.42, px + u * 0.3, py - u * 0.42);
          } else {
            brush.line(px + u * 0.15, py - u * 0.25, px + u * 0.15, py - u * 0.65);
            brush.line(px + u * 0.15, py - u * 0.65, px + u * 0.35, py - u * 0.65);
            brush.line(px + u * 0.15, py - u * 0.45, px + u * 0.3, py - u * 0.45);
          }
          outline(ellP(px + u * 0.22, py - u * 0.45, u * 0.25, u * 0.28, 0, 12, 0.05), "#c8372d", 0.8);
        }
      }
      return { top: gy - u * 1.6, w: u * 1.8 };
    }
    case "clock": {
      const c = ellP(x, cy - u * 0.2, u * 0.85, u * 0.85, 0, 28, 0.01);
      shape(c, col || "#e1b83f", 200, 0.05, true);
      solid(ellP(x, cy - u * 0.2, u * 0.68, u * 0.68, 0, 28, 0.01), "#fbf8f0", 240);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pip(x + Math.cos(a) * u * 0.56, cy - u * 0.2 + Math.sin(a) * u * 0.56, 1.6, INK);
      }
      const late = SC.moodSet.has("stressed");
      const ah = late ? -0.3 : -Math.PI / 2 + random(-1, 1);
      ln(x, cy - u * 0.2, x + Math.cos(ah) * u * 0.32, cy - u * 0.2 + Math.sin(ah) * u * 0.32, INK, 1.8, "2B");
      const am = late ? -Math.PI / 2 - 0.2 : random(Math.PI * 2);
      ln(x, cy - u * 0.2, x + Math.cos(am) * u * 0.5, cy - u * 0.2 + Math.sin(am) * u * 0.5, INK, 1.2, "2B");
      for (const e of [-1, 1]) oval(x + e * u * 0.6, cy - u * 0.95, u * 0.25, u * 0.2, col || "#c8372d", 200, e * 0.5);
      ln(x - u * 0.5, gy, x - u * 0.4, cy + u * 0.5, INK, 1.4);
      ln(x + u * 0.5, gy, x + u * 0.4, cy + u * 0.5, INK, 1.4);
      outline(c, INK, 0.5);
      if (late) for (let i = 0; i < 3; i++) ln(x + u * (0.9 + i * 0.08), cy - u * (0.9 - i * 0.25), x + u * (1.15 + i * 0.08), cy - u * (1.0 - i * 0.25), INK, 0.8);
      return { top: cy - u * 1.15, w: u * 1.8 };
    }
    case "phone": {
      const p = rectP(x - u * 0.45, gy - u * 1.7, u * 0.9, u * 1.7);
      shape(p, col || "#2b2622", 220, 0.03, true);
      solid(rectP(x - u * 0.37, gy - u * 1.6, u * 0.74, u * 1.45), "#8fd0e8", 230);
      for (let i = 0; i < 3; i++) solid(rectP(x - u * 0.3 + (i % 2) * u * 0.2, gy - u * 1.45 + i * u * 0.35, u * 0.4, u * 0.22), i % 2 ? "#3dd6f5" : "#fbf8f0", 230);
      outline(p, INK, 0.5);
      return { top: gy - u * 1.7, w: u };
    }
    case "laptop": {
      const scr = [[x - u * 0.9, gy - u * 0.12], [x - u * 0.85, gy - u * 1.35], [x + u * 0.85, gy - u * 1.35], [x + u * 0.9, gy - u * 0.12]];
      shape(scr, col || "#5f6b7a", 210, 0.03, true);
      solid([[x - u * 0.75, gy - u * 0.25], [x - u * 0.72, gy - u * 1.22], [x + u * 0.72, gy - u * 1.22], [x + u * 0.75, gy - u * 0.25]], SC.time === "night" ? "#bfe8f0" : "#2c3b70", 230);
      for (let i = 0; i < 5; i++) ln(x - u * 0.6 + (i % 2) * 10, gy - u * (1.05 - i * 0.16), x - u * 0.6 + random(u * 0.4, u * 1.1), gy - u * (1.05 - i * 0.16), i % 2 ? "#3dd6f5" : "#ffb020", 1.1);
      shape([[x - u * 1.1, gy], [x + u * 1.1, gy], [x + u * 0.9, gy - u * 0.12], [x - u * 0.9, gy - u * 0.12]], "#a8b0bd", 210, 0.03, true);
      outline(scr, INK, 0.5);
      return { top: gy - u * 1.35, w: u * 2.2 };
    }
    case "notes": {
      for (let i = 0; i < 3; i++) {
        const nx = x + (i - 1) * u * 0.55;
        const ny = gy - u * (0.35 + (i % 2) * 0.6);
        oval(nx, ny, u * 0.2, u * 0.15, col || INK, 230, -0.4);
        ln(nx + u * 0.17, ny - 2, nx + u * 0.17, ny - u * 0.9, col || INK, 1.6, "2B");
        sp([[nx + u * 0.17, ny - u * 0.9], [nx + u * 0.4, ny - u * 0.7], [nx + u * 0.38, ny - u * 0.5]], col || INK, 1.6, "2B");
      }
      return { top: gy - u * 1.9, w: u * 1.8 };
    }
    case "guitar": {
      oval(x, gy - u * 0.55, u * 0.6, u * 0.5, col || "#c98a4a", 200, 0, true);
      oval(x, gy - u * 1.2, u * 0.45, u * 0.38, col || "#c98a4a", 200, 0, true);
      pip(x, gy - u * 0.8, u * 0.16, "#4a2c1a");
      limb(x, gy - u * 1.4, x, gy - u * 2.6, u * 0.08, u * 0.07, "#6b4a30", 220);
      solid(rectP(x - u * 0.12, gy - u * 2.9, u * 0.24, u * 0.3), "#4a2c1a");
      for (const d of [-3, 0, 3]) ln(x + d, gy - u * 0.4, x + d, gy - u * 2.7, "#e8e4dc", 0.5);
      return { top: gy - u * 2.9, w: u * 1.3 };
    }
    case "ball": {
      const sport = (t.raw || "").match(/basket/) ? "basket" : (t.raw || "").match(/football/) && !(t.raw || "").match(/soccer/) ? "soccer" : null;
      const b = ellP(x, cy, u * 0.72, u * 0.72, 0, 26, 0.01);
      const kindB = SC.hash % 3;
      const c = col || (kindB === 0 ? "#fbf8f0" : kindB === 1 ? "#e98a3a" : "#fbf8f0");
      shape(b, c, 210, 0.05, true);
      if (kindB === 1 && !col) {
        ln(x - u * 0.72, cy, x + u * 0.72, cy, INK, 1);
        ln(x, cy - u * 0.72, x, cy + u * 0.72, INK, 1);
        sp([[x - u * 0.5, cy - u * 0.5], [x - u * 0.25, cy], [x - u * 0.5, cy + u * 0.5]], INK, 1);
        sp([[x + u * 0.5, cy - u * 0.5], [x + u * 0.25, cy], [x + u * 0.5, cy + u * 0.5]], INK, 1);
      } else {
        solid(starP(x, cy, u * 0.24, u * 0.2, 5), INK, 220);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
          ln(x + Math.cos(a) * u * 0.24, cy + Math.sin(a) * u * 0.24, x + Math.cos(a) * u * 0.6, cy + Math.sin(a) * u * 0.6, INK, 0.9);
          pip(x + Math.cos(a) * u * 0.66, cy + Math.sin(a) * u * 0.66, u * 0.08, INK, 200);
        }
      }
      outline(b, INK, 0.6);
      return { top: cy - u * 0.75, w: u * 1.5 };
    }
    case "crown": {
      const p = [[x - u * 0.8, gy - u * 0.2], [x - u * 0.9, gy - u * 1.1], [x - u * 0.45, gy - u * 0.65], [x, gy - u * 1.3], [x + u * 0.45, gy - u * 0.65], [x + u * 0.9, gy - u * 1.1], [x + u * 0.8, gy - u * 0.2]];
      shape(p, col || "#e1b83f", 210, 0.04, true);
      for (const [dx, dy] of [[-0.9, -1.1], [0, -1.3], [0.9, -1.1]]) pip(x + dx * u, gy + dy * u, u * 0.1, "#c8372d");
      pip(x, gy - u * 0.45, u * 0.12, "#3a6cb8");
      outline(p, INK, 0.5);
      return { top: gy - u * 1.4, w: u * 1.9 };
    }
    case "key": {
      const c = col || "#e1b83f";
      outline(ellP(x - u * 0.5, cy, u * 0.38, u * 0.38, 0, 16, 0), c, 3);
      limb(x - u * 0.12, cy, x + u * 0.9, cy, u * 0.08, u * 0.08, c, 220);
      solid(rectP(x + u * 0.55, cy, u * 0.1, u * 0.3), c);
      solid(rectP(x + u * 0.78, cy, u * 0.1, u * 0.25), c);
      return { top: cy - u * 0.4, w: u * 1.9 };
    }
    case "umbrella": {
      const c = col || pickc(["#c13b4a", "#3a6cb8", "#f3c94a"]);
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const a = Math.PI + (i / 18) * Math.PI;
        pts.push([x + Math.cos(a) * u * 1.1, gy - u * 1.5 + Math.sin(a) * u * 0.8]);
      }
      shape(pts, c, 200, 0.05, true);
      ln(x, gy - u * 2.3, x, gy - u * 0.2, INK, 1.4, "2B");
      sp([[x, gy - u * 0.2], [x + u * 0.1, gy], [x + u * 0.25, gy - u * 0.1]], INK, 1.4, "2B");
      outline(pts, INK, 0.5);
      return { top: gy - u * 2.3, w: u * 2.2 };
    }
    case "candle": {
      const c = col || "#f6eec8";
      oval(x, gy - u * 1.6, u * 0.8, u * 0.8, "#fff3b0", 60, 0, false, 0.5);
      const p = rectP(x - u * 0.25, gy - u * 1.2, u * 0.5, u * 1.2);
      shape(p, c, 210, 0.03, true);
      ln(x, gy - u * 1.2, x, gy - u * 1.35, INK, 1);
      oval(x, gy - u * 1.55, u * 0.12, u * 0.25, "#f3a33a", 220);
      oval(x, gy - u * 1.5, u * 0.06, u * 0.12, "#fff3b0", 230);
      outline(p, INK, 0.5);
      return { top: gy - u * 1.9, w: u };
    }
    case "gift": {
      const c = col || pickc(["#c13b4a", "#3a6cb8", "#2f8f68", "#7a4a9a"]);
      const p = rectP(x - u * 0.75, gy - u * 1.2, u * 1.5, u * 1.2);
      shape(p, c, 200, 0.03, true);
      solid(rectP(x - u * 0.12, gy - u * 1.2, u * 0.24, u * 1.2), "#f3d660", 230);
      solid(rectP(x - u * 0.85, gy - u * 1.45, u * 1.7, u * 0.3), darker(c, 0.1), 230);
      for (const e of [-1, 1]) oval(x + e * u * 0.3, gy - u * 1.6, u * 0.3, u * 0.17, "#f3d660", 220, e * -0.5);
      outline(p, INK, 0.5);
      return { top: gy - u * 1.8, w: u * 1.7 };
    }
    case "trophy": {
      const c = col || "#e1b83f";
      const cup = [[x - u * 0.7, gy - u * 1.9], [x + u * 0.7, gy - u * 1.9], [x + u * 0.5, gy - u * 1.1], [x + u * 0.12, gy - u * 0.85], [x - u * 0.12, gy - u * 0.85], [x - u * 0.5, gy - u * 1.1]];
      for (const e of [-1, 1]) outline(ellP(x + e * u * 0.75, gy - u * 1.55, u * 0.25, u * 0.28, 0, 14, 0), c, 2.4);
      shape(cup, c, 215, 0.04, true);
      solid(rectP(x - u * 0.1, gy - u * 0.85, u * 0.2, u * 0.5), c);
      solid(rectP(x - u * 0.5, gy - u * 0.35, u, u * 0.35), "#6b4a30");
      solid(starP(x, gy - u * 1.45, u * 0.2, u * 0.09), "#fff3b0");
      outline(cup, INK, 0.5);
      return { top: gy - u * 2, w: u * 1.9 };
    }
    case "pencil": {
      const c = col || "#f3c94a";
      const p = limbP(x - u * 0.9, gy - u * 0.3, x + u * 0.6, gy - u * 1.5, u * 0.16, u * 0.16);
      shape(p, c, 220, 0.03, true);
      solid([[x + u * 0.6 + u * 0.1, gy - u * 1.5 + u * 0.12], [x + u * 0.6 - u * 0.1, gy - u * 1.5 - u * 0.12], [x + u * 0.95, gy - u * 1.85]], "#e8c49a");
      pip(x + u * 0.92, gy - u * 1.82, u * 0.05, INK);
      pip(x - u * 0.92, gy - u * 0.28, u * 0.16, "#e57a9a");
      return { top: gy - u * 1.9, w: u * 2 };
    }
    case "sword": {
      const c = col || "#c2c6cf";
      shape([[x - u * 0.1, gy - u * 0.6], [x - u * 0.1, gy - u * 2.4], [x, gy - u * 2.7], [x + u * 0.1, gy - u * 2.4], [x + u * 0.1, gy - u * 0.6]], c, 220, 0.03, true);
      solid(rectP(x - u * 0.45, gy - u * 0.65, u * 0.9, u * 0.12), "#e1b83f");
      solid(rectP(x - u * 0.07, gy - u * 0.55, u * 0.14, u * 0.5), "#6b4a30");
      return { top: gy - u * 2.7, w: u };
    }
    case "flag": {
      const c = col || pickc(["#c13b4a", "#3a6cb8", "#2f8f68", "#e1b83f"]);
      ln(x - u * 0.6, gy, x - u * 0.6, gy - u * 2.6, "#6b4a30", 2, "2B");
      const fl = [[x - u * 0.6, gy - u * 2.6], [x + u * 0.4, gy - u * 2.4], [x + u * 0.9, gy - u * 2.55], [x + u * 0.85, gy - u * 1.75], [x + u * 0.4, gy - u * 1.6], [x - u * 0.6, gy - u * 1.8]];
      shape(fl, c, 210, 0.05, true);
      solid(starP(x + u * 0.1, gy - u * 2.15, u * 0.18, u * 0.08), "#fbf8f0");
      outline(fl, INK, 0.5);
      return { top: gy - u * 2.6, w: u * 1.6 };
    }
    case "gem": {
      const c = col || pickc(["#3fbfb7", "#8f9be0", "#e0509a", "#5fd0d0"]);
      const p = [[x - u * 0.7, gy - u * 1.1], [x - u * 0.4, gy - u * 1.5], [x + u * 0.4, gy - u * 1.5], [x + u * 0.7, gy - u * 1.1], [x, gy - u * 0.1]];
      shape(p, c, 200, 0.04, true);
      solid([[x - u * 0.4, gy - u * 1.5], [x, gy - u * 1.1], [x + u * 0.4, gy - u * 1.5]], lighter(c, 0.4), 200);
      ln(x - u * 0.7, gy - u * 1.1, x + u * 0.7, gy - u * 1.1, darker(c, 0.3), 0.8);
      ln(x, gy - u * 1.1, x, gy - u * 0.1, darker(c, 0.3), 0.6);
      sparkle(x + u * 0.6, gy - u * 1.6, u * 0.2, "#fbf8f0");
      outline(p, INK, 0.5);
      return { top: gy - u * 1.6, w: u * 1.5 };
    }
    case "coins": {
      for (let i = 0; i < 5; i++) {
        oval(x + random(-u * 0.6, u * 0.6), gy - u * 0.15 - i * u * 0.18, u * 0.45, u * 0.15, col || "#e1b83f", 210, 0, true);
      }
      oval(x + u * 0.7, gy - u * 0.5, u * 0.42, u * 0.42, col || "#e1b83f", 210, 0, true);
      pen(darker(col || "#e1b83f", 0.4), 1.4, "2B");
      brush.line(x + u * 0.7, gy - u * 0.75, x + u * 0.7, gy - u * 0.25);
      sp([[x + u * 0.85, gy - u * 0.65], [x + u * 0.6, gy - u * 0.62], [x + u * 0.8, gy - u * 0.38], [x + u * 0.55, gy - u * 0.35]], darker(col || "#e1b83f", 0.4), 1.2);
      return { top: gy - u * 1.1, w: u * 2 };
    }
    case "camera": {
      const p = rectP(x - u * 0.8, gy - u * 1.1, u * 1.6, u * 1.0);
      shape(p, col || "#3c3f45", 220, 0.03, true);
      solid(rectP(x - u * 0.3, gy - u * 1.3, u * 0.6, u * 0.25), col || "#3c3f45");
      oval(x, gy - u * 0.6, u * 0.38, u * 0.38, "#a8b0bd", 230, 0, true);
      pip(x, gy - u * 0.6, u * 0.22, "#2c3b70");
      pip(x - u * 0.08, gy - u * 0.68, u * 0.06, "#fbf8f0");
      outline(p, INK, 0.5);
      return { top: gy - u * 1.3, w: u * 1.6 };
    }
    case "controller": {
      const c = col || "#3c3f45";
      const p = [[x - u * 0.9, gy - u * 0.8], [x - u * 0.6, gy - u * 1.15], [x + u * 0.6, gy - u * 1.15], [x + u * 0.9, gy - u * 0.8], [x + u * 0.8, gy - u * 0.2], [x + u * 0.4, gy - u * 0.4], [x - u * 0.4, gy - u * 0.4], [x - u * 0.8, gy - u * 0.2]];
      shape(p, c, 215, 0.04, true);
      solid(rectP(x - u * 0.6, gy - u * 0.85, u * 0.35, u * 0.1), "#fbf8f0");
      solid(rectP(x - u * 0.475, gy - u * 0.97, u * 0.1, u * 0.35), "#fbf8f0");
      for (const [dx, dy, cc] of [[0.45, -0.95, "#c8372d"], [0.6, -0.8, "#3dd6f5"], [0.3, -0.8, "#ffb020"], [0.45, -0.65, "#7cc36e"]]) pip(x + dx * u, gy + dy * u, u * 0.07, cc);
      outline(p, INK, 0.5);
      return { top: gy - u * 1.2, w: u * 1.9 };
    }
    case "dice": {
      for (let k = 0; k < 2; k++) {
        const dx = x + (k - 0.5) * u * 0.95;
        const p = rectP(dx - u * 0.4, gy - u * 0.8 - k * 4, u * 0.8, u * 0.8);
        shape(p, col || "#fbf8f0", 220, 0.03, true);
        const n = 1 + Math.floor(random(6));
        const spots = [[0, 0], [-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, 0], [0.2, 0]].slice(n % 2 ? 0 : 1, (n % 2 ? 0 : 1) + n);
        for (const [sx, sy] of spots) pip(dx + sx * u, gy - u * 0.4 - k * 4 + sy * u, u * 0.07, INK);
        outline(p, INK, 0.5);
      }
      return { top: gy - u, w: u * 2 };
    }
    case "letter": {
      const p = rectP(x - u * 0.9, gy - u * 1.1, u * 1.8, u * 1.1);
      shape(p, col || "#f6f0dc", 220, 0.03, true);
      solid([[x - u * 0.9, gy - u * 1.1], [x, gy - u * 0.45], [x + u * 0.9, gy - u * 1.1]], "#e8dcc0", 230);
      outline([[x - u * 0.9, gy - u * 1.1], [x, gy - u * 0.45], [x + u * 0.9, gy - u * 1.1]], INK, 0.5);
      solid(heartP(x, gy - u * 0.5, u * 0.2), "#c13b4a");
      outline(p, INK, 0.5);
      return { top: gy - u * 1.1, w: u * 1.8 };
    }
    case "fire": {
      for (let i = 0; i < 3; i++) limb(x - u * 0.6 + i * u * 0.1, gy - u * 0.05 - i * 3, x + u * 0.6 - i * u * 0.1, gy - u * 0.2 + i * 3, u * 0.1, u * 0.1, "#6b4a30", 200);
      oval(x, gy - u * 0.9, u * 1.2, u * 1.2, "#ffd27a", 45, 0, false, 0.5);
      const flame = (fx, fy, w, h, c) => shape([[fx - w, fy], [fx - w * 0.6, fy - h * 0.5], [fx - w * 0.2, fy - h * 0.7], [fx, fy - h], [fx + w * 0.3, fy - h * 0.6], [fx + w * 0.7, fy - h * 0.45], [fx + w, fy]], c, 200, 0.12, true);
      flame(x, gy - u * 0.15, u * 0.55, u * 1.6, col || "#e0512b");
      flame(x, gy - u * 0.15, u * 0.38, u * 1.1, "#f08a2c");
      flame(x, gy - u * 0.15, u * 0.2, u * 0.6, "#f3d660");
      return { top: gy - u * 1.7, w: u * 1.4 };
    }
    case "skull": {
      const sk = ellP(x, gy - u * 1.0, u * 0.7, u * 0.62);
      shape(sk, "#f6f0dc", 220, 0.05, true);
      shape(rectP(x - u * 0.38, gy - u * 0.6, u * 0.76, u * 0.45), "#f6f0dc", 220, 0.05, true);
      for (const e of [-1, 1]) oval(x + e * u * 0.27, gy - u * 1.0, u * 0.18, u * 0.2, INK, 230);
      solid(triP(x - u * 0.08, gy - u * 0.65, x + u * 0.08, gy - u * 0.65, x, gy - u * 0.82), INK);
      for (let i = 0; i < 4; i++) ln(x - u * 0.24 + i * u * 0.16, gy - u * 0.42, x - u * 0.24 + i * u * 0.16, gy - u * 0.18, INK, 0.8);
      outline(sk, INK, 0.5);
      return { top: gy - u * 1.65, w: u * 1.4 };
    }
    case "rock": {
      const r = [[x - u, gy], [x - u * 0.8, gy - u * 0.6], [x - u * 0.2, gy - u * 0.95], [x + u * 0.5, gy - u * 0.8], [x + u, gy - u * 0.2], [x + u * 0.9, gy]];
      shape(r, col || "#8c8f96", 200, 0.05, true);
      solid([[x - u * 0.2, gy - u * 0.95], [x + u * 0.5, gy - u * 0.8], [x + u * 0.2, gy - u * 0.5]], lighter(col || "#8c8f96", 0.3), 180);
      outline(r, INK, 0.5);
      return { top: gy - u, w: u * 2 };
    }
    case "shell": {
      const c = col || "#f2b5c4";
      const pts = [[x, gy - u * 0.1]];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI + (i / 12) * Math.PI;
        pts.push([x + Math.cos(a) * u * 0.8, gy - u * 0.5 + Math.sin(a) * u * 0.7]);
      }
      shape(pts, c, 210, 0.05, true);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + ((i + 0.5) / 6) * Math.PI;
        ln(x, gy - u * 0.1, x + Math.cos(a) * u * 0.75, gy - u * 0.5 + Math.sin(a) * u * 0.65, darker(c, 0.3), 0.8);
      }
      return { top: gy - u * 1.2, w: u * 1.6 };
    }
    case "feather": {
      const c = col || "#5fb3e0";
      shape(bladePoints(x - u * 0.6, gy - u * 0.2, Math.PI * 1.25, u * 2.2, u * 0.32), c, 190, 0.06, true);
      ln(x - u * 0.6, gy - u * 0.2, x + u * 0.95, gy - u * 1.75, darker(c, 0.35), 1.2);
      return { top: gy - u * 1.9, w: u * 1.8 };
    }
    case "snowflake":
    case "star": {
      if (kind === "star") {
        const p = starP(x, cy, u * 0.85, u * 0.38);
        shape(p, col || "#f3c94a", 215, 0.05, true);
        outline(p, INK, 0.5);
      } else for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ln(x - Math.cos(a) * u * 0.8, cy - Math.sin(a) * u * 0.8, x + Math.cos(a) * u * 0.8, cy + Math.sin(a) * u * 0.8, col || "#8fc1e6", 2, "2B");
      }
      return { top: cy - u, w: u * 1.8 };
    }
    case "anchor": {
      const c = col || "#3c3f45";
      ln(x, gy - u * 2, x, gy - u * 0.2, c, 3.2, "2B");
      ln(x - u * 0.4, gy - u * 1.6, x + u * 0.4, gy - u * 1.6, c, 3, "2B");
      outline(ellP(x, gy - u * 2.15, u * 0.18, u * 0.18, 0, 12, 0), c, 2.4);
      sp([[x - u * 0.8, gy - u * 0.7], [x - u * 0.5, gy - u * 0.25], [x, gy - u * 0.15], [x + u * 0.5, gy - u * 0.25], [x + u * 0.8, gy - u * 0.7]], c, 3, "2B");
      return { top: gy - u * 2.3, w: u * 1.8 };
    }
    case "bed": {
      const c = col || pickc(["#3a6cb8", "#e57a9a", "#7a4a9a"]);
      solid(rectP(x - u * 1.5, gy - u * 1.4, u * 0.18, u * 1.4), "#6b4a30");
      solid(rectP(x + u * 1.32, gy - u * 0.9, u * 0.18, u * 0.9), "#6b4a30");
      const blanket = [[x - u * 1.3, gy - u * 0.35], [x - u * 1.3, gy - u * 0.85], [x + u * 1.35, gy - u * 0.85], [x + u * 1.35, gy - u * 0.35]];
      shape(blanket, c, 200, 0.05, true);
      oval(x - u * 0.95, gy - u * 0.98, u * 0.35, u * 0.2, "#fbf8f0", 220, 0, true);
      for (let i = 0; i < 4; i++) ln(x - u * 0.5 + i * u * 0.45, gy - u * 0.85, x - u * 0.5 + i * u * 0.45, gy - u * 0.35, darker(c, 0.2), 0.8);
      outline(blanket, INK, 0.5);
      return { top: gy - u * 1.4, w: u * 3, seat: [x, gy - u * 0.9] };
    }
    case "chair": {
      const c = col || "#a8743a";
      solid(rectP(x - u * 0.6, gy - u * 0.95, u * 1.2, u * 0.15), c);
      for (const e of [-1, 1]) solid(rectP(x + e * u * 0.5 - u * 0.05, gy - u * 0.85, u * 0.1, u * 0.85), darker(c, 0.1));
      solid(rectP(x - u * 0.6, gy - u * 2, u * 0.12, u * 1.1), c);
      for (let i = 0; i < 3; i++) solid(rectP(x - u * 0.55, gy - u * (1.9 - i * 0.3), u * 0.5, u * 0.08), c);
      return { top: gy - u * 2, w: u * 1.3 };
    }
    case "hat": {
      const c = col || pickc(["#2b2622", "#c13b4a", "#3a6cb8"]);
      if ((SC.prompt || "").match(/graduat/)) {
        solid([[x - u * 1.0, gy - u * 0.9], [x, gy - u * 1.3], [x + u * 1.0, gy - u * 0.9], [x, gy - u * 0.5]], INK);
        solid(rectP(x - u * 0.45, gy - u * 0.75, u * 0.9, u * 0.5), INK);
        sp([[x, gy - u * 0.9], [x + u * 0.6, gy - u * 0.8], [x + u * 0.7, gy - u * 0.35]], "#e1b83f", 1.6);
        return { top: gy - u * 1.3, w: u * 2 };
      }
      oval(x, gy - u * 0.2, u * 1.0, u * 0.18, c, 210, 0, true);
      shape(rectP(x - u * 0.5, gy - u * 1.1, u, u * 0.9), c, 210, 0.04, true);
      solid(rectP(x - u * 0.5, gy - u * 0.5, u, u * 0.15), "#c8372d");
      return { top: gy - u * 1.1, w: u * 2 };
    }
    case "shoe": {
      const c = col || pickc(["#c13b4a", "#3a6cb8", "#fbf8f0"]);
      const p = [[x - u * 0.9, gy], [x - u * 0.9, gy - u * 0.8], [x - u * 0.3, gy - u * 0.8], [x - u * 0.1, gy - u * 0.45], [x + u * 0.8, gy - u * 0.3], [x + u, gy]];
      shape(p, c, 210, 0.04, true);
      solid(rectP(x - u * 0.9, gy - u * 0.12, u * 1.9, u * 0.12), "#fbf8f0");
      for (let i = 0; i < 3; i++) ln(x - u * 0.35 + i * u * 0.13, gy - u * 0.65 + i * 4, x - u * 0.1 + i * u * 0.13, gy - u * 0.55 + i * 4, "#fbf8f0", 1);
      outline(p, INK, 0.5);
      return { top: gy - u * 0.8, w: u * 2 };
    }
    case "glasses": {
      for (const e of [-1, 1]) {
        oval(x + e * u * 0.5, cy, u * 0.38, u * 0.3, "#2c3b70", 180, 0, true);
        outline(ellP(x + e * u * 0.5, cy, u * 0.38, u * 0.3, 0, 16, 0), INK, 1.6);
      }
      sp([[x - u * 0.12, cy - 3], [x, cy - 8], [x + u * 0.12, cy - 3]], INK, 1.4);
      return { top: cy - u * 0.4, w: u * 2 };
    }
    case "eye": {
      const p = [];
      for (let i = 0; i <= 12; i++) p.push([x - u + (i / 12) * 2 * u, cy - Math.sin((i / 12) * Math.PI) * u * 0.55]);
      for (let i = 12; i >= 0; i--) p.push([x - u + (i / 12) * 2 * u, cy + Math.sin((i / 12) * Math.PI) * u * 0.55]);
      shape(p, "#fbf8f0", 230, 0.04, true);
      pip(x, cy, u * 0.4, col || "#3a6cb8");
      pip(x, cy, u * 0.18, INK);
      pip(x - u * 0.12, cy - u * 0.12, u * 0.07, "#fbf8f0");
      outline(p, INK, 0.7);
      return { top: cy - u * 0.6, w: u * 2 };
    }
    case "bulb": {
      oval(x, gy - u * 1.4, u * 1.1, u * 1.1, "#fff3b0", 60, 0, false, 0.5);
      const b = ellP(x, gy - u * 1.4, u * 0.6, u * 0.62);
      shape(b, col || "#f6e3a0", 210, 0.05, true);
      solid(rectP(x - u * 0.25, gy - u * 0.85, u * 0.5, u * 0.45), "#a8b0bd");
      sp([[x - u * 0.15, gy - u * 0.9], [x - u * 0.1, gy - u * 1.4], [x + u * 0.1, gy - u * 1.4], [x + u * 0.15, gy - u * 0.9]], "#c98a4a", 1);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.45;
        ln(x + Math.cos(a) * u * 0.8, gy - u * 1.4 + Math.sin(a) * u * 0.8, x + Math.cos(a) * u * 1.1, gy - u * 1.4 + Math.sin(a) * u * 1.1, "#e1b83f", 1.4);
      }
      outline(b, INK, 0.5);
      return { top: gy - u * 2.5, w: u * 1.5 };
    }
    case "bell": {
      const c = col || "#e1b83f";
      const p = [[x - u * 0.85, gy - u * 0.3], [x - u * 0.55, gy - u * 0.75], [x - u * 0.45, gy - u * 1.4], [x, gy - u * 1.7], [x + u * 0.45, gy - u * 1.4], [x + u * 0.55, gy - u * 0.75], [x + u * 0.85, gy - u * 0.3]];
      shape(p, c, 210, 0.05, true);
      pip(x, gy - u * 0.2, u * 0.15, darker(c, 0.3));
      outline(p, INK, 0.5);
      return { top: gy - u * 1.8, w: u * 1.8 };
    }
    case "firework":
    case "confetti": {
      if (kind === "firework") {
        for (let k = 0; k < 2; k++) {
          const fx = x + (k ? u * 0.9 : -u * 0.6);
          const fy = gy - u * (1.6 + k * 0.7);
          const c = col || pickc(["#e0509a", "#f3d660", "#3dbbe0", "#ff8a2a"]);
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            ln(fx + Math.cos(a) * u * 0.2, fy + Math.sin(a) * u * 0.2, fx + Math.cos(a) * u * 0.8, fy + Math.sin(a) * u * 0.8, c, 1.4, "2B");
            pip(fx + Math.cos(a) * u * 0.9, fy + Math.sin(a) * u * 0.9, 2, c);
          }
        }
        return { top: gy - u * 3.2, w: u * 2.5 };
      }
      for (let i = 0; i < 22; i++) {
        const px = x + random(-u * 1.5, u * 1.5);
        const py = gy - random(u * 0.1, u * 2.4);
        const a = random(Math.PI);
        solid(limbP(px, py, px + Math.cos(a) * 8, py + Math.sin(a) * 8, 3, 3), col || pickc(["#e0509a", "#f3d660", "#3dbbe0", "#ff8a2a", "#7cc36e"]), 230);
      }
      return { top: gy - u * 2.4, w: u * 3 };
    }
    default:
      return mGlyph(x, gy - u * 0.8, s, { word: t.label || kind }, true);
  }
}

/* ---------------- invented words ---------------- */

// An unknown word becomes a little creature or emblem, decided by its letters.
function mGlyph(x, cy, s, g, big) {
  const word = String(g.word || "?");
  const h = strHash(word.toLowerCase());
  const u = 46 * s;
  const hue = h % 360;
  const c1 = hslHex(hue, 55, 58);
  const c2 = hslHex(hue + 40 + (h >>> 9) % 80, 50, 48);
  const c3 = hslHex(hue + 180, 45, 70);
  const form = (h >>> 4) % 7;
  const vowels = (word.match(/[aeiouy]/gi) || []).length;
  const n = 3 + (word.length % 5);
  if (form === 0 || form === 1) {
    // creature: blob + eyes + legs/antennae
    const rx = u * (0.7 + (h % 5) * 0.08);
    const ry = u * (0.6 + ((h >>> 3) % 5) * 0.09);
    const legs = 2 + (h >>> 6) % 3;
    for (let i = 0; i < legs; i++) {
      const lx = x - rx * 0.6 + (i / Math.max(1, legs - 1)) * rx * 1.2;
      limb(lx, cy + ry * 0.6, lx + random(-6, 6), cy + ry + u * 0.45, u * 0.09, u * 0.08, c2, 170);
    }
    const body = ellP(x, cy, rx, ry, 0, 22, 0.08);
    shape(body, c1, 170, 0.12, true);
    for (let i = 0; i < vowels % 4 + 1; i++) pip(x + random(-rx * 0.6, rx * 0.6), cy + random(0, ry * 0.6), u * 0.08, c2, 180);
    const eyes = 1 + (h >>> 8) % 3;
    for (let i = 0; i < eyes; i++) {
      const ex = x + (eyes === 1 ? 0 : (i / (eyes - 1) - 0.5) * rx * 0.9);
      oval(ex, cy - ry * 0.25, u * 0.17, u * 0.17, "#fbf8f0", 230, 0, true);
      pip(ex + 2, cy - ry * 0.22, u * 0.08, INK);
    }
    sp([[x - rx * 0.3, cy + ry * 0.25], [x, cy + ry * (form ? 0.45 : 0.15)], [x + rx * 0.3, cy + ry * 0.25]], INK, 1);
    if (form === 1) for (const e of [-1, 1]) {
      sp([[x + e * rx * 0.3, cy - ry * 0.8], [x + e * rx * 0.5, cy - ry * 1.4], [x + e * rx * 0.75, cy - ry * 1.5]], INK, 1);
      pip(x + e * rx * 0.75, cy - ry * 1.5, u * 0.08, c3);
    } else for (let i = 0; i < 3; i++) solid(triP(x - rx * 0.4 + i * rx * 0.4 - 6, cy - ry * 0.85, x - rx * 0.4 + i * rx * 0.4, cy - ry * 1.3, x - rx * 0.4 + i * rx * 0.4 + 6, cy - ry * 0.85), c2);
    outline(body, INK, 0.6);
    return { top: cy - ry * 1.5, w: rx * 2.2, head: [x, cy], hand: [x + rx, cy] };
  }
  if (form === 2) {
    // concentric rings
    for (let i = n; i > 0; i--) oval(x, cy, u * 0.25 * i, u * 0.25 * i, i % 2 ? c1 : c3, 120, 0, i === n);
    pip(x, cy, u * 0.12, c2);
  } else if (form === 3) {
    // spiral
    oval(x, cy, u * 1.1, u * 1.1, c3, 70, 0, true, 0.3);
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const a = i * 0.42 + (h % 7);
      const r = u * 0.03 * i;
      pts.push([x + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    sp(pts, c2, 3.4, "2B");
  } else if (form === 4) {
    // burst / sun-flower
    for (let i = 0; i < n + 4; i++) {
      const a = (i / (n + 4)) * Math.PI * 2;
      oval(x + Math.cos(a) * u * 0.6, cy + Math.sin(a) * u * 0.6, u * 0.45, u * 0.18, i % 2 ? c1 : c2, 140, a, true);
    }
    oval(x, cy, u * 0.35, u * 0.35, c3, 200, 0, true);
  } else if (form === 5) {
    // totem: stacked letters-blocks, one per letter (max 5)
    const letters = Math.min(5, Math.max(2, word.length));
    for (let i = 0; i < letters; i++) {
      const cc = [c1, c2, c3][i % 3];
      const bw = u * (0.9 - (i % 2) * 0.2);
      const p = (word.charCodeAt(i) || 0) % 3 === 0 ? ellP(x, cy + u * 0.8 - i * u * 0.55, bw * 0.55, u * 0.27) : rectP(x - bw / 2, cy + u * 0.55 - i * u * 0.55, bw, u * 0.5);
      shape(p, cc, 170, 0.06, true);
      outline(p, INK, 0.5);
    }
    eye(x - u * 0.15, cy + u * 0.8 - (letters - 1) * u * 0.55, u * 0.07);
    eye(x + u * 0.15, cy + u * 0.8 - (letters - 1) * u * 0.55, u * 0.07);
  } else {
    // crystal cluster
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.35;
      const len = u * (0.8 + ((h >>> i) % 4) * 0.25);
      const bx = x + (i - (n - 1) / 2) * u * 0.18;
      const by = cy + u * 0.6;
      const tip = [bx + Math.cos(a) * len, by + Math.sin(a) * len];
      shape([[bx - u * 0.12, by], [bx - u * 0.14 + Math.cos(a) * len * 0.8, by + Math.sin(a) * len * 0.8], tip, [bx + u * 0.14 + Math.cos(a) * len * 0.8, by + Math.sin(a) * len * 0.8], [bx + u * 0.12, by]], i % 2 ? c1 : c3, 160, 0.06, true);
    }
    sparkle(x + u * 0.5, cy - u * 0.6, u * 0.15, "#fbf8f0");
  }
  return { top: cy - u * 1.2, w: u * 2.2, head: [x, cy], hand: [x + u, cy] };
}

/* ---------------- dispatch ---------------- */

const MOTIF = {
  quad: { fn: mQuad, w: 150, h: 120, ground: true },
  bird: { fn: mBird, w: 80, h: 75, ground: true },
  fish: { fn: mFish, w: 110, h: 60, ground: false },
  bug: { fn: mBug, w: 60, h: 45, ground: false },
  critter: { fn: mCritter, w: 95, h: 55, ground: true },
  person: { fn: mPerson, w: 70, h: 165, ground: true },
  tree: { fn: mTree, w: 140, h: 200, ground: true },
  flower: { fn: mFlower, w: 110, h: 110, ground: true },
  building: { fn: mBuilding, w: 160, h: 170, ground: true },
  vehicle: { fn: mVehicle, w: 140, h: 75, ground: true },
  boat: { fn: mBoat, w: 140, h: 150, ground: false },
  air: { fn: mAir, w: 130, h: 90, ground: false },
  food: { fn: mFood, w: 80, h: 80, ground: true },
  sky: { fn: mSky, w: 120, h: 100, ground: false },
  obj: { fn: mObj, w: 85, h: 85, ground: true },
  glyph: { fn: null, w: 100, h: 110, ground: true },
};
