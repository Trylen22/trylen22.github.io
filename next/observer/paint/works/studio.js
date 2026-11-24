const SEED_KEY = "paint-with-code-seeds";

const COLOR_WORDS = [
  ["peach", "#f6d3b4"],
  ["coral", "#e88972"],
  ["pink", "#e59bb3"],
  ["crimson", "#a33b4a"],
  ["red", "#c13b4a"],
  ["gold", "#e7c14a"],
  ["yellow", "#f3de7a"],
  ["indigo", "#1a2450"],
  ["violet", "#5a4a8a"],
  ["purple", "#6b4a7a"],
  ["blue", "#3a4c88"],
  ["navy", "#12102a"],
  ["cyan", "#7ef0e4"],
  ["magenta", "#e59bb3"],
  ["mint", "#b7d4a8"],
  ["green", "#4e6a40"],
  ["olive", "#6f8a55"],
  ["cream", "#f4efe4"],
  ["white", "#fff6d8"],
  ["black", "#14180f"],
  ["silver", "#c5c8d4"],
];

function interpretPrompt(text) {
  const prompt = (text || "").trim() || "a starry night sky in watercolour";
  const t = prompt.toLowerCase();
  let colors = COLOR_WORDS.filter(([word]) => new RegExp(`\\b${word}\\b`).test(t)).map(([, hex]) => hex);
  const plan = parsePrompt(prompt);
  const things = plan.things.filter((x) => !x.quiet);
  const only = (pred) => things.length === 1 && pred(things[0]) && !plan.place && !plan.weather.length && !plan.acts.length && !plan.unknown.length;
  const none = !things.length && !plan.place && !plan.weather.length;

  // Hand-made paintings win only when the prompt is really about them;
  // everything else goes to the general scene painter.
  let subject = "scene";
  let variant = "plain";
  if (/smiley|:\)|:-\)|\bemoji\b|smiley face|smiling face/.test(t) && none) subject = "smiley";
  else if (only((x) => x.o.kind === "bee")) subject = "bee";
  else if (only((x) => x.o.kind === "jelly")) subject = "jelly";
  else if (/\bmoths?\b/.test(t) && only((x) => x.m === "bug")) subject = "moth";
  else if (/window|cathedral|stained|tracery/.test(t) && !things.length) subject = "window";
  else if (/\bsine\b|\bsin\b|cosine|\bcos\b|calculus|integral|derivative|sin\s*\(|cos\s*\(|\bgraph\b/.test(t) && !things.length) subject = "sine";
  else if (/hibiscus|tropic|canopy|ornament|motif|\btile|pattern|\bgrid\b/.test(t) && (none || only((x) => x.m === "flower" && x.o.kind === "flower"))) subject = "flower";
  else if (/\b(flower|bloom|petal|peony|lily|daisy|hibiscus)s?\b/.test(t) && only((x) => x.m === "flower" && x.o.kind === "flower")) subject = "flower";

  if (subject === "flower") {
    if (/tropic|canopy|jungle|lush|glaze/.test(t)) variant = "canopy";
    else if (/ornament|motif|tile|pattern|grid|border/.test(t)) variant = "ornament";
  } else if (subject === "sine") {
    if (/cosine|\bcos\b/.test(t) && !/\bsine\b|\bsin\b|\bsin\s*\(/.test(t)) variant = "cosine";
  }

  const darkPaper = ["night", "moth", "jelly", "window"].includes(subject) || variant === "canopy";
  let paper = "#f4efe4";
  if (darkPaper) paper = "#051208";

  return {
    prompt,
    subject,
    variant,
    colors,
    paper,
    plan,
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1000000000 || 1;
}

function loadSeeds() {
  try {
    return JSON.parse(localStorage.getItem(SEED_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSeeds(entries) {
  localStorage.setItem(SEED_KEY, JSON.stringify(entries));
}

function saveSeed(entry) {
  const entries = loadSeeds();
  const dup = entries.some((e) => e.prompt === entry.prompt && e.seed === entry.seed);
  if (dup) return entries;
  entries.unshift(entry);
  writeSeeds(entries.slice(0, 24));
  return loadSeeds();
}

function forgetSeed(id) {
  writeSeeds(loadSeeds().filter((e) => e.id !== id));
  return loadSeeds();
}

function renderShelf(onOpen) {
  const list = document.getElementById("saved-list");
  const entries = loadSeeds();
  list.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Nothing saved yet. Paint something you like, then keep the seed.";
    list.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "saved";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "saved-open";
    open.addEventListener("click", () => onOpen(entry));

    if (entry.thumb) {
      const img = document.createElement("img");
      img.src = entry.thumb;
      img.alt = "";
      open.appendChild(img);
    }

    const meta = document.createElement("span");
    meta.innerHTML = `<em>${escapeHtml(entry.prompt)}</em><code>seed ${entry.seed}</code>`;
    open.appendChild(meta);

    const forget = document.createElement("button");
    forget.type = "button";
    forget.className = "forget";
    forget.textContent = "Forget";
    forget.addEventListener("click", (event) => {
      event.stopPropagation();
      forgetSeed(entry.id);
      renderShelf(onOpen);
    });

    item.appendChild(open);
    item.appendChild(forget);
    list.appendChild(item);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function captureThumb() {
  const canvas = document.querySelector("#canvas-wrap canvas");
  if (!canvas) return "";
  try {
    return canvas.toDataURL("image/jpeg", 0.55);
  } catch {
    return "";
  }
}
