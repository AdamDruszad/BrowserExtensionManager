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
  const app = initExtensionManager(doc, { fetch: async () => ({ ok: true, json: async () => structuredClone(seed) }), storage: memoryStorage(), ...options });
  await app.ready;
  const filter = (name) => doc.querySelector(`[data-filter="${name}"]`).click();
  const card = (name) => [...doc.querySelectorAll(".card")].find((node) => node.dataset.name === name);
  return { doc, dom, filter, card };
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

test("removals and toggles survive a reload and Reset restores the original list", async (t) => {
  const storage = memoryStorage();
  const first = await setup(t, { storage });
  first.card("Alpha").querySelector("input").click();
  first.card("Beta").querySelector("button").click();
  const second = await setup(t, { storage });
  assert.equal(second.card("Beta"), undefined);
  assert.equal(second.card("Alpha").querySelector("input").checked, false);
  second.doc.getElementById("reset-btn").click();
  assert.equal(second.doc.querySelectorAll(".card").length, 3);
  assert.equal(second.card("Alpha").querySelector("input").checked, true);
  const third = await setup(t, { storage });
  assert.equal(third.doc.querySelectorAll(".card").length, 3);
});

test("an empty filtered list has feedback and a useful focus target", async (t) => {
  const { doc, filter, card } = await setup(t);
  filter("inactive");
  card("Gamma").querySelector("input").click();
  assert.equal(doc.querySelectorAll(".card").length, 0);
  assert.equal(doc.getElementById("feedback").hidden, false);
  assert.match(doc.getElementById("feedback").textContent, /No inactive/);
  assert.equal(doc.activeElement, doc.querySelector('[data-filter="inactive"]'));
});

test("HTTP failures can be retried without a reload", async (t) => {
  let requests = 0;
  const { doc } = await setup(t, { fetch: async () => ++requests === 1
    ? { ok: false, status: 503 }
    : { ok: true, json: async () => structuredClone(seed) } });
  assert.equal(doc.getElementById("retry-btn").hidden, false);
  assert.equal(doc.querySelector(".extensions-grid").getAttribute("aria-busy"), "false");
  doc.getElementById("retry-btn").click();
  await new Promise(setImmediate);
  assert.equal(doc.querySelectorAll(".card").length, 3);
  assert.equal(doc.getElementById("retry-btn").hidden, true);
});

test("corrupted or blocked storage does not break the controls", async (t) => {
  const storage = { getItem: () => "not valid JSON", setItem: () => { throw new Error("QuotaExceeded"); } };
  const { doc, card, filter } = await setup(t, { storage });
  card("Alpha").querySelector("input").click();
  filter("inactive");
  assert.ok(card("Alpha"));
  doc.querySelector(".switcher").click();
  assert.equal(doc.body.classList.contains("light-theme"), true);
});

test("theme choice survives reinitialization", async (t) => {
  const storage = memoryStorage();
  const first = await setup(t, { storage });
  first.doc.querySelector(".switcher").click();
  const second = await setup(t, { storage });
  assert.equal(second.doc.body.classList.contains("light-theme"), true);
  assert.equal(second.doc.querySelector(".switcher").getAttribute("aria-label"), "Switch to dark theme");
});

test("extension strings are rendered as text, not HTML", async (t) => {
  const data = [{ ...seed[0], name: '<img src=x onerror="alert(1)">', description: "<script>bad()</script>" }];
  const { doc } = await setup(t, { fetch: async () => ({ ok: true, json: async () => data }) });
  assert.equal(doc.querySelector(".card h2").textContent, data[0].name);
  assert.equal(doc.querySelectorAll(".card img").length, 1);
  assert.equal(doc.querySelector(".card script"), null);
});

test("invalid server data is recoverable instead of crashing rendering", async (t) => {
  const { doc } = await setup(t, { fetch: async () => ({ ok: true, json: async () => [{ name: "Broken" }] }) });
  assert.equal(doc.querySelectorAll(".card").length, 0);
  assert.equal(doc.getElementById("retry-btn").hidden, false);
});

test("a stalled request times out and leaves a retry action", async (t) => {
  const { doc } = await setup(t, { loadTimeoutMs: 1, fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Aborted")));
  }) });
  assert.match(doc.getElementById("feedback").textContent, /took too long/);
  assert.equal(doc.getElementById("retry-btn").hidden, false);
  assert.equal(doc.querySelector(".extensions-grid").getAttribute("aria-busy"), "false");
});

test("extension logos cannot load remote, executable or parent-directory URLs", async (t) => {
  for (const logo of ["https://example.invalid/tracker.svg", "javascript:alert(1)", "data:image/svg+xml,bad", "./../private.svg"]) {
    const { doc } = await setup(t, { fetch: async () => ({ ok: true, json: async () => [{ ...seed[0], logo }] }) });
    assert.equal(doc.querySelectorAll(".card").length, 0);
    assert.equal(doc.getElementById("retry-btn").hidden, false);
  }
});
