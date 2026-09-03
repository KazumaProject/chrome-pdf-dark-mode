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
