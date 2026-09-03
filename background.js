const VIEWER_PAGE = "viewer.html";
const CONTEXT_MENU_ID = "open-pdf-dark-mode";

function extractOriginalUrl(rawUrl) {
  if (!rawUrl) return "";

  try {
    const parsed = new URL(rawUrl);

    if (parsed.href.startsWith(chrome.runtime.getURL(VIEWER_PAGE))) {
      return parsed.searchParams.get("url") || "";
    }

    // Also understands Chrome's built-in PDF viewer URL if Chrome exposes it.
    if (
      parsed.protocol === "chrome-extension:" &&
      parsed.pathname.endsWith("/index.html") &&
      parsed.searchParams.has("file")
    ) {
      return parsed.searchParams.get("file") || "";
    }

    if (["http:", "https:", "file:"].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch (_error) {
    // The viewer will open without a source and let the user choose a file.
  }

  return "";
}

function buildViewerUrl(sourceUrl = "", fileAccessBlocked = false) {
  const viewerUrl = new URL(chrome.runtime.getURL(VIEWER_PAGE));
  if (sourceUrl) viewerUrl.searchParams.set("url", sourceUrl);
  if (fileAccessBlocked) viewerUrl.searchParams.set("fileAccess", "blocked");
  return viewerUrl.href;
}

async function openViewer(tab, sourceUrl, openInNewTab = false) {
  const originalUrl = extractOriginalUrl(sourceUrl);
  const isLocalFile = originalUrl.startsWith("file:");
  const fileAccessBlocked =
    isLocalFile &&
    chrome.extension?.isAllowedFileSchemeAccess &&
    !(await chrome.extension.isAllowedFileSchemeAccess());
  const targetUrl = buildViewerUrl(originalUrl, fileAccessBlocked);

  if (!openInNewTab && tab?.id != null) {
    try {
      await chrome.tabs.update(tab.id, { url: targetUrl });
      return;
    } catch (_error) {
      // Some protected tabs cannot be replaced; a new viewer tab still works.
    }
  }

  await chrome.tabs.create({
    url: targetUrl,
    index: typeof tab?.index === "number" ? tab.index + 1 : undefined
  });
}

chrome.action.onClicked.addListener((tab) => {
  void openViewer(tab, tab.url || tab.pendingUrl || "");
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Open PDF in Dark Mode",
      contexts: ["link"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  void openViewer(tab, info.linkUrl || "", true);
});
