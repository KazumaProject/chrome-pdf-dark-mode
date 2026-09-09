const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizePageNumber(value, totalPages, fallbackPage = 1) {
  const pageCount = Number.parseInt(totalPages, 10);
  if (!Number.isFinite(pageCount) || pageCount < 1) return 1;

  const fallback = Number.parseInt(fallbackPage, 10);
  const safeFallback = clamp(Number.isFinite(fallback) ? fallback : 1, 1, pageCount);
  const rawValue = String(value ?? "").trim();
  if (!/^[+-]?\d+$/.test(rawValue)) return safeFallback;

  const pageNumber = Number.parseInt(rawValue, 10);
  return clamp(Number.isFinite(pageNumber) ? pageNumber : safeFallback, 1, pageCount);
}

export function getCurrentPageNumber(pageRects, view) {
  if (!pageRects.length) return null;

  const viewportTop = Math.max(0, view.scrollTop || 0);
  const viewportHeight = Math.max(0, view.height ?? view.clientHeight ?? 0);
  const viewportBottom = viewportTop + viewportHeight;
  const viewportCenter = viewportTop + viewportHeight / 2;
  let selectedIndex = 0;
  let largestVisibleHeight = -1;
  let nearestCenterDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < pageRects.length; index += 1) {
    const page = pageRects[index];
    const top = page.top || 0;
    const height = Math.max(0, page.height || 0);
    const bottom = top + height;
    const visibleHeight = Math.max(0, Math.min(bottom, viewportBottom) - Math.max(top, viewportTop));
    const centerDistance = Math.abs((top + height / 2) - viewportCenter);

    if (
      visibleHeight > largestVisibleHeight
      || (visibleHeight === largestVisibleHeight && centerDistance < nearestCenterDistance)
    ) {
      selectedIndex = index;
      largestVisibleHeight = visibleHeight;
      nearestCenterDistance = centerDistance;
    }
  }

  return selectedIndex + 1;
}

export function normalizeHexColor(value, fallback) {
  return HEX_COLOR_PATTERN.test(value || "") ? value.toLowerCase() : fallback;
}

export function hexToRgb(value) {
  const hex = normalizeHexColor(value, "#000000").slice(1);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16)
  ];
}

export function parsePageRange(value, totalPages) {
  const pageCount = Number.parseInt(totalPages, 10);
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
    return { pages: [], error: "This PDF does not contain any pages." };
  }

  const input = String(value ?? "").trim();
  if (!input) {
    return { pages: [], error: "Enter a page number or range." };
  }

  const pages = new Set();
  for (const rawPart of input.split(",")) {
    const part = rawPart.trim();
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) {
      return { pages: [], error: `Invalid page range: “${part || rawPart}”.` };
    }

    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return { pages: [], error: "Page numbers are too large." };
    }
    if (start > end) {
      return { pages: [], error: `Range ${start}-${end} must be ascending.` };
    }
    if (start < 1 || end > pageCount) {
      return { pages: [], error: `Pages must be between 1 and ${pageCount}.` };
    }

    for (let page = start; page <= end; page += 1) pages.add(page);
  }

  return {
    pages: Array.from(pages).sort((first, second) => first - second),
    error: ""
  };
}

export function formatPageRange(pages) {
  const normalizedPages = Array.from(new Set((pages || [])
    .map((page) => Number(page))
    .filter((page) => Number.isSafeInteger(page) && page > 0)))
    .sort((first, second) => first - second);
  const parts = [];

  for (let index = 0; index < normalizedPages.length; index += 1) {
    const start = normalizedPages[index];
    let end = start;
    while (normalizedPages[index + 1] === end + 1) {
      index += 1;
      end = normalizedPages[index];
    }
    parts.push(start === end ? String(start) : `${start}-${end}`);
  }

  return parts.join(",");
}

export function normalizePdfBounds(bounds) {
  const values = Array.isArray(bounds) ? bounds : [0, 0, 0, 0];
  const x1 = Number(values[0]) || 0;
  const y1 = Number(values[1]) || 0;
  const x2 = Number(values[2]) || 0;
  const y2 = Number(values[3]) || 0;
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}

function annotationPathList(paths) {
  const rawPaths = Array.isArray(paths) ? paths : [];
  const isPoint = (value) => Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]));
  return rawPaths.length && rawPaths.every(isPoint) ? [rawPaths] : rawPaths;
}

function annotationPoints(annotation) {
  if (!annotation) return [];
  if (annotation.kind === "pen") {
    return annotationPathList(annotation.paths).flat().filter((point) => Array.isArray(point));
  }
  if (annotation.kind === "line" || annotation.kind === "arrow") {
    return [annotation.start, annotation.end].filter(Boolean);
  }
  return [];
}

export function getAnnotationBounds(annotation) {
  if (!annotation) return [0, 0, 0, 0];
  if (annotation.kind === "rectangle" || annotation.kind === "ellipse" || annotation.kind === "text") {
    return normalizePdfBounds(annotation.bounds);
  }

  const points = annotationPoints(annotation);
  if (!points.length) return [0, 0, 0, 0];
  const xs = points.map((point) => Number(point?.[0]) || 0);
  const ys = points.map((point) => Number(point?.[1]) || 0);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function scaleAnnotationGeometry(annotation, fromBounds, toBounds) {
  const source = normalizePdfBounds(fromBounds);
  const target = normalizePdfBounds(toBounds);
  const sourceWidth = Math.max(0.001, source[2] - source[0]);
  const sourceHeight = Math.max(0.001, source[3] - source[1]);
  const scalePoint = (point) => [
    target[0] + ((Number(point?.[0]) || 0) - source[0]) * (target[2] - target[0]) / sourceWidth,
    target[1] + ((Number(point?.[1]) || 0) - source[1]) * (target[3] - target[1]) / sourceHeight
  ];

  const scaled = { ...annotation };
  if (annotation.kind === "rectangle" || annotation.kind === "ellipse" || annotation.kind === "text") {
    scaled.bounds = target;
    if (annotation.kind === "text") {
      const sourceHeight = Math.max(0.001, source[3] - source[1]);
      const targetHeight = Math.max(0.001, target[3] - target[1]);
      scaled.fontSize = Math.max(6, (Number(annotation.fontSize) || sourceHeight) * targetHeight / sourceHeight);
    }
  } else if (annotation.kind === "line" || annotation.kind === "arrow") {
    scaled.start = scalePoint(annotation.start);
    scaled.end = scalePoint(annotation.end);
  } else if (annotation.kind === "pen") {
    scaled.paths = annotationPathList(annotation.paths)
      .map((path) => path.filter(Array.isArray).map(scalePoint))
      .filter((path) => path.length >= 2);
  }
  return scaled;
}

export function pdfPointToViewport(point, pageSize, scale = 1, rotation = 0) {
  const width = Number(pageSize?.width) || 0;
  const height = Number(pageSize?.height) || 0;
  const x = Number(point?.[0]) || 0;
  const y = Number(point?.[1]) || 0;
  const normalizedRotation = ((Number(rotation) || 0) % 360 + 360) % 360;

  if (normalizedRotation === 90) return [y * scale, x * scale];
  if (normalizedRotation === 180) return [(width - x) * scale, y * scale];
  if (normalizedRotation === 270) return [(height - y) * scale, (width - x) * scale];
  return [x * scale, (height - y) * scale];
}

export function viewportPointToPdf(point, pageSize, scale = 1, rotation = 0) {
  const width = Number(pageSize?.width) || 0;
  const height = Number(pageSize?.height) || 0;
  const x = (Number(point?.[0]) || 0) / Math.max(0.001, scale);
  const y = (Number(point?.[1]) || 0) / Math.max(0.001, scale);
  const normalizedRotation = ((Number(rotation) || 0) % 360 + 360) % 360;

  if (normalizedRotation === 90) return [y, x];
  if (normalizedRotation === 180) return [width - x, y];
  if (normalizedRotation === 270) return [width - y, height - x];
  return [x, height - y];
}

export function textContentToPlainText(textContent) {
  const items = Array.isArray(textContent?.items) ? textContent.items : [];
  const lines = [];
  let currentLine = "";

  for (const item of items) {
    const text = String(item?.str ?? "");
    if (text) {
      if (currentLine && !/[\s\u00a0]$/.test(currentLine) && !/^[\s\u00a0]/.test(text)) {
        currentLine += " ";
      }
      currentLine += text;
    }
    if (item?.hasEOL) {
      lines.push(currentLine.trimEnd());
      currentLine = "";
    }
  }

  if (currentLine) lines.push(currentLine.trimEnd());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Maps the PDF's original black pixels to textColor and white pixels to backgroundColor.
export function buildDuotoneMatrix(textColor, backgroundColor) {
  const text = hexToRgb(textColor).map((value) => value / 255);
  const background = hexToRgb(backgroundColor).map((value) => value / 255);
  const luminance = [0.2126, 0.7152, 0.0722];
  const matrix = [];

  for (let channel = 0; channel < 3; channel += 1) {
    const difference = background[channel] - text[channel];
    matrix.push(
      luminance[0] * difference,
      luminance[1] * difference,
      luminance[2] * difference,
      0,
      text[channel]
    );
  }

  matrix.push(0, 0, 0, 1, 0);
  return matrix;
}

export function getKeyboardCommand(event) {
  const modifier = Boolean(event.ctrlKey || event.metaKey);
  if (!modifier || event.altKey) return "";

  if (["+", "=", "Add"].includes(event.key)) return "zoom-in";
  if (["-", "_", "Subtract"].includes(event.key)) return "zoom-out";
  if (event.key === "0") return "fit";
  if (event.key.toLowerCase() === "o") return "open";
  return "";
}

export function getWheelZoomDirection(event) {
  if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return 0;
  return event.deltaY < 0 ? 1 : -1;
}

export function getPageAnchor(pageRects, view, point = {}) {
  if (!pageRects.length) return null;

  const viewportX = clamp(point.x ?? view.width / 2, 0, view.width);
  const viewportY = clamp(point.y ?? view.height / 2, 0, view.height);
  const contentX = view.scrollLeft + viewportX;
  const contentY = view.scrollTop + viewportY;

  let selectedIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < pageRects.length; index += 1) {
    const page = pageRects[index];
    const pageBottom = page.top + page.height;
    const distance = contentY < page.top
      ? page.top - contentY
      : contentY > pageBottom
        ? contentY - pageBottom
        : 0;
    if (distance < nearestDistance) {
      selectedIndex = index;
      nearestDistance = distance;
    }
  }

  const page = pageRects[selectedIndex];
  return {
    pageNumber: selectedIndex + 1,
    relativeY: clamp((contentY - page.top) / Math.max(1, page.height), 0, 1),
    relativeX: clamp((contentX - page.left) / Math.max(1, page.width), 0, 1),
    viewportX,
    viewportY
  };
}

export function getAnchoredScrollPosition(anchor, pageRect) {
  return {
    top: Math.max(0, pageRect.top + pageRect.height * anchor.relativeY - anchor.viewportY),
    left: Math.max(0, pageRect.left + pageRect.width * anchor.relativeX - anchor.viewportX)
  };
}
