import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
  PDFRef
} from "./vendor/pdf-lib.mjs";
import {
  getAnnotationBounds,
  normalizeHexColor,
  normalizePdfBounds
} from "./viewer-utils.js";

export const ANNOTATION_MARKER_PREFIX = "Dark PDF Viewer";
export const ANNOTATION_FILL_OPACITY = 0.18;
export const ANNOTATION_KINDS = Object.freeze([
  "pen",
  "line",
  "rectangle",
  "ellipse",
  "arrow",
  "text"
]);

const DEFAULT_COLOR = "#ff5f56";
const MIN_THICKNESS = 0.5;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value) {
  return finiteNumber(value).toFixed(3).replace(/\.?(0+)$/, "");
}

function normalizePoint(point) {
  return [finiteNumber(point?.[0]), finiteNumber(point?.[1])];
}

function normalizePaths(paths) {
  const rawPaths = Array.isArray(paths) ? paths : [];
  const isPoint = (value) => Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]));
  const pathList = rawPaths.length && rawPaths.every(isPoint)
    ? [rawPaths]
    : rawPaths;
  return pathList
    .map((path) => (Array.isArray(path) ? path : []).map(normalizePoint))
    .filter((path) => path.length >= 2);
}

function cloneGeometry(annotation) {
  if (annotation.kind === "pen") {
    return { paths: normalizePaths(annotation.paths) };
  }
  if (annotation.kind === "line" || annotation.kind === "arrow") {
    return {
      start: normalizePoint(annotation.start),
      end: normalizePoint(annotation.end)
    };
  }
  if (annotation.kind === "text") {
    return {
      bounds: normalizePdfBounds(annotation.bounds),
      fontSize: Math.max(6, finiteNumber(annotation.fontSize, 18)),
      text: String(annotation.text || "")
    };
  }
  return { bounds: normalizePdfBounds(annotation.bounds) };
}

function geometryPayload(annotation) {
  return encodeURIComponent(JSON.stringify({
    color: normalizeHexColor(annotation.color, DEFAULT_COLOR),
    thickness: Math.max(MIN_THICKNESS, finiteNumber(annotation.thickness, 2)),
    ...cloneGeometry(annotation)
  }));
}

export function getAnnotationMarker(annotation) {
  return `${ANNOTATION_MARKER_PREFIX}|${annotation.id}|${annotation.kind}`;
}

function getAnnotationTitle(annotation) {
  return `${getAnnotationMarker(annotation)}|${geometryPayload(annotation)}`;
}

function parseMarker(value) {
  const text = String(value || "");
  const match = text.match(
    new RegExp(`^${ANNOTATION_MARKER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\|([^|]+)\\|(${ANNOTATION_KINDS.join("|")})(?:\\|(.*))?$`)
  );
  if (!match) return null;

  let payload = null;
  if (match[3]) {
    try {
      payload = JSON.parse(decodeURIComponent(match[3]));
    } catch (_error) {
      payload = null;
    }
  }
  return {
    id: match[1],
    kind: match[2],
    base: `${ANNOTATION_MARKER_PREFIX}|${match[1]}|${match[2]}`,
    payload
  };
}

function resolveObject(context, value) {
  if (value instanceof PDFRef) return context.lookup(value);
  return value;
}

function getDictValue(context, dict, key) {
  if (!(dict instanceof PDFDict)) return undefined;
  return resolveObject(context, dict.get(PDFName.of(key)));
}

function decodePdfString(value) {
  if (value && typeof value.decodeText === "function") return value.decodeText();
  if (typeof value?.str === "string") return value.str;
  return typeof value === "string" ? value : "";
}

function colorToHex(color) {
  if (!Array.isArray(color) && !(color instanceof Uint8Array) && !(color instanceof Uint8ClampedArray)) {
    return DEFAULT_COLOR;
  }
  const channels = Array.from(color).slice(0, 3).map((channel) => Math.round(finiteNumber(channel, 0)));
  if (channels.length < 3) return DEFAULT_COLOR;
  return `#${channels.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0")).join("")}`;
}

function parsePayloadGeometry(marker, data) {
  const payload = marker?.payload;
  if (!payload || typeof payload !== "object") return {};

  if (marker.kind === "pen" && Array.isArray(payload.paths)) {
    return { paths: normalizePaths(payload.paths) };
  }
  if ((marker.kind === "line" || marker.kind === "arrow") && payload.start && payload.end) {
    return { start: normalizePoint(payload.start), end: normalizePoint(payload.end) };
  }
  if ((marker.kind === "rectangle" || marker.kind === "ellipse") && payload.bounds) {
    return { bounds: normalizePdfBounds(payload.bounds) };
  }
  if (marker.kind === "text" && payload.bounds) {
    return {
      bounds: normalizePdfBounds(payload.bounds),
      fontSize: Math.max(6, finiteNumber(payload.fontSize, 18)),
      text: String(payload.text || "")
    };
  }
  return {};
}

function fallbackGeometry(marker, data) {
  const rect = normalizePdfBounds(data?.rect);
  if (marker.kind === "pen") {
    const paths = (data?.inkLists || [])
      .map((path) => {
        const values = Array.from(path || []);
        const points = [];
        for (let index = 0; index + 1 < values.length; index += 2) {
          points.push([finiteNumber(values[index]), finiteNumber(values[index + 1])]);
        }
        return points;
      })
      .filter((path) => path.length >= 2);
    return { paths };
  }

  if (marker.kind === "line" || marker.kind === "arrow") {
    const coordinates = Array.from(data?.lineCoordinates || []);
    if (coordinates.length >= 4) {
      return {
        start: [finiteNumber(coordinates[0]), finiteNumber(coordinates[1])],
        end: [finiteNumber(coordinates[2]), finiteNumber(coordinates[3])]
      };
    }
    return { start: [rect[0], rect[1]], end: [rect[2], rect[3]] };
  }

  return { bounds: rect };
}

export function getAnnotationMarkerFromData(data) {
  const title = decodePdfString(data?.titleObj) || data?.title || data?.author || "";
  return parseMarker(title);
}

export function isAppAnnotationData(data) {
  return Boolean(getAnnotationMarkerFromData(data));
}

export function annotationRecordFromPdfData(data, pageNumber) {
  const marker = getAnnotationMarkerFromData(data);
  if (!marker) return null;

  const subtype = String(data?.subtype || "").toLowerCase();
  const expectedSubtype = {
    pen: "ink",
    line: "line",
    arrow: "line",
    rectangle: "square",
    ellipse: "circle",
    text: "freetext"
  }[marker.kind];
  if (subtype && subtype !== expectedSubtype) return null;

  const payload = marker.payload || {};
  const geometry = parsePayloadGeometry(marker, data);
  const fallback = fallbackGeometry(marker, data);
  const thickness = Math.max(
    MIN_THICKNESS,
    finiteNumber(payload.thickness, finiteNumber(data?.borderStyle?.width, 2))
  );
  const color = normalizeHexColor(payload.color, colorToHex(data?.color));
  const text = marker.kind === "text"
    ? String(payload.text ?? data?.contents ?? "")
    : "";
  const record = {
    id: marker.id,
    pageNumber: Number(pageNumber),
    kind: marker.kind,
    color,
    thickness,
    fillOpacity: ANNOTATION_FILL_OPACITY,
    sourceMarker: marker.base,
    sourceAnnotationId: data?.id || "",
    deleted: false,
    ...(marker.kind === "text" ? {
      text,
      fontSize: Math.max(6, finiteNumber(payload.fontSize, 18))
    } : {}),
    ...(geometry.paths ? { paths: geometry.paths } : {}),
    ...(geometry.start ? { start: geometry.start, end: geometry.end } : {}),
    ...(geometry.bounds ? { bounds: geometry.bounds } : {})
  };

  if (!record.paths && fallback.paths) record.paths = fallback.paths;
  if (!record.start && fallback.start) {
    record.start = fallback.start;
    record.end = fallback.end;
  }
  if (!record.bounds && fallback.bounds) record.bounds = fallback.bounds;
  if (record.kind === "arrow" && !record.start && !record.end) return null;
  return record;
}

function rgbFromHex(value) {
  const hex = normalizeHexColor(value, DEFAULT_COLOR).slice(1);
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255
  ];
}

function pointString(point, bounds) {
  return `${formatNumber(finiteNumber(point?.[0]) - bounds[0])} ${formatNumber(finiteNumber(point?.[1]) - bounds[1])}`;
}

function appearanceResources(fillOpacity) {
  return {
    ExtGState: {
      GS0: {
        Type: "ExtGState",
        CA: 1,
        ca: fillOpacity
      }
    }
  };
}

function textAppearanceResources(fillOpacity) {
  const resources = appearanceResources(fillOpacity);
  resources.Font = {
    F1: {
      Type: "Font",
      Subtype: "Type1",
      BaseFont: "Helvetica",
      Encoding: "WinAnsiEncoding"
    }
  };
  return resources;
}

function escapePdfLiteralText(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      if (code < 0x20 || code > 0x7e) return "?";
      if (character === "\\") return "\\\\";
      if (character === "(") return "\\(";
      if (character === ")") return "\\)";
      return character;
    })
    .join("");
}

function arrowHeadContent(start, end, thickness, bounds) {
  const x1 = finiteNumber(start?.[0]);
  const y1 = finiteNumber(start?.[1]);
  const x2 = finiteNumber(end?.[0]);
  const y2 = finiteNumber(end?.[1]);
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 0.001) return "";

  const size = Math.min(length * 0.45, Math.max(8, thickness * 4 + 5));
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const px = -uy;
  const py = ux;
  const baseX = x2 - ux * size;
  const baseY = y2 - uy * size;
  const wing = size * 0.45;
  const left = [baseX + px * wing, baseY + py * wing];
  const right = [baseX - px * wing, baseY - py * wing];
  return [
    ` ${pointString(end, bounds)} m ${pointString(left, bounds)} l S`,
    ` ${pointString(end, bounds)} m ${pointString(right, bounds)} l S`
  ].join("");
}

function appearanceContent(annotation, bounds) {
  const [red, green, blue] = rgbFromHex(annotation.color);
  const stroke = `${formatNumber(red)} ${formatNumber(green)} ${formatNumber(blue)} RG`;
  const fill = `${formatNumber(red)} ${formatNumber(green)} ${formatNumber(blue)} rg`;
  const width = formatNumber(Math.max(MIN_THICKNESS, finiteNumber(annotation.thickness, 2)));
  const content = [`q ${stroke} ${width} w 1 J 1 j`];

  if (annotation.kind === "text") {
    const annotationBounds = normalizePdfBounds(annotation.bounds);
    const fontSize = Math.max(6, finiteNumber(annotation.fontSize, 18));
    const x = formatNumber(annotationBounds[0] - bounds[0]);
    const y = formatNumber(annotationBounds[1] - bounds[1]);
    content.push(`${fill} BT /F1 ${formatNumber(fontSize)} Tf ${x} ${y} Td (${escapePdfLiteralText(annotation.text)}) Tj ET`);
  } else if (annotation.kind === "pen") {
    for (const path of normalizePaths(annotation.paths)) {
      const [first, ...rest] = path;
      content.push(`${pointString(first, bounds)} m`);
      for (const point of rest) content.push(`${pointString(point, bounds)} l`);
      content.push("S");
    }
  } else if (annotation.kind === "line" || annotation.kind === "arrow") {
    content.push(`${pointString(annotation.start, bounds)} m ${pointString(annotation.end, bounds)} l S`);
    if (annotation.kind === "arrow") {
      content.push(arrowHeadContent(annotation.start, annotation.end, annotation.thickness, bounds));
    }
  } else {
    const [minX, minY, maxX, maxY] = normalizePdfBounds(annotation.bounds);
    const localWidth = maxX - minX;
    const localHeight = maxY - minY;
    const localMinX = minX - bounds[0];
    const localMinY = minY - bounds[1];
    if (annotation.kind === "rectangle") {
      content.push(`q /GS0 gs ${fill} ${formatNumber(localMinX)} ${formatNumber(localMinY)} ${formatNumber(localWidth)} ${formatNumber(localHeight)} re f Q`);
      content.push(`${fill} ${formatNumber(localMinX)} ${formatNumber(localMinY)} ${formatNumber(localWidth)} ${formatNumber(localHeight)} re S`);
    } else {
      const kappa = 0.5522847498;
      const cx = localMinX + localWidth / 2;
      const cy = localMinY + localHeight / 2;
      const rx = localWidth / 2;
      const ry = localHeight / 2;
      content.push(`q /GS0 gs ${fill}`);
      content.push(`${formatNumber(cx + rx)} ${formatNumber(cy)} m`);
      content.push(`${formatNumber(cx + rx)} ${formatNumber(cy + kappa * ry)} ${formatNumber(cx + kappa * rx)} ${formatNumber(cy + ry)} ${formatNumber(cx)} ${formatNumber(cy + ry)} c`);
      content.push(`${formatNumber(cx - kappa * rx)} ${formatNumber(cy + ry)} ${formatNumber(cx - rx)} ${formatNumber(cy + kappa * ry)} ${formatNumber(cx - rx)} ${formatNumber(cy)} c`);
      content.push(`${formatNumber(cx - rx)} ${formatNumber(cy - kappa * ry)} ${formatNumber(cx - kappa * rx)} ${formatNumber(cy - ry)} ${formatNumber(cx)} ${formatNumber(cy - ry)} c`);
      content.push(`${formatNumber(cx + kappa * rx)} ${formatNumber(cy - ry)} ${formatNumber(cx + rx)} ${formatNumber(cy - kappa * ry)} ${formatNumber(cx + rx)} ${formatNumber(cy)} c f Q`);
      content.push(`${stroke} ${formatNumber(cx + rx)} ${formatNumber(cy)} m`);
      content.push(`${formatNumber(cx + rx)} ${formatNumber(cy + kappa * ry)} ${formatNumber(cx + kappa * rx)} ${formatNumber(cy + ry)} ${formatNumber(cx)} ${formatNumber(cy + ry)} c`);
      content.push(`${formatNumber(cx - kappa * rx)} ${formatNumber(cy + ry)} ${formatNumber(cx - rx)} ${formatNumber(cy + kappa * ry)} ${formatNumber(cx - rx)} ${formatNumber(cy)} c`);
      content.push(`${formatNumber(cx - rx)} ${formatNumber(cy - kappa * ry)} ${formatNumber(cx - kappa * rx)} ${formatNumber(cy - ry)} ${formatNumber(cx)} ${formatNumber(cy - ry)} c`);
      content.push(`${formatNumber(cx + kappa * rx)} ${formatNumber(cy - ry)} ${formatNumber(cx + rx)} ${formatNumber(cy - kappa * ry)} ${formatNumber(cx + rx)} ${formatNumber(cy)} c S`);
    }
  }

  content.push("Q");
  return content.join("\n");
}

function annotationRect(annotation) {
  const bounds = getAnnotationBounds(annotation);
  const thickness = Math.max(MIN_THICKNESS, finiteNumber(annotation.thickness, 2));
  const padding = annotation.kind === "text"
    ? 2
    : Math.max(3, thickness * 2 + (annotation.kind === "arrow" ? thickness * 2 : 0));
  return [bounds[0] - padding, bounds[1] - padding, bounds[2] + padding, bounds[3] + padding];
}

function buildAnnotationObject(pdfDocument, annotation) {
  const context = pdfDocument.context;
  const rect = annotationRect(annotation);
  const width = Math.max(1, rect[2] - rect[0]);
  const height = Math.max(1, rect[3] - rect[1]);
  const appearance = context.flateStream(
    appearanceContent(annotation, rect),
    {
      Type: "XObject",
      Subtype: "Form",
      FormType: 1,
      BBox: [0, 0, width, height],
      Resources: annotation.kind === "text"
        ? textAppearanceResources(ANNOTATION_FILL_OPACITY)
        : appearanceResources(ANNOTATION_FILL_OPACITY)
    }
  );
  const appearanceRef = context.register(appearance);
  const color = rgbFromHex(annotation.color);
  const thickness = Math.max(MIN_THICKNESS, finiteNumber(annotation.thickness, 2));
  const marker = getAnnotationMarker(annotation);
  const subtype = annotation.kind === "pen"
    ? "Ink"
    : annotation.kind === "line" || annotation.kind === "arrow"
      ? "Line"
      : annotation.kind === "rectangle"
        ? "Square"
        : annotation.kind === "ellipse"
          ? "Circle"
          : "FreeText";
  const dict = context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of(subtype),
    Rect: rect,
    F: 4,
    NM: PDFHexString.fromText(marker),
    T: PDFHexString.fromText(getAnnotationTitle(annotation)),
    M: PDFHexString.fromText(`D:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`),
    C: color,
    CA: 1,
    BS: { W: thickness, S: PDFName.of("S") },
    AP: { N: appearanceRef }
  });

  if (annotation.kind === "text") {
    const fontSize = Math.max(6, finiteNumber(annotation.fontSize, 18));
    dict.set(PDFName.of("Contents"), PDFHexString.fromText(String(annotation.text || "")));
    dict.set(PDFName.of("DA"), PDFString.of(
      `${formatNumber(color[0])} ${formatNumber(color[1])} ${formatNumber(color[2])} rg /F1 ${formatNumber(fontSize)} Tf`
    ));
  }

  if (annotation.kind === "pen") {
    dict.set(PDFName.of("InkList"), context.obj(normalizePaths(annotation.paths).map((path) => path.flat())));
  } else if (annotation.kind === "line" || annotation.kind === "arrow") {
    dict.set(PDFName.of("L"), context.obj([
      finiteNumber(annotation.start?.[0]), finiteNumber(annotation.start?.[1]),
      finiteNumber(annotation.end?.[0]), finiteNumber(annotation.end?.[1])
    ]));
    dict.set(PDFName.of("LE"), context.obj([
      PDFName.of("None"),
      PDFName.of(annotation.kind === "arrow" ? "OpenArrow" : "None")
    ]));
  } else {
    dict.set(PDFName.of("IC"), context.obj(color));
  }

  return context.register(dict);
}

function markerFromPdfDict(context, dict) {
  const marker = parseMarker(decodePdfString(getDictValue(context, dict, "NM")));
  if (marker) return marker.base;
  return parseMarker(decodePdfString(getDictValue(context, dict, "T")))?.base || "";
}

function annotationEntries(pdfDocument, page) {
  const context = pdfDocument.context;
  const rawAnnots = page.node.get(PDFName.of("Annots"));
  const annots = resolveObject(context, rawAnnots);
  if (!(annots instanceof PDFArray)) return [];

  const entries = [];
  for (let index = 0; index < annots.size(); index += 1) {
    const rawEntry = annots.get(index);
    const dict = resolveObject(context, rawEntry);
    if (dict instanceof PDFDict) entries.push({ rawEntry, dict, marker: markerFromPdfDict(context, dict) });
  }
  return entries;
}

function applyAnnotationsToPage(pdfDocument, page, records) {
  const pageRecords = records.filter((record) => Number(record.pageNumber) > 0);
  if (!pageRecords.length) return;

  const context = pdfDocument.context;
  const existingEntries = annotationEntries(pdfDocument, page);
  const recordsByMarker = new Map();
  for (const record of pageRecords) {
    const marker = record.sourceMarker ? parseMarker(record.sourceMarker)?.base : getAnnotationMarker(record);
    recordsByMarker.set(marker || getAnnotationMarker(record), record);
  }

  const retained = [];
  for (const entry of existingEntries) {
    if (!entry.marker || !recordsByMarker.has(entry.marker)) retained.push(entry.rawEntry);
  }

  const newRefs = pageRecords
    .filter((record) => !record.deleted)
    .map((record) => buildAnnotationObject(pdfDocument, record));
  const nextAnnots = [...retained, ...newRefs];
  if (nextAnnots.length) page.node.set(PDFName.of("Annots"), context.obj(nextAnnots));
  else page.node.delete(PDFName.of("Annots"));
}

function validateSelectedPageNumbers(pageNumbers, pageCount) {
  const numbers = Array.from(new Set((pageNumbers || []).map(Number)))
    .sort((first, second) => first - second);
  if (!numbers.length) throw new Error("Choose at least one page to export.");
  if (numbers.some((page) => !Number.isSafeInteger(page) || page < 1 || page > pageCount)) {
    throw new Error(`Export pages must be between 1 and ${pageCount}.`);
  }
  return numbers;
}

export async function exportAnnotatedPdf({ sourceBytes, selectedPageNumbers = null, annotations = [] }) {
  if (!sourceBytes) throw new Error("The original PDF bytes are not available for export.");
  const sourceDocument = await PDFDocument.load(sourceBytes);
  const pageNumbers = selectedPageNumbers == null
    ? Array.from({ length: sourceDocument.getPageCount() }, (_value, index) => index + 1)
    : validateSelectedPageNumbers(selectedPageNumbers, sourceDocument.getPageCount());

  if (selectedPageNumbers == null) {
    for (const pageNumber of pageNumbers) {
      const page = sourceDocument.getPage(pageNumber - 1);
      applyAnnotationsToPage(sourceDocument, page, annotations.filter((record) => Number(record.pageNumber) === pageNumber));
    }
    return sourceDocument.save({ useObjectStreams: false });
  }

  const outputDocument = await PDFDocument.create();
  const copiedPages = await outputDocument.copyPages(sourceDocument, pageNumbers.map((page) => page - 1));
  copiedPages.forEach((page, index) => {
    outputDocument.addPage(page);
    const pageNumber = pageNumbers[index];
    applyAnnotationsToPage(outputDocument, page, annotations.filter((record) => Number(record.pageNumber) === pageNumber));
  });
  return outputDocument.save({ useObjectStreams: false });
}
