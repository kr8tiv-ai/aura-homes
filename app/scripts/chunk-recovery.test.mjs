import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";

function browserHarness(storage) {
  const listeners = new Map();
  const mounted = [];
  let reloads = 0;
  const documentElement = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const document = {
    readyState: "complete",
    documentElement,
    body: { appendChild(node) { mounted.push(node); } },
    addEventListener(name, handler) { listeners.set(`document:${name}`, handler); },
    getElementById(id) { return mounted.find((node) => node.id === id) ?? null; },
    createElement() {
      const retry = { addEventListener(name, handler) { this[name] = handler; } };
      return {
        id: "",
        attributes: {},
        innerHTML: "",
        setAttribute(name, value) { this.attributes[name] = value; },
        querySelector(selector) { return selector === "[data-aura-retry]" ? retry : null; },
      };
    },
  };
  const sessionStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); },
  };
  const window = {
    document,
    sessionStorage,
    location: { reload() { reloads += 1; } },
    addEventListener(name, handler) { listeners.set(name, handler); },
  };
  return {
    context: { window, document, sessionStorage, location: window.location },
    fire(name, event) { listeners.get(name)?.(event); },
    get mounted() { return mounted; },
    get reloads() { return reloads; },
  };
}

test("the pre-hydration chunk guard reloads once, then shows a static recovery panel", async () => {
  const { createChunkRecoveryScript } = await import("../lib/chunkRecovery.mjs");
  const storage = new Map();
  const first = browserHarness(storage);
  vm.runInNewContext(createChunkRecoveryScript("release-a"), first.context);

  first.fire("error", { message: "ordinary validation error", target: { tagName: "DIV" } });
  assert.equal(first.reloads, 0);
  first.fire("error", {
    message: "Loading chunk 9628 failed",
    target: { tagName: "SCRIPT", src: "https://aurahomes.fun/_next/static/chunks/9628.old.js" },
  });
  assert.equal(first.reloads, 1);
  assert.equal(first.mounted.length, 0);
  assert.equal(storage.get("aura:chunk-recovery"), "release-a");

  const second = browserHarness(storage);
  vm.runInNewContext(createChunkRecoveryScript("release-a"), second.context);
  second.fire("unhandledrejection", {
    reason: new Error("Failed to fetch dynamically imported module"),
  });
  assert.equal(second.reloads, 0);
  assert.equal(second.mounted.length, 1);
  assert.match(second.mounted[0].innerHTML, /Aura updated while this page was open/);
  assert.equal(second.context.document.documentElement.attributes["data-aura-static-fallback"], "true");
});

test("the root layout embeds the chunk guard before hydration", async () => {
  const layout = await readFile(path.resolve("app/layout.tsx"), "utf8");
  assert.match(layout, /createChunkRecoveryScript/);
  assert.match(layout, /id="aura-chunk-recovery"/);
  assert.match(layout, /NEXT_PUBLIC_DEPLOYMENT_ID/);
});
