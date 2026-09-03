import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const css = await readFile(new URL("viewer.css", root), "utf8");
const js = await readFile(new URL("viewer.js", root), "utf8");
const html = await readFile(new URL("viewer.html", root), "utf8");
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const releaseWorkflow = await readFile(new URL(".github/workflows/release.yml", root), "utf8");

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
assert.match(js, /getCurrentPageNumber/);
assert.match(js, /normalizePageNumber/);
assert.match(js, /credentials:\s*"omit"/);
assert.match(js, /withCredentials\s*=\s*false/);
assert.doesNotMatch(js, /credentials:\s*"include"/);
assert.doesNotMatch(js, /withCredentials\s*=\s*true/);
assert.match(js, /enableScripting:\s*false/);
assert.match(css, /\.page-scrubber/);
assert.match(css, /writing-mode:\s*vertical-lr/);
assert.match(css, /prefers-reduced-motion/);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.default_locale, "en");
assert.equal(manifest.version, "1.9.0");
assert.equal(packageJson.version, "1.9.0");
assert.match(releaseWorkflow, /tags:/);
assert.match(releaseWorkflow, /v\*\.\*\.\*/);
assert.match(releaseWorkflow, /contents:\s*write/);
assert.match(releaseWorkflow, /git merge-base --is-ancestor/);
assert.match(releaseWorkflow, /gh release create/);

for (const theme of [
  "Material 3",
  "Nord",
  "Catppuccin Mocha",
  "Solarized Dark",
  "Dracula",
  "Sepia Paper",
  "Material Blue",
  "Material Green",
  "High Contrast",
  "Custom Colors"
]) {
  assert(html.includes(theme), `Missing theme: ${theme}`);
}

for (const control of [
  "pageNavigation",
  "pageFirstButton",
  "pagePreviousButton",
  "currentPageInput",
  "pageTotalOutput",
  "pageNextButton",
  "pageLastButton",
  "pageScrubber",
  "pageScrubberRange",
  "pageScrubberLabel"
]) {
  assert(html.includes(`id="${control}"`), `Missing page control: ${control}`);
}

console.log("static-layout: passed");
