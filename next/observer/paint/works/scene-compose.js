/**
 * Scene composer: plan → backdrop (place, time, weather) → subjects laid out
 * on the ground / in the sky / in the water → mood marks → caption.
 */

const SPACE_KINDS = new Set(["planet", "galaxy", "comet"]);

function resolveScene(plan) {
  const things = plan.things;
  const has = (pred) => things.some((t) => !t.heldBy && pred(t));
  const kinds = new Set(things.map((t) => t.o.kind));
  const moods = new Set(plan.moods);
  const guessed = [];
  let place = plan.place;
  if (!place) {
    if (has((t) => t.m === "fish" || t.o.kind === "mermaid" || t.o.kind === "sub")) place = has((t) => t.o.kind === "whale" || t.o.kind === "dolphin") && !has((t) => t.o.kind === "octopus" || t.o.kind === "jelly") ? "ocean" : "underwater";
    else if (has((t) => t.m === "boat")) place = "ocean";
    else if (has((t) => SPACE_KINDS.has(t.o.kind) || t.o.kind === "astronaut")) place = has((t) => t.o.kind === "astronaut") ? "moon" : "space";
    else if (has((t) => ["penguin", "polar", "igloo", "snowman"].includes(t.o.kind))) place = "arctic";
    else if (has((t) => ["camel", "cactus", "pyramid"].includes(t.o.kind))) place = "desert";
    else if (has((t) => ["palm", "crab", "shell"].includes(t.o.kind))) place = "beach";
    else if (has((t) => ["cow", "pig", "sheep", "chicken", "barn", "tractor", "goat"].includes(t.o.kind))) place = "farm";
    else if (has((t) => ["lion", "giraffe", "zebra", "elephant", "cheetah", "hippo"].includes(t.o.kind))) place = "savanna";
    else if (has((t) => ["monkey", "parrot", "tiger", "frog", "lizard", "dino"].includes(t.o.kind))) place = "jungle";
    else if (has((t) => t.o.kind === "tower" || t.o.kind === "bus")) place = "city";
    else if (has((t) => t.m === "vehicle" && t.o.kind !== "tractor")) place = "road";
    else if (has((t) => t.o.kind === "bed")) place = "room";
    else if (has((t) => t.o.kind === "ball")) place = "stadium";
    else if (things.length && things.every((t) => t.m === "food" || (t.m === "obj" && !["fire", "firework", "rock", "flag", "confetti"].includes(t.o.kind)))) place = "table";
    else if (things.length && things.every((t) => t.m === "sky" || t.m === "air")) place = has((t) => SPACE_KINDS.has(t.o.kind)) ? "space" : "meadow";
    else if (!things.length && !plan.moods.length && !plan.weather.length && !plan.time && !plan.season && plan.unknown.length) {
      place = ["meadow", "desert", "beach", "moon", "mountains", "lake", "forest", "arctic"][plan.hash % 8];
    } else if (moods.has("calm")) place = ["lake", "meadow", "beach"][plan.hash % 3];
    else if (moods.has("spooky")) place = "forest";
    else if (plan.season === "winter") place = "meadow";
    else place = ["meadow", "meadow", "mountains", "lake", "forest"][plan.hash % 5];
    if (place) guessed.push(place);
  }
  let time = plan.time;
  if (place === "space" || place === "moon") time = "space";
  if (!time) {
    if (kinds.has("stars") || (kinds.has("moon") && place !== "moon")) time = "night";
    else if (moods.has("spooky") || plan.season === "halloween" || things.some((t) => t.act === "sleep") || kinds.has("firework") || kinds.has("ghost") || kinds.has("vampire") || kinds.has("bat")) time = "night";
    else if (kinds.has("sun")) time = "day";
    else if (moods.has("love") || moods.has("calm")) time = ["sunset", "dawn"][plan.hash % 2];
    else if (place === "underwater" || place === "room" || place === "table" || place === "cave") time = "day";
    else time = ["day", "day", "day", "sunset", "day", "dawn", "day", "sunset"][(plan.hash >>> 3) % 8];
    if (time !== "day") guessed.push(time);
  }
  return { place, time, guessed };
}

/* ---------------- sky + places ---------------- */

function skyColors() {
  let cols = (SKY[SC.time] || SKY.day).slice();
  const wx = SC.weather;
  if (wx.includes("storm")) cols = cols.map((c) => mixHex(c, "#3c4250", 0.6));
  else if (wx.includes("rain")) cols = cols.map((c) => mixHex(c, "#8c96a3", 0.45));
  else if (wx.includes("snow") || wx.includes("fog")) cols = cols.map((c) => mixHex(c, "#dde4ec", 0.4));
  for (const m of SC.moods) {
    const mp = MOOD_PAL[m];
    if (mp && SC.time !== "space") cols = cols.map((c) => mixHex(c, mp.sky, mp.amt * (SC.time === "night" ? 0.4 : 1) / SC.moods.length));
  }
  if (SC.tint && SC.time !== "space") cols = cols.map((c) => mixHex(c, SC.tint, SC.time === "night" ? 0.25 : 0.35));
  // a nudge from the prompt's own hash so similar prompts still differ
  cols = cols.map((c) => mixHex(c, hslHex(SC.hash % 360, 45, SC.time === "night" ? 30 : 72), 0.1));
  return cols;
}

function paintSky(y0, y1) {
  const cols = skyColors();
  const n = cols.length;
  brush.noStroke();
  // solid base gradient (cheap), then textured washes on top
  const bands = 40;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const k = t * (n - 1);
    const c = mixHex(cols[Math.floor(k)], cols[Math.min(n - 1, Math.ceil(k))], k - Math.floor(k));
    const ya = y0 + ((y1 - y0) * i) / bands;
    flatWash(c, 255);
    brush.rect(-10, ya - 2, width + 20, (y1 - y0) / bands + 6, "corner");
  }
  brush.noWash();
  for (let i = 0; i < 4; i++) {
    const c = cols[Math.floor(random(n))];
    fillC(c, SC.time === "night" || SC.time === "space" ? 90 : 55, 0.45, 0.5);
    brush.polygon(ellP(random(width), random(y0, y1), random(200, 340), random(50, 90)));
  }
}

function paintStars(y1, n = 70) {
  for (let i = 0; i < n; i++) {
    const x = random(10, width - 10);
    const y = random(10, y1);
    const r = random() < 0.12 ? random(1.8, 2.8) : random(0.8, 1.6);
    pip(x, y, r, pickc(["#fff6d8", "#f3de7a", "#cfe0ff"]), random(150, 240));
  }
  for (let i = 0; i < 5; i++) sparkle(random(30, width - 30), random(20, y1 * 0.8), random(4, 7), "#fff6d8");
}

function ridgeAt(baseY, rise, steps = 10, jag = 12) {
  const pts = [[-10, height + 10], [-10, baseY]];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * (width + 20) - 10;
    pts.push([x, baseY - rise * noise(i * 0.37 + SC.hash * 0.0001 + baseY) - random(0, jag)]);
  }
  pts.push([width + 10, baseY], [width + 10, height + 10]);
  return pts;
}

function groundCols() {
  const s = SC.season;
  let g = ["#8aa05a", "#6f8a55", "#5d7a45"];
  if (s === "autumn" || s === "halloween") g = ["#b9893a", "#9a6a3a", "#7b6a3a"];
  if (s === "winter" || s === "christmas" || SC.weather.includes("snow")) g = ["#eef2f6", "#dfe6ee", "#cdd7e2"];
  if (s === "spring") g = ["#9cc46a", "#7fb05a", "#6a9a4a"];
  if (s === "summer") g = ["#b0b85a", "#8fa04a", "#7a9a45"];
  if (SC.time === "night") g = g.map((c) => mixHex(c, "#1a2450", 0.55));
  if (SC.time === "sunset") g = g.map((c) => mixHex(c, "#8a4a5a", 0.2));
  if (SC.moodSet.has("sad") || SC.moodSet.has("stressed")) g = g.map((c) => mixHex(c, "#7d8ca3", 0.35));
  if (SC.moodSet.has("spooky")) g = g.map((c) => mixHex(c, "#3a2a4a", 0.4));
  return g.map((c) => mixHex(c, hslHex((SC.hash >>> 5) % 360, 40, 50), 0.08));
}

function groundBand(y, cols, rise = 40) {
  groundFill(ridgeAt(y, rise), cols[0], 200, 0.15);
  groundFill(ridgeAt(y + (height - y) * 0.35, rise * 0.5), cols[1], 150, 0.15);
  for (let i = 0; i < 12; i++) {
    const x = random(width);
    const yy = random(y + 20, height);
    ln(x, yy, x + random(-4, 4), yy - random(6, 14), darker(cols[2], 0.2), 0.7);
  }
}

function paintPlace() {
  const place = SC.place;
  const night = SC.time === "night" || SC.time === "space";
  let horizon = height * (0.56 + ((SC.hash >>> 2) % 9) * 0.012);
  SC.water = null;
  SC.floating = false;
  SC.knock = true;
  if (place === "underwater") {
    const top = night ? ["#0c2240", "#0a1830"] : ["#5fb0d0", "#2f7aa8"];
    const cols = [top[0], top[1], "#1f4f7a", "#183a5c"];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const k = t * (cols.length - 1);
      flatWash(mixHex(cols[Math.floor(k)], cols[Math.ceil(k)], k - Math.floor(k)), 255);
      brush.rect(-10, (height * i) / n - 2, width + 20, height / n + 6, "corner");
    }
    brush.noWash();
    for (let i = 0; i < 5; i++) shape([[random(width), -10], [random(width), -10], [random(width), height * 0.8]], "#cfeef8", 35, 0.4);
    const sand = height * 0.85;
    groundFill(ridgeAt(sand, 25), "#d8c08a", 210, 0.15);
    for (let i = 0; i < 6; i++) {
      const sx = random(20, width - 20);
      const h = random(70, 160);
      const pts = [];
      for (let k = 0; k <= 6; k++) pts.push([sx + Math.sin(k * 1.3 + i) * 10, sand + 10 - (k / 6) * h]);
      sp(pts, pickc(["#4f8a6a", "#6f9a4a", "#3e7a5a"]), 4.5, "marker");
    }
    for (let i = 0; i < 4; i++) oval(random(width), sand + random(5, 25), random(18, 30), random(10, 16), pickc(["#e98a72", "#f19cc4", "#e9a23b"]), 170);
    for (let i = 0; i < 14; i++) outline(ellP(random(width), random(height * 0.7), random(3, 8), random(3, 8), 0, 10, 0), "#e8f6fb", 0.6);
    SC.water = [0, sand];
    SC.groundY = sand + 20;
    SC.horizon = 0;
    SC.underwater = true;
    return;
  }
  if (place === "room") {
    const wall = mixHex(pickc(["#e8d8bc", "#d8e2d0", "#e6cfc4", "#cfd8e6", "#e8e0c8"]), hslHex(SC.hash % 360, 40, 75), 0.25);
    flatWash(night ? mixHex(wall, "#1a2450", 0.55) : wall, 255);
    brush.rect(-10, -10, width + 20, height * 0.72 + 10, "corner");
    flatWash(night ? "#3a2c24" : "#a8743a", 255);
    brush.polygon(rectP(-10, height * 0.72, width + 20, height * 0.28 + 10));
    brush.noWash();
    for (let i = 0; i < 6; i++) ln(-10, height * 0.72 + i * 22, width + 10, height * 0.72 + i * 22 + random(-3, 3), "#6b4a30", 0.6);
    fillC(wall, 90, 0.4);
    brush.polygon(ellP(width * 0.4, height * 0.3, 260, 140));
    // window with the time of day
    const wx = width * (SC.hash % 2 ? 0.66 : 0.12);
    const wy = height * 0.12;
    const ww = width * 0.24;
    const wh = height * 0.28;
    const cols = skyColors();
    flatWash(cols[0], 255);
    brush.rect(wx, wy, ww, wh * 0.5, "corner");
    flatWash(cols[cols.length - 1], 255);
    brush.rect(wx, wy + wh * 0.5, ww, wh * 0.5, "corner");
    brush.noWash();
    if (night) for (let i = 0; i < 8; i++) pip(wx + random(8, ww - 8), wy + random(8, wh - 8), 1.4, "#fff6d8");
    if (night) pip(wx + ww * 0.7, wy + wh * 0.3, 12, "#f6eec8");
    else pip(wx + ww * 0.3, wy + wh * 0.35, 14, "#f6d070", 200);
    pen("#6b4a30", 3, "2B");
    brush.rect(wx, wy, ww, wh, "corner");
    brush.line(wx + ww / 2, wy, wx + ww / 2, wy + wh);
    brush.line(wx, wy + wh / 2, wx + ww, wy + wh / 2);
    SC.horizon = height * 0.72;
    SC.groundY = height * 0.9;
    SC.skyTop = height * 0.1;
    return;
  }
  if (place === "table") {
    const wall = mixHex(pickc(["#e8dcc4", "#d8e0d4", "#e6d2c8", "#d2dae6"]), hslHex(SC.hash % 360, 40, 72), 0.3);
    flatWash(SC.time === "night" ? mixHex(wall, "#1a2450", 0.5) : wall, 255);
    brush.rect(-10, -10, width + 20, height + 20, "corner");
    brush.noWash();
    fillC(wall, 90, 0.4);
    brush.polygon(ellP(width * random(0.3, 0.7), height * 0.3, 280, 160));
    const ty = height * 0.6;
    const cloth = SC.tint || pickc(["#c13b4a", "#3a6cb8", "#f4ead0", "#2f8f68", "#e1b83f"]);
    groundFill([[-10, ty], [width + 10, ty - 6], [width + 10, height + 10], [-10, height + 10]], cloth, 170, 0.08);
    if (cloth === "#c13b4a" || cloth === "#3a6cb8") {
      for (let i = 0; i < 9; i++) ln(i * 80, ty, i * 80 - 40, height, "#fbf8f0", 2.2, "2B");
      for (let i = 0; i < 4; i++) ln(-10, ty + 30 + i * 60, width + 10, ty + 30 + i * 60, "#fbf8f0", 2.2, "2B");
    }
    oval(width * 0.5, height * 0.83, width * 0.35, 30, darker(cloth, 0.3), 60, 0, false, 0.4);
    SC.horizon = ty;
    SC.groundY = height * 0.82;
    SC.skyTop = 40;
    SC.noSky = true;
    return;
  }
  if (place === "cave") {
    flatWash(night ? "#1a1418" : "#3a2c24", 255);
    brush.rect(-10, -10, width + 20, height + 20, "corner");
    brush.noWash();
    const cols = skyColors();
    const mouth = ellP(width * 0.5, height * 0.5, width * 0.33, height * 0.3, 0, 24, 0.12);
    solid(mouth, cols[cols.length - 1], 255);
    for (let i = 0; i < 9; i++) {
      const x = random(width);
      solid(triP(x - 18, -5, x + 18, -5, x + random(-5, 5), random(50, 120)), "#4a3a30", 230);
    }
    groundFill(ridgeAt(height * 0.78, 20), "#5a4a3a", 200, 0.1);
    SC.horizon = height * 0.7;
    SC.groundY = height * 0.88;
    SC.noSky = true;
    return;
  }
  // outdoor places share the sky
  if (place === "skyonly") horizon = height + 10;
  if (place === "space") horizon = height + 10;
  if (place === "moon" || place === "mars") horizon = height * 0.66;
  if (place === "ocean") horizon = height * 0.5;
  if (place === "beach" || place === "lake" || place === "island") horizon = height * 0.55;
  paintSky(-10, horizon + 20);
  SC.horizon = horizon;
  SC.skyTop = 30;
  if (night) paintStars(horizon * 0.85, SC.time === "space" ? 120 : 70);
  if (SC.time === "space" && place !== "moon") {
    if (!SC.kinds.has("planet") && !SC.kinds.has("earth")) mSky(width * (SC.hash % 2 ? 0.8 : 0.2), height * 0.75, 1.3, { o: { kind: SC.hash % 3 ? "planet" : "earth" } });
  }
  // celestial defaults
  if (!SC.kinds.has("sun") && !SC.kinds.has("moon") && place !== "space" && place !== "moon") {
    const sx = width * (SC.hash % 2 ? 0.78 : 0.22);
    if (SC.time === "night") mSky(sx, height * 0.16, 0.9, { o: { kind: "moon" } });
    else if (!SC.weather.includes("rain") && !SC.weather.includes("storm") && !SC.weather.includes("fog")) {
      if (SC.time === "sunset" || SC.time === "dawn") {
        oval(sx, horizon - 20, 90, 90, SC.time === "sunset" ? "#f08a5a" : "#f6c070", 80, 0, false, 0.4);
        oval(sx, horizon - 10, 40, 40, SC.time === "sunset" ? "#e0603a" : "#f3c94a", 200, 0, true, 0.15);
      } else {
        oval(sx, height * 0.15, 56, 56, "#fffaf0", 110, 0, false, 0.45);
        oval(sx, height * 0.15, 30, 30, "#f6c850", 210, 0, true, 0.15);
      }
    }
  }
  if (SC.time === "day" && !SC.weather.length) for (let i = 0; i < 2; i++) cloud(random(width * 0.1, width * 0.9), random(height * 0.12, horizon * 0.5), random(28, 45), "#ffffff", 130);
  if (place === "space" || place === "skyonly") {
    SC.floating = true;
    SC.groundY = height * 0.72;
    if (place === "skyonly") for (let i = 0; i < 4; i++) cloud(random(width), random(height * 0.55, height * 0.95), random(40, 70), night ? "#46507a" : "#ffffff", night ? 110 : 150);
    return;
  }
  if (place === "moon" || place === "mars") {
    const g = place === "moon" ? ["#a8aab0", "#8c8f96", "#6f7378"] : ["#c8673a", "#a8532f", "#8a3f24"];
    flatWash(darker(g[0], 0.15), 255);
    brush.polygon(ridgeAt(horizon + 6, 24, 8, 4));
    brush.noWash();
    groundFill(ridgeAt(horizon, 30, 8, 6), g[0], 200, 0.12);
    groundFill(ridgeAt(horizon + 80, 20, 8, 6), g[1], 150, 0.12);
    for (let i = 0; i < 9; i++) {
      const cx = random(width);
      const cy = random(horizon + 30, height - 10);
      const r = random(14, 40) * (0.5 + (cy - horizon) / (height - horizon));
      oval(cx, cy, r, r * 0.35, g[2], 150);
      oval(cx + 2, cy - r * 0.08, r * 0.8, r * 0.25, g[0], 160);
    }
    if (place === "moon" && !SC.kinds.has("earth")) mSky(width * (SC.hash % 2 ? 0.2 : 0.8), height * 0.2, 0.9, { o: { kind: "earth" } });
    SC.groundY = height * 0.86;
    return;
  }
  const g = groundCols();
  if (place === "ocean" || place === "beach" || place === "lake" || place === "island") {
    const sea = SC.time === "night" ? ["#1a2a50", "#14203c"] : SC.time === "sunset" ? ["#5a5a8a", "#3a4a7a"] : ["#4a8ab8", "#2f6a98"];
    const seaBottom = place === "ocean" ? height + 10 : place === "beach" ? height * 0.7 : height * 0.72;
    if (place === "lake") {
      groundBand(horizon - 10, g, 30);
      const lake = ellP(width * 0.5, (horizon + seaBottom) / 2 + 10, width * 0.62, (seaBottom - horizon) / 2 + 5, 0, 28, 0.03);
      shape(lake, sea[0], 210, 0.1);
      for (let i = 0; i < 6; i++) waveLine(width * 0.15, width * 0.85, horizon + 20 + i * 14, 1.5, "#dfeef6", 0.6);
      SC.water = [horizon + 10, seaBottom];
      SC.groundY = height * 0.9;
      groundFill(ridgeAt(height * 0.8, 15), g[0], 200, 0.12);
      return;
    }
    flatWash(sea[0], 255);
    brush.rect(-10, horizon, width + 20, seaBottom - horizon + 10, "corner");
    brush.noWash();
    fillC(sea[1], 130, 0.3);
    brush.polygon([[-10, horizon + (seaBottom - horizon) * 0.4], [width + 10, horizon + (seaBottom - horizon) * 0.35], [width + 10, seaBottom], [-10, seaBottom]]);
    for (let i = 0; i < 9; i++) waveLine(random(-20, width * 0.4), random(width * 0.6, width + 20), horizon + 10 + i * ((seaBottom - horizon) / 9), 2.5, "#e6f2f8", 0.7);
    if (SC.time === "sunset" || SC.time === "night") for (let i = 0; i < 6; i++) ln(width * 0.5 - 40 + random(-20, 20), horizon + 10 + i * 18, width * 0.5 + 40 + random(-20, 20), horizon + 10 + i * 18, SC.time === "night" ? "#f6eec8" : "#f6c066", 1.6, "2B");
    SC.water = [horizon, seaBottom];
    if (place === "island") {
      const ix = width * (SC.hash % 2 ? 0.7 : 0.3);
      oval(ix, horizon + 30, 120, 26, "#e3cc94", 220, 0, true);
      mTree(ix - 10, horizon + 20, 0.6, { o: { kind: "palm" } });
    }
    if (place === "beach") {
      groundFill(ridgeAt(height * 0.68, 12, 8, 4), "#e8d4a0", 220, 0.12);
      waveLine(-10, width + 10, height * 0.68, 3, "#fbf8f0", 1.6);
      groundFill(ridgeAt(height * 0.82, 10), "#dcc394", 140, 0.2);
      for (let i = 0; i < 3; i++) mObj(random(40, width - 40), random(height * 0.9, height * 0.97), 0.3, { o: { kind: "shell" } });
      SC.groundY = height * 0.9;
    } else SC.groundY = height * 0.9;
    return;
  }
  if (place === "volcano") {
    const cx = width * (0.4 + (SC.hash % 5) * 0.05);
    const base = horizon + 30;
    const cone = [[cx - 260, base], [cx - 50, base - 230], [cx + 45, base - 228], [cx + 270, base]];
    shape(cone, SC.time === "night" ? "#3a2c34" : "#6f5a52", 220, 0.08, true);
    for (let i = 0; i < 4; i++) {
      const lx = cx + random(-40, 40);
      sp([[lx, base - 228], [lx + random(-30, 30), base - 150], [lx + random(-60, 60), base - 60]], pickc(["#e0512b", "#f08a2c"]), 3.2, "2B");
    }
    oval(cx, base - 236, 60, 16, "#f08a2c", 220, 0, true);
    for (let i = 0; i < 5; i++) oval(cx + random(-30, 30) + i * 12, base - 270 - i * 45, 40 + i * 14, 28 + i * 8, i < 2 ? "#e0512b" : "#5f5a60", 120 - i * 10, 0, false, 0.3);
    groundBand(base + 10, groundCols().map((c) => mixHex(c, "#4a3a34", 0.4)), 20);
    SC.groundY = height * 0.9;
    return;
  }
  if (place === "mountains") {
    const m = SC.time === "night" ? ["#2a3560", "#1c2648"] : ["#8a9ab8", "#6f7f9a"];
    for (let k = 0; k < 2; k++) {
      const base = horizon + k * 10;
      const pts = [[-10, base]];
      const peaks = 3 + k;
      for (let i = 0; i <= peaks * 2; i++) {
        const x = (i / (peaks * 2)) * (width + 20) - 10;
        pts.push([x, i % 2 ? base - random(130, 230) / (k + 1) : base - random(10, 50)]);
      }
      pts.push([width + 10, base]);
      shape(pts, m[k], 200, 0.1);
      for (let i = 1; i < pts.length - 1; i += 2) if (pts[i][1] < base - 110) solid([[pts[i][0] - 22, pts[i][1] + 34], [pts[i][0], pts[i][1]], [pts[i][0] + 22, pts[i][1] + 34], [pts[i][0], pts[i][1] + 26]], "#f6f8fb", 230);
    }
    groundBand(horizon + 15, g, 30);
    SC.groundY = height * 0.88;
    return;
  }
  if (place === "desert") {
    const d = SC.time === "night" ? ["#5a4a6a", "#4a3a5a"] : ["#e8c48a", "#d9a866", "#c98a4a"];
    for (let k = 0; k < 3; k++) {
      groundFill(ridgeAt(horizon + k * 50, 40 - k * 8, 6, 2), d[k % d.length], 200, 0.12);
    }
    if (!SC.kinds.has("cactus")) mTree(width * (SC.hash % 2 ? 0.12 : 0.88), horizon + 70, 0.5, { o: { kind: "cactus" } });
    SC.groundY = height * 0.88;
    return;
  }
  if (place === "arctic") {
    groundBand(horizon, ["#eef2f6", "#dfe6ee", "#9ab0c8"], 20);
    for (let i = 0; i < 2; i++) {
      const x = random(width);
      shape([[x - 70, horizon + 5], [x - 30, horizon - 60], [x + 10, horizon - 40], [x + 60, horizon + 5]], "#d8e8f4", 220, 0.08, true);
      outline([[x - 70, horizon + 5], [x - 30, horizon - 60], [x + 10, horizon - 40], [x + 60, horizon + 5]], "#8fa3b8", 0.6);
    }
    SC.groundY = height * 0.88;
    return;
  }
  if (place === "city") {
    const night2 = SC.time === "night";
    for (let k = 0; k < 2; k++) {
      let x = -10;
      while (x < width + 10) {
        const w = random(40, 90);
        const h = random(80, 220) * (k ? 0.75 : 1);
        const c = night2 ? (k ? "#1c2340" : "#2a3358") : k ? "#a8b0bd" : "#8c96a3";
        solid(rectP(x, horizon - h + k * 20, w - 4, h + 40), c, 230);
        if (!k || night2) for (let r = 0; r < h / 22 - 1; r++) for (let q = 0; q < w / 18 - 1; q++) if (random() < (night2 ? 0.45 : 0.7)) solid(rectP(x + 6 + q * 18, horizon - h + k * 20 + 10 + r * 22, 8, 10), night2 ? "#f3d660" : "#d4e2ee", night2 ? 230 : 160);
        x += w;
      }
    }
    flatWash(night2 ? "#3a3f50" : "#8a8d94", 255);
    brush.polygon(rectP(-10, horizon + 40, width + 20, height - horizon - 30));
    brush.noWash();
    for (let i = 0; i < 7; i++) solid(rectP(i * 100 + 20, height * 0.86, 50, 6), "#f3d660", 220);
    solid(rectP(-10, horizon + 40, width + 20, 14), "#c2c6cf", 230);
    SC.groundY = height * 0.83;
    return;
  }
  if (place === "road") {
    groundBand(horizon, g, 40);
    for (let i = 0; i < 3; i++) mTree(random(width), horizon + 8, random(0.35, 0.5), { o: { kind: SC.season === "winter" ? "pine" : "round" } });
    flatWash(SC.time === "night" ? "#2a2c34" : "#6f7378", 255);
    brush.polygon([[-10, height * 0.78], [width + 10, height * 0.76], [width + 10, height * 0.95], [-10, height * 0.97]]);
    brush.noWash();
    for (let i = 0; i < 6; i++) solid(rectP(i * 120 + 10, height * 0.865, 60, 5), "#f3d660", 230);
    SC.groundY = height * 0.885;
    return;
  }
  if (place === "stadium") {
    for (let r = 0; r < 4; r++) for (let i = 0; i < 40; i++) pip(i * 16 + (r % 2) * 8, horizon - 70 + r * 16, 4.5, pickc(["#c13b4a", "#3a6cb8", "#f3d660", "#fbf8f0", "#2f8f68", "#e98a3a"]), 200);
    flatWash(SC.time === "night" ? "#2f5a35" : "#5d9a4a", 255);
    brush.polygon(rectP(-10, horizon - 10, width + 20, height - horizon + 20));
    brush.noWash();
    for (let i = 0; i < 5; i++) fillC(i % 2 ? "#6faa5a" : "#5d9a4a", 120, 0.05), brush.rect(-10, horizon + i * 50, width + 20, 50, "corner");
    ln(width / 2, horizon, width / 2, height, "#fbf8f0", 2.4, "2B");
    outline(ellP(width / 2, height * 0.8, 90, 40, 0, 24, 0), "#fbf8f0", 2);
    if (SC.time === "night") for (const lx of [40, width - 40]) {
      ln(lx, horizon - 80, lx, 60, "#5f6b7a", 2, "2B");
      oval(lx, 60, 50, 50, "#fff3b0", 80);
    }
    SC.groundY = height * 0.88;
    return;
  }
  if (place === "swamp") {
    groundBand(horizon, g.map((c) => mixHex(c, "#4a5a3a", 0.3)), 25);
    shape(ellP(width * 0.5, height * 0.8, width * 0.6, 60), "#4a6a5a", 200, 0.1);
    for (let i = 0; i < 20; i++) {
      const x = random(width);
      ln(x, height * 0.75 + random(20), x + random(-6, 6), height * 0.75 - random(30, 70), "#5d6a3a", 1.4, "2B");
    }
    SC.water = [height * 0.72, height * 0.9];
    SC.groundY = height * 0.92;
    return;
  }
  // meadow / farm / forest / jungle / savanna
  if (place === "forest" || place === "jungle") {
    groundBand(horizon, g, 30);
    const kind = place === "jungle" ? "palm" : SC.season === "winter" ? "pine" : ["pine", "round"][SC.hash % 2];
    for (let i = 0; i < 7; i++) mTree(-30 + i * (width + 60) / 6 + random(-20, 20), horizon + random(0, 20), random(0.45, 0.65), { o: { kind: kind === "round" && i % 2 ? "pine" : kind } });
    if (place === "jungle") for (let i = 0; i < 10; i++) shape(bladePoints(random(width), height, Math.PI + random(-0.6, 0.6), random(60, 120), 12), pickc(["#3e7a3a", "#5d8a4a", "#2f5a35"]), 160, 0.08);
    SC.groundY = height * 0.9;
    return;
  }
  if (place === "savanna") {
    groundBand(horizon, ["#d9b46a", "#c9a05a", "#a8843a"], 20);
    const tx = width * (SC.hash % 2 ? 0.82 : 0.18);
    ln(tx, horizon + 10, tx, horizon - 70, "#5e3a26", 2.6, "2B");
    shape([[tx - 90, horizon - 60], [tx + 90, horizon - 60], [tx + 60, horizon - 90], [tx - 60, horizon - 92]], "#6f7a3a", 190, 0.1, true);
    SC.groundY = height * 0.88;
    return;
  }
  groundBand(horizon, g, 45);
  if (place === "farm") {
    if (!SC.kinds.has("barn")) mBuilding(width * (SC.hash % 2 ? 0.82 : 0.18), horizon + 15, 0.55, { o: { kind: "barn" } });
    for (let i = 0; i < 12; i++) ln(i * 56, height * 0.78, i * 56, height * 0.72, "#8a6a4a", 2, "2B");
    ln(-10, height * 0.74, width + 10, height * 0.735, "#8a6a4a", 2, "2B");
    ln(-10, height * 0.765, width + 10, height * 0.76, "#8a6a4a", 2, "2B");
  } else {
    if (SC.season === "spring" || SC.moodSet.has("happy") || SC.moodSet.has("love")) {
      for (let i = 0; i < 26; i++) pip(random(width), random(horizon + 30, height), random(2, 4), pickc(["#f3d660", "#fbf8f0", "#e57a9a", "#c3a3d6"]), 220);
    }
    if (place === "meadow" && random() < 0.6) mTree(width * (SC.hash % 2 ? 0.1 : 0.9), horizon + 10, 0.5, { o: { kind: SC.season === "winter" ? "pine" : "round" } });
  }
  SC.groundY = height * 0.88;
}

/* ---------------- layout ---------------- */

const SKY_ITEMS = new Set(["sky", "air"]);

// Nominal size (at scale 1) of a subject, so long dragons and tall giraffes fit.
function motifSize(t) {
  const M = MOTIF[t.m] || MOTIF.obj;
  if (t.m === "quad") {
    const q = QUAD[t.o.kind] || QUAD.dog;
    const g = q.girth || 1;
    const tail = q.tail === "dino" ? 1.2 : q.tail === "huge" || q.tail === "bushy" ? 0.8 : 0.4;
    return { fn: M.fn, w: 58 * (q.len * 1.9 + 0.75 + q.neck * 0.35 + tail), h: 58 * (q.leg + 0.85 * g + q.neck * 0.9 + 0.9) };
  }
  if (t.m === "vehicle" && t.o.kind === "train") return { fn: M.fn, w: 280, h: 95 };
  if (t.m === "vehicle") return { fn: M.fn, w: t.o.kind === "bus" ? 170 : t.o.kind === "truck" ? 155 : t.o.kind === "bike" ? 130 : 125, h: 80 };
  if (t.m === "building" && ["castle", "pyramid", "bridge", "windmill"].includes(t.o.kind)) return { fn: M.fn, w: 190, h: 180 };
  return M;
}

function instancesOf(t) {
  const out = [];
  for (let i = 0; i < Math.max(1, Math.min(t.count, 7)); i++) out.push({ t, i });
  return out;
}

function paintScene(plan) {
  const res = resolveScene(plan);
  SC = {
    prompt: plan.prompt.toLowerCase(), hash: plan.hash, place: res.place, time: res.time,
    season: plan.season === "halloween" || plan.season === "christmas" ? (plan.season === "christmas" ? "winter" : "autumn") : plan.season,
    halloween: plan.season === "halloween", christmas: plan.season === "christmas" || /christmas|xmas/.test(plan.prompt.toLowerCase()),
    weather: plan.weather.slice(), moods: plan.moods.slice(), moodSet: new Set(plan.moods),
    kinds: new Set(plan.things.map((t) => t.o.kind)), toneTo: null, toneAmt: 0, knock: true,
    tint: null,
  };
  if (SC.christmas && !SC.weather.includes("snow")) SC.weather.push("snow");
  const usedColors = new Set(plan.things.map((t) => t.color).filter(Boolean));
  const freeTint = plan.tints.find((c) => !usedColors.has(c) && c[0] === "#");
  if (freeTint) SC.tint = freeTint;
  if (plan.tints.includes("rainbow") && !SC.kinds.has("rainbow")) SC.addRainbow = true;

  brush.noField();
  brush.noFill();
  brush.noStroke();
  brush.noHatch();
  brush.noWash();
  paintPlace();

  // night tones subjects slightly toward blue so they sit in the scene
  if (SC.time === "night") {
    SC.toneTo = "#2a3566";
    SC.toneAmt = 0.18;
  }
  if (SC.moodSet.has("sad")) {
    SC.toneTo = SC.toneTo || "#7d8ca3";
    SC.toneAmt = Math.max(SC.toneAmt, 0.2);
  }

  // Sort subjects into lanes.
  const sky = [];
  const water = [];
  const ground = [];
  // "a house with a ghost": only creatures hold things, and only small things.
  const HOLDERS = new Set(["quad", "bird", "person", "critter", "fish", "glyph"]);
  const TOO_BIG = new Set(["person", "quad", "building", "tree", "vehicle", "boat"]);
  for (const t of plan.things) {
    if (t.held && (!HOLDERS.has(t.m) || TOO_BIG.has(t.held.m))) {
      t.held.heldBy = null;
      t.held = null;
    }
    if (t.rider && !["vehicle", "quad", "boat", "air", "bird"].includes(t.m)) {
      t.rider.ridingOn = null;
      t.rider = null;
    }
  }
  const things = plan.things.filter((t) => !t.heldBy && !t.ridingOn);
  const hasPerch = things.some((t) => t.m === "flower" || t.m === "tree");
  const perched = [];
  const glyphThings = [];
  if (!things.length && plan.unknown.length) {
    for (const u of plan.unknown.slice(0, 4)) glyphThings.push({ m: "glyph", o: { kind: "glyph" }, word: u.word, label: u.word, count: 1, scale: 1 });
  }
  for (const t of things.concat(glyphThings)) {
    const flying = t.act === "fly" || (t.m === "bird" && (t.o.kind === "bat" || t.o.kind === "eagle" || t.o.kind === "phoenix" || t.o.kind === "gull") && t.act !== "sleep") || (t.m === "bug" && ["butterfly", "dragonfly", "bee"].includes(t.o.kind) && things.length > 1);
    t.flying = flying && t.m === "bird" ? true : t.act === "fly";
    if (SKY_ITEMS.has(t.m) || flying) sky.push(t);
    else if ((t.m === "fish" || t.m === "boat" || t.act === "swim") && SC.water) water.push(t);
    else if (t.m === "fish" && SC.floating) sky.push(t);
    else ground.push(t);
  }
  if (SC.addRainbow) sky.unshift({ m: "sky", o: { kind: "rainbow" }, count: 1, scale: 1 });
  // fish on dry land: float them low in the air (it's a painting)
  for (let i = ground.length - 1; i >= 0; i--) if (ground[i].m === "fish" || ground[i].m === "boat") {
    if (ground[i].m === "fish") sky.push(ground.splice(i, 1)[0]);
  }

  const reports = [];
  // Sky lane: big celestial bodies first
  const skyInst = sky.flatMap(instancesOf);
  const skyBottom = SC.floating ? height * 0.9 : (SC.horizon || height * 0.6) - 30;
  const skyTop = SC.skyTop || 30;
  skyInst.forEach((inst, k) => {
    const t = inst.t;
    if (t.m === "bug" && hasPerch && t.act !== "fly") {
      perched.push(t);
      return;
    }
    const kind = t.o.kind;
    const big = ["sun", "moon", "planet", "earth", "mars", "galaxy"].includes(kind);
    let x;
    let y;
    let s = (big ? 1.1 : 0.9) * t.scale;
    if (kind === "rainbow") {
      x = width * 0.5;
      y = SC.horizon ? SC.horizon + 10 : height * 0.7;
      s = 1.2;
    } else if (big) {
      x = width * (SC.hash % 2 ? 0.76 : 0.24) + random(-30, 30);
      y = skyTop + 70 + random(0, 30);
      if (skyInst.filter((q) => ["sun", "moon", "planet", "earth", "mars", "galaxy"].includes(q.t.o.kind)).indexOf(inst) === 1) x = width - x;
      if (!ground.length && skyInst.length === 1) {
        x = width / 2;
        y = (skyTop + skyBottom) / 2;
        s = 2.0 * t.scale;
      }
    } else if (kind === "stars") {
      x = width * 0.5 + random(-60, 60);
      y = skyTop + 80;
    } else if (kind === "cloud") {
      x = width * random(0.2, 0.8);
      y = skyTop + random(30, 110);
      s *= t.count > 1 ? 0.7 : 1;
    } else {
      const n = skyInst.length;
      const lane = (k + 0.5) / n;
      x = width * (0.12 + 0.76 * lane) + random(-25, 25);
      y = skyTop + 60 + (skyBottom - skyTop - 120) * (0.25 + 0.5 * ((k * 7 + SC.hash) % 5) / 4) + random(-20, 20);
      if (!ground.length && skyInst.filter((q) => !["sun", "moon", "stars", "cloud", "rainbow"].includes(q.t.o.kind)).length === 1) {
        x = width * 0.5;
        y = (skyTop + skyBottom) / 2 + 20;
        s = 2.0 * t.scale;
      } else s *= t.count > 2 ? 0.55 : 0.85;
    }
    const f = (k + (SC.hash & 1)) % 2 ? -1 : 1;
    const fn = MOTIF[t.m] && MOTIF[t.m].fn;
    let r;
    if (t.m === "glyph") r = mGlyph(x, y, s, t);
    else if (t.m === "bird") r = mBird(x, y, s, t, f);
    else if (t.m === "quad") r = mQuad(x, y + 40 * s, s * 0.85, t, f);
    else if (t.m === "person") r = mPerson(x, y + 70 * s, s * 0.8, t, f);
    else if (MOTIF[t.m] && MOTIF[t.m].ground) r = fn(x, y + 30 * s, s, t, f);
    else r = fn(x, y, s, t, f);
    reports.push({ t, r, x, y, s, f });
  });

  // Water lane
  const waterInst = water.flatMap(instancesOf);
  waterInst.forEach((inst, k) => {
    const t = inst.t;
    const n = waterInst.length;
    const x = width * (0.15 + 0.7 * ((k + 0.5) / n)) + random(-20, 20);
    const f = k % 2 ? -1 : 1;
    let s = Math.min(1.8, 2.2 / Math.sqrt(n)) * t.scale;
    let r;
    if (t.m === "boat") {
      s = Math.min(s, 1.3);
      const wy = SC.water[0] + 30 + (k % 2) * 30;
      r = mBoat(x, wy, s, t, f);
    } else if (t.m === "fish") {
      if (t.o.kind === "whale") s *= 0.7;
      const y = SC.underwater ? height * (0.3 + 0.45 * ((k * 3 + SC.hash) % 4) / 3) : SC.water[0] + (SC.water[1] - SC.water[0]) * 0.55;
      r = mFish(x, y, s, t, f);
    } else {
      const wy = SC.water[0] + 40;
      r = (MOTIF[t.m].fn)(x, wy, s * 0.8, t, f);
    }
    reports.push({ t, r, x, y: 0, s, f });
  });

  // Ground lane: buildings + trees at the back, everything else in front.
  const back = ground.filter((t) => (t.m === "building" || t.m === "tree") && ground.length > 1);
  const front = ground.filter((t) => !back.includes(t));
  const lanes = [
    { list: back.flatMap(instancesOf), gy: SC.floating ? SC.groundY - 40 : Math.min(SC.groundY - 30, (SC.horizon || SC.groundY) + 40), depth: 0.75 },
    { list: front.flatMap(instancesOf), gy: SC.groundY, depth: 1 },
  ];
  for (const lane of lanes) {
    const list = lane.list;
    if (!list.length) continue;
    const roomH = lane.gy - (SC.skyTop || 30) - 20;
    const gap = 16;
    const items = list.map((inst) => {
      const M = motifSize(inst.t);
      let s = Math.min((roomH * (list.length === 1 ? 0.6 : 0.72)) / M.h, list.length === 1 ? 2.6 : 2.1);
      s *= lane.depth * (inst.i ? 0.85 : 1) * Math.min(1.25, inst.t.scale);
      // a held thing takes room beside its holder
      const extra = inst.t.held ? 0.45 : 0;
      return { inst, M, s, extra };
    });
    const widthOf = (it) => it.M.w * it.s * (1 + it.extra);
    const avail = width * 0.9 - gap * (items.length - 1);
    let total = items.reduce((a, it) => a + widthOf(it), 0);
    if (total > avail) {
      const k = avail / total;
      items.forEach((it) => (it.s = Math.max(0.3, it.s * k)));
      total = items.reduce((a, it) => a + widthOf(it), 0);
    }
    let cursor = (width - total - gap * (items.length - 1)) / 2;
    // keep the foreground from hiding the house / tree behind it
    if (back.length && front.length) {
      const room = width - total - gap * (items.length - 1);
      const side = SC.hash % 2 ? 1 : -1;
      const shift = Math.min(room / 2, width * (lane.depth < 1 ? 0.2 : 0.14)) * (lane.depth < 1 ? side : -side);
      cursor += shift;
    }
    items.forEach((it, k) => {
      const { inst, M, s } = it;
      const t = inst.t;
      const w = M.w * s;
      const f = list.length > 1 ? (k < list.length / 2 ? 1 : -1) : SC.hash % 2 ? 1 : -1;
      const x = cursor + (f > 0 ? w / 2 : widthOf(it) - w / 2) + random(-8, 8);
      cursor += widthOf(it) + gap;
      const gy = lane.gy + (inst.i % 2) * 14 - (k % 2) * 6;
      if (SC.floating && SC.place === "space" && t.m !== "glyph") {
        oval(x, gy + 8, w * 0.55, 14 * s + 6, "#8c8f96", 220, 0, true);
        oval(x - w * 0.15, gy + 4, w * 0.12, 4 * s + 2, "#6f7378", 200);
      } else if (SC.floating) cloud(x, gy + 10, w * 0.35, "#ffffff", 190);
      else oval(x, gy + 2, w * 0.42, 6 + 4 * s, "#1c1d22", 40, 0, false, 0.3);
      let r;
      if (t.m === "glyph") r = mGlyph(x, gy - 60 * s, s, t);
      else if (t.m === "fish") r = mFish(x, gy - 50 * s, s, t, f);
      else if (t.m === "bug") r = mBug(x, gy - 30 * s, s, t, f);
      else if (t.m === "sky") r = mSky(x, gy - 60 * s, s, t);
      else if (t.m === "boat") r = mBoat(x, gy - 20 * s, s * 0.8, t, f);
      else r = M.fn(x, gy, s, t, f);
      reports.push({ t, r, x, y: gy, s, f });
    });
  }

  // Bees and butterflies land on the flowers / trees.
  const perches = reports.filter((r) => r.t.m === "flower" || r.t.m === "tree");
  perched.forEach((t, i) => {
    const p = perches[i % perches.length];
    mBug(p.x + random(-25, 25), p.r.top + 18 + random(0, 20), Math.max(0.8, p.s * 0.9) * t.scale, t, i % 2 ? -1 : 1);
  });

  // Riders sit in or on what they ride.
  for (const rep of reports) {
    const rider = rep.t.rider;
    if (!rider || !rep.r || !rep.r.seat) continue;
    const [sx, sy] = rep.r.seat;
    const enclosed = rep.t.m === "vehicle" && rep.t.o.kind !== "bike" || rep.t.m === "air";
    if (enclosed && rider.m === "person") {
      const hr = 13 * rep.s;
      const skin = SKIN[(rider.name ? strHash(rider.name) : SC.hash) % SKIN.length];
      oval(sx, sy, hr, hr * 1.05, skin, 220, 0, true);
      oval(sx - rep.f * hr * 0.15, sy - hr * 0.55, hr * 1.02, hr * 0.5, HAIR[(SC.hash >>> 3) % HAIR.length], 200);
      eye(sx + rep.f * hr * 0.35, sy, Math.max(1.6, hr * 0.13));
      sp([[sx + rep.f * hr * 0.1, sy + hr * 0.45], [sx + rep.f * hr * 0.4, sy + hr * 0.55], [sx + rep.f * hr * 0.65, sy + hr * 0.4]], INK, 0.8);
    } else {
      const M = MOTIF[rider.m] || MOTIF.obj;
      const rs = rep.s * (rider.m === "person" ? 0.55 : 0.45);
      if (rider.m === "person") rider.o = Object.assign({}, rider.o);
      M.fn(sx, sy + (rider.m === "person" ? 4 : 8), rs, rider, rep.f);
    }
  }

  // Held / eaten things go at the holder's mouth or hand.
  for (const rep of reports) {
    const held = rep.t.held;
    if (!held || !rep.r) continue;
    const anchor = rep.t.act === "eat" ? rep.r.head : rep.r.hand;
    if (!anchor) continue;
    const M = MOTIF[held.m] || MOTIF.obj;
    const hs = Math.max(0.3, Math.min(0.9, rep.s * 0.55 * (rep.t.m === "person" ? 1 : 0.9)));
    const hx = anchor[0] + rep.f * M.w * hs * 0.35;
    const hy = anchor[1] + M.h * hs * 0.45;
    if (held.m === "sky") mSky(hx, anchor[1], hs * 0.6, held);
    else if (held.m === "fish") mFish(hx, anchor[1], hs, held, rep.f);
    else if (held.m === "bug") mBug(hx, anchor[1], hs, held, rep.f);
    else if (held.m === "air") mAir(hx, anchor[1] - 40 * hs, hs * 0.7, held, rep.f);
    else if (held.m === "person" || held.m === "quad" || held.m === "building" || held.m === "tree" || held.m === "vehicle") {
      // too big to hold: stand it next to the holder
      M.fn(rep.x + rep.f * (rep.r.w || 100) * 0.9, rep.y, rep.s * 0.75, held, -rep.f);
    } else M.fn(hx, hy, hs, held, rep.f);
    if (rep.t.act === "eat") for (let i = 0; i < 4; i++) pip(hx + random(-20, 20), hy + random(0, 20), 1.8, "#c98a4a");
  }

  // Action marks
  for (const rep of reports) {
    const { t, r } = rep;
    if (!r) continue;
    if (t.act === "sleep") {
      for (let i = 0; i < 3; i++) {
        const zx = rep.x + rep.f * (20 + i * 18);
        const zy = r.top - 10 - i * 22;
        const z = 6 + i * 3;
        pen(SC.time === "night" ? "#fff6d8" : INK, 1.2, "2B");
        brush.line(zx - z, zy - z, zx + z, zy - z);
        brush.line(zx + z, zy - z, zx - z, zy + z);
        brush.line(zx - z, zy + z, zx + z, zy + z);
      }
    }
    if (t.act === "run") for (let i = 0; i < 4; i++) ln(rep.x - rep.f * (r.w * 0.55 + 10), r.top + 30 + i * 16, rep.x - rep.f * (r.w * 0.55 + 60 + random(30)), r.top + 30 + i * 16, SC.time === "night" ? "#c9d6f0" : "#5f6b7a", 1);
    if (t.act === "dance") for (let i = 0; i < 3; i++) mObj(rep.x + random(-r.w * 0.6, r.w * 0.6), r.top - 10 - random(40), 0.35, { o: { kind: "notes" } });
    if (t.act === "study" && !t.held) mObj(rep.x + rep.f * r.w * 0.6, rep.y, rep.s * 0.5, { o: { kind: "books" } });
  }

  paintWeather();
  paintMoods(reports);

  // Invented words that rode along with real subjects: little emblems in the sky.
  if (things.length && plan.unknown.length) {
    plan.unknown.filter((u) => !u.verbish).slice(0, 2).forEach((u, i) => {
      const x = width * (i ? 0.84 : 0.16) + random(-15, 15);
      const y = (SC.skyTop || 30) + 40 + random(0, 50);
      mGlyph(x, y, 0.42, u);
    });
  }

  return res;
}

/* ---------------- weather + mood ---------------- */

function paintWeather() {
  const wx = SC.weather;
  const top = SC.skyTop || 20;
  if (wx.includes("storm") || wx.includes("rain")) {
    const dark = wx.includes("storm");
    for (let i = 0; i < 4; i++) cloud(width * (0.12 + i * 0.26) + random(-20, 20), top + random(20, 60), random(45, 70), dark ? "#5f6b7a" : "#a8b0bd", 170);
    pen(dark ? "#c9d6f0" : "#5a7aa8", 0.9, "HB");
    for (let i = 0; i < (dark ? 110 : 80); i++) {
      const x = random(-20, width);
      const y = random(top + 60, height);
      brush.line(x, y, x - 7, y + 18);
    }
    if (dark) {
      const lx = width * random(0.3, 0.7);
      const bolt = [[lx, top + 70], [lx - 25, top + 160], [lx + 5, top + 165], [lx - 30, top + 280]];
      sp(bolt, "#fff3b0", 3.5, "marker", 0);
      sp(bolt, "#f3d660", 1.4, "2B", 0);
    }
  }
  if (wx.includes("snow")) {
    for (let i = 0; i < 120; i++) pip(random(width), random(height), random(1.5, 3.5), "#ffffff", random(180, 245));
  }
  if (wx.includes("fog")) {
    for (let i = 0; i < 5; i++) {
      fillC("#eef2f6", 90, 0.5, 0.3);
      brush.polygon(ellP(random(width), random(height * 0.3, height * 0.9), random(220, 320), random(30, 55)));
    }
  }
  if (wx.includes("wind")) {
    for (let i = 0; i < 7; i++) {
      const y = random(top + 30, height * 0.8);
      const x = random(-20, width * 0.6);
      sp([[x, y], [x + 80, y - 8], [x + 160, y + 4], [x + 200, y - 14], [x + 190, y - 30], [x + 172, y - 20]], SC.time === "night" ? "#c9d6f0" : "#6f7f9a", 0.9);
    }
    for (let i = 0; i < 8; i++) oval(random(width), random(height * 0.8), 7, 3.5, pickc(SC.season === "autumn" ? ["#e08a3a", "#c8572d"] : ["#7a9a52", "#9cc46a"]), 200, random(3));
  }
  if (SC.season === "autumn" && !wx.includes("wind")) for (let i = 0; i < 14; i++) oval(random(width), random(height * 0.85), 7, 3.5, pickc(["#e08a3a", "#c8572d", "#e1b83f"]), 200, random(3));
  if (SC.season === "spring" && random() < 0.7) for (let i = 0; i < 12; i++) oval(random(width), random(height * 0.7), 5, 3, "#f2b5c4", 200, random(3));
}

function paintMoods(reports) {
  const ms = SC.moodSet;
  const main = reports.find((r) => r.t.m !== "sky" && r.t.m !== "air") || reports[0];
  const top = SC.skyTop || 30;
  if (ms.has("love")) for (let i = 0; i < 7; i++) {
    const x = random(40, width - 40);
    const y = random(top + 20, height * 0.55);
    const s = random(10, 24);
    shape(heartP(x, y, s), pickc(["#e57a9a", "#d84a6a", "#f2b5c4"]), 190, 0.08, true);
  }
  if (ms.has("magic")) for (let i = 0; i < 16; i++) sparkle(random(20, width - 20), random(top, height * 0.85), random(4, 10), pickc(["#f6e3a0", "#fbf8f0", "#e4b8f0"]));
  if (ms.has("excited")) {
    for (let i = 0; i < 40; i++) {
      const px = random(width);
      const py = random(top, height * 0.8);
      const a = random(Math.PI);
      solid(limbP(px, py, px + Math.cos(a) * 9, py + Math.sin(a) * 9, 2.5, 2.5), pickc(["#e0509a", "#f3d660", "#3dbbe0", "#ff8a2a", "#7cc36e"]), 230);
    }
  }
  if (ms.has("angry")) {
    for (let k = 0; k < 3; k++) {
      const cx = main ? main.x + random(-90, 90) : random(width);
      const cy = main && main.r ? main.r.top - 20 - random(40) : random(height * 0.5);
      const pts = [];
      for (let i = 0; i < 9; i++) pts.push([cx - 50 + i * 12, cy + (i % 2 ? -14 : 14)]);
      sp(pts, "#c1272d", 2.2, "2B", 0);
    }
  }
  if (ms.has("stressed")) {
    const cx = main ? main.x : width / 2;
    const cy = main && main.r ? main.r.top - 45 : height * 0.3;
    const pts = [];
    for (let i = 0; i < 40; i++) pts.push([cx + random(-55, 55), cy + random(-28, 28)]);
    sp(pts, SC.time === "night" ? "#c9d6f0" : "#3c3f45", 1, "HB", 0.9);
    for (let i = 0; i < 4; i++) {
      const px = random(30, width - 30);
      const py = random(top + 20, height * 0.6);
      const p = rectP(px, py, 26, 34).map(([a, b]) => rotatePoint(px, py, a - px, b - py, random(-0.6, 0.6)));
      solid(p, "#fbf8f0", 230);
      outline(p, "#8592a3", 0.5);
    }
  }
  if (ms.has("sad") && main && main.r && !SC.weather.includes("rain") && !SC.weather.includes("storm")) {
    const cx = main.x;
    const cy = Math.max(top + 40, main.r.top - 60);
    cloud(cx, cy, 34, "#8c96a3", 190);
    pen("#5a7aa8", 0.9);
    for (let i = 0; i < 14; i++) {
      const x = cx + random(-45, 45);
      const y = cy + random(20, 80);
      brush.line(x, y, x - 4, y + 12);
    }
  }
  if (ms.has("spooky")) {
    for (let i = 0; i < 3; i++) mBird(random(60, width - 60), random(top + 30, height * 0.35), 0.35, { o: { kind: "bat" }, flying: true }, 1);
  }
  if (ms.has("happy") && !SC.kinds.has("sun") && SC.time === "day" && SC.place !== "room" && SC.place !== "table" && SC.place !== "underwater") {
    for (let i = 0; i < 2; i++) mBird(random(60, width - 60), random(top + 40, (SC.horizon || 300) * 0.6), 0.32, { o: { kind: "bird", col: "#3c3f45" }, flying: true }, i ? 1 : -1);
  }
  if (ms.has("hungry") && !SC.kinds.size) mFood(width / 2, SC.groundY, 1.6, { o: { kind: pickc(["pizza", "burger", "donut"]) } }, 1);
}

/* ---------------- caption ---------------- */

const PLACE_LABEL = { meadow: "meadow", farm: "farm", forest: "forest", jungle: "jungle", savanna: "savanna", mountains: "mountains", volcano: "volcano", desert: "desert", beach: "beach", ocean: "ocean", lake: "lake", island: "island", underwater: "underwater", city: "city", road: "road", arctic: "snowfield", room: "a room", table: "a table", stadium: "stadium", space: "space", moon: "the moon", mars: "mars", skyonly: "the sky", cave: "a cave", swamp: "swamp" };
const FORM_NAMES = ["creature", "antennaed creature", "rings", "spiral", "burst", "totem", "crystals"];

function sceneCaption(plan, res) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const parts = [];
  const saw = plan.seen.map((s) => (s.kind === "place" && s.label === "moon" ? "on the moon" : s.label));
  if (saw.length) parts.push(`<span class="k">saw</span> ${saw.map(esc).join(" · ")}`);
  const added = res.guessed.map((g) => PLACE_LABEL[g] || g);
  if (added.length) parts.push(`<span class="k">set in</span> ${added.map(esc).join(" · ")}`);
  if (plan.unknown.length) {
    const inv = plan.unknown.slice(0, 4).map((u) => {
      const form = (strHash(String(u.word).toLowerCase()) >>> 4) % 7;
      return `${esc(u.word)} → ${FORM_NAMES[form]}`;
    });
    parts.push(`<span class="k">invented</span> ${inv.join(" · ")}`);
  }
  if (!parts.length) parts.push(`<span class="k">saw</span> nothing yet`);
  return parts.join("<br>");
}
