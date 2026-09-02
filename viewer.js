import * as pdfjsLib from "./vendor/pdf.mjs";
import {
  buildDuotoneMatrix,
  getAnchoredScrollPosition,
  getKeyboardCommand,
  getPageAnchor,
  getWheelZoomDirection,
  normalizeHexColor
} from "./viewer-utils.js";

const DEFAULT_SETTINGS = Object.freeze({
  darkMode: true,
  readingPreset: "clear",
  textColor: "#f1f3f4",
  backgroundColor: "#202124",
  brightness: 100,
  contrast: 108,
  readabilityVersion: 3
});

const READING_PRESETS = Object.freeze({
  clear: Object.freeze({ mode: "duotone", textColor: "#f1f3f4", backgroundColor: "#202124", brightness: 100, contrast: 108 }),
  material: Object.freeze({ mode: "duotone", textColor: "#e6e1e5", backgroundColor: "#1d1b20", brightness: 100, contrast: 108 }),
  materialBlue: Object.freeze({ mode: "duotone", textColor: "#dbe9ff", backgroundColor: "#171c24", brightness: 100, contrast: 108 }),
  materialGreen: Object.freeze({ mode: "duotone", textColor: "#d9eadf", backgroundColor: "#171d19", brightness: 100, contrast: 108 }),
  materialAmber: Object.freeze({ mode: "duotone", textColor: "#f3e3c3", backgroundColor: "#211b12", brightness: 100, contrast: 108 }),
  warm: Object.freeze({ mode: "duotone", textColor: "#f4ead7", backgroundColor: "#28221b", brightness: 100, contrast: 106 }),
  midnight: Object.freeze({ mode: "duotone", textColor: "#e0f2fe", backgroundColor: "#111827", brightness: 100, contrast: 110 }),
  highContrast: Object.freeze({ mode: "duotone", textColor: "#ffffff", backgroundColor: "#121212", brightness: 100, contrast: 125 }),
  black: Object.freeze({ mode: "duotone", textColor: "#ffffff", backgroundColor: "#000000", brightness: 100, contrast: 112 }),
  preserve: Object.freeze({ mode: "preserve", invert: 88, textColor: "#e8eaed", backgroundColor: "#202124", brightness: 100, contrast: 95 }),
  custom: Object.freeze({ mode: "duotone", brightness: 100, contrast: 108 })
});

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.2;
const MAX_CONCURRENT_PAGE_RENDERS = 1;
const MAX_CACHED_RENDERED_PAGES = 8;

const elements = {
  chooseFileButton: document.querySelector("#chooseFileButton"),
  emptyChooseButton: document.querySelector("#emptyChooseButton"),
  fileInput: document.querySelector("#fileInput"),
  fileAccessState: document.querySelector("#fileAccessState"),
  openExtensionSettingsButton: document.querySelector("#openExtensionSettingsButton"),
  retryFileAccessButton: document.querySelector("#retryFileAccessButton"),
  setupChooseButton: document.querySelector("#setupChooseButton"),
  urlForm: document.querySelector("#urlForm"),
  urlInput: document.querySelector("#urlInput"),
  darkModeToggle: document.querySelector("#darkModeToggle"),
  readingPresetSelect: document.querySelector("#readingPresetSelect"),
  textColorInput: document.querySelector("#textColorInput"),
  backgroundColorInput: document.querySelector("#backgroundColorInput"),
  duotoneColorMatrix: document.querySelector("#duotoneColorMatrix"),
  brightnessRange: document.querySelector("#brightnessRange"),
  brightnessOutput: document.querySelector("#brightnessOutput"),
  contrastRange: document.querySelector("#contrastRange"),
  contrastOutput: document.querySelector("#contrastOutput"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutput: document.querySelector("#zoomOutput"),
  fitWidthButton: document.querySelector("#fitWidthButton"),
  resetButton: document.querySelector("#resetButton"),
  originalButton: document.querySelector("#originalButton"),
  viewerArea: document.querySelector("#viewerArea"),
  pdfPages: document.querySelector("#pdfPages"),
  emptyState: document.querySelector("#emptyState"),
  loadingState: document.querySelector("#loadingState"),
  loadingText: document.querySelector("#loadingText"),
  dropOverlay: document.querySelector("#dropOverlay"),
  notice: document.querySelector("#notice")
};

let settings = { ...DEFAULT_SETTINGS };
let pdfDocument = null;
let currentLoadingTask = null;
let currentSource = "";
let pendingSource = "";
let zoom = 1.25;
let activeScale = 1.25;
let fitWidth = true;
let renderGeneration = 0;
let resizeTimer = 0;
let zoomRenderTimer = 0;
let pendingZoomAnchor = null;
let activeCanvasRenderTasks = new Set();
let pageCache = new Map();
let pageMetrics = new Map();
let pageEntries = [];
let pageObserver = null;
let pageRenderQueue = new Set();
let pageRenderWorkers = 0;
let noticeTimer = 0;
let dragDepth = 0;

function assetUrl(relativePath) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(relativePath);
  }
  return new URL(relativePath, import.meta.url).href;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = assetUrl("vendor/pdf.worker.mjs");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showNotice(message, duration = 5500) {
  window.clearTimeout(noticeTimer);
  elements.notice.textContent = message;
  elements.notice.hidden = false;
  noticeTimer = window.setTimeout(() => {
    elements.notice.hidden = true;
  }, duration);
}

function normalizeRemoteUrl(rawValue) {
  const value = rawValue.trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    return ["http:", "https:", "file:"].includes(parsed.protocol) ? parsed.href : "";
  } catch (_error) {
    try {
      return new URL(`https://${value}`).href;
    } catch (_secondError) {
      return "";
    }
  }
}

function fileNameFromUrl(source) {
  try {
    const parsed = new URL(source);
    const lastPart = decodeURIComponent(parsed.pathname.split("/").pop() || "document.pdf");
    return lastPart.toLowerCase().endsWith(".pdf") ? lastPart : "document.pdf";
  } catch (_error) {
    return "document.pdf";
  }
}

function updateControlValues() {
  elements.darkModeToggle.checked = settings.darkMode;
  elements.readingPresetSelect.value = settings.readingPreset;
  elements.textColorInput.value = settings.textColor;
  elements.backgroundColorInput.value = settings.backgroundColor;
  const preserveColors = settings.readingPreset === "preserve";
  elements.textColorInput.disabled = preserveColors;
  elements.backgroundColorInput.disabled = preserveColors;
  elements.brightnessRange.value = String(settings.brightness);
  elements.brightnessOutput.value = `${settings.brightness}%`;
  elements.contrastRange.value = String(settings.contrast);
  elements.contrastOutput.value = `${settings.contrast}%`;
  elements.zoomOutput.value = fitWidth ? "Fit" : `${Math.round(zoom * 100)}%`;
}

function applyDarkMode() {
  const preset = READING_PRESETS[settings.readingPreset] || READING_PRESETS.clear;
  const textColor = settings.readingPreset === "custom" ? settings.textColor : preset.textColor;
  const backgroundColor = settings.readingPreset === "custom"
    ? settings.backgroundColor
    : preset.backgroundColor;
  const preserveColors = preset.mode === "preserve";
  elements.pdfPages.classList.toggle("dark", settings.darkMode);
  elements.pdfPages.classList.toggle("duotone", settings.darkMode && !preserveColors);
  elements.pdfPages.classList.toggle("preserve-colors", settings.darkMode && preserveColors);
  elements.pdfPages.style.setProperty("--pdf-invert", `${preset.invert || 88}%`);
  elements.pdfPages.style.setProperty("--pdf-background-color", backgroundColor);
  elements.pdfPages.style.setProperty("--pdf-brightness", `${settings.brightness}%`);
  elements.pdfPages.style.setProperty("--pdf-contrast", `${settings.contrast}%`);
  elements.duotoneColorMatrix.setAttribute(
    "values",
    buildDuotoneMatrix(textColor, backgroundColor).join(" ")
  );
}

async function persistSettings() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ pdfDarkModeSettings: settings });
    return;
  }
  localStorage.setItem("pdfDarkModeSettings", JSON.stringify(settings));
}

async function loadSavedSettings() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const stored = await chrome.storage.local.get("pdfDarkModeSettings");
    return stored.pdfDarkModeSettings || {};
  }

  try {
    return JSON.parse(localStorage.getItem("pdfDarkModeSettings") || "{}");
  } catch (_error) {
    return {};
  }
}

function setSettings(nextSettings, persist = true) {
  const readingPreset = Object.hasOwn(READING_PRESETS, nextSettings.readingPreset)
    ? nextSettings.readingPreset
    : DEFAULT_SETTINGS.readingPreset;
  settings = {
    darkMode: Boolean(nextSettings.darkMode),
    readingPreset,
    textColor: normalizeHexColor(nextSettings.textColor, DEFAULT_SETTINGS.textColor),
    backgroundColor: normalizeHexColor(nextSettings.backgroundColor, DEFAULT_SETTINGS.backgroundColor),
    brightness: clamp(Number(nextSettings.brightness), 50, 120),
    contrast: clamp(Number(nextSettings.contrast), 70, 150),
    readabilityVersion: DEFAULT_SETTINGS.readabilityVersion
  };
  updateControlValues();
  applyDarkMode();
  if (persist) void persistSettings();
}

function showLoading(message) {
  elements.loadingText.textContent = message;
  elements.loadingState.hidden = false;
  elements.emptyState.classList.add("hidden");
  elements.fileAccessState.hidden = true;
}

function hideLoading() {
  elements.loadingState.hidden = true;
}

function showEmptyState() {
  elements.emptyState.classList.remove("hidden");
  elements.fileAccessState.hidden = true;
  elements.loadingState.hidden = true;
  elements.pdfPages.replaceChildren();
}

function showFileAccessState(source) {
  pendingSource = source;
  elements.urlInput.value = source;
  elements.emptyState.classList.add("hidden");
  elements.loadingState.hidden = true;
  elements.pdfPages.replaceChildren();
  elements.fileAccessState.hidden = false;
}

function loadBytesWithXhr(source) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", source, true);
    request.responseType = "arraybuffer";
    request.withCredentials = true;
    request.onload = () => {
      // Local file requests report status 0 when they succeed.
      if ((request.status >= 200 && request.status < 300) || (request.status === 0 && request.response)) {
        resolve(request.response);
        return;
      }
      reject(new Error(request.status ? `HTTP ${request.status}` : "Chrome could not read the local file"));
    };
    request.onerror = () => reject(new Error("Chrome could not read the local file"));
    request.send();
  });
}

async function downloadPdfBytes(source) {
  if (source.startsWith("file:")) return loadBytesWithXhr(source);

  const response = await fetch(source, {
    credentials: "include",
    cache: "default"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.arrayBuffer();
}

function getPageScale(baseViewport) {
  if (!fitWidth) return zoom;
  const horizontalPadding = window.innerWidth <= 860 ? 32 : 84;
  const availableWidth = Math.max(260, elements.viewerArea.clientWidth - horizontalPadding);
  return clamp(availableWidth / baseViewport.width, MIN_ZOOM, MAX_ZOOM);
}

function captureViewPosition(point) {
  const pages = Array.from(elements.pdfPages.children);
  if (!pages.length) return null;

  return getPageAnchor(
    pages.map((page) => ({
      top: page.offsetTop,
      left: page.offsetLeft,
      width: page.offsetWidth,
      height: page.offsetHeight
    })),
    {
      scrollTop: elements.viewerArea.scrollTop,
      scrollLeft: elements.viewerArea.scrollLeft,
      width: elements.viewerArea.clientWidth,
      height: elements.viewerArea.clientHeight
    },
    point
  );
}

function restoreViewPosition(viewPosition, pageElement) {
  if (!viewPosition) return;
  const position = getAnchoredScrollPosition(viewPosition, {
    top: pageElement.offsetTop,
    left: pageElement.offsetLeft,
    width: pageElement.offsetWidth,
    height: pageElement.offsetHeight
  });
  elements.viewerArea.scrollTop = position.top;
  elements.viewerArea.scrollLeft = position.left;
}

function cancelActivePageRenders() {
  for (const renderTask of activeCanvasRenderTasks) renderTask.cancel();
  activeCanvasRenderTasks.clear();
  pageRenderQueue.clear();
  pageObserver?.disconnect();
  pageObserver = null;
}

async function getCachedPage(pageNumber) {
  let page = pageCache.get(pageNumber);
  if (!page) {
    page = await pdfDocument.getPage(pageNumber);
    pageCache.set(pageNumber, page);
  }
  return page;
}

function pruneRenderedPages(focusEntry) {
  const renderedEntries = pageEntries
    .filter((entry) => entry.rendered && entry !== focusEntry)
    .sort((first, second) => {
      return Math.abs(first.pageNumber - focusEntry.pageNumber)
        - Math.abs(second.pageNumber - focusEntry.pageNumber);
    });

  for (const entry of renderedEntries.slice(MAX_CACHED_RENDERED_PAGES - 1)) {
    entry.pageElement.querySelector("canvas")?.remove();
    entry.pageElement.querySelector(".textLayer")?.remove();
    entry.pageElement.classList.remove("rendered");
    entry.rendered = false;
  }
}

async function renderPageEntry(entry, generation) {
  if (entry.rendered || entry.rendering || generation !== renderGeneration) {
    return entry.renderPromise;
  }

  entry.rendering = true;
  entry.renderPromise = (async () => {
    const page = await getCachedPage(entry.pageNumber);
    if (generation !== renderGeneration) return;

    const baseViewport = page.getViewport({ scale: 1 });
    pageMetrics.set(entry.pageNumber, {
      width: baseViewport.width,
      height: baseViewport.height
    });
    const displayScale = getPageScale(baseViewport);
    const displayViewport = page.getViewport({ scale: displayScale });
    const layoutAnchor = captureViewPosition();
    entry.pageElement.style.setProperty("--total-scale-factor", String(displayScale));
    entry.pageElement.style.width = `${Math.ceil(displayViewport.width)}px`;
    entry.pageElement.style.height = `${Math.ceil(displayViewport.height)}px`;
    if (layoutAnchor) {
      const anchorEntry = pageEntries[layoutAnchor.pageNumber - 1];
      if (anchorEntry) restoreViewPosition(layoutAnchor, anchorEntry.pageElement);
    }

    // Render at the physical display resolution. The previous forced 1.5x
    // oversampling made every canvas at least 2.25 times more expensive.
    const idealPixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
    const largestDisplayDimension = Math.max(displayViewport.width, displayViewport.height);
    const safePixelRatio = 8192 / Math.max(1, largestDisplayDimension);
    const pixelRatio = clamp(Math.min(idealPixelRatio, safePixelRatio), 1, 2);
    const renderViewport = page.getViewport({ scale: displayScale * pixelRatio });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    canvas.style.width = `${Math.ceil(displayViewport.width)}px`;
    canvas.style.height = `${Math.ceil(displayViewport.height)}px`;

    const textLayerElement = document.createElement("div");
    textLayerElement.className = "textLayer";
    textLayerElement.setAttribute("aria-label", `Selectable text for page ${entry.pageNumber}`);
    entry.pageElement.prepend(canvas, textLayerElement);

    const canvasContext = canvas.getContext("2d", { alpha: false });
    const canvasRenderTask = page.render({ canvasContext, viewport: renderViewport });
    activeCanvasRenderTasks.add(canvasRenderTask);
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: page.streamTextContent({ includeMarkedContent: true }),
      container: textLayerElement,
      viewport: displayViewport
    });
    try {
      await Promise.all([canvasRenderTask.promise, textLayer.render()]);
    } finally {
      activeCanvasRenderTasks.delete(canvasRenderTask);
    }

    if (generation !== renderGeneration) return;
    entry.rendered = true;
    entry.pageElement.classList.add("rendered");
    pruneRenderedPages(entry);
  })();

  try {
    await entry.renderPromise;
  } finally {
    entry.rendering = false;
    entry.renderPromise = null;
  }
}

function processPageRenderQueue() {
  while (pageRenderWorkers < MAX_CONCURRENT_PAGE_RENDERS && pageRenderQueue.size) {
    const viewerCenter = elements.viewerArea.scrollTop + elements.viewerArea.clientHeight / 2;
    const entry = Array.from(pageRenderQueue).sort((first, second) => {
      const firstCenter = first.pageElement.offsetTop + first.pageElement.offsetHeight / 2;
      const secondCenter = second.pageElement.offsetTop + second.pageElement.offsetHeight / 2;
      return Math.abs(firstCenter - viewerCenter) - Math.abs(secondCenter - viewerCenter);
    })[0];
    pageRenderQueue.delete(entry);
    pageRenderWorkers += 1;
    void renderPageEntry(entry, entry.generation)
      .catch((error) => {
        if (entry.generation === renderGeneration && error?.name !== "RenderingCancelledException") {
          showNotice(`Page ${entry.pageNumber} could not render: ${error.message || "Unknown error"}`);
        }
      })
      .finally(() => {
        pageRenderWorkers -= 1;
        processPageRenderQueue();
      });
  }
}

function queuePageRender(entry) {
  if (!entry || entry.rendered || entry.rendering || entry.generation !== renderGeneration) return;
  pageRenderQueue.add(entry);
  processPageRenderQueue();
}

function observeVisiblePages() {
  pageObserver?.disconnect();
  pageObserver = new IntersectionObserver((observedEntries) => {
    for (const observedEntry of observedEntries) {
      if (!observedEntry.isIntersecting) continue;
      const pageNumber = Number(observedEntry.target.dataset.pageNumber);
      queuePageRender(pageEntries[pageNumber - 1]);
    }
  }, {
    root: elements.viewerArea,
    rootMargin: "50% 0px"
  });
  for (const entry of pageEntries) pageObserver.observe(entry.pageElement);
}

async function renderDocument() {
  if (!pdfDocument) return;

  const viewPosition = pendingZoomAnchor || captureViewPosition();
  const revealPageNumber = viewPosition?.pageNumber || 1;
  const generation = ++renderGeneration;
  cancelActivePageRenders();
  elements.emptyState.classList.add("hidden");
  showLoading(`Rendering page ${revealPageNumber}…`);
  updateControlValues();
  applyDarkMode();

  try {
    // Only page 1 is requested up front. Its size provides cheap placeholders;
    // all other PDF pages remain unopened until they approach the viewport.
    const firstPage = await getCachedPage(1);
    if (generation !== renderGeneration) return;
    const firstBaseViewport = firstPage.getViewport({ scale: 1 });
    pageMetrics.set(1, {
      width: firstBaseViewport.width,
      height: firstBaseViewport.height
    });

    pageEntries = Array.from({ length: pdfDocument.numPages }, (_value, index) => {
      const pageNumber = index + 1;
      const metric = pageMetrics.get(pageNumber) || pageMetrics.get(1);
      const displayScale = getPageScale(metric);
      if (pageNumber === 1) activeScale = displayScale;
      const pageElement = document.createElement("section");
      pageElement.className = "pdf-page";
      pageElement.dataset.pageNumber = String(pageNumber);
      pageElement.dataset.loadingLabel = `Page ${pageNumber}`;
      pageElement.setAttribute("aria-label", `Page ${pageNumber}`);
      pageElement.style.setProperty("--total-scale-factor", String(displayScale));
      pageElement.style.width = `${Math.ceil(metric.width * displayScale)}px`;
      pageElement.style.height = `${Math.ceil(metric.height * displayScale)}px`;

      const pageLabel = document.createElement("span");
      pageLabel.className = "page-number";
      pageLabel.textContent = `${pageNumber} / ${pdfDocument.numPages}`;
      pageElement.append(pageLabel);
      return {
        pageNumber,
        pageElement,
        generation,
        rendered: false,
        rendering: false,
        renderPromise: null
      };
    });

    elements.pdfPages.replaceChildren(...pageEntries.map((entry) => entry.pageElement));
    const revealEntry = pageEntries[revealPageNumber - 1];
    if (viewPosition && revealEntry) restoreViewPosition(viewPosition, revealEntry.pageElement);
    await renderPageEntry(revealEntry, generation);
    if (generation !== renderGeneration) return;
    if (viewPosition) restoreViewPosition(viewPosition, revealEntry.pageElement);
    hideLoading();
    if (pendingZoomAnchor === viewPosition) pendingZoomAnchor = null;

    observeVisiblePages();
  } catch (error) {
    if (generation !== renderGeneration) return;
    pendingZoomAnchor = null;
    hideLoading();
    showNotice(`PDF rendering failed: ${error.message || "Unknown error"}`, 9000);
  }
}

async function openPdfBytes(bytes, displayName, originalSource = "") {
  renderGeneration += 1;
  cancelActivePageRenders();
  pageCache = new Map();
  pageMetrics = new Map();
  pageEntries = [];
  pendingZoomAnchor = null;
  if (currentLoadingTask) {
    await currentLoadingTask.destroy();
    currentLoadingTask = null;
    pdfDocument = null;
  }

  currentSource = originalSource;
  elements.originalButton.disabled = !originalSource;
  document.title = `${displayName} — Dark PDF`;
  showLoading("Reading PDF…");

  try {
    currentLoadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(bytes),
      cMapUrl: assetUrl("vendor/cmaps/"),
      cMapPacked: true,
      standardFontDataUrl: assetUrl("vendor/standard_fonts/"),
      wasmUrl: assetUrl("vendor/wasm/"),
      isEvalSupported: false
    });
    currentLoadingTask.onPassword = (updatePassword, reason) => {
      const firstAttempt = reason === pdfjsLib.PasswordResponses.NEED_PASSWORD;
      const password = window.prompt(
        firstAttempt ? "This PDF is password protected. Enter its password:" : "Incorrect password. Try again:"
      );
      if (password !== null) updatePassword(password);
    };
    pdfDocument = await currentLoadingTask.promise;
    await renderDocument();
  } catch (error) {
    hideLoading();
    showEmptyState();
    showNotice(`Could not open this PDF: ${error.message || "Unknown error"}`, 9000);
  }
}

async function loadRemoteSource(rawSource) {
  const source = normalizeRemoteUrl(rawSource);
  if (!source) {
    showNotice("Enter a valid http://, https://, or file:// PDF address.");
    return;
  }

  pendingSource = source;

  if (
    source.startsWith("file:") &&
    typeof chrome !== "undefined" &&
    chrome.extension?.isAllowedFileSchemeAccess &&
    !(await chrome.extension.isAllowedFileSchemeAccess())
  ) {
    showFileAccessState(source);
    return;
  }

  showLoading("Downloading PDF…");
  elements.urlInput.value = source;

  try {
    const bytes = await downloadPdfBytes(source);
    await openPdfBytes(bytes, fileNameFromUrl(source), source);
  } catch (error) {
    hideLoading();
    showEmptyState();
    showNotice(
      `Could not download this PDF (${error.message || "network error"}). Save it, then use Open PDF.`,
      9000
    );
  }
}

async function loadLocalFile(file) {
  if (!file) return;
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    showNotice("That file does not look like a PDF.");
    return;
  }

  showLoading("Reading local PDF…");
  try {
    await openPdfBytes(await file.arrayBuffer(), file.name);
    elements.urlInput.value = file.name;
  } catch (error) {
    hideLoading();
    showEmptyState();
    showNotice(`Could not read this file: ${error.message || "Unknown error"}`, 9000);
  }
}

function chooseFile() {
  elements.fileInput.value = "";
  elements.fileInput.click();
}

function setZoom(nextZoom, anchorPoint) {
  if (!pendingZoomAnchor) pendingZoomAnchor = captureViewPosition(anchorPoint);
  fitWidth = false;
  zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  activeScale = zoom;
  updateControlValues();
  window.clearTimeout(zoomRenderTimer);
  zoomRenderTimer = window.setTimeout(() => void renderDocument(), 80);
}

async function initialize() {
  const saved = await loadSavedSettings();
  const needsReadabilityUpgrade = saved.readabilityVersion !== DEFAULT_SETTINGS.readabilityVersion;
  const upgraded = needsReadabilityUpgrade
    ? { ...saved, ...DEFAULT_SETTINGS }
    : { ...DEFAULT_SETTINGS, ...saved };
  setSettings(upgraded, needsReadabilityUpgrade);

  const initialSource = new URL(window.location.href).searchParams.get("url");
  if (initialSource) await loadRemoteSource(initialSource);
}

elements.chooseFileButton.addEventListener("click", chooseFile);
elements.emptyChooseButton.addEventListener("click", chooseFile);
elements.setupChooseButton.addEventListener("click", chooseFile);

elements.openExtensionSettingsButton.addEventListener("click", async () => {
  const settingsUrl = `chrome://extensions/?id=${chrome.runtime.id}`;
  try {
    await chrome.tabs.create({ url: settingsUrl });
  } catch (_error) {
    showNotice("Right-click the extension icon, then choose Manage extension.", 8000);
  }
});

elements.retryFileAccessButton.addEventListener("click", () => {
  if (pendingSource) void loadRemoteSource(pendingSource);
});

elements.fileInput.addEventListener("change", () => {
  void loadLocalFile(elements.fileInput.files?.[0]);
});

elements.urlForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void loadRemoteSource(elements.urlInput.value);
});

elements.darkModeToggle.addEventListener("change", () => {
  setSettings({ ...settings, darkMode: elements.darkModeToggle.checked });
});

elements.readingPresetSelect.addEventListener("change", () => {
  const readingPreset = elements.readingPresetSelect.value;
  const preset = READING_PRESETS[readingPreset] || READING_PRESETS.clear;
  setSettings({
    ...settings,
    readingPreset,
    textColor: preset.textColor || settings.textColor,
    backgroundColor: preset.backgroundColor || settings.backgroundColor,
    brightness: preset.brightness,
    contrast: preset.contrast
  });
});

function applyCustomColors() {
  setSettings({
    ...settings,
    readingPreset: "custom",
    textColor: elements.textColorInput.value,
    backgroundColor: elements.backgroundColorInput.value,
    brightness: settings.readingPreset === "custom" ? settings.brightness : 100,
    contrast: settings.readingPreset === "custom" ? settings.contrast : 108
  });
}

elements.textColorInput.addEventListener("input", applyCustomColors);
elements.backgroundColorInput.addEventListener("input", applyCustomColors);

elements.brightnessRange.addEventListener("input", () => {
  setSettings({ ...settings, brightness: Number(elements.brightnessRange.value) });
});

elements.contrastRange.addEventListener("input", () => {
  setSettings({ ...settings, contrast: Number(elements.contrastRange.value) });
});

elements.zoomOutButton.addEventListener("click", () => setZoom((fitWidth ? activeScale : zoom) - ZOOM_STEP));
elements.zoomInButton.addEventListener("click", () => setZoom((fitWidth ? activeScale : zoom) + ZOOM_STEP));

elements.fitWidthButton.addEventListener("click", () => {
  fitWidth = true;
  updateControlValues();
  void renderDocument();
});

elements.resetButton.addEventListener("click", () => {
  setSettings(DEFAULT_SETTINGS);
  fitWidth = true;
  updateControlValues();
  void renderDocument();
});

elements.originalButton.addEventListener("click", () => {
  if (!currentSource) return;
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    void chrome.tabs.create({ url: currentSource }).catch(() => {
      showNotice("Chrome could not open the original address in a new tab.");
    });
  } else {
    window.open(currentSource, "_blank", "noopener");
  }
});

elements.viewerArea.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth += 1;
  elements.dropOverlay.classList.add("visible");
});

elements.viewerArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
});

elements.viewerArea.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) elements.dropOverlay.classList.remove("visible");
});

elements.viewerArea.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  elements.dropOverlay.classList.remove("visible");
  void loadLocalFile(event.dataTransfer?.files?.[0]);
});

document.addEventListener("keydown", (event) => {
  const command = getKeyboardCommand(event);
  if (command) {
    event.preventDefault();
    if (command === "zoom-in") setZoom((fitWidth ? activeScale : zoom) + ZOOM_STEP);
    if (command === "zoom-out") setZoom((fitWidth ? activeScale : zoom) - ZOOM_STEP);
    if (command === "fit") {
      fitWidth = true;
      updateControlValues();
      void renderDocument();
    }
    if (command === "open") chooseFile();
    return;
  }

  const target = event.target;
  const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  if (typing) return;

  if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "d") {
    setSettings({ ...settings, darkMode: !settings.darkMode });
  } else if (!event.ctrlKey && !event.metaKey && (event.key === "+" || event.key === "=")) {
    setZoom((fitWidth ? activeScale : zoom) + ZOOM_STEP);
  } else if (!event.ctrlKey && !event.metaKey && event.key === "-") {
    setZoom((fitWidth ? activeScale : zoom) - ZOOM_STEP);
  }
});

window.addEventListener("wheel", (event) => {
  const direction = getWheelZoomDirection(event);
  if (!direction || !pdfDocument) return;
  event.preventDefault();
  const viewerRect = elements.viewerArea.getBoundingClientRect();
  setZoom((fitWidth ? activeScale : zoom) + direction * ZOOM_STEP, {
    x: event.clientX - viewerRect.left,
    y: event.clientY - viewerRect.top
  });
}, { passive: false, capture: true });

window.addEventListener("resize", () => {
  if (!fitWidth || !pdfDocument) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => void renderDocument(), 180);
});

window.addEventListener("focus", () => {
  if (!elements.fileAccessState.hidden && pendingSource) {
    void loadRemoteSource(pendingSource);
  }
});

void initialize();
