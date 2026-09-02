import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const css = await readFile(new URL("viewer.css", root), "utf8");
const js = await readFile(new URL("viewer.js", root), "utf8");
const html = await readFile(new URL("viewer.html", root), "utf8");
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));

const canvasRule = css.match(/\.pdf-page canvas\s*\{([^}]+)\}/)?.[1] || "";
const pagesRule = css.match(/\.pdf-pages\s*\{([^}]+)\}/)?.[1] || "";
assert.match(canvasRule, /max-width:\s*none/);
assert.doesNotMatch(canvasRule, /max-width:\s*100%/);
assert.match(pagesRule, /width:\s*max-content/);
assert.match(js, /new pdfjsLib\.TextLayer/);
assert.match(css, /\.textLayer ::selection/);
assert.match(js, /await renderPageEntry\(revealEntry, generation\)/);
assert.match(js, /new IntersectionObserver/);
assert.match(js, /MAX_CONCURRENT_PAGE_RENDERS = 1/);
assert.match(js, /MAX_CACHED_RENDERED_PAGES = 8/);
assert.doesNotMatch(js, /Promise\.all\(\s*Array\.from\(\{ length: pdfDocument\.numPages/);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.default_locale, "en");
assert.equal(manifest.version, "1.8.0");

for (const theme of ["Material 3", "Material Blue", "Material Green", "High Contrast", "Custom Colors"]) {
  assert(html.includes(theme), `Missing theme: ${theme}`);
}

console.log("static-layout: passed");
