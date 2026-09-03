import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const listeners = {};
const operations = [];
let fileAccessAllowed = false;

globalThis.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://test-extension/${path}`,
    onInstalled: { addListener: (listener) => { listeners.installed = listener; } }
  },
  extension: { isAllowedFileSchemeAccess: async () => fileAccessAllowed },
  action: { onClicked: { addListener: (listener) => { listeners.action = listener; } } },
  contextMenus: {
    removeAll: (callback) => callback(),
    create: (options) => operations.push({ type: "menu", options }),
    onClicked: { addListener: (listener) => { listeners.menu = listener; } }
  },
  tabs: {
    update: async (tabId, options) => operations.push({ type: "update", tabId, options }),
    create: async (options) => operations.push({ type: "create", options })
  }
};

const source = await readFile(new URL("../background.js", import.meta.url), "utf8");
vm.runInThisContext(source, { filename: "background.js" });

const sampleUrl = "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";
await listeners.action({ id: 7, index: 2, url: sampleUrl });
await new Promise((resolve) => setTimeout(resolve, 0));
const update = operations.find((operation) => operation.type === "update");
assert.equal(new URL(update.options.url).searchParams.get("url"), sampleUrl);

const localUrl = "file:///C:/Users/example/Desktop/local%20document.pdf";
await listeners.action({ id: 8, index: 3, url: localUrl });
await new Promise((resolve) => setTimeout(resolve, 0));
let localViewerUrl = new URL(operations.filter((operation) => operation.type === "update").at(-1).options.url);
assert.equal(localViewerUrl.searchParams.get("fileAccess"), "blocked");

fileAccessAllowed = true;
await listeners.action({ id: 9, index: 4, url: localUrl });
await new Promise((resolve) => setTimeout(resolve, 0));
localViewerUrl = new URL(operations.filter((operation) => operation.type === "update").at(-1).options.url);
assert.equal(localViewerUrl.searchParams.has("fileAccess"), false);

console.log("background: passed");
