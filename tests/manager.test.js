import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { initExtensionManager } from "../script.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const seed = [
  { name: "Alpha", description: "First extension", logo: "./a.svg", isActive: true },
  { name: "Beta", description: "Second extension", logo: "./b.svg", isActive: true },
  { name: "Gamma", description: "Third extension", logo: "./c.svg", isActive: false },
];
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
async function setup(t, options = {}) {
  const dom = new JSDOM(html, { url: "https://extensions.test/" });
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  if (options.prefersLight !== undefined) {
    dom.window.matchMedia = (query) => ({ matches: query.includes("light") && options.prefersLight, addEventListener() {} });
  }
  const app = initExtensionManager(doc, { fetch: async () => ({ ok: true, json: async () => structuredClone(seed) }), storage: memoryStorage(), ...options });
  await app.ready;
  const filter = (name) => doc.querySelector(`[data-filter="${name}"]`).click();
  const card = (name) => [...doc.querySelectorAll(".extension")].find((node) => node.dataset.name === name);
  const theme = () => doc.documentElement.dataset.theme;
  return { doc, dom, filter, card, theme };
}

test("toggling an active extension updates filters and keeps keyboard focus", async (t) => {
  const { doc, filter, card } = await setup(t);
  filter("active");
  card("Alpha").querySelector("input").click();
  assert.equal(card("Alpha"), undefined);
  assert.equal(doc.activeElement.getAttribute("aria-label"), "Beta");
  assert.equal(doc.querySelector('[data-filter="active"]').getAttribute("aria-pressed"), "true");
  filter("inactive");
  assert.equal(card("Alpha").querySelector("input").checked, false);
  filter("all");
  assert.equal(card("Alpha").querySelector("input").checked, false);
});

test("a toggle that stays visible updates its row in place", async (t) => {
  const { doc, card } = await setup(t);
  const row = card("Alpha");
  const input = row.querySelector("input");
  input.focus();
  input.click();
  assert.equal(card("Alpha"), row, "the row element is kept, so its transition can run");
  assert.equal(row.dataset.active, "false");
  assert.equal(row.querySelector(".extension-status").textContent, "Paused");
  assert.equal(doc.activeElement, input);
  assert.match(doc.getElementById("active-summary").textContent, /1 active · 2 paused/);
  assert.equal(doc.querySelector('[data-count="inactive"]').textContent, "2");
  assert.deepEqual([...doc.querySelectorAll(".toolkit-strip li")].map((cell) => cell.dataset.active), ["false", "true", "false"]);
});

test("removals and toggles survive a reload and Reset restores the original list", async (t) => {
  const storage = memoryStorage();
  const first = await setup(t, { storage });
  first.card("Alpha").querySelector("input").click();
  first.card("Beta").querySelector("button").click();
  const second = await setup(t, { storage });
  assert.equal(second.card("Beta"), undefined);
  assert.equal(second.card("Alpha").querySelector("input").checked, false);
  second.doc.getElementById("reset-btn").click();
  assert.equal(second.doc.querySelectorAll(".extension").length, 3);
  assert.equal(second.card("Alpha").querySelector("input").checked, true);
  const third = await setup(t, { storage });
  assert.equal(third.doc.querySelectorAll(".extension").length, 3);
});

test("a removal can be undone without losing other changes", async (t) => {
  const storage = memoryStorage();
  const { doc, card } = await setup(t, { storage });
  card("Alpha").querySelector("input").click();
  card("Beta").querySelector('[data-action="remove"]').click();
  const undoBar = doc.getElementById("undo-bar");
  assert.equal(undoBar.hidden, false);
  assert.match(doc.getElementById("undo-text").textContent, /Beta removed/);
  assert.equal(doc.activeElement.getAttribute("aria-label"), "Remove Gamma");
  doc.getElementById("undo-btn").click();
  assert.equal(undoBar.hidden, true);
  assert.deepEqual([...doc.querySelectorAll(".extension")].map((node) => node.dataset.name), ["Alpha", "Beta", "Gamma"]);
  assert.equal(card("Alpha").querySelector("input").checked, false, "the earlier toggle is kept");
  assert.equal(doc.activeElement.getAttribute("aria-label"), "Remove Beta");
  assert.deepEqual(JSON.parse(storage.getItem("extension-manager-state-v1")), { Alpha: { isActive: false } });
});

test("the undo offer disappears after the next action", async (t) => {
  const { doc, card, filter } = await setup(t);
  card("Alpha").querySelector('[data-action="remove"]').click();
  filter("active");
  assert.equal(doc.getElementById("undo-bar").hidden, true);
});

test("an empty filtered list has feedback and a useful focus target", async (t) => {
  const { doc, filter, card } = await setup(t);
  filter("inactive");
  card("Gamma").querySelector("input").click();
  assert.equal(doc.querySelectorAll(".extension").length, 0);
  assert.equal(doc.getElementById("feedback").hidden, false);
  assert.match(doc.getElementById("feedback").textContent, /No inactive/);
  assert.equal(doc.activeElement, doc.querySelector('[data-filter="inactive"]'));
});

test("counts use singular wording for one extension", async (t) => {
  const { doc, card } = await setup(t);
  card("Alpha").querySelector('[data-action="remove"]').click();
  card("Beta").querySelector('[data-action="remove"]').click();
  assert.equal(doc.getElementById("visible-summary").textContent, "Showing 1 of 1 extension");
  assert.equal(doc.getElementById("total-count").textContent, "1");
  assert.equal(doc.getElementById("total-label").textContent, "extension in your toolkit");
});

test("extension titles sit one level below the list heading", async (t) => {
  const { doc } = await setup(t);
  assert.equal(doc.querySelector("#list-title").tagName, "H2");
  assert.equal(doc.querySelectorAll(".extension h3").length, 3);
  assert.equal(doc.querySelectorAll(".extension h2").length, 0);
});

test("HTTP failures can be retried without a reload", async (t) => {
  let requests = 0;
  const { doc } = await setup(t, { fetch: async () => ++requests === 1
    ? { ok: false, status: 503 }
    : { ok: true, json: async () => structuredClone(seed) } });
  assert.equal(doc.getElementById("retry-btn").hidden, false);
  assert.equal(doc.querySelector(".extension-list").getAttribute("aria-busy"), "false");
  assert.match(doc.getElementById("announcement").textContent, /could not be loaded/);
  doc.getElementById("retry-btn").click();
  await new Promise(setImmediate);
  assert.equal(doc.querySelectorAll(".extension").length, 3);
  assert.equal(doc.getElementById("retry-btn").hidden, true);
});

test("corrupted or blocked storage does not break the controls", async (t) => {
  const storage = { getItem: () => "not valid JSON", setItem: () => { throw new Error("QuotaExceeded"); } };
  const { doc, card, filter, theme } = await setup(t, { storage });
  card("Alpha").querySelector("input").click();
  filter("inactive");
  assert.ok(card("Alpha"));
  doc.querySelector(".switcher").click();
  assert.equal(theme(), "light");
});

test("theme choice survives reinitialization", async (t) => {
  const storage = memoryStorage();
  const first = await setup(t, { storage });
  first.doc.querySelector(".switcher").click();
  const second = await setup(t, { storage });
  assert.equal(second.theme(), "light");
  assert.equal(second.doc.querySelector(".switcher").getAttribute("aria-label"), "Switch to dark theme");
});

test("without a saved choice the theme follows the operating system", async (t) => {
  const light = await setup(t, { prefersLight: true });
  assert.equal(light.theme(), "light");
  const dark = await setup(t, { prefersLight: false });
  assert.equal(dark.theme(), "dark");
  const storage = memoryStorage();
  storage.setItem("extension-manager-theme", "dark");
  const saved = await setup(t, { prefersLight: true, storage });
  assert.equal(saved.theme(), "dark", "a saved choice wins over the OS setting");
});

test("extension strings are rendered as text, not HTML", async (t) => {
  const data = [{ ...seed[0], name: '<img src=x onerror="alert(1)">', description: "<script>bad()</script>" }];
  const { doc } = await setup(t, { fetch: async () => ({ ok: true, json: async () => data }) });
  assert.equal(doc.querySelector(".extension h3").textContent, data[0].name);
  assert.equal(doc.querySelectorAll(".extension img").length, 1);
  assert.equal(doc.querySelector(".extension script"), null);
});

test("invalid server data is recoverable instead of crashing rendering", async (t) => {
  const { doc } = await setup(t, { fetch: async () => ({ ok: true, json: async () => [{ name: "Broken" }] }) });
  assert.equal(doc.querySelectorAll(".extension").length, 0);
  assert.equal(doc.getElementById("retry-btn").hidden, false);
});

test("a stalled request times out and leaves a retry action", async (t) => {
  const { doc } = await setup(t, { loadTimeoutMs: 1, fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Aborted")));
  }) });
  assert.match(doc.getElementById("feedback").textContent, /took too long/);
  assert.equal(doc.getElementById("retry-btn").hidden, false);
  assert.equal(doc.querySelector(".extension-list").getAttribute("aria-busy"), "false");
});

test("extension logos cannot load remote, executable or parent-directory URLs", async (t) => {
  for (const logo of ["https://example.invalid/tracker.svg", "javascript:alert(1)", "data:image/svg+xml,bad", "./../private.svg"]) {
    const { doc } = await setup(t, { fetch: async () => ({ ok: true, json: async () => [{ ...seed[0], logo }] }) });
    assert.equal(doc.querySelectorAll(".extension").length, 0);
    assert.equal(doc.getElementById("retry-btn").hidden, false);
  }
});
