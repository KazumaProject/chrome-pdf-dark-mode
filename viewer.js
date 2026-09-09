import * as pdfjsLib from "./vendor/pdf.mjs";
import {
  createLocalPdfRangeTransport,
  PDF_RANGE_CHUNK_SIZE
} from "./pdf-source.js";
import {
  buildDuotoneMatrix,
  getAnchoredScrollPosition,
  getCurrentPageNumber,
  getKeyboardCommand,
  getPageAnchor,
  getAnnotationBounds,
  getWheelZoomDirection,
  formatPageRange,
  normalizeHexColor,
  normalizePageNumber,
  parsePageRange,
  scaleAnnotationGeometry,
  textContentToPlainText
} from "./viewer-utils.js";
import {
  ANNOTATION_FILL_OPACITY,
  ANNOTATION_KINDS,
  annotationRecordFromPdfData,
  exportAnnotatedPdf,
  getAnnotationMarkerFromData,
  isAppAnnotationData
} from "./pdf-annotations.js";

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
  nord: Object.freeze({ mode: "duotone", textColor: "#e5e9f0", backgroundColor: "#2e3440", brightness: 100, contrast: 104 }),
  catppuccinMocha: Object.freeze({ mode: "duotone", textColor: "#cdd6f4", backgroundColor: "#1e1e2e", brightness: 100, contrast: 106 }),
  solarizedDark: Object.freeze({ mode: "duotone", textColor: "#eee8d5", backgroundColor: "#002b36", brightness: 100, contrast: 104 }),
  dracula: Object.freeze({ mode: "duotone", textColor: "#f8f8f2", backgroundColor: "#282a36", brightness: 100, contrast: 106 }),
  sepiaPaper: Object.freeze({ mode: "duotone", textColor: "#f5e6c8", backgroundColor: "#30261d", brightness: 100, contrast: 104 }),
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
  pageNavigation: document.querySelector("#pageNavigation"),
  pageFirstButton: document.querySelector("#pageFirstButton"),
  pagePreviousButton: document.querySelector("#pagePreviousButton"),
  currentPageInput: document.querySelector("#currentPageInput"),
  pageTotalOutput: document.querySelector("#pageTotalOutput"),
  pageNextButton: document.querySelector("#pageNextButton"),
  pageLastButton: document.querySelector("#pageLastButton"),
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
  annotationButton: document.querySelector("#annotationButton"),
  savePdfButton: document.querySelector("#savePdfButton"),
  extractTextButton: document.querySelector("#extractTextButton"),
  annotationPanel: document.querySelector("#annotationPanel"),
  closeAnnotationButton: document.querySelector("#closeAnnotationButton"),
  annotationStatus: document.querySelector("#annotationStatus"),
  annotationToolButtons: Array.from(document.querySelectorAll("[data-annotation-tool]")),
  annotationTextInput: document.querySelector("#annotationTextInput"),
  annotationColorInput: document.querySelector("#annotationColorInput"),
  annotationThicknessRange: document.querySelector("#annotationThicknessRange"),
  annotationThicknessOutput: document.querySelector("#annotationThicknessOutput"),
  annotationFinishButton: document.querySelector("#annotationFinishButton"),
  annotationUndoButton: document.querySelector("#annotationUndoButton"),
  annotationRedoButton: document.querySelector("#annotationRedoButton"),
  annotationDeleteButton: document.querySelector("#annotationDeleteButton"),
  extractPanel: document.querySelector("#extractPanel"),
  closeExtractButton: document.querySelector("#closeExtractButton"),
  extractStatus: document.querySelector("#extractStatus"),
  extractPageRangeInput: document.querySelector("#extractPageRangeInput"),
  extractRangeButton: document.querySelector("#extractRangeButton"),
  extractSelectionButton: document.querySelector("#extractSelectionButton"),
  extractPageRangeError: document.querySelector("#extractPageRangeError"),
  extractPageRangeSummary: document.querySelector("#extractPageRangeSummary"),
  extractedText: document.querySelector("#extractedText"),
  copyExtractedTextButton: document.querySelector("#copyExtractedTextButton"),
  downloadExtractedTextButton: document.querySelector("#downloadExtractedTextButton"),
  resetExtractedTextButton: document.querySelector("#resetExtractedTextButton"),
  saveDialog: document.querySelector("#saveDialog"),
  saveForm: document.querySelector("#saveForm"),
  closeSaveDialogButton: document.querySelector("#closeSaveDialogButton"),
  cancelSaveButton: document.querySelector("#cancelSaveButton"),
  saveScopeInputs: Array.from(document.querySelectorAll("input[name=saveScope]")),
  savePageRangeControl: document.querySelector("#savePageRangeControl"),
  savePageRangeInput: document.querySelector("#savePageRangeInput"),
  savePageRangeError: document.querySelector("#savePageRangeError"),
  savePageRangeSummary: document.querySelector("#savePageRangeSummary"),
  confirmSaveButton: document.querySelector("#confirmSaveButton"),
  viewerArea: document.querySelector("#viewerArea"),
  pdfPages: document.querySelector("#pdfPages"),
  pageScrubber: document.querySelector("#pageScrubber"),
  pageScrubberLabel: document.querySelector("#pageScrubberLabel"),
  pageScrubberRange: document.querySelector("#pageScrubberRange"),
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
let pageRectCache = null;
let pageObserver = null;
let pageRenderQueue = new Set();
let pageRenderWorkers = 0;
let currentPageNumber = 0;
let currentPageUpdateFrame = 0;
let pageScrubberHideTimer = 0;
let pageScrubberFrame = 0;
let pendingScrubberPage = 0;
let noticeTimer = 0;
let dragDepth = 0;
let sourceLoadGeneration = 0;
let currentDisplayName = "document.pdf";
let annotationTool = "select";
let annotationColor = "#ff5f56";
let annotationThickness = 3;
let annotationText = "Text";
let annotationMode = false;
let annotationRecords = new Map();
let annotationHistory = [];
let annotationRedo = [];
let selectedAnnotationId = "";
let pageAnnotationData = new Map();
let drawingSession = null;
let penSession = null;
let pointerInteraction = null;
let latestTextSelection = "";
let extractionBaseline = "";
let isExporting = false;

const PAGE_SCRUBBER_IDLE_DELAY = 1800;

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

function getTotalPageCount() {
  return pdfDocument?.numPages || 0;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const TEXT_TOOL = "text";
const DRAWING_TOOLS = new Set(ANNOTATION_KINDS.filter((kind) => kind !== TEXT_TOOL));
const DEFAULT_TEXT_FONT_SIZE = 18;

function isAnnotationPoint(value) {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]));
}

function normalizeAnnotationPaths(paths) {
  const rawPaths = Array.isArray(paths) ? paths : [];
  const pathList = rawPaths.length && rawPaths.every(isAnnotationPoint)
    ? [rawPaths]
    : rawPaths;
  return pathList
    .filter(Array.isArray)
    .map((path) => path
      .filter(isAnnotationPoint)
      .map((point) => [Number(point[0]), Number(point[1])]))
    .filter((path) => path.length >= 2);
}

function cloneAnnotation(annotation) {
  if (!annotation) return annotation;
  const clone = { ...annotation };
  if (annotation.paths) clone.paths = normalizeAnnotationPaths(annotation.paths);
  if (annotation.start) clone.start = [...annotation.start];
  if (annotation.end) clone.end = [...annotation.end];
  if (annotation.bounds) clone.bounds = [...annotation.bounds];
  return clone;
}

function cloneAnnotationMap(map) {
  return new Map(Array.from(map.entries(), ([id, annotation]) => [id, cloneAnnotation(annotation)]));
}

function annotationMapSignature(map) {
  return JSON.stringify(Array.from(map.entries()).sort(([first], [second]) => first.localeCompare(second)));
}

function newAnnotationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `annotation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function activeAnnotationsForPage(pageNumber) {
  return Array.from(annotationRecords.values())
    .filter((annotation) => Number(annotation.pageNumber) === Number(pageNumber) && !annotation.deleted);
}

function setSelectedAnnotation(id) {
  const nextId = id && annotationRecords.get(id) && !annotationRecords.get(id).deleted ? id : "";
  const previous = annotationRecords.get(selectedAnnotationId);
  selectedAnnotationId = nextId;
  const next = annotationRecords.get(selectedAnnotationId);
  if (previous?.pageNumber) renderPageAnnotationsForPage(previous.pageNumber);
  if (next?.pageNumber && next.pageNumber !== previous?.pageNumber) renderPageAnnotationsForPage(next.pageNumber);
  updateAnnotationControls();
}

function applyAnnotationMap(nextMap) {
  const affectedPages = new Set();
  for (const annotation of annotationRecords.values()) affectedPages.add(annotation.pageNumber);
  for (const annotation of nextMap.values()) affectedPages.add(annotation.pageNumber);
  annotationRecords = nextMap;
  if (selectedAnnotationId && annotationRecords.get(selectedAnnotationId)?.deleted) selectedAnnotationId = "";
  for (const pageNumber of affectedPages) renderPageAnnotationsForPage(pageNumber);
  updateAnnotationControls();
}

function commitAnnotationMap(before, nextMap) {
  if (annotationMapSignature(before) === annotationMapSignature(nextMap)) return false;
  annotationHistory.push({ before: cloneAnnotationMap(before), after: cloneAnnotationMap(nextMap) });
  annotationRedo = [];
  applyAnnotationMap(nextMap);
  return true;
}

function undoAnnotation() {
  const change = annotationHistory.pop();
  if (!change) return;
  annotationRedo.push(change);
  applyAnnotationMap(cloneAnnotationMap(change.before));
  showNotice("Annotation change undone.");
}

function redoAnnotation() {
  const change = annotationRedo.pop();
  if (!change) return;
  annotationHistory.push(change);
  applyAnnotationMap(cloneAnnotationMap(change.after));
  showNotice("Annotation change redone.");
}

function translateAnnotation(annotation, dx, dy) {
  const translated = cloneAnnotation(annotation);
  const movePoint = (point) => [point[0] + dx, point[1] + dy];
  if (translated.paths) translated.paths = translated.paths.map((path) => path.map(movePoint));
  if (translated.start) translated.start = movePoint(translated.start);
  if (translated.end) translated.end = movePoint(translated.end);
  if (translated.bounds) translated.bounds = [
    translated.bounds[0] + dx,
    translated.bounds[1] + dy,
    translated.bounds[2] + dx,
    translated.bounds[3] + dy
  ];
  return translated;
}

function pointDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function normalizeDrawBounds(first, second) {
  return [
    Math.min(first[0], second[0]),
    Math.min(first[1], second[1]),
    Math.max(first[0], second[0]),
    Math.max(first[1], second[1])
  ];
}

function pendingPenPreview() {
  if (!penSession) return null;
  const paths = [...penSession.paths];
  if (drawingSession?.kind === "pen" && drawingSession.pageNumber === penSession.pageNumber) {
    paths.push(drawingSession.points);
  }
  const normalizedPaths = normalizeAnnotationPaths(paths);
  if (!normalizedPaths.length) return null;
  return {
    id: "__pen-session__",
    pageNumber: penSession.pageNumber,
    kind: "pen",
    color: penSession.color,
    thickness: penSession.thickness,
    fillOpacity: ANNOTATION_FILL_OPACITY,
    paths: normalizedPaths
  };
}

function getDrawingPreview() {
  if (penSession) return pendingPenPreview();
  if (!drawingSession) return null;
  const { kind, pageNumber, start, currentPoint, points } = drawingSession;
  const end = currentPoint || start;
  const base = {
    id: "__drawing-preview__",
    pageNumber,
    kind,
    color: annotationColor,
    thickness: annotationThickness,
    fillOpacity: ANNOTATION_FILL_OPACITY
  };
  if (kind === "line" || kind === "arrow") return { ...base, start, end };
  return { ...base, bounds: normalizeDrawBounds(start, end) };
}

function finishPendingPen() {
  if (drawingSession?.kind === "pen") finishDrawing();
  if (!penSession) {
    updateAnnotationControls();
    return false;
  }

  const session = penSession;
  penSession = null;
  const paths = normalizeAnnotationPaths(session.paths);
  if (!paths.length) {
    renderPageAnnotationsForPage(session.pageNumber);
    updateAnnotationControls();
    return false;
  }

  const annotation = {
    id: newAnnotationId(),
    pageNumber: session.pageNumber,
    kind: "pen",
    color: session.color,
    thickness: session.thickness,
    fillOpacity: ANNOTATION_FILL_OPACITY,
    paths,
    deleted: false
  };
  const before = cloneAnnotationMap(annotationRecords);
  const next = cloneAnnotationMap(annotationRecords);
  next.set(annotation.id, annotation);
  commitAnnotationMap(before, next);
  updateAnnotationControls();
  return true;
}

function finishPenAndSelect() {
  if (finishPendingPen()) setAnnotationTool("select");
}

function finishDrawing() {
  if (!drawingSession) return;
  const { kind, pageNumber, start, currentPoint, points } = drawingSession;
  const end = currentPoint || start;
  drawingSession = null;
  const hasEnoughPoints = kind === "pen"
    ? points.length >= 2 && points.some((point) => pointDistance(point, points[0]) >= 1)
    : pointDistance(start, end) >= 2;
  if (!hasEnoughPoints) {
    renderPageAnnotationsForPage(pageNumber);
    return;
  }

  const annotation = {
    id: newAnnotationId(),
    pageNumber,
    kind,
    color: annotationColor,
    thickness: annotationThickness,
    fillOpacity: ANNOTATION_FILL_OPACITY,
    deleted: false
  };
  if (kind === "pen") {
    if (!penSession || penSession.pageNumber !== pageNumber) {
      penSession = {
        pageNumber,
        color: annotationColor,
        thickness: annotationThickness,
        paths: []
      };
    }
    penSession.paths.push(points.map((point) => [...point]));
    renderPageAnnotationsForPage(pageNumber);
    updateAnnotationControls();
    return;
  }
  if (kind === "line" || kind === "arrow") {
    annotation.start = [...start];
    annotation.end = [...end];
  } else annotation.bounds = normalizeDrawBounds(start, end);

  const before = cloneAnnotationMap(annotationRecords);
  const next = cloneAnnotationMap(annotationRecords);
  next.set(annotation.id, annotation);
  commitAnnotationMap(before, next);
  setAnnotationTool("select");
  setSelectedAnnotation(annotation.id);
}

function handleDeleteSelectedAnnotation() {
  const selected = annotationRecords.get(selectedAnnotationId);
  if (!selected) return;
  const before = cloneAnnotationMap(annotationRecords);
  const next = cloneAnnotationMap(annotationRecords);
  if (selected.sourceMarker) next.set(selected.id, { ...next.get(selected.id), deleted: true });
  else next.delete(selected.id);
  commitAnnotationMap(before, next);
  selectedAnnotationId = "";
  updateAnnotationControls();
}

function updateSelectedAnnotationStyle(property, value) {
  if (property === "color") annotationColor = normalizeHexColor(value, annotationColor);
  if (property === "thickness") annotationThickness = clamp(Number(value), 1, 12);
  const selected = annotationRecords.get(selectedAnnotationId);
  if (!selected) {
    updateAnnotationControls();
    return;
  }
  const before = cloneAnnotationMap(annotationRecords);
  const next = cloneAnnotationMap(annotationRecords);
  next.set(selected.id, {
    ...next.get(selected.id),
    [property]: property === "color"
      ? normalizeHexColor(value, selected.color)
      : clamp(Number(value), 1, 12)
  });
  commitAnnotationMap(before, next);
}

function updateSelectedAnnotationText(value) {
  annotationText = String(value ?? "");
  const selected = annotationRecords.get(selectedAnnotationId);
  if (!selected || selected.kind !== TEXT_TOOL) {
    updateAnnotationControls();
    return;
  }
  const before = cloneAnnotationMap(annotationRecords);
  const next = cloneAnnotationMap(annotationRecords);
  next.set(selected.id, { ...next.get(selected.id), text: annotationText });
  commitAnnotationMap(before, next);
}

function createTextAnnotation(pageNumber, point) {
  const text = annotationText.trim();
  if (!text) {
    showNotice("Type the text to place, then click the page.");
    elements.annotationTextInput?.focus();
    return;
  }

  const fontSize = DEFAULT_TEXT_FONT_SIZE;
  const width = Math.max(fontSize * 0.8, text.length * fontSize * 0.58);
  const annotation = {
    id: newAnnotationId(),
    pageNumber,
    kind: TEXT_TOOL,
    color: annotationColor,
    thickness: annotationThickness,
    fontSize,
    text,
    bounds: [point[0], point[1], point[0] + width, point[1] + fontSize],
    fillOpacity: ANNOTATION_FILL_OPACITY,
    deleted: false
  };
  const before = cloneAnnotationMap(annotationRecords);
  const next = cloneAnnotationMap(annotationRecords);
  next.set(annotation.id, annotation);
  commitAnnotationMap(before, next);
  setAnnotationTool("select");
  setSelectedAnnotation(annotation.id);
}

function getHandlePoints(bounds) {
  const [minX, minY, maxX, maxY] = bounds;
  return [
    { name: "nw", point: [minX, maxY] },
    { name: "ne", point: [maxX, maxY] },
    { name: "se", point: [maxX, minY] },
    { name: "sw", point: [minX, minY] }
  ];
}

function oppositeHandlePoint(bounds, handle) {
  const [minX, minY, maxX, maxY] = bounds;
  return {
    nw: [maxX, minY],
    ne: [minX, minY],
    se: [minX, maxY],
    sw: [maxX, maxY]
  }[handle] || [minX, minY];
}

function resizeAnnotation(annotation, handle, point, originalBounds) {
  const anchor = oppositeHandlePoint(originalBounds, handle);
  let nextBounds = normalizeDrawBounds(anchor, point);
  if (nextBounds[2] - nextBounds[0] < 2) {
    nextBounds[2] = nextBounds[0] + 2;
  }
  if (nextBounds[3] - nextBounds[1] < 2) {
    nextBounds[3] = nextBounds[1] + 2;
  }
  return scaleAnnotationGeometry(annotation, originalBounds, nextBounds);
}

function entryForPage(pageNumber) {
  return pageEntries[Number(pageNumber) - 1];
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function viewportPoint(viewport, point) {
  return viewport.convertToViewportPoint(point[0], point[1]);
}

function viewportPoints(viewport, points) {
  return points.map((point) => viewportPoint(viewport, point));
}

function svgPointList(points) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function ellipsePoints(bounds, segments = 48) {
  const [minX, minY, maxX, maxY] = bounds;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusX = Math.max(0.001, (maxX - minX) / 2);
  const radiusY = Math.max(0.001, (maxY - minY) / 2);
  return Array.from({ length: segments }, (_value, index) => {
    const angle = (Math.PI * 2 * index) / segments;
    return [centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY];
  });
}

function annotationStrokeWidth(annotation, viewport) {
  return Math.max(1, Number(annotation.thickness || 2) * Number(viewport.scale || 1));
}

function appendLineArrow(group, annotation, viewport, preview = false) {
  const [startX, startY] = viewportPoint(viewport, annotation.start);
  const [endX, endY] = viewportPoint(viewport, annotation.end);
  const width = annotationStrokeWidth(annotation, viewport);
  const attributes = {
    x1: startX,
    y1: startY,
    x2: endX,
    y2: endY,
    stroke: annotation.color,
    "stroke-width": width,
    "stroke-linecap": "round",
    class: `${preview ? "annotation-preview" : "annotation-stroke"}`
  };
  group.append(createSvgElement("line", attributes));
  if (annotation.kind === "arrow") {
    const length = Math.hypot(endX - startX, endY - startY);
    if (length > 0.1) {
      const size = Math.min(length * 0.45, Math.max(10, width * 4 + 5));
      const ux = (endX - startX) / length;
      const uy = (endY - startY) / length;
      const px = -uy;
      const py = ux;
      const baseX = endX - ux * size;
      const baseY = endY - uy * size;
      const wing = size * 0.45;
      for (const sign of [-1, 1]) {
        group.append(createSvgElement("line", {
          x1: endX,
          y1: endY,
          x2: baseX + px * wing * sign,
          y2: baseY + py * wing * sign,
          stroke: annotation.color,
          "stroke-width": width,
          "stroke-linecap": "round",
          class: `${preview ? "annotation-preview" : "annotation-stroke"}`
        }));
      }
    }
  }
}

function renderSvgAnnotation(overlay, annotation, viewport, { selected = false, preview = false } = {}) {
  const group = createSvgElement("g", {
    class: `annotation-item${selected ? " selected" : ""}${preview ? " annotation-preview-group" : ""}`,
    "data-annotation-id": annotation.id
  });
  const strokeWidth = annotationStrokeWidth(annotation, viewport);
  if (annotation.kind === TEXT_TOOL) {
    const bounds = getAnnotationBounds(annotation);
    const fontSize = Math.max(6, Number(annotation.fontSize) || DEFAULT_TEXT_FONT_SIZE);
    const [baselineX, baselineY] = viewportPoint(viewport, [bounds[0], bounds[1]]);
    const rotation = Number(viewport.rotation || 0);
    const textElement = createSvgElement("text", {
      x: baselineX,
      y: baselineY,
      transform: `rotate(${rotation} ${baselineX} ${baselineY})`,
      fill: annotation.color,
      "font-size": fontSize * Number(viewport.scale || 1),
      "font-family": "Arial, Helvetica, sans-serif",
      "dominant-baseline": "alphabetic",
      class: preview ? "annotation-preview" : "annotation-stroke"
    });
    textElement.textContent = String(annotation.text || "");
    group.append(textElement);
    if (!preview) {
      const hitPoints = viewportPoints(viewport, [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[1]],
        [bounds[2], bounds[3]],
        [bounds[0], bounds[3]]
      ]);
      group.append(createSvgElement("polygon", {
        points: svgPointList(hitPoints),
        fill: "transparent",
        stroke: "transparent",
        "stroke-width": Math.max(14, fontSize * Number(viewport.scale || 1)),
        class: "annotation-hit-area"
      }));
    }
  } else if (annotation.kind === "pen") {
    for (const path of normalizeAnnotationPaths(annotation.paths)) {
      const points = svgPointList(viewportPoints(viewport, path));
      group.append(createSvgElement("polyline", {
        points,
        fill: "none",
        stroke: annotation.color,
        "stroke-width": preview ? strokeWidth : strokeWidth,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: preview ? "annotation-preview" : "annotation-stroke"
      }));
      if (!preview) {
        group.append(createSvgElement("polyline", {
          points,
          fill: "none",
          stroke: "transparent",
          "stroke-width": Math.max(14, strokeWidth + 10),
          class: "annotation-hit-area"
        }));
      }
    }
  } else if (annotation.kind === "line" || annotation.kind === "arrow") {
    if (!preview) {
      const [startX, startY] = viewportPoint(viewport, annotation.start);
      const [endX, endY] = viewportPoint(viewport, annotation.end);
      group.append(createSvgElement("line", {
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        stroke: "transparent",
        "stroke-width": Math.max(14, strokeWidth + 10),
        class: "annotation-hit-area"
      }));
    }
    appendLineArrow(group, annotation, viewport, preview);
  } else {
    const bounds = getAnnotationBounds(annotation);
    const points = viewportPoints(
      viewport,
      annotation.kind === "ellipse"
        ? ellipsePoints(bounds)
        : [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]]]
    );
    const shape = createSvgElement("polygon", {
      points: svgPointList(points),
      fill: annotation.color,
      "fill-opacity": annotation.fillOpacity ?? ANNOTATION_FILL_OPACITY,
      stroke: annotation.color,
      "stroke-width": strokeWidth,
      "stroke-linejoin": "round",
      class: preview ? "annotation-preview" : "annotation-stroke"
    });
    group.append(shape);
    if (!preview) {
      group.append(createSvgElement("polygon", {
        points: svgPointList(points),
        fill: "transparent",
        stroke: "transparent",
        "stroke-width": Math.max(14, strokeWidth + 10),
        class: "annotation-hit-area"
      }));
    }
  }

  if (!preview && selected) {
    for (const handle of getHandlePoints(getAnnotationBounds(annotation))) {
      const [x, y] = viewportPoint(viewport, handle.point);
      group.append(createSvgElement("circle", {
        cx: x,
        cy: y,
        r: 5,
        class: "annotation-handle",
        "data-annotation-id": annotation.id,
        "data-handle": handle.name
      }));
    }
  }
  overlay.append(group);
}

function renderPageAnnotations(entry) {
  if (!entry?.rendered || !entry.displayViewport) return;
  entry.pageElement.querySelector(".annotation-overlay")?.remove();
  const viewport = entry.displayViewport;
  const overlay = createSvgElement("svg", {
    class: "annotation-overlay",
    viewBox: `0 0 ${viewport.width} ${viewport.height}`,
    "aria-label": `Editable annotations for page ${entry.pageNumber}`,
    "data-page-number": entry.pageNumber,
    "data-tool": annotationTool
  });
  overlay.classList.toggle("interactive", annotationMode);
  overlay.addEventListener("pointerdown", handleAnnotationPointerDown);
  for (const annotation of activeAnnotationsForPage(entry.pageNumber)) {
    renderSvgAnnotation(overlay, annotation, viewport, {
      selected: annotationTool === "select" && annotation.id === selectedAnnotationId
    });
  }
  const preview = getDrawingPreview();
  if (preview?.pageNumber === entry.pageNumber) renderSvgAnnotation(overlay, preview, viewport, { preview: true });
  entry.pageElement.append(overlay);
}

function renderPageAnnotationsForPage(pageNumber) {
  const entry = entryForPage(pageNumber);
  if (entry) renderPageAnnotations(entry);
}

function renderAllPageAnnotations() {
  for (const entry of pageEntries) renderPageAnnotations(entry);
}

function updateAnnotationControls() {
  const hasDocument = Boolean(pdfDocument);
  if (elements.annotationButton) elements.annotationButton.disabled = !hasDocument;
  if (elements.savePdfButton) elements.savePdfButton.disabled = !hasDocument || isExporting;
  if (elements.extractTextButton) elements.extractTextButton.disabled = !hasDocument;
  if (elements.annotationFinishButton) elements.annotationFinishButton.disabled = !penSession?.paths?.length || isExporting;
  if (elements.annotationUndoButton) elements.annotationUndoButton.disabled = !annotationHistory.length || isExporting;
  if (elements.annotationRedoButton) elements.annotationRedoButton.disabled = !annotationRedo.length || isExporting;
  const selected = annotationRecords.get(selectedAnnotationId);
  if (elements.annotationDeleteButton) elements.annotationDeleteButton.disabled = !selected || isExporting;
  if (elements.annotationColorInput) elements.annotationColorInput.value = normalizeHexColor(selected?.color, annotationColor);
  if (elements.annotationThicknessRange) elements.annotationThicknessRange.value = String(Math.round(selected?.thickness || annotationThickness));
  if (elements.annotationThicknessOutput) elements.annotationThicknessOutput.value = `${Math.round(selected?.thickness || annotationThickness)} pt`;
  if (elements.annotationTextInput) {
    if (selected?.kind === TEXT_TOOL) annotationText = String(selected.text || "");
    elements.annotationTextInput.value = annotationText;
    elements.annotationTextInput.disabled = !hasDocument;
  }
  if (elements.annotationStatus) {
    elements.annotationStatus.textContent = selected
      ? `${selected.kind[0].toUpperCase()}${selected.kind.slice(1)} selected on page ${selected.pageNumber}.`
      : annotationTool === "pen" && penSession?.paths?.length
        ? `Pen writing in progress: ${penSession.paths.length} stroke${penSession.paths.length === 1 ? "" : "s"}. Click Finish pen when the letter is complete.`
      : annotationTool === TEXT_TOOL
        ? "Type text, then click on a page to place it."
      : annotationMode
        ? "Select a tool, then draw on a page."
        : "Select a tool, then draw on a page.";
  }
  for (const button of elements.annotationToolButtons || []) {
    const active = button.dataset.annotationTool === annotationTool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  updateExtractionButtons();
}

function setAnnotationTool(tool) {
  if (!DRAWING_TOOLS.has(tool) && tool !== "select" && tool !== TEXT_TOOL) return;
  if (annotationTool === "pen" && tool !== "pen" && penSession) finishPendingPen();
  annotationTool = tool;
  if (tool !== "select") setSelectedAnnotation("");
  renderAllPageAnnotations();
  updateAnnotationControls();
}

function setAnnotationMode(open) {
  if (!open && penSession) finishPendingPen();
  annotationMode = Boolean(open && pdfDocument);
  elements.annotationPanel.hidden = !annotationMode;
  if (!annotationMode) {
    drawingSession = null;
    pointerInteraction = null;
  }
  if (annotationMode) {
    elements.extractPanel.hidden = true;
    setAnnotationTool("select");
  }
  renderAllPageAnnotations();
  updateAnnotationControls();
}

function eventPointOnPage(event, entry) {
  if (!entry?.displayViewport) return [0, 0];
  const rect = entry.pageElement.getBoundingClientRect();
  const viewportX = clamp(event.clientX - rect.left, 0, entry.displayViewport.width);
  const viewportY = clamp(event.clientY - rect.top, 0, entry.displayViewport.height);
  return entry.displayViewport.convertToPdfPoint(viewportX, viewportY);
}

function handleAnnotationPointerDown(event) {
  if (!annotationMode || !pdfDocument) return;
  const overlay = event.currentTarget;
  const pageNumber = Number(overlay.dataset.pageNumber);
  const entry = entryForPage(pageNumber);
  const point = eventPointOnPage(event, entry);
  const target = event.target?.closest?.("[data-annotation-id]");
  const targetId = target?.dataset.annotationId || "";
  const handle = event.target?.closest?.(".annotation-handle")?.dataset.handle || "";
  event.preventDefault();

  if (annotationTool === "select") {
    if (targetId && targetId !== "__drawing-preview__" && annotationRecords.has(targetId)) {
      setSelectedAnnotation(targetId);
      const selected = annotationRecords.get(targetId);
      pointerInteraction = {
        type: handle ? "resize" : "move",
        id: targetId,
        pageNumber,
        startPoint: point,
        originalBounds: getAnnotationBounds(selected),
        handle,
        before: cloneAnnotationMap(annotationRecords),
        overlay
      };
    } else {
      setSelectedAnnotation("");
    }
    return;
  }

  if (annotationTool === TEXT_TOOL) {
    createTextAnnotation(pageNumber, point);
    return;
  }

  if (!DRAWING_TOOLS.has(annotationTool)) return;
  if (annotationTool === "pen") {
    if (penSession && penSession.pageNumber !== pageNumber) finishPendingPen();
    if (!penSession) {
      penSession = {
        pageNumber,
        color: annotationColor,
        thickness: annotationThickness,
        paths: []
      };
    }
  }
  drawingSession = {
    kind: annotationTool,
    pageNumber,
    start: point,
    currentPoint: point,
    points: [point],
    pointerId: event.pointerId,
    overlay
  };
  renderPageAnnotations(entry);
}

function handleAnnotationPointerMove(event) {
  if (drawingSession) {
    if (event.pointerId !== drawingSession.pointerId) return;
    const entry = entryForPage(drawingSession.pageNumber);
    const point = eventPointOnPage(event, entry);
    drawingSession.currentPoint = point;
    if (drawingSession.kind === "pen" && pointDistance(point, drawingSession.points.at(-1)) >= 1) {
      drawingSession.points.push(point);
    }
    renderPageAnnotations(entry);
    return;
  }

  if (!pointerInteraction) return;
  const entry = entryForPage(pointerInteraction.pageNumber);
  const point = eventPointOnPage(event, entry);
  const current = annotationRecords.get(pointerInteraction.id);
  if (!current) return;
  const original = pointerInteraction.before.get(pointerInteraction.id) || current;
  const next = cloneAnnotationMap(annotationRecords);
  const updated = pointerInteraction.type === "resize"
    ? resizeAnnotation(original, pointerInteraction.handle, point, pointerInteraction.originalBounds)
    : translateAnnotation(
      original,
      point[0] - pointerInteraction.startPoint[0],
      point[1] - pointerInteraction.startPoint[1]
    );
  next.set(pointerInteraction.id, updated);
  applyAnnotationMap(next);
}

function handleAnnotationPointerUp(event) {
  if (drawingSession && event.pointerId === drawingSession.pointerId) {
    finishDrawing();
    return;
  }
  if (!pointerInteraction) return;
  const interaction = pointerInteraction;
  pointerInteraction = null;
  const after = cloneAnnotationMap(annotationRecords);
  if (annotationMapSignature(interaction.before) !== annotationMapSignature(after)) {
    annotationHistory.push({ before: interaction.before, after });
    annotationRedo = [];
  }
  updateAnnotationControls();
}

function handleAnnotationPointerCancel(event) {
  if (drawingSession && event.pointerId === drawingSession.pointerId) {
    const pageNumber = drawingSession.pageNumber;
    drawingSession = null;
    renderPageAnnotationsForPage(pageNumber);
  }
  if (pointerInteraction) {
    applyAnnotationMap(cloneAnnotationMap(pointerInteraction.before));
    pointerInteraction = null;
  }
}

function syncPageAnnotations(pageNumber, annotations) {
  pageAnnotationData.set(pageNumber, annotations);
  for (const data of annotations) {
    if (!isAppAnnotationData(data)) continue;
    const record = annotationRecordFromPdfData(data, pageNumber);
    if (!record || annotationRecords.has(record.id)) continue;
    annotationRecords.set(record.id, record);
  }
  updateAnnotationControls();
}

async function ensurePageAnnotationsLoaded(pageNumber, { strict = false } = {}) {
  const page = await getCachedPage(pageNumber);
  try {
    const annotations = await page.getAnnotations({ intent: "display" });
    syncPageAnnotations(pageNumber, annotations);
    return annotations;
  } catch (error) {
    if (strict) throw error;
    if (!pageAnnotationData.has(pageNumber)) {
      pageAnnotationData.set(pageNumber, []);
      showNotice(`Page ${pageNumber} annotations could not be read; the page itself can still render.`);
    }
    return [];
  }
}

async function ensureAnnotationsLoaded(pageNumbers) {
  for (const pageNumber of pageNumbers) await ensurePageAnnotationsLoaded(pageNumber, { strict: true });
}

function resetAnnotationState() {
  annotationMode = false;
  annotationTool = "select";
  annotationRecords = new Map();
  pageAnnotationData = new Map();
  annotationHistory = [];
  annotationRedo = [];
  selectedAnnotationId = "";
  drawingSession = null;
  penSession = null;
  pointerInteraction = null;
  latestTextSelection = "";
  extractionBaseline = "";
  annotationText = "Text";
  elements.annotationPanel.hidden = true;
  elements.extractPanel.hidden = true;
  if (elements.saveDialog.open) elements.saveDialog.close();
  elements.extractedText.value = "";
  updateAnnotationControls();
}

function allPageNumbers() {
  return Array.from({ length: getTotalPageCount() }, (_value, index) => index + 1);
}

function setRangeFeedback(input, errorElement, summaryElement) {
  if (!input || !errorElement || !summaryElement || !pdfDocument) return null;
  const result = parsePageRange(input.value, getTotalPageCount());
  errorElement.textContent = result.error;
  errorElement.hidden = !result.error;
  summaryElement.textContent = result.error
    ? ""
    : `${result.pages.length} page${result.pages.length === 1 ? "" : "s"}: ${formatPageRange(result.pages)}`;
  return result.error ? null : result.pages;
}

function updateSaveRangeVisibility() {
  const selected = elements.saveScopeInputs.find((input) => input.checked)?.value === "selected";
  elements.savePageRangeControl.hidden = !selected;
  if (selected) setRangeFeedback(
    elements.savePageRangeInput,
    elements.savePageRangeError,
    elements.savePageRangeSummary
  );
  else elements.savePageRangeSummary.textContent = `All ${getTotalPageCount()} page${getTotalPageCount() === 1 ? "" : "s"}`;
}

function updateExtractionButtons() {
  const hasText = Boolean(elements.extractedText.value.trim());
  elements.copyExtractedTextButton.disabled = !hasText;
  elements.downloadExtractedTextButton.disabled = !hasText;
  elements.resetExtractedTextButton.disabled = elements.extractedText.value === extractionBaseline;
  elements.extractSelectionButton.disabled = !pdfDocument || !latestTextSelection;
}

function setExtractedText(value, status = "") {
  elements.extractedText.value = value;
  extractionBaseline = value;
  if (status) elements.extractStatus.textContent = status;
  updateExtractionButtons();
}

function openSaveDialog() {
  if (!pdfDocument || isExporting) return;
  setAnnotationMode(false);
  const range = formatPageRange(allPageNumbers());
  elements.savePageRangeInput.value = range;
  elements.saveScopeInputs.forEach((input) => { input.checked = input.value === "whole"; });
  updateSaveRangeVisibility();
  if (typeof elements.saveDialog.showModal === "function") elements.saveDialog.showModal();
  else elements.saveDialog.hidden = false;
}

function closeSaveDialog() {
  if (typeof elements.saveDialog.close === "function" && elements.saveDialog.open) elements.saveDialog.close();
  else elements.saveDialog.hidden = true;
}

function safeFileStem(fileName) {
  const raw = String(fileName || "document.pdf").split(/[\\/]/).pop() || "document.pdf";
  return raw.replace(/\.pdf$/i, "") || "document";
}

function downloadBytes(bytes, fileName, mimeType) {
  const blob = new Blob([bytes], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function editedPdfFileName(scope, pages) {
  const stem = safeFileStem(currentDisplayName);
  const suffix = scope === "whole"
    ? "edited"
    : `pages-${formatPageRange(pages).replace(/,/g, "-")}-edited`;
  return `${stem}-${suffix}.pdf`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
}

async function savePdf() {
  if (!pdfDocument || isExporting) return;
  const scope = elements.saveScopeInputs.find((input) => input.checked)?.value || "whole";
  let pages = allPageNumbers();
  if (scope === "selected") {
    pages = setRangeFeedback(
      elements.savePageRangeInput,
      elements.savePageRangeError,
      elements.savePageRangeSummary
    );
    if (!pages) return;
  }

  isExporting = true;
  updateAnnotationControls();
  elements.confirmSaveButton.disabled = true;
  try {
    await ensureAnnotationsLoaded(pages);
    const sourceBytes = await pdfDocument.getData();
    const outputBytes = await exportAnnotatedPdf({
      sourceBytes,
      selectedPageNumbers: scope === "whole" ? null : pages,
      annotations: Array.from(annotationRecords.values())
    });
    downloadBytes(outputBytes, editedPdfFileName(scope, pages), "application/pdf");
    closeSaveDialog();
    showNotice(scope === "whole"
      ? "Saved an editable copy of the whole PDF."
      : `Saved an editable PDF with pages ${formatPageRange(pages)}.`);
  } catch (error) {
    const detail = error?.message || "Unknown error";
    showNotice(`Could not save this PDF. It may be encrypted or unsupported: ${detail}`, 9000);
  } finally {
    isExporting = false;
    elements.confirmSaveButton.disabled = false;
    updateAnnotationControls();
  }
}

function openExtractPanel() {
  if (!pdfDocument) return;
  setAnnotationMode(false);
  elements.extractPanel.hidden = false;
  if (!elements.extractPageRangeInput.value) elements.extractPageRangeInput.value = formatPageRange(allPageNumbers());
  setRangeFeedback(
    elements.extractPageRangeInput,
    elements.extractPageRangeError,
    elements.extractPageRangeSummary
  );
  updateExtractionButtons();
}

function closeExtractPanel() {
  elements.extractPanel.hidden = true;
}

async function extractTextFromRange() {
  if (!pdfDocument) return;
  const pages = setRangeFeedback(
    elements.extractPageRangeInput,
    elements.extractPageRangeError,
    elements.extractPageRangeSummary
  );
  if (!pages) return;

  elements.extractRangeButton.disabled = true;
  elements.extractSelectionButton.disabled = true;
  elements.extractStatus.textContent = `Reading ${pages.length} page${pages.length === 1 ? "" : "s"}…`;
  try {
    const chunks = [];
    for (const pageNumber of pages) {
      const page = await getCachedPage(pageNumber);
      const content = await page.getTextContent();
      const text = textContentToPlainText(content);
      if (text) chunks.push(`Page ${pageNumber}\n${text}`);
    }
    const extracted = chunks.join("\n\n");
    if (!extracted) {
      setExtractedText("", "No embedded text found in the selected pages.");
      showNotice("No embedded text was found. This PDF may be scanned and require OCR.");
    } else {
      setExtractedText(extracted, `Extracted text from ${formatPageRange(pages)}.`);
    }
  } catch (error) {
    elements.extractStatus.textContent = "Text extraction failed.";
    showNotice(`Could not extract text from this PDF: ${error?.message || "Unknown error"}`, 9000);
  } finally {
    elements.extractRangeButton.disabled = false;
    updateExtractionButtons();
  }
}

function extractLatestSelection() {
  if (!latestTextSelection) {
    showNotice("Drag across selectable PDF text first, then choose Use selected text.");
    return;
  }
  setExtractedText(latestTextSelection, "Loaded the latest browser text selection. You can edit it here.");
}

async function copyExtractedText() {
  const text = elements.extractedText.value;
  if (!text.trim()) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error("Clipboard API unavailable");
    showNotice("Extracted text copied.");
  } catch (_error) {
    elements.extractedText.focus();
    elements.extractedText.select();
    const copied = document.execCommand?.("copy");
    if (copied) showNotice("Extracted text copied.");
    else showNotice("Copy was blocked. Select the text and copy it manually.");
  }
}

function downloadExtractedText() {
  const text = elements.extractedText.value;
  if (!text.trim()) return;
  downloadBytes(new TextEncoder().encode(text), `${safeFileStem(currentDisplayName)}-extracted.txt`, "text/plain;charset=utf-8");
  showNotice("Extracted text downloaded.");
}

function updatePageNavigation() {
  const totalPages = getTotalPageCount();
  const hasDocument = totalPages > 0;
  const pageNumber = hasDocument
    ? normalizePageNumber(currentPageNumber || 1, totalPages, 1)
    : 0;

  if (hasDocument) currentPageNumber = pageNumber;
  elements.pageNavigation.hidden = !hasDocument;
  elements.pageNavigation.setAttribute("aria-label", hasDocument
    ? `Page navigation, page ${pageNumber} of ${totalPages}`
    : "Page navigation");
  elements.currentPageInput.disabled = !hasDocument;
  elements.currentPageInput.value = hasDocument && document.activeElement !== elements.currentPageInput
    ? String(pageNumber)
    : hasDocument
      ? elements.currentPageInput.value
      : "";
  elements.pageTotalOutput.textContent = hasDocument ? String(totalPages) : "—";

  elements.pageFirstButton.disabled = !hasDocument || pageNumber <= 1;
  elements.pagePreviousButton.disabled = !hasDocument || pageNumber <= 1;
  elements.pageNextButton.disabled = !hasDocument || pageNumber >= totalPages;
  elements.pageLastButton.disabled = !hasDocument || pageNumber >= totalPages;

  elements.pageScrubber.hidden = !hasDocument;
  elements.pageScrubberRange.disabled = !hasDocument;
  elements.pageScrubberRange.max = String(Math.max(1, totalPages));
  elements.pageScrubberRange.value = String(hasDocument ? pageNumber : 1);
  elements.pageScrubberRange.setAttribute(
    "aria-valuetext",
    hasDocument ? `Page ${pageNumber} of ${totalPages}` : "No PDF open"
  );
  elements.pageScrubberLabel.textContent = hasDocument
    ? `Page ${pageNumber} of ${totalPages}`
    : "Page —";
  updateAnnotationControls();
}

function setCurrentPageNumber(value) {
  const totalPages = getTotalPageCount();
  if (!totalPages) {
    currentPageNumber = 0;
    updatePageNavigation();
    return;
  }

  const nextPageNumber = normalizePageNumber(value, totalPages, currentPageNumber || 1);
  if (currentPageNumber === nextPageNumber) return;
  currentPageNumber = nextPageNumber;
  updatePageNavigation();
}

function getPageRectData() {
  if (pageRectCache) return pageRectCache;
  pageRectCache = pageEntries.map((entry) => ({
    top: entry.pageElement.offsetTop,
    left: entry.pageElement.offsetLeft,
    width: entry.pageElement.offsetWidth,
    height: entry.pageElement.offsetHeight
  }));
  return pageRectCache;
}

function invalidatePageLayout() {
  pageRectCache = null;
}

function updateCurrentPageFromScroll() {
  const detectedPage = getCurrentPageNumber(getPageRectData(), {
    scrollTop: elements.viewerArea.scrollTop,
    height: elements.viewerArea.clientHeight
  });
  if (detectedPage) setCurrentPageNumber(detectedPage);
}

function scheduleCurrentPageUpdate() {
  if (currentPageUpdateFrame) return;
  currentPageUpdateFrame = window.requestAnimationFrame(() => {
    currentPageUpdateFrame = 0;
    updateCurrentPageFromScroll();
  });
}

function hidePageScrubber() {
  if (
    elements.pageScrubber.matches(":hover")
    || elements.pageScrubber.matches(":focus-within")
    || elements.pageScrubber.classList.contains("dragging")
  ) return;
  elements.pageScrubber.classList.remove("revealed");
}

function schedulePageScrubberHide() {
  window.clearTimeout(pageScrubberHideTimer);
  pageScrubberHideTimer = window.setTimeout(hidePageScrubber, PAGE_SCRUBBER_IDLE_DELAY);
}

function revealPageScrubber(keepVisible = false) {
  if (!pdfDocument) return;
  elements.pageScrubber.classList.add("revealed");
  window.clearTimeout(pageScrubberHideTimer);
  if (!keepVisible) schedulePageScrubberHide();
}

function jumpToPage(value, { behavior = "smooth" } = {}) {
  const totalPages = getTotalPageCount();
  if (!totalPages || !pageEntries.length) return;

  const pageNumber = normalizePageNumber(value, totalPages, currentPageNumber || 1);
  const entry = pageEntries[pageNumber - 1];
  if (!entry) return;

  setCurrentPageNumber(pageNumber);
  queuePageRender(entry);

  const pageHeight = entry.pageElement.offsetHeight;
  const viewerRect = elements.viewerArea.getBoundingClientRect();
  const pageRect = entry.pageElement.getBoundingClientRect();
  const pageTop = elements.viewerArea.scrollTop + pageRect.top - viewerRect.top;
  const centeredTop = pageTop - Math.max(0, (elements.viewerArea.clientHeight - pageHeight) / 2);
  const maxScrollTop = Math.max(0, elements.viewerArea.scrollHeight - elements.viewerArea.clientHeight);
  const top = clamp(centeredTop, 0, maxScrollTop);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const scrollBehavior = reducedMotion ? "auto" : behavior;
  if (scrollBehavior === "auto") elements.viewerArea.scrollTop = top;
  else elements.viewerArea.scrollTo({ top, behavior: scrollBehavior });
}

function commitCurrentPageInput({ behavior = "auto" } = {}) {
  if (!pdfDocument) return;
  const pageNumber = normalizePageNumber(
    elements.currentPageInput.value,
    getTotalPageCount(),
    currentPageNumber || 1
  );
  jumpToPage(pageNumber, { behavior });
  elements.currentPageInput.value = String(currentPageNumber);
}

function queueScrubberNavigation() {
  pendingScrubberPage = normalizePageNumber(
    elements.pageScrubberRange.value,
    getTotalPageCount(),
    currentPageNumber || 1
  );
  if (pageScrubberFrame) return;

  pageScrubberFrame = window.requestAnimationFrame(() => {
    pageScrubberFrame = 0;
    const pageNumber = pendingScrubberPage;
    pendingScrubberPage = 0;
    if (pageNumber) jumpToPage(pageNumber, { behavior: "auto" });
  });
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
  updatePageNavigation();
  updateAnnotationControls();
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
  currentPageNumber = 0;
  elements.emptyState.classList.remove("hidden");
  elements.fileAccessState.hidden = true;
  elements.loadingState.hidden = true;
  elements.pdfPages.replaceChildren();
  invalidatePageLayout();
  updatePageNavigation();
}

function showFileAccessState(source) {
  currentPageNumber = 0;
  pendingSource = source;
  elements.urlInput.value = source;
  elements.emptyState.classList.add("hidden");
  elements.loadingState.hidden = true;
  elements.pdfPages.replaceChildren();
  invalidatePageLayout();
  elements.fileAccessState.hidden = false;
  updatePageNavigation();
}

function getPageScale(baseViewport) {
  if (!fitWidth) return zoom;
  const horizontalPadding = window.innerWidth <= 860 ? 32 : 84;
  const availableWidth = Math.max(260, elements.viewerArea.clientWidth - horizontalPadding);
  return clamp(availableWidth / baseViewport.width, MIN_ZOOM, MAX_ZOOM);
}

function captureViewPosition(point) {
  const pageRects = getPageRectData();
  if (!pageRects.length) return null;

  return getPageAnchor(
    pageRects,
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
    entry.pageElement.querySelector(".annotation-overlay")?.remove();
    entry.pageElement.classList.remove("rendered");
    entry.rendered = false;
    entry.displayViewport = null;
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

    const pageAnnotations = await ensurePageAnnotationsLoaded(entry.pageNumber);
    if (generation !== renderGeneration) return;

    const baseViewport = page.getViewport({ scale: 1 });
    pageMetrics.set(entry.pageNumber, {
      width: baseViewport.width,
      height: baseViewport.height
    });
    const displayScale = getPageScale(baseViewport);
    const displayViewport = page.getViewport({ scale: displayScale });
    entry.displayViewport = displayViewport;
    const layoutAnchor = captureViewPosition();
    entry.pageElement.style.setProperty("--total-scale-factor", String(displayScale));
    entry.pageElement.style.width = `${Math.ceil(displayViewport.width)}px`;
    entry.pageElement.style.height = `${Math.ceil(displayViewport.height)}px`;
    invalidatePageLayout();
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
    const suppressedAnnotationIds = [];
    const annotationStorage = pdfDocument?.annotationStorage;
    if (annotationStorage?.setValue) {
      for (const annotation of pageAnnotations) {
        if (!isAppAnnotationData(annotation) || !annotation.id) continue;
        annotationStorage.setValue(annotation.id, { noView: true });
        suppressedAnnotationIds.push(annotation.id);
      }
    }
    const renderParameters = { canvasContext, viewport: renderViewport };
    if (suppressedAnnotationIds.length && pdfjsLib.AnnotationMode?.ENABLE_STORAGE !== undefined) {
      renderParameters.annotationMode = pdfjsLib.AnnotationMode.ENABLE_STORAGE;
    }
    const canvasRenderTask = page.render(renderParameters);
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
      for (const annotationId of suppressedAnnotationIds) annotationStorage?.remove?.(annotationId);
      annotationStorage?.resetModified?.();
    }

    if (generation !== renderGeneration) return;
    entry.rendered = true;
    entry.pageElement.classList.add("rendered");
    renderPageAnnotations(entry);
    pruneRenderedPages(entry);
    scheduleCurrentPageUpdate();
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
        renderPromise: null,
        displayViewport: null
      };
    });

    elements.pdfPages.replaceChildren(...pageEntries.map((entry) => entry.pageElement));
    invalidatePageLayout();
    setCurrentPageNumber(revealPageNumber);
    const revealEntry = pageEntries[revealPageNumber - 1];
    if (viewPosition && revealEntry) restoreViewPosition(viewPosition, revealEntry.pageElement);
    await renderPageEntry(revealEntry, generation);
    if (generation !== renderGeneration) return;
    if (viewPosition) restoreViewPosition(viewPosition, revealEntry.pageElement);
    hideLoading();
    if (pendingZoomAnchor === viewPosition) pendingZoomAnchor = null;

    observeVisiblePages();
    scheduleCurrentPageUpdate();
  } catch (error) {
    if (generation !== renderGeneration) return;
    pendingZoomAnchor = null;
    hideLoading();
    showNotice(`PDF rendering failed: ${error.message || "Unknown error"}`, 9000);
  }
}

function createPdfLoadingTask(source) {
  return pdfjsLib.getDocument({
    ...source,
    cMapUrl: assetUrl("vendor/cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: assetUrl("vendor/standard_fonts/"),
    wasmUrl: assetUrl("vendor/wasm/"),
    isEvalSupported: false,
    enableScripting: false,
    withCredentials: false,
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: PDF_RANGE_CHUNK_SIZE
  });
}

async function openPdfSource(
  source,
  displayName,
  originalSource,
  loadingMessage,
  loadGeneration
) {
  if (loadGeneration !== sourceLoadGeneration) return;

  renderGeneration += 1;
  cancelActivePageRenders();
  resetAnnotationState();
  pageCache = new Map();
  pageMetrics = new Map();
  pageEntries = [];
  invalidatePageLayout();
  currentPageNumber = 0;
  pendingZoomAnchor = null;
  if (currentLoadingTask) {
    await currentLoadingTask.destroy();
    currentLoadingTask = null;
    pdfDocument = null;
  }
  if (loadGeneration !== sourceLoadGeneration) return;

  updatePageNavigation();

  currentSource = originalSource;
  currentDisplayName = displayName || "document.pdf";
  elements.originalButton.disabled = !originalSource;
  document.title = `${displayName} — Dark PDF`;
  showLoading(loadingMessage);

  try {
    const loadingTask = currentLoadingTask = createPdfLoadingTask(source);
    currentLoadingTask.onPassword = (updatePassword, reason) => {
      const firstAttempt = reason === pdfjsLib.PasswordResponses.NEED_PASSWORD;
      const password = window.prompt(
        firstAttempt ? "This PDF is password protected. Enter its password:" : "Incorrect password. Try again:"
      );
      if (password !== null) updatePassword(password);
    };
    currentLoadingTask.onProgress = ({ loaded, total }) => {
      if (loadGeneration !== sourceLoadGeneration || elements.loadingState.hidden || !total) return;
      elements.loadingText.textContent = `${loadingMessage} ${Math.round((loaded / total) * 100)}%`;
    };
    pdfDocument = await loadingTask.promise;
    if (loadGeneration !== sourceLoadGeneration || loadingTask !== currentLoadingTask) {
      await loadingTask.destroy();
      return;
    }
    await renderDocument();
  } catch (error) {
    if (loadGeneration !== sourceLoadGeneration) return;
    currentLoadingTask = null;
    pdfDocument = null;
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

  const loadGeneration = ++sourceLoadGeneration;
  pendingSource = source;

  if (
    source.startsWith("file:") &&
    typeof chrome !== "undefined" &&
    chrome.extension?.isAllowedFileSchemeAccess &&
    !(await chrome.extension.isAllowedFileSchemeAccess())
  ) {
    if (loadGeneration !== sourceLoadGeneration) return;
    showFileAccessState(source);
    return;
  }

  if (loadGeneration !== sourceLoadGeneration) return;
  showLoading("Opening PDF…");
  elements.urlInput.value = source;
  await openPdfSource(
    { url: source },
    fileNameFromUrl(source),
    source,
    "Opening PDF…",
    loadGeneration
  );
}

async function loadLocalFile(file) {
  if (!file) return;
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    showNotice("That file does not look like a PDF.");
    return;
  }

  const loadGeneration = ++sourceLoadGeneration;
  showLoading("Reading the first PDF range…");
  try {
    const range = await createLocalPdfRangeTransport(pdfjsLib, file, PDF_RANGE_CHUNK_SIZE);
    if (loadGeneration !== sourceLoadGeneration) {
      range.abort();
      return;
    }
    await openPdfSource(
      { range },
      file.name,
      "",
      "Reading PDF…",
      loadGeneration
    );
    if (loadGeneration !== sourceLoadGeneration) return;
    elements.urlInput.value = file.name;
  } catch (error) {
    if (loadGeneration !== sourceLoadGeneration) return;
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

elements.pageFirstButton.addEventListener("click", () => jumpToPage(1));
elements.pagePreviousButton.addEventListener("click", () => jumpToPage(currentPageNumber - 1));
elements.pageNextButton.addEventListener("click", () => jumpToPage(currentPageNumber + 1));
elements.pageLastButton.addEventListener("click", () => jumpToPage(getTotalPageCount()));

elements.currentPageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitCurrentPageInput({ behavior: "auto" });
    elements.currentPageInput.select();
  } else if (event.key === "Escape") {
    event.preventDefault();
    elements.currentPageInput.value = String(currentPageNumber || 1);
    elements.currentPageInput.blur();
  }
});

elements.currentPageInput.addEventListener("blur", commitCurrentPageInput);

elements.pageScrubberRange.addEventListener("input", () => {
  revealPageScrubber(true);
  queueScrubberNavigation();
});

elements.pageScrubber.addEventListener("pointerenter", () => revealPageScrubber(true));
elements.pageScrubber.addEventListener("pointerleave", schedulePageScrubberHide);
elements.pageScrubber.addEventListener("focusin", () => revealPageScrubber(true));
elements.pageScrubber.addEventListener("focusout", schedulePageScrubberHide);
elements.pageScrubber.addEventListener("pointerdown", () => {
  elements.pageScrubber.classList.add("dragging");
  revealPageScrubber(true);
});
document.addEventListener("pointerup", () => {
  elements.pageScrubber.classList.remove("dragging");
  schedulePageScrubberHide();
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

elements.annotationButton.addEventListener("click", () => setAnnotationMode(!annotationMode));
elements.closeAnnotationButton.addEventListener("click", () => setAnnotationMode(false));
for (const button of elements.annotationToolButtons) {
  button.addEventListener("click", () => setAnnotationTool(button.dataset.annotationTool));
}
elements.annotationTextInput.addEventListener("input", () => {
  updateSelectedAnnotationText(elements.annotationTextInput.value);
});
elements.annotationColorInput.addEventListener("input", () => {
  updateSelectedAnnotationStyle("color", elements.annotationColorInput.value);
});
elements.annotationThicknessRange.addEventListener("input", () => {
  annotationThickness = clamp(Number(elements.annotationThicknessRange.value), 1, 12);
  elements.annotationThicknessOutput.value = `${annotationThickness} pt`;
});
elements.annotationThicknessRange.addEventListener("change", () => {
  updateSelectedAnnotationStyle("thickness", elements.annotationThicknessRange.value);
});
elements.annotationFinishButton.addEventListener("click", finishPenAndSelect);
elements.annotationUndoButton.addEventListener("click", undoAnnotation);
elements.annotationRedoButton.addEventListener("click", redoAnnotation);
elements.annotationDeleteButton.addEventListener("click", handleDeleteSelectedAnnotation);

elements.savePdfButton.addEventListener("click", openSaveDialog);
elements.closeSaveDialogButton.addEventListener("click", closeSaveDialog);
elements.cancelSaveButton.addEventListener("click", closeSaveDialog);
elements.saveForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void savePdf();
});
for (const input of elements.saveScopeInputs) input.addEventListener("change", updateSaveRangeVisibility);
elements.savePageRangeInput.addEventListener("input", () => {
  setRangeFeedback(elements.savePageRangeInput, elements.savePageRangeError, elements.savePageRangeSummary);
});

elements.extractTextButton.addEventListener("click", () => {
  const isOpen = !elements.extractPanel.hidden;
  if (isOpen) closeExtractPanel();
  else openExtractPanel();
});
elements.closeExtractButton.addEventListener("click", closeExtractPanel);
elements.extractPageRangeInput.addEventListener("input", () => {
  setRangeFeedback(
    elements.extractPageRangeInput,
    elements.extractPageRangeError,
    elements.extractPageRangeSummary
  );
});
elements.extractRangeButton.addEventListener("click", () => void extractTextFromRange());
elements.extractSelectionButton.addEventListener("click", extractLatestSelection);
elements.copyExtractedTextButton.addEventListener("click", () => void copyExtractedText());
elements.downloadExtractedTextButton.addEventListener("click", downloadExtractedText);
elements.resetExtractedTextButton.addEventListener("click", () => {
  elements.extractedText.value = extractionBaseline;
  updateExtractionButtons();
});
elements.extractedText.addEventListener("input", updateExtractionButtons);

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  const selectionText = selection?.toString() || "";
  const selectionNodes = [selection?.anchorNode, selection?.focusNode].filter(Boolean);
  const belongsToTextLayer = selectionNodes.some((node) => {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(element?.closest?.(".textLayer"));
  });
  if (belongsToTextLayer && selectionText.trim()) latestTextSelection = selectionText;
  updateExtractionButtons();
});

document.addEventListener("pointermove", handleAnnotationPointerMove);
document.addEventListener("pointerup", handleAnnotationPointerUp);
document.addEventListener("pointercancel", handleAnnotationPointerCancel);

elements.viewerArea.addEventListener("scroll", () => {
  scheduleCurrentPageUpdate();
  revealPageScrubber();
});

elements.viewerArea.addEventListener("pointermove", (event) => {
  const viewerRect = elements.viewerArea.getBoundingClientRect();
  if (viewerRect.right - event.clientX <= 72) revealPageScrubber();
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

  if (annotationMode && (event.ctrlKey || event.metaKey)) {
    const key = event.key.toLowerCase();
    if (key === "z" || key === "y") {
      event.preventDefault();
      if (key === "y" || event.shiftKey) redoAnnotation();
      else undoAnnotation();
      return;
    }
  }

  if (annotationMode && (event.key === "Delete" || event.key === "Backspace")) {
    event.preventDefault();
    handleDeleteSelectedAnnotation();
    return;
  }

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
