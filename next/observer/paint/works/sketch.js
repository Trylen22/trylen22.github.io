/**
 * Prompt → local recipe → p5.brush painting. No API.
 * The seed is the other half of the artefact: keep it, and you can return.
 */

const SIZE = 640;
const PARAMS = new URLSearchParams(window.location.search);
const EXPORT_LAYERS = PARAMS.has("layers");
const EXPORT_BEE = PARAMS.has("bee");
const EXPORT_DERIV = PARAMS.has("deriv");
const EXPORT_BLOOMTITLE = PARAMS.has("bloomtitle");
const DERIV_SEED = 412615804;

// ?p=prompt&seed=123 opens a specific painting (handy for presenting).
const URL_PROMPT = PARAMS.get("p");
const URL_SEED = PARAMS.has("seed") ? Number(PARAMS.get("seed")) || null : null;
let seed = hashSeed(URL_PROMPT || "a peach hibiscus in watercolour");
let recipe = interpretPrompt(URL_PROMPT || "a peach hibiscus in watercolour");
let painting = false;
let restoreSeed = null;
let lastThumb = "";
let layerShots = [];
let letterBrush = "2B";

async function setup() {
  const canvas = createCanvas(SIZE, SIZE, WEBGL);
  canvas.parent(document.getElementById("canvas-wrap"));
  pixelDensity(1);
  noLoop();
  brush.scaleBrushes(3);


  // Official example registers this tip — it is not a built-in stroke.
  brush.add("watercolor", {
    type: "custom",
    weight: 10,
    scatter: 1.05,
    opacity: 9,
    spacing: 0.3,
    pressure: [0.8, 1.3],
    rotate: "natural",
    tip: (_m) => {
      _m.fill(0, 200);
      _m.rect(-20, -20, 50, 50);
      _m.rect(25, 25, 20, 20);
    },
  });

  const promptEl = document.getElementById("prompt");
  if (URL_PROMPT) promptEl.value = URL_PROMPT;
  if (PARAMS.has("bare")) document.body.classList.add("bare");
  if (URL_SEED) restoreSeed = seed = URL_SEED;

  const form = document.getElementById("prompt-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (painting) return;
    restoreSeed = null;
    seed = hashSeed(readPrompt());
    paintSoon(true);
  });
  // Enter paints, Shift+Enter makes a new line.
  promptEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.getElementById("repaint").addEventListener("click", () => {
    if (painting) return;
    restoreSeed = null;
    seed = Math.floor(Math.random() * 1e9) + 1;
    paintSoon(true);
  });

  for (const chip of document.querySelectorAll("[data-try]")) {
    chip.addEventListener("click", () => {
      if (painting) return;
      promptEl.value = chip.dataset.try;
      restoreSeed = null;
      seed = hashSeed(chip.dataset.try);
      paintSoon(true);
    });
  }

  document.getElementById("save").addEventListener("click", keepSeed);

  renderShelf(openSeed);
  paintSoon();
}

// Painting blocks the page for a moment; show the status first.
function paintSoon(fromUser) {
  primed = true;
  setBusy(true);
  // phones: the painting sits under the form, bring it into view
  if (fromUser && window.innerWidth < 900) {
    const wrap = document.getElementById("canvas-wrap");
    const box = wrap.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) wrap.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  requestAnimationFrame(() => setTimeout(() => redraw(), 30));
}

let primed = false;
function draw() {
  // p5 calls draw() once on its own after setup; wait for paintSoon().
  if (!primed) return;
  if (painting) return;
  painting = true;
  setBusy(true);
  const t0 = performance.now();
  try {
    recipe = interpretPrompt(readPrompt());
    if (EXPORT_DERIV) {
      recipe = interpretPrompt("a sine wave");
      seed = DERIV_SEED;
      const promptEl = document.getElementById("prompt");
      if (promptEl) promptEl.value = "a sine wave";
    }
    if (EXPORT_BLOOMTITLE) {
      recipe = interpretPrompt("a peach hibiscus in watercolour");
      seed = hashSeed("a peach hibiscus in watercolour");
      const promptEl = document.getElementById("prompt");
      if (promptEl) promptEl.value = "a peach hibiscus in watercolour";
    }
    if (restoreSeed != null && !EXPORT_DERIV && !EXPORT_BLOOMTITLE) seed = restoreSeed;
    layerShots = [];

    randomSeed(seed);
    noiseSeed(seed);
    if (brush.seed) brush.seed(seed);
    if (brush.noiseSeed) brush.noiseSeed(seed);

    document.getElementById("prompt-label").textContent = `“${recipe.prompt}”`;
    document.getElementById("seed-label").textContent = `seed ${seed}`;
    const reading = document.getElementById("reading");
    if (recipe.subject !== "scene") {
      reading.innerHTML = `<span class="k">hand-made</span> ${recipe.subject}${recipe.variant && recipe.variant !== "plain" ? " · " + recipe.variant : ""}`;
    }
    document.getElementById("canvas-wrap").style.background = recipe.paper;

    background(recipe.paper);
    translate(-width / 2, -height / 2);
    brush.noField();

    if (EXPORT_DERIV) {
      paintDerivExport();
    } else if (EXPORT_BLOOMTITLE) {
      paintBloomTitle();
      flushBrush();
      snapLayer("title");
    } else if (EXPORT_BEE) {
      paintBeeExport();
    } else {
      snapLayer("00-paper");
      if (recipe.subject === "smiley") paintSmiley();
      else if (recipe.subject === "jelly") paintJelly();
      else if (recipe.subject === "moth") paintMoth();
      else if (recipe.subject === "window") paintWindow();
      else if (recipe.subject === "night") paintNight();
      else if (recipe.subject === "flower") paintFlower();
      else if (recipe.subject === "sine") paintSine();
      else if (recipe.subject === "bee") paintBee(1.05);
      else if (recipe.subject === "land") paintLand();
      else if (recipe.subject === "scene") {
        const res = paintScene(recipe.plan);
        reading.innerHTML = sceneCaption(recipe.plan, res);
      } else paintWash();
    }

    const ms = Math.round(performance.now() - t0);
    document.getElementById("canvas-wrap").dataset.ms = String(ms);
    if (PARAMS.has("dbg")) document.getElementById("seed-label").textContent += ` · ${ms} ms`;
    lastThumb = captureThumb();
    if (EXPORT_LAYERS || EXPORT_BEE || EXPORT_DERIV || EXPORT_BLOOMTITLE) {
      window.__paintLayers = layerShots;
      // Headless export: chrome --dump-dom can read this back without a driver.
      let dump = document.getElementById("paint-export");
      if (!dump) {
        dump = document.createElement("script");
        dump.type = "application/json";
        dump.id = "paint-export";
        document.body.appendChild(dump);
      }
      dump.textContent = JSON.stringify(layerShots);
    }
  } catch (err) {
    console.error(err);
  } finally {
    painting = false;
    restoreSeed = null;
    setBusy(false);
    shareUrl();
  }
}

// Keep the address bar on this painting so it can be shared or reloaded.
function shareUrl() {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("p", recipe.prompt);
    u.searchParams.set("seed", String(seed));
    history.replaceState(null, "", u);
  } catch {
    /* file:// or sandboxed: skip */
  }
}

function snapLayer(name) {
  if (!EXPORT_LAYERS && !EXPORT_BEE && !EXPORT_DERIV && !EXPORT_BLOOMTITLE) return;
  const canvas =
    document.querySelector("#canvas-wrap canvas.p5Canvas") ||
    document.querySelector("#canvas-wrap canvas:last-of-type");
  if (!canvas) return;
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (gl && gl.finish) gl.finish();
  try {
    layerShots.push({ name, data: canvas.toDataURL("image/png") });
  } catch (err) {
    console.warn("snapLayer failed", name, err);
  }
}

function readPrompt() {
  return document.getElementById("prompt").value;
}

function openSeed(entry) {
  if (painting) return;
  document.getElementById("prompt").value = entry.prompt;
  restoreSeed = entry.seed;
  seed = entry.seed;
  paintSoon();
}

function keepSeed() {
  if (painting) return;
  saveSeed({
    id: `${Date.now()}-${seed}`,
    prompt: recipe.prompt,
    seed,
    subject: recipe.subject,
    thumb: lastThumb,
    savedAt: new Date().toISOString(),
  });
  renderShelf(openSeed);
}

function setBusy(busy) {
  const status = document.getElementById("status");
  status.classList.toggle("is-done", !busy);
  status.textContent = busy ? "mixing pigment…" : "";
  for (const id of ["paint", "repaint", "save"]) {
    document.getElementById(id).disabled = busy;
  }
}

function pick(fallback, extras = []) {
  const pool = recipe.colors.length ? recipe.colors.concat(extras) : fallback;
  return random(pool);
}

function paintJelly() {
  const cx = width * 0.5;
  const cy = height * 0.28;
  const glow = recipe.colors[0] || "#8ff5e8";
  const inner = recipe.colors[1] || "#d4b3ff";

  brush.noStroke();
  brush.wash(recipe.paper, 255);
  brush.rect(0, 0, width, height, "corner");
  brush.noWash();

  const bell = bellPoints(cx, cy, 150, 88);
  brush.fill(glow, 85);
  brush.fillBleed(0.24, "out");
  brush.fillTexture(0.38, 0.2);
  brush.polygon(bell);

  brush.fill(inner, 70);
  brush.fillBleed(0.14, "in");
  brush.polygon(bellPoints(cx, cy + 10, 72, 42));

  brush.fill("#f4fff8", 40);
  brush.fillBleed(0.1, "out");
  brush.circle(cx, cy + 6, 28, 0.2);

  brush.noFill();
  brush.noField();
  for (let i = 0; i < 11; i++) {
    const x = cx - 120 + (i * 240) / 10 + random(-6, 6);
    const drift = random(-50, 50);
    brush.set(i % 2 === 0 ? "HB" : "rotring", random([glow, inner, "#e8fff6"]), random(0.5, 1.0));
    brush.spline(
      [
        [x, cy + 16],
        [x + drift * 0.3, cy + 90 + random(-10, 20)],
        [x + drift * 0.7, cy + 190 + random(-16, 24)],
        [x + drift, cy + 320 + random(-20, 40)],
      ],
      0.45
    );
  }
}

function bellPoints(cx, cy, w, h) {
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const a = Math.PI + t * Math.PI;
    pts.push([cx + Math.cos(a) * w, cy + Math.sin(a) * h]);
  }
  pts.push([cx + w * 0.62, cy + 14]);
  pts.push([cx, cy + 6]);
  pts.push([cx - w * 0.62, cy + 14]);
  return pts;
}

function paintWindow() {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const blue = ["#1a3268", "#254a8c", "#3d6cb0", "#16305a"];
  const red = ["#8b1c2c", "#c13b4a", "#6e1420"];
  const gold = ["#c9a227", "#e7c14a", "#f0d78c"];
  const leads = [];

  brush.noStroke();
  brush.wash(recipe.paper, 255);
  brush.rect(0, 0, width, height, "corner");
  brush.noWash();

  brush.noFill();
  for (let i = 0; i < 40; i++) {
    const a = random(TWO_PI);
    const rad = random(282, 330);
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    brush.set("HB", random(["#fff6d8", "#e7c14a", "#c5c8d4"]), random(0.35, 0.75));
    const s = random(0.6, 1.8);
    brush.line(x - s, y, x + s, y);
    brush.line(x, y - s, x, y + s);
  }

  brush.noStroke();
  brush.wash("#1c1612", 255);
  brush.circle(cx, cy, 272);
  brush.noWash();

  const outer = 12;
  for (let i = 0; i < outer; i++) {
    const mid = -HALF_PI + (i + 0.5) * (TWO_PI / outer);
    const pts = lancet(cx, cy, 170, 252, mid, (TWO_PI / outer) * 0.47);
    pane(pts, i % 3 === 0 ? red[i % red.length] : blue[i % blue.length], 215);
    leads.push(pts);
  }

  for (let i = 0; i < outer; i++) {
    const a = -HALF_PI + i * (TWO_PI / outer);
    const p = polarPt(cx, cy, 186, a);
    brush.wash(i % 2 === 0 ? gold[i % gold.length] : red[i % red.length], 220);
    brush.circle(p[0], p[1], 17);
    brush.noWash();
  }

  const inner = 8;
  for (let i = 0; i < inner; i++) {
    const mid = -HALF_PI + (i + 0.5) * (TWO_PI / inner);
    const pts = lancet(cx, cy, 80, 152, mid, (TWO_PI / inner) * 0.45);
    pane(pts, i % 2 === 0 ? gold[i % gold.length] : red[i % red.length], 225);
    leads.push(pts);
  }

  for (let i = 0; i < 6; i++) {
    const mid = -HALF_PI + i * (TWO_PI / 6);
    const pts = lancet(cx, cy, 16, 74, mid, (TWO_PI / 6) * 0.42);
    pane(pts, i % 2 === 0 ? red[0] : gold[1], 230);
    leads.push(pts);
  }

  brush.wash("#f3de7a", 235);
  brush.circle(cx, cy, 15);
  brush.noWash();

  brush.noFill();
  brush.set("rotring", "#0a0706", 1.05);
  for (const pts of leads) brush.polygon(pts);

  brush.set("rotring", "#0a0706", 0.95);
  brush.circle(cx, cy, 170);
  brush.circle(cx, cy, 80);
  brush.set("rotring", "#d4af37", 1.55);
  brush.circle(cx, cy, 272);
}

function pane(pts, hex, opacity) {
  brush.noStroke();
  brush.wash(hex, opacity);
  brush.polygon(pts);
  brush.noWash();
}

function lancet(cx, cy, r0, r1, mid, spread) {
  const a0 = mid - spread;
  const a2 = mid + spread;
  const pts = [];
  for (let t = 0; t <= 5; t++) {
    pts.push(polarPt(cx, cy, r0, a0 + (a2 - a0) * (t / 5)));
  }
  pts.push(polarPt(cx, cy, r0 * 0.3 + r1 * 0.7, a2));
  pts.push(polarPt(cx, cy, r1, mid));
  pts.push(polarPt(cx, cy, r0 * 0.3 + r1 * 0.7, a0));
  return pts;
}

function polarPt(cx, cy, r, a) {
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

function paintSmiley() {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const face = recipe.colors[0] || "#f3de7a";
  const ink = "#2a241c";

  brush.noStroke();
  brush.fill(face, 125);
  brush.fillBleed(0.14, "out");
  brush.fillTexture(0.4, 0.28);
  brush.circle(cx, cy, 158, 0.12);

  brush.fill("#e7c14a", 45);
  brush.fillBleed(0.08, "in");
  brush.circle(cx + 6, cy + 10, 112, 0.08);

  // Solid dots read as eyes; watercolor fills of this size turn hexagonal.
  brush.wash(ink, 230);
  brush.circle(cx - 48, cy - 30, 20);
  brush.circle(cx + 50, cy - 28, 20);
  brush.wash("#fff6d8", 200);
  brush.circle(cx - 54, cy - 36, 5);
  brush.circle(cx + 44, cy - 34, 5);
  brush.noWash();

  brush.noFill();
  brush.set("rotring", ink, 1.6);
  brush.spline(
    [
      [cx - 70, cy + 32],
      [cx - 36, cy + 70],
      [cx, cy + 82],
      [cx + 38, cy + 70],
      [cx + 72, cy + 34],
    ],
    0.6
  );
}

function withDegrees(fn) {
  angleMode(DEGREES);
  try {
    fn();
  } finally {
    angleMode(RADIANS);
    brush.noField();
    brush.noHatch();
    brush.noFill();
    brush.noMass();
  }
}











function paintCenteredWord(text, y, h, col, weight, gap) {
  const g = gap == null ? 7 : gap;
  const w = wordWidth(text, h, g);
  paintWord({ x: (width - w) / 2, y, h, gap: g }, text, col, weight);
}

function paintMoth() {
  const cx = width * 0.5;
  const cy = height * 0.42;
  const wing = recipe.colors[0] || "#e4f5c2";
  const wingDark = "#9cb86c";
  const glow = "#eef6d2";

  brush.noStroke();
  brush.wash(recipe.paper, 255);
  brush.rect(0, 0, width, height, "corner");
  brush.noWash();

  mothWing(cx, cy, -1, "hind", wing, wingDark);
  mothWing(cx, cy, 1, "hind", wing, wingDark);
  mothWing(cx, cy, -1, "fore", wing, wingDark);
  mothWing(cx, cy, 1, "fore", wing, wingDark);

  brush.noStroke();
  brush.wash(glow, 230);
  brush.polygon(mothBody(cx, cy));
  brush.noWash();
  brush.fill("#f4efe4", 90);
  brush.fillBleed(0.08, "out");
  brush.polygon(mothBody(cx, cy - 4));

  brush.noFill();
  brush.set("rotring", glow, 0.85);
  brush.spline(
    [
      [cx - 4, cy - 62],
      [cx - 28, cy - 108],
      [cx - 58, cy - 128],
    ],
    0.45
  );
  brush.spline(
    [
      [cx + 4, cy - 62],
      [cx + 30, cy - 106],
      [cx + 62, cy - 124],
    ],
    0.45
  );
}

function mothWing(cx, cy, side, kind, wing, wingDark) {
  const shape = kind === "fore" ? foreWing() : hindWing();
  const pts = shape.map(([x, y]) => [cx + side * x, cy + y]);

  brush.noStroke();
  brush.fill(wing, 175);
  brush.fillBleed(0.16, "out");
  brush.fillTexture(0.45, 0.28);
  brush.polygon(pts);

  if (kind === "fore") {
    const spotX = cx + side * 108;
    const spotY = cy - 18;
    brush.fill(wingDark, 80);
    brush.fillBleed(0.1, "out");
    brush.circle(spotX, spotY, 22, 0.2);
    brush.wash("#2a241c", 160);
    brush.circle(spotX, spotY, 8);
    brush.wash("#fff6d8", 180);
    brush.circle(spotX + side * 2, spotY - 2, 3);
    brush.noWash();
  }
}

function foreWing() {
  return [
    [12, -8],
    [70, -78],
    [138, -62],
    [168, -8],
    [142, 36],
    [78, 28],
    [18, 14],
  ];
}

function hindWing() {
  return [
    [10, 12],
    [72, 22],
    [108, 58],
    [64, 132],
    [38, 198],
    [22, 150],
    [8, 48],
  ];
}

function mothBody(cx, cy) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.7);
    pts.push([cx - 16 * env, cy - 70 + t * 150]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.7);
    pts.push([cx + 16 * env, cy - 70 + t * 150]);
  }
  return pts;
}

function paintNight() {
  const sky = recipe.colors.length ? recipe.colors : ["#1a2450", "#24366e", "#3a4c88", "#12102a"];
  const star = ["#fff6d8", "#f3de7a", "#fff8e8"];

  brush.noStroke();
  brush.wash(recipe.paper, 255);
  brush.rect(0, 0, width, height, "corner");
  brush.noWash();

  const blobs = [
    [width * 0.5, height * 0.32, 280, sky[0], 90],
    [width * 0.18, height * 0.18, 170, sky[1 % sky.length], 70],
    [width * 0.82, height * 0.24, 190, sky[2 % sky.length], 85],
    [width * 0.55, height * 0.12, 140, sky[sky.length - 1], 55],
  ];
  for (const [x, y, r, c, a] of blobs) {
    brush.fill(c, a);
    brush.fillBleed(0.38, "out");
    brush.fillTexture(0.4, 0.24);
    brush.circle(x + random(-18, 18), y + random(-12, 12), r, true);
  }

  brush.noFill();
  brush.field("waves");
  for (let i = 0; i < 7; i++) {
    brush.set("HB", random(["#8ea0d4", "#c9b57a", "#a8b8e0"]), random(0.55, 1.05));
    brush.flowLine(random(40, width - 40), random(40, height * 0.55), random(90, 180), random(-0.4, 0.35));
  }
  brush.noField();

  brush.noStroke();
  brush.fill("#0b0d0a", 150);
  brush.fillBleed(0.18, "out");
  brush.fillTexture(0.4, 0.35);
  brush.polygon(ridge(height * 0.72, 55));
  brush.fill("#151c16", 130);
  brush.polygon(ridge(height * 0.82, 38));
  cypress(width * 0.18, height * 0.92, random(150, 190));

  const mx = width * random(0.62, 0.78);
  const my = height * random(0.16, 0.28);
  brush.fill("#f3e4b4", 55);
  brush.fillBleed(0.5, "out");
  brush.circle(mx, my, 92, true);
  brush.fill("#fff6d8", 160);
  brush.fillBleed(0.16, "out");
  brush.circle(mx + 2, my + 1, 38, 0.4);

  brush.noFill();
  for (let i = 0; i < 70; i++) {
    const x = random(16, width - 16);
    const y = random(16, height * 0.7);
    const s = random(0.8, 2.2);
    brush.set("HB", random(star), random(0.4, 0.85));
    brush.line(x - s, y, x + s, y);
    brush.line(x, y - s, x, y + s);
  }
}

function paintFlower() {
  if (recipe.variant === "canopy") paintCanopy();
  else if (recipe.variant === "ornament") paintOrnamentGrid();
  else paintBloomHibiscus();
}

function flowerPalette() {
  return {
    rose: recipe.colors[0] || "#B97D78",
    mid: recipe.colors[1] || "#f0a3a0",
    crimson: recipe.colors[2] || "#991F25",
    gold: "#C5A059",
    teal: "#5E8C8A",
    ink: "#4a3c31",
    butter: "#f3de7a",
    leaf: ["#6f8a55", "#4e6a40", "#8aa05a"],
  };
}

function paintBloomHibiscus() {
  const c = flowerPalette();
  const cx = width * 0.5;
  const cy = height * 0.46;
  const size = 188;

  brush.noStroke();
  brush.fill(c.teal, 32);
  brush.fillBleed(0.08, "out");
  brush.fillTexture(0.4, 0.2);
  brush.circle(cx, cy, 118, 0.06);
  brush.fill(c.rose, 22);
  brush.fillBleed(0.5, "out");
  brush.circle(cx - 28, cy - 8, 150, true);
  snapLayer("01-stain");

  brush.noFill();
  brush.set("HB", "#5a6b42", 1.15);
  brush.spline(
    [
      [cx + 6, cy + 36],
      [cx + 16, cy + 108],
      [cx + 8, cy + 198],
    ],
    0.4
  );
  snapLayer("02-stem");

  leafBlade(cx - 78, cy + 62, -2.45, 128, 44, c.leaf);
  snapLayer("03-leaf-a");
  leafBlade(cx + 92, cy + 52, -0.4, 138, 48, c.leaf);
  snapLayer("04-leaf-b");
  leafBlade(cx - 18, cy + 118, -1.95, 96, 34, c.leaf);
  snapLayer("05-leaf-c");

  for (let i = 0; i < 5; i++) {
    const angle = -HALF_PI + (i * TWO_PI) / 5 + random(-0.08, 0.08);
    const pad = String(6 + i * 2).padStart(2, "0");
    const padV = String(7 + i * 2).padStart(2, "0");
    teardropPetal(
      cx, cy, angle, size * random(0.92, 1.08), c,
      `${pad}-petal-${i}-wash`,
      `${padV}-petal-${i}-vein`
    );
  }

  brush.noHatch();
  brush.noStroke();
  brush.fill(c.crimson, 160);
  brush.fillBleed(0.16, "in");
  brush.fillTexture(0.4, 0.3);
  brush.circle(cx, cy + 4, 42, 0.35);
  brush.fill("#4a0e22", 150);
  brush.circle(cx + 1, cy + 6, 18, 0.25);
  snapLayer("16-throat");

  goldStamen(cx, cy, size * 0.58, true);
}

function teardropPetal(cx, cy, angle, size, c, washName, veinName) {
  brush.noStroke();
  brush.noHatch();
  brush.fill(c.rose, 135);
  brush.fillBleed(0.16, "out");
  brush.fillTexture(0.55, 0.38);
  teardropShape(cx, cy, angle, size, 0.62);

  brush.fill(c.mid, 70);
  brush.fillBleed(0.12, "in");
  teardropShape(cx, cy, angle, size * 0.72, 0.5);

  brush.hatchStyle("HB", c.crimson, 0.48);
  brush.hatch(1.7, angle + HALF_PI, { rand: 0.22 });
  brush.fill(c.crimson, 85);
  brush.fillBleed(0.1, "in");
  teardropShape(cx, cy, angle, size * 0.48, 0.5);
  brush.noHatch();
  if (washName) snapLayer(washName);

  brush.noFill();
  brush.set("pen", c.ink, 0.42);
  const a = polarPt(cx, cy, 10, angle);
  const b = polarPt(cx, cy, size * 0.82, angle);
  brush.line(a[0], a[1], b[0], b[1]);
  if (veinName) snapLayer(veinName);
}

function teardropShape(cx, cy, angle, size, curve) {
  const pts = [
    [cx, cy],
    polarPt(cx, cy, size * 0.64, angle - 0.36),
    polarPt(cx, cy, size, angle),
    polarPt(cx, cy, size * 0.64, angle + 0.36),
  ];
  brush.beginShape(curve);
  for (const [x, y] of pts) brush.vertex(x, y);
  brush.endShape(true);
}

function goldStamen(cx, cy, length, snap) {
  const tipX = cx - 4;
  const tipY = cy - length;
  brush.noFill();
  brush.set("HB", "#C5A059", 0.85);
  brush.line(cx, cy, tipX, tipY);
  if (snap) snapLayer("17-stamen-stalk");

  brush.wash("#C5A059", 210);
  for (let i = 0; i < 7; i++) {
    brush.circle(tipX + random(-6, 6), tipY + random(-7, 5), random(2.2, 3.6));
  }
  brush.noWash();
  brush.noFill();
  for (let i = 0; i < 10; i++) {
    brush.set("HB", random(["#C5A059", "#f3de7a", "#991F25"]), random(0.35, 0.6));
    const x = tipX + random(-10, 10);
    const y = tipY + random(-8, 6);
    brush.line(x, y, x + random(-1.5, 1.5), y + random(-1.5, 1.5));
  }
  if (snap) snapLayer("18-stamen-dust");
}

function paintOrnamentGrid() {
  const c = flowerPalette();
  const spacing = 170;
  const startX = (width - 2 * spacing) / 2;
  const startY = (height - 2 * spacing) / 2;
  const size = 62;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      motifAt(startX + col * spacing, startY + row * spacing, size, c, row === 1 && col === 1);
    }
  }
  drawGoldCorners(c);
}

function motifAt(x, y, size, c, hatchInner) {
  brush.noStroke();
  brush.noHatch();
  brush.fill(c.teal, 35);
  brush.fillBleed(0.05, "out");
  brush.fillTexture(0.4, 0.2);
  brush.circle(x, y, size * 1.05, 0.05);

  for (let k = 0; k < 5; k++) {
    const angle = -HALF_PI + (k * TWO_PI) / 5;
    brush.fill(c.rose, 140);
    brush.fillTexture(0.55, 0.35);
    teardropShape(x, y, angle, size, 0.6);
    if (hatchInner) {
      brush.hatchStyle("HB", c.crimson, 0.45);
      brush.hatch(1.5, HALF_PI, { rand: 0.2 });
      brush.fill(c.crimson, 90);
      teardropShape(x, y, angle, size * 0.52, 0.5);
      brush.noHatch();
    }
    brush.noFill();
    brush.set("pen", c.ink, 0.35);
    const a = polarPt(x, y, 4, angle);
    const b = polarPt(x, y, size * 0.78, angle);
    brush.line(a[0], a[1], b[0], b[1]);
  }

  goldStamen(x, y, size * 0.55, false);
}

function drawGoldCorners(c) {
  brush.set("2B", c.gold, 1.15);
  brush.noFill();
  const m = 36;
  const len = 58;
  brush.line(m, m, m + len, m);
  brush.line(m, m, m, m + len);
  brush.line(width - m, m, width - m - len, m);
  brush.line(width - m, m, width - m, m + len);
  brush.line(m, height - m, m + len, height - m);
  brush.line(m, height - m, m, height - m - len);
  brush.line(width - m, height - m, width - m - len, height - m);
  brush.line(width - m, height - m, width - m, height - m - len);

  brush.wash(c.teal, 180);
  for (let p = 130; p < width - 110; p += 190) {
    brush.circle(p, m, 4);
    brush.circle(p, height - m, 4);
    brush.circle(m, p, 4);
    brush.circle(width - m, p, 4);
  }
  brush.noWash();
}

function paintCanopy() {
  const glazes = ["#0b2e13", "#081c0c", "#143a1a"];
  brush.noStroke();
  brush.noHatch();
  for (const col of glazes) {
    brush.fill(col, 170);
    brush.fillTexture(0.4, 0.2);
    brush.rect(0, 0, width, height, "corner");
  }

  for (let i = 0; i < 8; i++) {
    brush.fill("#2a4d2e", 80);
    brush.fillBleed(0.7, "out");
    brush.circle(random(width), random(height), random(36, 110), 0.2);
  }
  for (let i = 0; i < 5; i++) {
    brush.fill("#1e5a2d", 40);
    brush.circle(random(width), random(height), random(90, 200), 0.45);
  }

  const pool = recipe.colors.length
    ? recipe.colors
    : ["#ff1694", "#ff8c00", "#4b0082"];
  brush.field("curved");
  for (let i = 0; i < 6; i++) {
    glazeHibiscus(
      random(70, width - 70),
      random(70, height - 70),
      random(58, 100),
      pool[i % pool.length],
      110
    );
  }
  glazeHibiscus(width * 0.42, height * 0.4, random(108, 132), "#fefefa", 200, "#c40000");
  glazeHibiscus(width * 0.62, height * 0.58, random(96, 118), "#fefefa", 190, "#c40000");
  brush.noField();
}

function glazeHibiscus(x, y, size, col, opacity, eyeCol) {
  const rot = random(TWO_PI);
  for (let i = 0; i < 5; i++) {
    const angle = rot + (i * TWO_PI) / 5 + random(-0.12, 0.12);
    brush.noStroke();
    brush.noHatch();
    brush.fill(col, opacity);
    brush.fillBleed(0.14, "in");
    brush.fillTexture(0.12, 0.35);
    const pts = [
      [x, y],
      polarPt(x, y, size * 0.55, angle - 0.42),
      polarPt(x, y, size, angle - 0.08),
      polarPt(x, y, size * 0.95, angle + 0.22),
      polarPt(x, y, size * 0.45, angle + 0.5),
    ];
    brush.beginShape(0.55);
    for (const [px, py] of pts) brush.vertex(px, py);
    brush.endShape(true);

    brush.noFill();
    brush.set("HB", "#2a241c", 0.28);
    const a = polarPt(x, y, 4, angle);
    const b = polarPt(x, y, size * 0.7, angle + 0.08);
    brush.line(a[0], a[1], b[0], b[1]);
  }

  const eye = eyeCol || lerpColor(color(col), color(0), 0.4);
  brush.noStroke();
  brush.fill(eye, 180);
  brush.fillBleed(0.5, "out");
  brush.circle(x, y, size * 0.28, 0.2);

  const stamenA = random(TWO_PI);
  brush.set("pen", "#ffeb3b", 0.55);
  brush.flowLine(x, y, size * 0.85, stamenA);
  brush.wash("#ffc107", 200);
  for (let j = 0; j < 5; j++) {
    const r = size * 0.72 + j * 3;
    brush.circle(x + Math.cos(stamenA) * r, y + Math.sin(stamenA) * r, 2.2);
  }
  brush.noWash();
}

function paintBeeExport() {
  randomSeed(seed);
  noiseSeed(seed);
  paintBee(1.0);
  snapLayer("bee-open");
  background(recipe.paper);
  randomSeed(seed);
  noiseSeed(seed);
  paintBee(0.22);
  snapLayer("bee-closed");
  for (let k = 0; k < 3; k++) {
    background(recipe.paper);
    randomSeed(seed + 17 * (k + 1));
    noiseSeed(seed + 17 * (k + 1));
    paintHashStamp();
    snapLayer(`hash-${k}`);
  }
}

function paintBee(wingSpread) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const open = wingSpread;

  brush.noStroke();
  brush.fill("#ead9c4", 28);
  brush.fillBleed(0.55, "out");
  brush.circle(cx, cy, 110, true);

  brush.wash("#fff6d8", 175);
  brush.circle(cx - 10, cy - 28, 16 + 28 * open);
  brush.circle(cx + 18, cy - 32, 14 + 24 * open);
  brush.noWash();
  brush.noFill();
  brush.set("HB", "#d8d0c0", 0.45);
  brush.spline(
    [
      [cx - 6, cy - 8],
      [cx - 22 - 20 * open, cy - 30],
      [cx - 8, cy - 44 - 10 * open],
    ],
    0.35
  );
  brush.spline(
    [
      [cx + 8, cy - 10],
      [cx + 28 + 12 * open, cy - 34],
      [cx + 14, cy - 48 - 8 * open],
    ],
    0.35
  );

  brush.noStroke();
  brush.fill("#e7c14a", 145);
  brush.fillBleed(0.2, "out");
  brush.fillTexture(0.58, 0.38);
  brush.polygon(beeAbdomen(cx + 6, cy + 6, 58, 20, 0.28));

  brush.wash("#c45c18", 195);
  brush.circle(cx - 8, cy + 2, 17);
  brush.wash("#1c1612", 225);
  brush.circle(cx - 26, cy - 2, 13);
  brush.noWash();

  brush.noFill();
  brush.set("HB", "#2a241c", 0.85);
  brush.spline(
    [
      [cx - 2, cy - 8],
      [cx + 6, cy + 4],
      [cx + 10, cy + 16],
    ],
    0.2
  );
  brush.spline(
    [
      [cx + 10, cy - 6],
      [cx + 18, cy + 6],
      [cx + 22, cy + 16],
    ],
    0.2
  );
  brush.set("HB", "#5a3a12", 0.7);
  brush.spline(
    [
      [cx + 20, cy - 4],
      [cx + 30, cy + 8],
      [cx + 34, cy + 14],
    ],
    0.2
  );

  for (let i = 0; i < 20; i++) {
    const x = cx + random(-18, 40);
    const y = cy + random(-12, 18);
    brush.set("HB", random(["#2a241c", "#7a5a28", "#e7c14a"]), random(0.28, 0.55));
    brush.line(x, y, x + random(-2.2, 2.2), y + random(-2.2, 2.2));
  }

  brush.set("HB", "#1c1612", 0.55);
  brush.line(cx - 4, cy + 14, cx - 16, cy + 36);
  brush.line(cx + 8, cy + 16, cx + 4, cy + 40);
  brush.line(cx + 20, cy + 16, cx + 32, cy + 34);
  brush.set("HB", "#1c1612", 0.4);
  brush.line(cx - 30, cy - 10, cx - 48, cy - 26);
  brush.line(cx - 28, cy - 4, cx - 50, cy - 6);
}

function beeAbdomen(cx, cy, length, girth, angle) {
  const n = 10;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.85) * (1 - 0.12 * t);
    pts.push(rotatePoint(cx, cy, -girth * env * (0.8 + random(0.25)), t * length, angle));
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.85) * (1 - 0.12 * t);
    pts.push(rotatePoint(cx, cy, girth * env * (0.8 + random(0.25)), t * length, angle));
  }
  return pts;
}

function paintHashStamp() {
  const cx = width * 0.5;
  const cy = height * 0.5;
  brush.noStroke();
  brush.fill("#d4c8b8", 55);
  brush.fillBleed(0.22, "out");
  brush.circle(cx, cy, 18, true);

  brush.noFill();
  for (let i = 0; i < 14; i++) {
    const a = random(TWO_PI);
    const x = cx + random(-12, 12);
    const y = cy + random(-12, 12);
    brush.set("rotring", random(["#2a241c", "#3d3a34", "#5c5348"]), random(0.6, 1.15));
    const h = random(7, 16);
    brush.line(x, y, x + Math.cos(a) * h, y + Math.sin(a) * h);
  }
  for (let i = 0; i < 10; i++) {
    brush.set("HB", "#2a241c", random(0.45, 0.85));
    const x = cx + random(-10, 10);
    const y = cy + random(-10, 10);
    brush.line(x, y, x + random(-4, 4), y + random(-4, 4));
  }
}

function paintSine(opts = {}) {
  const c = flowerPalette();
  const curveCol = recipe.colors[0] || c.rose;
  const useCos = recipe.variant === "cosine";
  const fn = useCos ? Math.cos : Math.sin;
  const dfn = useCos ? ((t) => -Math.sin(t)) : Math.cos;
  const maps = sineMaps();

  const showWash = opts.showWash !== false;
  const showIntegral = opts.showIntegral !== false;
  const showCurve = opts.showCurve !== false;
  const showTangent = opts.showTangent !== false;
  const secantH = opts.secantH;
  const tangentT = opts.tangentT != null ? opts.tangentT : PI / 6;

  paintSinePaper(c, maps, curveCol, fn, showWash);
  if (showIntegral) paintSineIntegral(c, maps, fn);
  paintSineAxes(c, maps);
  if (showCurve) paintSineCurve(c, maps, fn, curveCol);

  if (secantH != null) paintSineSecant(c, maps, fn, PI / 6, secantH);
  else if (showTangent) paintSineTangent(c, maps, fn, dfn, tangentT);

  drawGoldCorners(c);
  flushBrush();
}

function sineMaps() {
  const m = 78;
  const tMin = -TWO_PI;
  const tMax = TWO_PI;
  const yAmp = 1.4;
  return {
    m,
    tMin,
    tMax,
    toX: (t) => map(t, tMin, tMax, m, width - m),
    toY: (y) => map(y, -yAmp, yAmp, height - m, m),
  };
}

function paintSinePaper(c, maps, curveCol, fn, showWash) {
  paintSinePlotRect(c, maps);
  if (showWash) paintSineBlooms(c, maps, curveCol, fn);
}

function paintSinePlotRect(c, maps) {
  brush.noStroke();
  brush.noHatch();
  brush.fill(c.teal, 22);
  brush.fillBleed(0.12, "out");
  brush.fillTexture(0.28, 0.16);
  brush.rect(maps.m - 10, maps.m - 10, width - 2 * maps.m + 20, height - 2 * maps.m + 20, "corner");
}

function paintSineBlooms(c, maps, curveCol, fn) {
  const extrema = [-3 * HALF_PI, -HALF_PI, HALF_PI, 3 * HALF_PI];
  for (const t of extrema) {
    const y = fn(t);
    brush.fill(y >= 0 ? curveCol : c.teal, 30);
    brush.fillBleed(0.55, "out");
    brush.fillTexture(0.32, 0.18);
    brush.circle(maps.toX(t), maps.toY(y), 52, 0.42);
  }
}

function paintSineIntegral(c, maps, fn) {
  const oy = maps.toY(0);
  const lobe = [[maps.toX(0), oy]];
  for (let i = 0; i <= 18; i++) {
    const t = (i / 18) * PI;
    lobe.push([maps.toX(t), maps.toY(fn(t))]);
  }
  lobe.push([maps.toX(PI), oy]);
  brush.fill(c.teal, 55);
  brush.fillBleed(0.1, "in");
  brush.fillTexture(0.4, 0.22);
  brush.polygon(lobe);
}

function paintSineAxes(c, maps) {
  const ox = maps.toX(0);
  const oy = maps.toY(0);
  brush.noFill();
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    const x = maps.toX(k * HALF_PI);
    brush.set("HB", c.teal, 0.32);
    brush.line(x, maps.m, x, height - maps.m);
  }
  brush.set("HB", c.teal, 0.32);
  brush.line(maps.m, maps.toY(1), width - maps.m, maps.toY(1));
  brush.line(maps.m, maps.toY(-1), width - maps.m, maps.toY(-1));

  brush.set("2B", c.ink, 0.95);
  axisArrow(maps.m, oy, width - maps.m, oy);
  axisArrow(ox, height - maps.m, ox, maps.m);

  for (let k = -4; k <= 4; k++) {
    const x = maps.toX(k * HALF_PI);
    const tick = k % 2 === 0 ? 11 : 6;
    brush.set("HB", c.ink, k % 2 === 0 ? 0.7 : 0.45);
    brush.line(x, oy - tick, x, oy + tick);
  }
  brush.set("HB", c.ink, 0.7);
  brush.line(ox - 11, maps.toY(1), ox + 11, maps.toY(1));
  brush.line(ox - 11, maps.toY(-1), ox + 11, maps.toY(-1));
}

function paintSineCurve(c, maps, fn, curveCol, tFrom, tTo) {
  const a = tFrom == null ? maps.tMin : tFrom;
  const b = tTo == null ? maps.tMax : tTo;
  const n = Math.max(8, Math.round(48 * (b - a) / (maps.tMax - maps.tMin)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(a, b, i / n);
    pts.push([maps.toX(t), maps.toY(fn(t))]);
  }
  brush.set("HB", curveCol, 1.35);
  brush.spline(pts, 0.42);
  brush.set("pen", c.crimson, 0.5);
  brush.spline(pts, 0.42);
}

function paintSineSecant(c, maps, fn, t0, h) {
  const t1 = t0 + h;
  const x0 = maps.toX(t0);
  const y0 = maps.toY(fn(t0));
  const x1 = maps.toX(t1);
  const y1 = maps.toY(fn(t1));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const extra = 46;
  brush.set("2B", c.crimson, 1.25);
  brush.line(x0 - ux * extra, y0 - uy * extra, x1 + ux * extra, y1 + uy * extra);
  brush.set("HB", c.ink, 0.55);
  brush.line(x0 - ux * extra * 0.7, y0 - uy * extra * 0.7, x1 + ux * extra * 0.7, y1 + uy * extra * 0.7);
  brush.wash(c.crimson, 210);
  brush.circle(x0, y0, 6.5);
  brush.circle(x1, y1, 6.5);
  brush.noWash();
}

function paintSineTangent(c, maps, fn, dfn, t0) {
  const x0 = maps.toX(t0);
  const y0 = maps.toY(fn(t0));
  const slope = dfn(t0);
  const dt = 1.15;
  brush.set("2B", c.gold, 1.45);
  brush.line(
    maps.toX(t0 - dt),
    maps.toY(fn(t0) - slope * dt),
    maps.toX(t0 + dt),
    maps.toY(fn(t0) + slope * dt)
  );
  brush.set("HB", c.gold, 0.7);
  brush.line(
    maps.toX(t0 - dt * 0.7),
    maps.toY(fn(t0) - slope * dt * 0.7),
    maps.toX(t0 + dt * 0.7),
    maps.toY(fn(t0) + slope * dt * 0.7)
  );
  brush.wash(c.gold, 220);
  brush.circle(x0, y0, 6);
  brush.noWash();
}

function flushBrush() {
  brush.fill("#f4efe4", 12);
  brush.fillBleed(0.05, "out");
  brush.circle(-8, -8, 8, 0.2);
}

function paintDerivExport() {
  paintCreditSequence();
  paintInspiredSequence();

  const c = flowerPalette();
  randomSeed(seed);
  noiseSeed(seed);
  background(recipe.paper);
  paintFormulaHalo(c);
  drawGoldCorners(c);
  flushBrush();
  snapLayer("f0-paper");

  const cur = { x: 108, y: height * 0.5, h: 82, gap: 12 };
  paintGlyphF(cur, c.ink);
  paintGlyphParen(cur, c.ink, 1);
  paintGlyphX(cur, c.ink);
  paintGlyphParen(cur, c.ink, -1);
  flushBrush();
  snapLayer("f1-fx");

  cur.x += 10;
  paintGlyphEquals(cur, c.gold);
  cur.x += 10;
  flushBrush();
  snapLayer("f2-eq");

  paintGlyphS(cur, c.rose);
  paintGlyphI(cur, c.rose);
  paintGlyphN(cur, c.rose);
  paintGlyphParen(cur, c.ink, 1);
  paintGlyphX(cur, c.ink);
  paintGlyphParen(cur, c.ink, -1);
  flushBrush();
  snapLayer("f3-sin");

  const maps = sineMaps();
  const fn = Math.sin;
  const curveCol = c.rose;
  randomSeed(seed);
  noiseSeed(seed);
  background(recipe.paper);
  paintSinePlotRect(c, maps);
  drawGoldCorners(c);
  flushBrush();
  snapLayer("g0-paper");

  paintSineBlooms(c, maps, curveCol, fn);
  flushBrush();
  snapLayer("g1-wash");

  paintSineAxes(c, maps);
  flushBrush();
  snapLayer("g2-axes");

  const spans = [
    [maps.tMin, -PI, "g3-curve-a"],
    [-PI, 0, "g4-curve-b"],
    [0, PI, "g5-curve-c"],
    [PI, maps.tMax, "g6-curve"],
  ];
  for (const [a, b, name] of spans) {
    paintSineCurve(c, maps, fn, curveCol, a, b);
    flushBrush();
    snapLayer(name);
  }

  const beats = [
    { name: "e0-secant-wide", showIntegral: false, showTangent: false, secantH: 1.85 },
    { name: "e1-secant-mid", showIntegral: false, showTangent: false, secantH: 0.95 },
    { name: "e2-secant-close", showIntegral: false, showTangent: false, secantH: 0.32 },
    { name: "e3-tangent", showIntegral: false, showTangent: true, tangentT: PI / 6 },
    { name: "e4-peak", showIntegral: false, showTangent: true, tangentT: HALF_PI },
    { name: "e5-fall", showIntegral: false, showTangent: true, tangentT: PI * 0.72 },
  ];
  for (const beat of beats) {
    randomSeed(seed);
    noiseSeed(seed);
    background(recipe.paper);
    paintSine(beat);
    snapLayer(beat.name);
  }
}

function paintCreditSequence() {
  const c = flowerPalette();
  randomSeed(seed);
  noiseSeed(seed);
  background(recipe.paper);
  paintCreditHalo(c);
  drawGoldCorners(c);
  flushBrush();
  snapLayer("c0-paper");

  const ink = "#1a1410";
  const smallH = 46;
  const smallGap = 7;
  const phrase = "Created by";
  const line1 = {
    x: (width - wordWidth(phrase, smallH, smallGap)) / 2,
    y: height * 0.32,
    h: smallH,
    gap: smallGap,
  };
  letterBrush = "2B";
  paintWord(line1, "Created", ink, 2.35);
  flushBrush();
  snapLayer("c1-created");
  paintChar(line1, " ", ink);
  letterBrush = "2B";
  paintWord(line1, "by", c.gold, 1.55);
  flushBrush();
  snapLayer("c2-by");

  const nameH = 64;
  const nameGap = 7;
  const tryW = wordWidth("Trylen", nameH, nameGap);
  const steW = wordWidth("Stephens", nameH, nameGap);
  const spaceW = nameH * 0.28;
  const nameW = tryW + spaceW + steW;
  const nameX = (width - nameW) / 2;
  const nameCur = { x: nameX, y: height * 0.54, h: nameH, gap: nameGap };

  const tryLetters = "Trylen".split("");
  for (let i = 0; i < tryLetters.length; i++) {
    paintChar(nameCur, tryLetters[i], ink, 2.25);
    flushBrush();
    snapLayer(`c3-${i}-${tryLetters[i]}`);
  }
  nameCur.x += spaceW;
  const steLetters = "Stephens".split("");
  for (let i = 0; i < steLetters.length; i++) {
    paintChar(nameCur, steLetters[i], ink, 2.25);
    flushBrush();
    snapLayer(`c4-${i}-${steLetters[i]}`);
  }

  letterBrush = "2B";
  paintNameFlourish(nameX - 6, height * 0.54 + nameH * 0.62, nameW + 12, c.gold);
  flushBrush();
  snapLayer("c5-flourish");
}

function paintInspiredSequence() {
  const c = flowerPalette();
  randomSeed(seed);
  noiseSeed(seed);
  background(recipe.paper);
  paintCreditHalo(c);
  drawGoldCorners(c);

  const ink = "#1a1410";
  const smallH = 40;
  const smallGap = 6;
  const phrase = "inspired by";
  const line1 = {
    x: (width - wordWidth(phrase, smallH, smallGap)) / 2,
    y: height * 0.32,
    h: smallH,
    gap: smallGap,
  };
  letterBrush = "2B";
  paintWord(line1, "inspired", ink, 2.2);
  paintChar(line1, " ", ink);
  paintWord(line1, "by", c.gold, 1.55);

  const nameH = 56;
  const nameGap = 6;
  const surW = wordWidth("Surya", nameH, nameGap);
  const narW = wordWidth("Narreddi", nameH, nameGap);
  const spaceW = nameH * 0.28;
  const nameW = surW + spaceW + narW;
  const nameX = (width - nameW) / 2;
  const nameCur = { x: nameX, y: height * 0.54, h: nameH, gap: nameGap };
  paintWord(nameCur, "Surya", ink, 2.2);
  nameCur.x += spaceW;
  paintWord(nameCur, "Narreddi", ink, 2.2);
  paintNameFlourish(nameX - 6, height * 0.54 + nameH * 0.62, nameW + 12, c.gold);
  letterBrush = "2B";
  flushBrush();
  snapLayer("inspired");
}

function paintBloomTitle() {
  const c = flowerPalette();
  const ink = "#1a1410";
  randomSeed(seed);
  noiseSeed(seed);
  background(recipe.paper);
  brush.noField();
  brush.noStroke();
  brush.noHatch();
  brush.fill(c.gold || "#e7c14a", 28);
  brush.fillBleed(0.42, "out");
  brush.fillTexture(0.32, 0.18);
  brush.circle(width * 0.5, height * 0.38, 210, 0.38);
  brush.fill(c.rose || "#e88972", 16);
  brush.circle(width * 0.5, height * 0.62, 160, 0.48);

  letterBrush = "2B";
  paintCenteredWord("Bloom", height * 0.3, 92, ink, 2.35, 10);

  const byH = 34;
  const byGap = 6;
  const byPhrase = "By Trylen Stephens";
  const byCur = {
    x: (width - wordWidth(byPhrase, byH, byGap)) / 2,
    y: height * 0.52,
    h: byH,
    gap: byGap,
  };
  paintWord(byCur, "By", c.gold || "#C5A059", 1.7);
  paintChar(byCur, " ", ink);
  paintWord(byCur, "Trylen", ink, 2.15);
  paintChar(byCur, " ", ink);
  paintWord(byCur, "Stephens", ink, 2.15);

  const insH = 22;
  const insGap = 5;
  const insPhrase = "inspired by Surya Narreddi";
  const insCur = {
    x: (width - wordWidth(insPhrase, insH, insGap)) / 2,
    y: height * 0.72,
    h: insH,
    gap: insGap,
  };
  paintWord(insCur, "inspired", ink, 1.7);
  paintChar(insCur, " ", ink);
  paintWord(insCur, "by", c.gold || "#C5A059", 1.45);
  paintChar(insCur, " ", ink);
  paintWord(insCur, "Surya", ink, 1.7);
  paintChar(insCur, " ", ink);
  paintWord(insCur, "Narreddi", ink, 1.7);
}

function paintCreditHalo(c) {
  brush.noStroke();
  brush.noHatch();
  brush.fill(c.gold, 22);
  brush.fillBleed(0.45, "out");
  brush.fillTexture(0.28, 0.16);
  brush.circle(width * 0.5, height * 0.54, 250, 0.42);
  brush.fill(c.teal, 18);
  brush.fillBleed(0.4, "out");
  brush.circle(width * 0.5, height * 0.32, 130, 0.5);
}

function wordWidth(text, h, gap) {
  let w = 0;
  for (const ch of text) w += glyphWidth(ch, h) + gap;
  return Math.max(0, w - gap);
}

function glyphWidth(ch, h) {
  const u = {
    " ": 0.3,
    A: 0.5,
    B: 0.48,
    C: 0.5,
    D: 0.5,
    E: 0.44,
    F: 0.42,
    G: 0.52,
    H: 0.5,
    I: 0.22,
    J: 0.42,
    K: 0.5,
    L: 0.42,
    M: 0.62,
    N: 0.56,
    O: 0.5,
    P: 0.46,
    R: 0.5,
    S: 0.52,
    T: 0.62,
    U: 0.5,
    W: 0.64,
    Y: 0.54,
    "'": 0.16,
    a: 0.4,
    b: 0.38,
    d: 0.42,
    e: 0.36,
    h: 0.42,
    i: 0.2,
    l: 0.2,
    m: 0.58,
    n: 0.44,
    o: 0.4,
    p: 0.4,
    r: 0.32,
    s: 0.38,
    t: 0.32,
    u: 0.44,
    y: 0.4,
  };
  return (u[ch] == null ? 0.4 : u[ch]) * h;
}

function paintWord(cur, text, col, weight) {
  for (const ch of text) paintChar(cur, ch, col, weight);
}

function paintChar(cur, ch, col, weight) {
  if (ch === " ") {
    cur.x += glyphWidth(" ", cur.h);
    return;
  }
  if (ch === "'" || ch === "’") {
    const { x, y, h } = cur;
    const w = glyphWidth("'", h);
    strokeInk(col, (weight || 1.2) + 0.2);
    brush.line(x + w * 0.4, y - h * 0.48, x + w * 0.55, y - h * 0.28);
    cur.x += w + cur.gap;
    return;
  }
  const fn = {
    A: paintCapA,
    B: paintCapB,
    C: paintCapC,
    D: paintCapD,
    E: paintCapE,
    F: paintCapF,
    G: paintCapG,
    H: paintCapH,
    I: paintCapI,
    J: paintCapJ,
    K: paintCapK,
    L: paintCapL,
    M: paintCapM,
    N: paintCapN,
    O: paintCapO,
    P: paintCapP,
    R: paintCapR,
    S: paintCapS,
    T: paintCapT,
    U: paintCapU,
    W: paintCapW,
    Y: paintCapY,
    a: paintLowA,
    b: paintLowB,
    d: paintLowD,
    e: paintLowE,
    h: paintLowH,
    i: paintLowI,
    l: paintLowL,
    m: paintLowM,
    n: paintLowN,
    o: paintLowO,
    p: paintLowP,
    r: paintLowR,
    s: paintLowS,
    t: paintLowT,
    u: paintLowU,
    y: paintLowY,
  }[ch];
  if (!fn) {
    cur.x += glyphWidth(ch, cur.h) + cur.gap;
    return;
  }
  const w = weight || 1.2;
  const startX = cur.x;
  fn(cur, col, w);
  if (w >= 1.6) {
    const endX = cur.x;
    cur.x = startX;
    fn(cur, col, w * 0.9);
    cur.x = startX;
    fn(cur, col, w * 0.7);
    cur.x = endX;
  }
}

function paintCapT(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("T", h);
  strokeInk(col, (weight || 1.3) + 0.25);
  brush.spline(
    [
      [x - w * 0.08, y - h * 0.08],
      [x + w * 0.06, y - h * 0.5],
      [x + w * 0.22, y - h * 0.52],
    ],
    0.4
  );
  brush.line(x + w * 0.12, y - h * 0.5, x + w * 0.96, y - h * 0.5);
  brush.set("HB", col, weight || 1.2);
  brush.line(x + w * 0.5, y - h * 0.5, x + w * 0.5, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintCapS(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("S", h);
  strokeInk(col, (weight || 1.3) + 0.2);
  brush.spline(
    [
      [x + w * 0.92, y - h * 0.42],
      [x + w * 0.12, y - h * 0.48],
      [x + w * 0.12, y - h * 0.08],
      [x + w * 0.82, y + h * 0.02],
      [x + w * 0.88, y + h * 0.28],
      [x + w * 0.1, y + h * 0.46],
    ],
    0.42
  );
  cur.x += w + cur.gap;
}

function paintCapN(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("N", h);
  strokeInk(col, (weight || 1.3) + 0.15);
  brush.line(x + w * 0.08, y + h * 0.42, x + w * 0.08, y - h * 0.5);
  brush.spline(
    [
      [x + w * 0.08, y - h * 0.48],
      [x + w * 0.48, y - h * 0.08],
      [x + w * 0.9, y + h * 0.18],
    ],
    0.32
  );
  brush.line(x + w * 0.9, y + h * 0.14, x + w * 0.9, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintCapC(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("C", h);
  strokeInk(col, weight || 1.1);
  brush.spline(
    [
      [x + w * 0.88, y - h * 0.38],
      [x + w * 0.18, y - h * 0.48],
      [x + w * 0.05, y],
      [x + w * 0.22, y + h * 0.46],
      [x + w * 0.86, y + h * 0.36],
    ],
    0.45
  );
  cur.x += w + cur.gap;
}

function paintCapA(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("A", h);
  strokeInk(col, (weight || 1.3) + 0.15);
  brush.line(x + w * 0.06, y + h * 0.42, x + w * 0.5, y - h * 0.5);
  brush.line(x + w * 0.5, y - h * 0.5, x + w * 0.94, y + h * 0.42);
  brush.set("HB", col, weight || 1.2);
  brush.line(x + w * 0.28, y + h * 0.06, x + w * 0.72, y + h * 0.06);
  cur.x += w + cur.gap;
}

function paintCapE(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("E", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.12, y - h * 0.5, x + w * 0.12, y + h * 0.42);
  brush.line(x + w * 0.12, y - h * 0.5, x + w * 0.92, y - h * 0.48);
  brush.line(x + w * 0.12, y - h * 0.04, x + w * 0.7, y - h * 0.04);
  brush.line(x + w * 0.12, y + h * 0.42, x + w * 0.88, y + h * 0.4);
  cur.x += w + cur.gap;
}

function paintCapF(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("F", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.14, y - h * 0.5, x + w * 0.14, y + h * 0.42);
  brush.line(x + w * 0.14, y - h * 0.5, x + w * 0.94, y - h * 0.48);
  brush.set("HB", col, weight || 1.15);
  brush.line(x + w * 0.14, y - h * 0.04, x + w * 0.72, y - h * 0.04);
  cur.x += w + cur.gap;
}

function paintCapG(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("G", h);
  strokeInk(col, (weight || 1.25) + 0.1);
  brush.spline(
    [
      [x + w * 0.9, y - h * 0.36],
      [x + w * 0.2, y - h * 0.48],
      [x + w * 0.06, y],
      [x + w * 0.24, y + h * 0.44],
      [x + w * 0.88, y + h * 0.32],
    ],
    0.45
  );
  brush.line(x + w * 0.52, y + h * 0.02, x + w * 0.92, y + h * 0.02);
  brush.line(x + w * 0.92, y + h * 0.02, x + w * 0.92, y + h * 0.28);
  cur.x += w + cur.gap;
}

function paintCapH(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("H", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.1, y - h * 0.5, x + w * 0.1, y + h * 0.42);
  brush.line(x + w * 0.88, y - h * 0.5, x + w * 0.88, y + h * 0.42);
  brush.set("HB", col, weight || 1.15);
  brush.line(x + w * 0.1, y - h * 0.02, x + w * 0.88, y - h * 0.02);
  cur.x += w + cur.gap;
}

function paintCapI(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("I", h);
  strokeInk(col, (weight || 1.3) + 0.15);
  brush.line(x + w * 0.08, y - h * 0.5, x + w * 0.92, y - h * 0.5);
  brush.line(x + w * 0.5, y - h * 0.5, x + w * 0.5, y + h * 0.42);
  brush.line(x + w * 0.08, y + h * 0.42, x + w * 0.92, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintCapJ(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("J", h);
  strokeInk(col, (weight || 1.3) + 0.15);
  brush.line(x + w * 0.08, y - h * 0.5, x + w * 0.96, y - h * 0.48);
  brush.line(x + w * 0.66, y - h * 0.48, x + w * 0.66, y + h * 0.22);
  brush.spline(
    [
      [x + w * 0.66, y + h * 0.16],
      [x + w * 0.4, y + h * 0.46],
      [x + w * 0.06, y + h * 0.3],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintCapM(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("M", h);
  strokeInk(col, (weight || 1.3) + 0.12);
  brush.line(x + w * 0.08, y + h * 0.42, x + w * 0.08, y - h * 0.5);
  brush.line(x + w * 0.08, y - h * 0.48, x + w * 0.5, y + h * 0.14);
  brush.line(x + w * 0.5, y + h * 0.14, x + w * 0.92, y - h * 0.48);
  brush.line(x + w * 0.92, y - h * 0.5, x + w * 0.92, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintCapO(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("O", h);
  strokeInk(col, (weight || 1.25) + 0.1);
  brush.spline(
    [
      [x + w * 0.5, y - h * 0.5],
      [x + w * 0.08, y - h * 0.12],
      [x + w * 0.16, y + h * 0.38],
      [x + w * 0.84, y + h * 0.38],
      [x + w * 0.92, y - h * 0.12],
      [x + w * 0.5, y - h * 0.5],
    ],
    0.5
  );
  cur.x += w + cur.gap;
}

function paintCapB(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("B", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.12, y - h * 0.5, x + w * 0.12, y + h * 0.42);
  brush.spline(
    [
      [x + w * 0.12, y - h * 0.5],
      [x + w * 0.82, y - h * 0.48],
      [x + w * 0.82, y - h * 0.08],
      [x + w * 0.12, y - h * 0.02],
    ],
    0.4
  );
  brush.spline(
    [
      [x + w * 0.12, y - h * 0.02],
      [x + w * 0.9, y],
      [x + w * 0.86, y + h * 0.36],
      [x + w * 0.12, y + h * 0.42],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintCapD(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("D", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.12, y - h * 0.5, x + w * 0.12, y + h * 0.42);
  brush.spline(
    [
      [x + w * 0.12, y - h * 0.5],
      [x + w * 0.88, y - h * 0.28],
      [x + w * 0.88, y + h * 0.18],
      [x + w * 0.12, y + h * 0.42],
    ],
    0.42
  );
  cur.x += w + cur.gap;
}

function paintCapK(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("K", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.12, y - h * 0.5, x + w * 0.12, y + h * 0.42);
  brush.line(x + w * 0.18, y - h * 0.02, x + w * 0.92, y - h * 0.48);
  brush.line(x + w * 0.32, y - h * 0.02, x + w * 0.92, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintCapL(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("L", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.16, y - h * 0.5, x + w * 0.16, y + h * 0.42);
  brush.line(x + w * 0.16, y + h * 0.42, x + w * 0.92, y + h * 0.4);
  cur.x += w + cur.gap;
}

function paintCapP(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("P", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.14, y - h * 0.5, x + w * 0.14, y + h * 0.42);
  brush.spline(
    [
      [x + w * 0.14, y - h * 0.5],
      [x + w * 0.88, y - h * 0.46],
      [x + w * 0.86, y - h * 0.06],
      [x + w * 0.14, y + h * 0.02],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintCapR(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("R", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.14, y - h * 0.5, x + w * 0.14, y + h * 0.42);
  brush.spline(
    [
      [x + w * 0.14, y - h * 0.5],
      [x + w * 0.86, y - h * 0.46],
      [x + w * 0.84, y - h * 0.06],
      [x + w * 0.14, y + h * 0.02],
    ],
    0.4
  );
  brush.line(x + w * 0.4, y, x + w * 0.92, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintCapU(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("U", h);
  strokeInk(col, (weight || 1.25) + 0.1);
  brush.line(x + w * 0.12, y - h * 0.5, x + w * 0.12, y + h * 0.12);
  brush.line(x + w * 0.88, y - h * 0.5, x + w * 0.88, y + h * 0.12);
  brush.spline(
    [
      [x + w * 0.12, y + h * 0.08],
      [x + w * 0.5, y + h * 0.44],
      [x + w * 0.88, y + h * 0.08],
    ],
    0.45
  );
  cur.x += w + cur.gap;
}

function paintCapY(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("Y", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.06, y - h * 0.5, x + w * 0.5, y - h * 0.02);
  brush.line(x + w * 0.94, y - h * 0.5, x + w * 0.5, y - h * 0.02);
  brush.set("HB", col, weight || 1.2);
  brush.line(x + w * 0.5, y - h * 0.02, x + w * 0.5, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintCapW(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("W", h);
  strokeInk(col, (weight || 1.3) + 0.1);
  brush.line(x + w * 0.04, y - h * 0.5, x + w * 0.28, y + h * 0.42);
  brush.line(x + w * 0.28, y + h * 0.42, x + w * 0.5, y - h * 0.12);
  brush.line(x + w * 0.5, y - h * 0.12, x + w * 0.72, y + h * 0.42);
  brush.line(x + w * 0.72, y + h * 0.42, x + w * 0.96, y - h * 0.5);
  cur.x += w + cur.gap;
}

function paintLowA(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("a", h);
  strokeInk(col, weight || 1.1);
  brush.spline(
    [
      [x + w * 0.78, y - h * 0.08],
      [x + w * 0.18, y - h * 0.14],
      [x + w * 0.12, y + h * 0.18],
      [x + w * 0.72, y + h * 0.42],
    ],
    0.4
  );
  brush.line(x + w * 0.78, y - h * 0.12, x + w * 0.78, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintLowB(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("b", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.12, y - h * 0.48, x + w * 0.12, y + h * 0.42);
  brush.spline(
    [
      [x + w * 0.12, y - h * 0.04],
      [x + w * 0.82, y - h * 0.06],
      [x + w * 0.82, y + h * 0.28],
      [x + w * 0.12, y + h * 0.42],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintLowD(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("d", h);
  strokeInk(col, weight || 1.1);
  brush.spline(
    [
      [x + w * 0.82, y - h * 0.06],
      [x + w * 0.16, y - h * 0.12],
      [x + w * 0.12, y + h * 0.22],
      [x + w * 0.82, y + h * 0.42],
    ],
    0.4
  );
  brush.line(x + w * 0.82, y - h * 0.48, x + w * 0.82, y + h * 0.42);
  cur.x += w + cur.gap;
}

function paintLowE(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("e", h);
  strokeInk(col, weight || 1.1);
  brush.spline(
    [
      [x + w * 0.08, y + h * 0.08],
      [x + w * 0.9, y],
      [x + w * 0.72, y - h * 0.18],
      [x + w * 0.12, y - h * 0.06],
      [x + w * 0.18, y + h * 0.32],
      [x + w * 0.88, y + h * 0.38],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintLowH(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("h", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.1, y - h * 0.48, x + w * 0.1, y + h * 0.42);
  brush.spline(
    [
      [x + w * 0.1, y - h * 0.02],
      [x + w * 0.55, y - h * 0.14],
      [x + w * 0.88, y + h * 0.08],
      [x + w * 0.88, y + h * 0.42],
    ],
    0.35
  );
  cur.x += w + cur.gap;
}

function paintLowI(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("i", h);
  strokeInk(col, weight || 1.15);
  brush.line(x + w * 0.42, y - h * 0.12, x + w * 0.42, y + h * 0.42);
  brush.spline(
    [
      [x + w * 0.28, y - h * 0.36],
      [x + w * 0.48, y - h * 0.42],
      [x + w * 0.62, y - h * 0.34],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintLowU(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("u", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.1, y - h * 0.14, x + w * 0.1, y + h * 0.22);
  brush.spline(
    [
      [x + w * 0.1, y + h * 0.18],
      [x + w * 0.38, y + h * 0.42],
      [x + w * 0.88, y + h * 0.22],
    ],
    0.4
  );
  brush.line(x + w * 0.88, y + h * 0.24, x + w * 0.88, y - h * 0.14);
  cur.x += w + cur.gap;
}

function paintLowL(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("l", h);
  strokeInk(col, weight || 1.15);
  brush.spline(
    [
      [x + w * 0.2, y - h * 0.5],
      [x + w * 0.45, y - h * 0.46],
      [x + w * 0.5, y + h * 0.38],
      [x + w * 0.22, y + h * 0.44],
    ],
    0.35
  );
  cur.x += w + cur.gap;
}

function paintLowN(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("n", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.1, y + h * 0.42, x + w * 0.1, y - h * 0.14);
  brush.spline(
    [
      [x + w * 0.1, y - h * 0.12],
      [x + w * 0.5, y - h * 0.16],
      [x + w * 0.88, y + h * 0.06],
      [x + w * 0.88, y + h * 0.42],
    ],
    0.35
  );
  cur.x += w + cur.gap;
}

function paintLowM(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("m", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.08, y + h * 0.42, x + w * 0.08, y - h * 0.14);
  brush.spline(
    [
      [x + w * 0.08, y - h * 0.1],
      [x + w * 0.3, y - h * 0.16],
      [x + w * 0.48, y + h * 0.04],
      [x + w * 0.48, y + h * 0.42],
    ],
    0.32
  );
  brush.spline(
    [
      [x + w * 0.48, y - h * 0.02],
      [x + w * 0.7, y - h * 0.16],
      [x + w * 0.92, y + h * 0.04],
      [x + w * 0.92, y + h * 0.42],
    ],
    0.32
  );
  cur.x += w + cur.gap;
}

function paintLowO(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("o", h);
  strokeInk(col, weight || 1.1);
  brush.spline(
    [
      [x + w * 0.5, y - h * 0.16],
      [x + w * 0.08, y + h * 0.04],
      [x + w * 0.18, y + h * 0.4],
      [x + w * 0.82, y + h * 0.4],
      [x + w * 0.92, y + h * 0.04],
      [x + w * 0.5, y - h * 0.16],
    ],
    0.48
  );
  cur.x += w + cur.gap;
}

function paintLowP(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("p", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.12, y - h * 0.14, x + w * 0.12, y + h * 0.58);
  brush.spline(
    [
      [x + w * 0.12, y - h * 0.12],
      [x + w * 0.86, y - h * 0.14],
      [x + w * 0.82, y + h * 0.18],
      [x + w * 0.12, y + h * 0.32],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintLowR(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("r", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.12, y + h * 0.42, x + w * 0.12, y - h * 0.14);
  brush.spline(
    [
      [x + w * 0.12, y - h * 0.06],
      [x + w * 0.55, y - h * 0.18],
      [x + w * 0.92, y - h * 0.08],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintLowS(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("s", h);
  strokeInk(col, weight || 1.1);
  brush.spline(
    [
      [x + w * 0.88, y - h * 0.12],
      [x + w * 0.16, y - h * 0.16],
      [x + w * 0.22, y + h * 0.08],
      [x + w * 0.78, y + h * 0.14],
      [x + w * 0.14, y + h * 0.42],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintLowT(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("t", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.42, y - h * 0.36, x + w * 0.42, y + h * 0.38);
  brush.line(x + w * 0.08, y - h * 0.1, x + w * 0.82, y - h * 0.1);
  brush.spline(
    [
      [x + w * 0.42, y + h * 0.3],
      [x + w * 0.7, y + h * 0.42],
      [x + w * 0.9, y + h * 0.34],
    ],
    0.4
  );
  cur.x += w + cur.gap;
}

function paintLowY(cur, col, weight) {
  const { x, y, h } = cur;
  const w = glyphWidth("y", h);
  strokeInk(col, weight || 1.1);
  brush.line(x + w * 0.08, y - h * 0.14, x + w * 0.48, y + h * 0.22);
  brush.line(x + w * 0.88, y - h * 0.14, x + w * 0.28, y + h * 0.58);
  cur.x += w + cur.gap;
}

function paintNameFlourish(x, y, w, col) {
  strokeInk(col, 1.45);
  brush.spline(
    [
      [x, y],
      [x + w * 0.22, y + 10],
      [x + w * 0.5, y - 3],
      [x + w * 0.78, y + 8],
      [x + w + 8, y - 8],
    ],
    0.48
  );
  brush.set("HB", col, 0.9);
  brush.spline(
    [
      [x + w - 4, y - 2],
      [x + w + 22, y - 20],
      [x + w + 8, y - 26],
      [x + w + 16, y - 6],
    ],
    0.45
  );
}

function paintFormulaHalo(c) {
  brush.noStroke();
  brush.noHatch();
  brush.fill(c.teal, 24);
  brush.fillBleed(0.35, "out");
  brush.fillTexture(0.3, 0.18);
  brush.circle(width * 0.5, height * 0.5, 210, 0.4);
  brush.fill(c.rose, 16);
  brush.fillBleed(0.45, "out");
  brush.circle(width * 0.42, height * 0.46, 160, 0.5);
}

function strokeInk(col, weight) {
  brush.noFill();
  brush.set(letterBrush, col, weight);
}

function paintGlyphF(cur, col) {
  const { x, y, h } = cur;
  const w = h * 0.42;
  strokeInk(col, 1.55);
  brush.line(x, y - h * 0.48, x, y + h * 0.48);
  brush.line(x, y - h * 0.48, x + w, y - h * 0.48);
  brush.set("HB", col, 1.05);
  brush.line(x, y - h * 0.06, x + w * 0.72, y - h * 0.06);
  cur.x += w + cur.gap + 6;
}

function paintGlyphX(cur, col) {
  const { x, y, h } = cur;
  const w = h * 0.28;
  strokeInk(col, 1.2);
  brush.spline(
    [
      [x + w * 0.04, y - h * 0.16],
      [x + w * 0.42, y + h * 0.12],
      [x + w * 0.96, y + h * 0.4],
    ],
    0.28
  );
  brush.spline(
    [
      [x + w * 0.94, y - h * 0.16],
      [x + w * 0.5, y + h * 0.12],
      [x + w * 0.06, y + h * 0.4],
    ],
    0.28
  );
  cur.x += w + cur.gap;
}

function paintGlyphParen(cur, col, side) {
  const { x, y, h } = cur;
  const w = h * 0.22;
  const s = side >= 0 ? 1 : -1;
  const x0 = side >= 0 ? x + w : x;
  strokeInk(col, 1.2);
  brush.spline(
    [
      [x0 + s * w * 0.15, y - h * 0.46],
      [x0 - s * w * 0.55, y - h * 0.12],
      [x0 - s * w * 0.55, y + h * 0.12],
      [x0 + s * w * 0.15, y + h * 0.46],
    ],
    0.45
  );
  cur.x += w + cur.gap;
}

function paintGlyphEquals(cur, col) {
  const { x, y, h } = cur;
  const w = h * 0.4;
  strokeInk(col, 1.35);
  brush.line(x, y - h * 0.1, x + w, y - h * 0.1);
  brush.line(x, y + h * 0.12, x + w, y + h * 0.12);
  cur.x += w + cur.gap;
}

function paintGlyphS(cur, col) {
  const { x, y, h } = cur;
  const w = h * 0.4;
  const upper = [
    [x + w * 0.98, y - h * 0.08],
    [x + w * 0.62, y - h * 0.24],
    [x + w * 0.08, y - h * 0.18],
    [x + w * 0.06, y + h * 0.02],
    [x + w * 0.48, y + h * 0.1],
  ];
  const lower = [
    [x + w * 0.48, y + h * 0.1],
    [x + w * 0.94, y + h * 0.18],
    [x + w * 0.96, y + h * 0.36],
    [x + w * 0.4, y + h * 0.46],
    [x + w * 0.04, y + h * 0.34],
  ];
  for (const wt of [2.25, 2.0, 1.55]) {
    strokeInk(col, wt);
    brush.spline(upper, 0.52);
    brush.spline(lower, 0.52);
  }
  cur.x += w + cur.gap;
}

function paintGlyphI(cur, col) {
  const { x, y, h } = cur;
  strokeInk(col, 1.3);
  brush.line(x + 4, y - h * 0.22, x + 4, y + h * 0.42);
  brush.wash(col, 210);
  brush.circle(x + 4, y - h * 0.4, 4.5);
  brush.noWash();
  cur.x += 16 + cur.gap;
}

function paintGlyphN(cur, col) {
  const { x, y, h } = cur;
  const w = h * 0.42;
  strokeInk(col, 1.3);
  brush.line(x, y + h * 0.42, x, y - h * 0.42);
  brush.spline(
    [
      [x, y - h * 0.42],
      [x + w * 0.45, y - h * 0.2],
      [x + w, y + h * 0.08],
    ],
    0.35
  );
  brush.line(x + w, y + h * 0.08, x + w, y + h * 0.42);
  cur.x += w + cur.gap;
}

function axisArrow(x1, y1, x2, y2) {
  brush.line(x1, y1, x2, y2);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const s = 14;
  brush.line(x2, y2, x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
  brush.line(x2, y2, x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
}

function paintLand() {
  const ground = recipe.colors.length ? recipe.colors : ["#6f8a55", "#4e6a40", "#c9b57a"];
  brush.noStroke();
  brush.fill("#d7e3ee", 70);
  brush.fillBleed(0.5, "out");
  brush.fillTexture(0.3, 0.18);
  brush.circle(width * 0.5, height * 0.28, 260, true);

  brush.fill(ground[0], 90);
  brush.fillBleed(0.22, "out");
  brush.fillTexture(0.5, 0.3);
  brush.polygon(ridge(height * 0.58, 80));
  brush.fill(ground[1 % ground.length], 100);
  brush.polygon(ridge(height * 0.74, 50));

  cypress(width * random(0.2, 0.8), height * 0.86, random(90, 140));
}

function paintWash() {
  const pool = recipe.colors.length ? recipe.colors : ["#c45c48", "#3d4f8a", "#ead9c4"];
  brush.noStroke();
  for (let i = 0; i < 5; i++) {
    brush.fill(random(pool), random(40, 90));
    brush.fillBleed(0.4, "out");
    brush.fillTexture(0.45, 0.25);
    brush.circle(random(width * 0.2, width * 0.8), random(height * 0.2, height * 0.8), random(80, 200), true);
  }
}

function ridge(baseY, rise) {
  const pts = [[0, height], [0, baseY]];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = baseY - rise * noise(i * 0.37 + seed * 0.0001) - random(0, 12);
    pts.push([x, y]);
  }
  pts.push([width, baseY], [width, height]);
  return pts;
}

function cypress(x, y, h) {
  const girth = h * 0.16;
  const pts = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.55) * (1 - t * 0.15);
    pts.push([x - girth * env * (0.7 + random(0.35)), y - t * h]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.55) * (1 - t * 0.15);
    pts.push([x + girth * env * (0.7 + random(0.35)), y - t * h]);
  }
  brush.noStroke();
  brush.fill("#14180f", 160);
  brush.fillBleed(0.12, "out");
  brush.fillTexture(0.5, 0.3);
  brush.polygon(pts);
}

function leafBlade(x, y, angle, length, girth, leaf) {
  brush.noStroke();
  brush.fill(random(leaf), 78);
  brush.fillBleed(0.3, "out");
  brush.fillTexture(0.58, 0.36);
  brush.polygon(bladePoints(x, y, angle, length, girth));
  brush.fill("#3f5a36", 40);
  brush.fillBleed(0.16, "in");
  brush.polygon(bladePoints(x, y, angle, length * 0.7, girth * 0.42));
}

function petalPoints(cx, cy, angle, length, girth) {
  const n = 22;
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(edgePoint(cx, cy, angle, length, girth, i / n, -1));
  for (let i = n; i >= 0; i--) pts.push(edgePoint(cx, cy, angle, length, girth, i / n, 1));
  return pts;
}

function edgePoint(cx, cy, angle, length, girth, t, side) {
  const along = t * length;
  const envelope = Math.pow(Math.sin(t * Math.PI), 1.08) * (1 - 0.18 * t);
  const ruffle = Math.sin(t * 9 + seed) * girth * 0.08;
  const xLocal = side * (girth * envelope * (0.82 + random(0.28)) + ruffle);
  const x = cx + xLocal * Math.cos(angle) - along * Math.sin(angle);
  const y = cy + xLocal * Math.sin(angle) + along * Math.cos(angle);
  return [x, y];
}

function bladePoints(x, y, angle, length, girth) {
  const n = 12;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.9);
    pts.push(rotatePoint(x, y, -girth * env * (0.85 + random(0.2)), t * length, angle));
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const env = Math.pow(Math.sin(t * Math.PI), 0.9);
    pts.push(rotatePoint(x, y, girth * env * (0.85 + random(0.2)), t * length, angle));
  }
  return pts;
}

function rotatePoint(ox, oy, x, y, angle) {
  return [ox + x * Math.cos(angle) - y * Math.sin(angle), oy + x * Math.sin(angle) + y * Math.cos(angle)];
}
