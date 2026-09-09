import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const css = await readFile(new URL("viewer.css", root), "utf8");
const js = await readFile(new URL("viewer.js", root), "utf8");
const html = await readFile(new URL("viewer.html", root), "utf8");
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const releaseWorkflow = await readFile(new URL(".github/workflows/release.yml", root), "utf8");
const packageStoreScript = await readFile(new URL("scripts/package-store.ps1", root), "utf8");

const canvasRule = css.match(/\.pdf-page canvas\s*\{([^}]+)\}/)?.[1] || "";
const pagesRule = css.match(/\.pdf-pages\s*\{([^}]+)\}/)?.[1] || "";
const scrubberRule = css.match(/\.page-scrubber input\[type="range"\]\s*\{([^}]+)\}/)?.[1] || "";
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
assert.match(js, /createLocalPdfRangeTransport/);
assert.match(js, /withCredentials:\s*false/);
assert.match(js, /disableAutoFetch:\s*true/);
assert.match(js, /disableStream:\s*true/);
assert.match(js, /rangeChunkSize:\s*PDF_RANGE_CHUNK_SIZE/);
assert.doesNotMatch(js, /response\.arrayBuffer/);
assert.doesNotMatch(js, /credentials:\s*"include"/);
assert.doesNotMatch(js, /withCredentials\s*:\s*true/);
assert.match(js, /enableScripting:\s*false/);
assert.match(css, /\.page-scrubber/);
assert.match(css, /writing-mode:\s*vertical-lr/);
assert.match(scrubberRule, /direction:\s*ltr/);
assert.doesNotMatch(scrubberRule, /direction:\s*rtl/);
assert.match(css, /prefers-reduced-motion/);
assert.match(js, /pageRectCache/);
assert.match(js, /if \(currentPageNumber === nextPageNumber\) return/);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.default_locale, "en");
assert.equal(manifest.version, "1.11.3");
assert.equal(packageJson.version, "1.11.3");
assert.match(packageJson.scripts.test, /node --check viewer\.js/);
assert.match(packageJson.scripts.test, /node --check pdf-source\.js/);
assert.match(packageJson.scripts.test, /node --check background\.js/);
assert.match(packageJson.scripts.test, /node tests\/pdf-source\.mjs/);
assert.match(packageJson.scripts.test, /node tests\/pdf-annotations\.mjs/);
assert.equal(packageJson.dependencies["pdf-lib"], "1.17.1");
assert.match(packageStoreScript, /"pdf-source\.js"/);
assert.match(packageStoreScript, /"pdf-annotations\.js"/);
assert.match(releaseWorkflow, /branches:/);
assert.match(releaseWorkflow, /- main/);
assert.match(releaseWorkflow, /contents:\s*write/);
assert.match(releaseWorkflow, /npm test/);
assert.match(releaseWorkflow, /git ls-remote/);
assert.match(releaseWorkflow, /\$global:LASTEXITCODE\s*=\s*0/);
assert.match(releaseWorkflow, /--target "\$GITHUB_SHA"/);
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

for (const control of [
  "annotationButton",
  "savePdfButton",
  "extractTextButton",
  "annotationPanel",
  "annotationTextInput",
  "annotationColorInput",
  "annotationThicknessRange",
  "annotationFinishButton",
  "annotationUndoButton",
  "annotationRedoButton",
  "annotationDeleteButton",
  "extractPanel",
  "extractPageRangeInput",
  "extractedText",
  "copyExtractedTextButton",
  "downloadExtractedTextButton",
  "saveDialog",
  "savePageRangeInput"
]) {
  assert(html.includes(`id="${control}"`), `Missing editing control: ${control}`);
}

assert.match(css, /\.annotation-overlay/);
assert.match(css, /\.pdf-dialog/);
assert.match(css, /\.extracted-text/);
assert.match(js, /parsePageRange/);
assert.match(js, /exportAnnotatedPdf/);
assert.match(js, /getTextContent/);
assert.match(js, /function finishPendingPen/);
assert.match(js, /function finishPenAndSelect/);
assert.match(js, /penSession/);

console.log("static-layout: passed");
