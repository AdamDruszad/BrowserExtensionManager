const STATE_KEY = "extension-manager-state-v1";
const THEME_KEY = "extension-manager-theme";
const FILTERS = new Set(["all", "active", "inactive"]);

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

export function initExtensionManager(doc = document, options = {}) {
  const win = doc.defaultView;
  const fetchData = options.fetch ?? win.fetch.bind(win);
  let storage = options.storage;
  if (storage === undefined) {
    try { storage = win.localStorage; } catch { storage = null; }
  }
  const grid = doc.querySelector(".extensions-grid");
  const filterButtons = [...doc.querySelectorAll("[data-filter]")];
  const themeButton = doc.querySelector(".switcher");
  const themeIcon = themeButton.querySelector("img");
  const themeLabel = themeButton.querySelector(".theme-label");
  const feedback = doc.getElementById("feedback");
  const announcement = doc.getElementById("announcement");
  const retryButton = doc.getElementById("retry-btn");
  const resetButton = doc.getElementById("reset-btn");
  let originals = [];
  let extensions = [];
  let filter = "all";
  let changes = Object.create(null);
  let loading = false;
  let cards = new Map();

  function visibleExtensions() {
    return extensions.filter((item) => filter === "all" || item.isActive === (filter === "active"));
  }

  function persist() {
    const saved = writeStorage(storage, STATE_KEY, JSON.stringify(changes));
    if (!saved) announcement.textContent += " Changes will only last for this visit because browser storage is unavailable.";
  }

  function applyTheme(theme, persistChoice = false) {
    const light = theme === "light";
    doc.body.classList.toggle("light-theme", light);
    themeIcon.src = `./assets/images/icon-${light ? "moon" : "sun"}.svg`;
    themeLabel.textContent = `${light ? "Dark" : "Light"} mode`;
    themeButton.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} theme`);
    themeButton.title = `Switch to ${light ? "dark" : "light"} theme`;
    if (persistChoice) writeStorage(storage, THEME_KEY, theme);
  }

  function makeCard(item) {
    const article = doc.createElement("article");
    article.className = "card";
    article.dataset.name = item.name;
    article.dataset.active = String(item.isActive);
    const info = doc.createElement("div");
    info.className = "card-info";
    const image = doc.createElement("img");
    image.src = item.logo;
    image.alt = "";
    image.width = image.height = 54;
    const text = doc.createElement("div");
    text.className = "card-text";
    const title = doc.createElement("h2");
    title.textContent = item.name;
    const description = doc.createElement("p");
    description.textContent = item.description;
    text.append(title, description);
    info.append(image, text);
    const actions = doc.createElement("div");
    actions.className = "card-actions";
    const remove = doc.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.dataset.action = "remove";
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.textContent = "Remove";
    const label = doc.createElement("label");
    label.className = "toggle-switch";
    const status = doc.createElement("span");
    status.className = "extension-status";
    status.textContent = item.isActive ? "Enabled" : "Paused";
    const toggle = doc.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = item.isActive;
    toggle.dataset.action = "toggle";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", item.name);
    const slider = doc.createElement("span");
    slider.className = "slider";
    slider.setAttribute("aria-hidden", "true");
    label.append(status, toggle, slider);
    actions.append(remove, label);
    article.append(info, actions);
    cards.set(item.name, article);
    return article;
  }

  function render() {
    cards = new Map();
    const visible = visibleExtensions();
    const fragment = doc.createDocumentFragment();
    visible.forEach((item) => fragment.append(makeCard(item)));
    grid.replaceChildren(fragment);
    const activeCount = extensions.filter((item) => item.isActive).length;
    const counts = { all: extensions.length, active: activeCount, inactive: extensions.length - activeCount };
    doc.getElementById("total-count").textContent = String(extensions.length).padStart(2, "0");
    doc.getElementById("active-summary").textContent = `${activeCount} active · ${counts.inactive} paused`;
    doc.getElementById("visible-summary").textContent = `Showing ${visible.length} of ${extensions.length} extensions`;
    for (const counter of doc.querySelectorAll("[data-count]")) counter.textContent = counts[counter.dataset.count];
    for (const button of filterButtons) {
      const selected = button.dataset.filter === filter;
      button.classList.toggle("active-btn", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    feedback.hidden = visible.length > 0;
    feedback.textContent = extensions.length === 0
      ? "No extensions left. Use Reset list to restore the demo."
      : `No ${filter === "all" ? "matching" : filter} extensions.`;
    retryButton.hidden = true;
  }

  function restoreFocus(name, previousIndex, action) {
    const visible = visibleExtensions();
    const card = cards.get(name) ?? cards.get(visible[Math.min(previousIndex, visible.length - 1)]?.name);
    const target = card?.querySelector(`[data-action="${action}"]`) ??
      filterButtons.find((button) => button.dataset.filter === filter);
    target?.focus();
  }

  async function load() {
    if (loading) return;
    loading = true;
    grid.setAttribute("aria-busy", "true");
    feedback.hidden = false;
    feedback.textContent = "Loading extensions…";
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
      extensions = originals
        .filter((item) => changes[item.name]?.removed !== true)
        .map((item) => ({ ...item, isActive: typeof changes[item.name]?.isActive === "boolean"
          ? changes[item.name].isActive : item.isActive }));
      render();
      announcement.textContent = `${extensions.length} extensions loaded.`;
      resetButton.disabled = false;
      filterButtons.forEach((button) => { button.disabled = false; });
    } catch {
      grid.replaceChildren();
      doc.getElementById("total-count").textContent = "—";
      doc.getElementById("active-summary").textContent = "Library unavailable";
      doc.getElementById("visible-summary").textContent = "Your tools could not be loaded";
      feedback.textContent = controller.signal.aborted
        ? "Loading extensions took too long. Check your connection and try again."
        : "Extensions could not be loaded. Check your connection and try again.";
      retryButton.hidden = false;
    } finally {
      win.clearTimeout(timeout);
      loading = false;
      grid.setAttribute("aria-busy", "false");
    }
  }

  filterButtons.forEach((button) => button.addEventListener("click", () => {
    if (!FILTERS.has(button.dataset.filter)) return;
    filter = button.dataset.filter;
    render();
    announcement.textContent = `${visibleExtensions().length} ${filter === "all" ? "" : `${filter} `}extensions shown.`;
  }));

  grid.addEventListener("change", (event) => {
    const toggle = event.target.closest('[data-action="toggle"]');
    if (!toggle) return;
    const name = toggle.closest(".card").dataset.name;
    const index = visibleExtensions().findIndex((item) => item.name === name);
    extensions = extensions.map((item) => item.name === name ? { ...item, isActive: toggle.checked } : item);
    changes[name] = { ...changes[name], isActive: toggle.checked };
    announcement.textContent = `${name} ${toggle.checked ? "enabled" : "disabled"}.`;
    persist();
    render();
    restoreFocus(name, index, "toggle");
  });

  grid.addEventListener("click", (event) => {
    const remove = event.target.closest('[data-action="remove"]');
    if (!remove) return;
    const name = remove.closest(".card").dataset.name;
    const index = visibleExtensions().findIndex((item) => item.name === name);
    extensions = extensions.filter((item) => item.name !== name);
    changes[name] = { ...changes[name], removed: true };
    announcement.textContent = `${name} removed. Reset list restores removed extensions.`;
    persist();
    render();
    restoreFocus(name, index, "remove");
  });

  resetButton.addEventListener("click", () => {
    extensions = originals.map((item) => ({ ...item }));
    changes = Object.create(null);
    filter = "all";
    announcement.textContent = "The original extension list has been restored.";
    persist();
    render();
  });
  retryButton.addEventListener("click", load);
  themeButton.addEventListener("click", () => applyTheme(doc.body.classList.contains("light-theme") ? "dark" : "light", true));
  const storedTheme = readStorage(storage, THEME_KEY);
  applyTheme(storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark");
  return { ready: load() };
}

if (typeof document !== "undefined") initExtensionManager();
