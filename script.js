const STATE_KEY = "extension-manager-state-v1";
const THEME_KEY = "extension-manager-theme";
const FILTERS = new Set(["all", "active", "inactive"]);
const THEME_COLORS = { dark: "#1f3680", light: "#2d4ea3" };
const PRINT_IN_MS = 1400;

function readStorage(storage, key) {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

function writeStorage(storage, key, value) {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch { return false; }
}

function validateExtensions(data) {
  if (!Array.isArray(data)) throw new Error("Invalid extension list");
  const names = new Set();
  return data.map((item) => {
    if (!item || typeof item.name !== "string" || !item.name.trim() ||
        names.has(item.name) || typeof item.description !== "string" ||
        typeof item.logo !== "string" || !/^\.\/[a-zA-Z0-9/_.-]+\.(?:svg|png)$/u.test(item.logo)
        || item.logo.split("/").includes("..") || typeof item.isActive !== "boolean") {
      throw new Error("Invalid extension data");
    }
    names.add(item.name);
    return { name: item.name, description: item.description, logo: item.logo, isActive: item.isActive };
  });
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function initExtensionManager(doc = document, options = {}) {
  const win = doc.defaultView;
  const root = doc.documentElement;
  const fetchData = options.fetch ?? win.fetch.bind(win);
  let storage = options.storage;
  if (storage === undefined) {
    try { storage = win.localStorage; } catch { storage = null; }
  }
  const list = doc.querySelector(".extension-list");
  const strip = doc.querySelector(".toolkit-strip");
  const filterButtons = [...doc.querySelectorAll("[data-filter]")];
  const themeButton = doc.querySelector(".switcher");
  const themeLabel = themeButton.querySelector(".theme-label");
  const themeColor = doc.querySelector('meta[name="theme-color"]');
  const feedback = doc.getElementById("feedback");
  const feedbackText = doc.getElementById("feedback-text");
  const announcement = doc.getElementById("announcement");
  const retryButton = doc.getElementById("retry-btn");
  const resetButton = doc.getElementById("reset-btn");
  const undoBar = doc.getElementById("undo-bar");
  const undoText = doc.getElementById("undo-text");
  const undoButton = doc.getElementById("undo-btn");
  let originals = [];
  let extensions = [];
  let filter = "all";
  let changes = Object.create(null);
  let loading = false;
  let lastRemoved = null;
  let cards = new Map();

  const shows = (item) => filter === "all" || item.isActive === (filter === "active");
  const visibleExtensions = () => extensions.filter(shows);

  function deriveExtensions() {
    return originals
      .filter((item) => changes[item.name]?.removed !== true)
      .map((item) => ({ ...item, isActive: typeof changes[item.name]?.isActive === "boolean"
        ? changes[item.name].isActive : item.isActive }));
  }

  function persist() {
    const saved = writeStorage(storage, STATE_KEY, JSON.stringify(changes));
    if (!saved) announcement.textContent += " Changes will only last for this visit because browser storage is unavailable.";
  }

  function applyTheme(theme, persistChoice = false) {
    const light = theme === "light";
    root.dataset.theme = theme;
    themeLabel.textContent = `${light ? "Dark" : "Light"} mode`;
    themeButton.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} theme`);
    themeButton.title = `Switch to ${light ? "dark" : "light"} theme`;
    themeColor?.setAttribute("content", THEME_COLORS[theme]);
    if (persistChoice) writeStorage(storage, THEME_KEY, theme);
  }

  function setStatus(card, active) {
    card.dataset.active = String(active);
    card.querySelector(".extension-status").textContent = active ? "Enabled" : "Paused";
    card.querySelector('[data-action="toggle"]').checked = active;
  }

  function makeCard(item, index) {
    const entry = doc.createElement("li");
    const article = doc.createElement("article");
    article.className = "extension";
    article.dataset.name = item.name;
    article.style.setProperty("--i", String(index));
    const image = doc.createElement("img");
    image.className = "extension-logo";
    image.src = item.logo;
    image.alt = "";
    image.width = image.height = 48;
    const text = doc.createElement("div");
    text.className = "extension-text";
    const title = doc.createElement("h3");
    title.textContent = item.name;
    const description = doc.createElement("p");
    description.textContent = item.description;
    text.append(title, description);
    const actions = doc.createElement("div");
    actions.className = "extension-actions";
    const remove = doc.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.dataset.action = "remove";
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.textContent = "Remove";
    const label = doc.createElement("label");
    label.className = "toggle";
    const status = doc.createElement("span");
    status.className = "extension-status";
    const toggle = doc.createElement("input");
    toggle.type = "checkbox";
    toggle.dataset.action = "toggle";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", item.name);
    const track = doc.createElement("span");
    track.className = "switch-track";
    track.setAttribute("aria-hidden", "true");
    label.append(status, toggle, track);
    actions.append(remove, label);
    article.append(image, text, actions);
    entry.append(article);
    setStatus(article, item.isActive);
    cards.set(item.name, article);
    return entry;
  }

  function renderSummary() {
    const activeCount = extensions.filter((item) => item.isActive).length;
    const counts = { all: extensions.length, active: activeCount, inactive: extensions.length - activeCount };
    const visible = visibleExtensions().length;
    doc.getElementById("total-count").textContent = String(extensions.length);
    doc.getElementById("total-label").textContent = `${extensions.length === 1 ? "extension" : "extensions"} in your toolkit`;
    const activeLegend = doc.createElement("span");
    activeLegend.className = "legend-on";
    activeLegend.textContent = `${activeCount} active`;
    const pausedLegend = doc.createElement("span");
    pausedLegend.className = "legend-off";
    pausedLegend.textContent = `${counts.inactive} paused`;
    doc.getElementById("active-summary").replaceChildren(activeLegend, " · ", pausedLegend);
    doc.getElementById("visible-summary").textContent = `Showing ${visible} of ${plural(extensions.length, "extension")}`;
    for (const counter of doc.querySelectorAll("[data-count]")) counter.textContent = counts[counter.dataset.count];
    const cells = [...strip.children];
    const sameCells = cells.length === extensions.length && cells.every((cell, i) => cell.dataset.name === extensions[i].name);
    if (sameCells) {
      // Update in place so the cell's ink transition runs.
      cells.forEach((cell, i) => { cell.dataset.active = String(extensions[i].isActive); });
    } else {
      strip.replaceChildren(...extensions.map((item) => {
        const cell = doc.createElement("li");
        cell.dataset.name = item.name;
        cell.dataset.active = String(item.isActive);
        return cell;
      }));
    }
    for (const button of filterButtons) {
      const selected = button.dataset.filter === filter;
      button.classList.toggle("active-btn", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    feedback.hidden = visible > 0;
    feedbackText.textContent = extensions.length === 0
      ? "No extensions left. Use Reset list to restore the demo."
      : `No ${filter === "all" ? "matching" : filter} extensions.`;
  }

  function render() {
    cards = new Map();
    const fragment = doc.createDocumentFragment();
    visibleExtensions().forEach((item, index) => fragment.append(makeCard(item, index)));
    list.replaceChildren(fragment);
    retryButton.hidden = true;
    renderSummary();
  }

  function hideUndo() {
    lastRemoved = null;
    undoBar.hidden = true;
  }

  function restoreFocus(name, previousIndex, action) {
    const visible = visibleExtensions();
    const card = cards.get(name) ?? cards.get(visible[Math.min(previousIndex, visible.length - 1)]?.name);
    const target = card?.querySelector(`[data-action="${action}"]`) ??
      filterButtons.find((button) => button.dataset.filter === filter);
    target?.focus();
  }

  function showError(message) {
    list.replaceChildren();
    strip.replaceChildren();
    doc.getElementById("total-count").textContent = "—";
    doc.getElementById("active-summary").textContent = "Library unavailable";
    doc.getElementById("visible-summary").textContent = "Your tools could not be loaded";
    feedback.hidden = false;
    feedbackText.textContent = message;
    announcement.textContent = message;
    retryButton.hidden = false;
  }

  async function load() {
    if (loading) return;
    loading = true;
    hideUndo();
    list.setAttribute("aria-busy", "true");
    feedback.hidden = false;
    feedbackText.textContent = "Loading extensions…";
    retryButton.hidden = true;
    resetButton.disabled = true;
    filterButtons.forEach((button) => { button.disabled = true; });
    const controller = new AbortController();
    const timeout = win.setTimeout(() => controller.abort(), options.loadTimeoutMs ?? 10000);
    try {
      const response = await fetchData("./data.json", { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      originals = validateExtensions(await response.json());
      try {
        const saved = JSON.parse(readStorage(storage, STATE_KEY) ?? "{}");
        changes = Object.assign(Object.create(null), saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {});
      } catch { changes = Object.create(null); }
      extensions = deriveExtensions();
      list.classList.add("is-printing");
      win.setTimeout(() => list.classList.remove("is-printing"), PRINT_IN_MS);
      render();
      announcement.textContent = `${plural(extensions.length, "extension")} loaded.`;
      resetButton.disabled = false;
      filterButtons.forEach((button) => { button.disabled = false; });
    } catch {
      showError(controller.signal.aborted
        ? "Loading extensions took too long. Check your connection and try again."
        : "Extensions could not be loaded. Check your connection and try again.");
    } finally {
      win.clearTimeout(timeout);
      loading = false;
      list.setAttribute("aria-busy", "false");
    }
  }

  filterButtons.forEach((button) => button.addEventListener("click", () => {
    if (!FILTERS.has(button.dataset.filter)) return;
    filter = button.dataset.filter;
    hideUndo();
    render();
    const shown = visibleExtensions().length;
    announcement.textContent = `${plural(shown, `${filter === "all" ? "" : `${filter} `}extension`)} shown.`;
  }));

  list.addEventListener("change", (event) => {
    const toggle = event.target.closest('[data-action="toggle"]');
    if (!toggle) return;
    const card = toggle.closest(".extension");
    const name = card.dataset.name;
    const index = visibleExtensions().findIndex((item) => item.name === name);
    extensions = extensions.map((item) => item.name === name ? { ...item, isActive: toggle.checked } : item);
    changes[name] = { ...changes[name], isActive: toggle.checked };
    hideUndo();
    announcement.textContent = `${name} ${toggle.checked ? "enabled" : "disabled"}.`;
    persist();
    if (shows({ isActive: toggle.checked })) {
      // Still visible under the current filter: update in place so the switch keeps focus and animates.
      setStatus(card, toggle.checked);
      renderSummary();
    } else {
      render();
      restoreFocus(name, index, "toggle");
    }
  });

  list.addEventListener("click", (event) => {
    const remove = event.target.closest('[data-action="remove"]');
    if (!remove) return;
    const name = remove.closest(".extension").dataset.name;
    const index = visibleExtensions().findIndex((item) => item.name === name);
    extensions = extensions.filter((item) => item.name !== name);
    changes[name] = { ...changes[name], removed: true };
    announcement.textContent = `${name} removed. Undo restores it; Reset list restores removed extensions.`;
    persist();
    render();
    lastRemoved = name;
    undoText.textContent = `${name} removed.`;
    undoButton.setAttribute("aria-label", `Undo removing ${name}`);
    undoBar.hidden = false;
    restoreFocus(name, index, "remove");
  });

  undoButton.addEventListener("click", () => {
    const name = lastRemoved;
    if (!name) return;
    const { removed, ...rest } = changes[name] ?? {};
    if (Object.keys(rest).length) changes[name] = rest; else delete changes[name];
    extensions = deriveExtensions();
    hideUndo();
    announcement.textContent = `${name} restored.`;
    persist();
    render();
    restoreFocus(name, 0, "remove");
  });

  resetButton.addEventListener("click", () => {
    extensions = originals.map((item) => ({ ...item }));
    changes = Object.create(null);
    filter = "all";
    hideUndo();
    announcement.textContent = "The original extension list has been restored.";
    persist();
    render();
  });
  retryButton.addEventListener("click", load);
  themeButton.addEventListener("click", () => applyTheme(root.dataset.theme === "light" ? "dark" : "light", true));

  const storedTheme = readStorage(storage, THEME_KEY);
  const prefersLight = win.matchMedia?.("(prefers-color-scheme: light)");
  const savedChoice = storedTheme === "light" || storedTheme === "dark";
  applyTheme(savedChoice ? storedTheme : prefersLight?.matches ? "light" : "dark");
  if (!savedChoice) {
    prefersLight?.addEventListener?.("change", (event) => {
      const chosen = readStorage(storage, THEME_KEY);
      if (chosen !== "light" && chosen !== "dark") applyTheme(event.matches ? "light" : "dark");
    });
  }
  return { ready: load() };
}

if (typeof document !== "undefined") initExtensionManager();
