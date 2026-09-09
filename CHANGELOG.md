# Changelog

## 1.11.3 — 2026-09-09

- Grouped multiple Pen strokes into one editable writing annotation with a Finish pen action.

## 1.11.2 — 2026-09-09

- Kept the Pen tool active after each stroke so multiple pen marks can be drawn without reselecting it.

## 1.11.1 — 2026-09-09

- Fixed shape and annotation dragging so movement is calculated from the original geometry of the current drag gesture and annotations do not fly off the page.

## 1.11.0 — 2026-09-09

- Added a Text annotation tool with editable user-entered text and standard `/FreeText` export.
- Fixed pen annotations disappearing or crashing when legacy point-list geometry is reopened.
- Fixed annotation hit testing so placed shapes can be selected, moved, resized, recolored, and deleted.
- Fixed Enter in the current-page field to jump immediately to the requested page.

## 1.10.0 — 2026-09-09

- Added editable pen, line, rectangle, ellipse, and arrow annotations with color, thickness, selection, move, resize, delete, undo, and redo.
- Added editable standard-PDF annotation export for whole documents and reusable page ranges, without overwriting the source.
- Added page-range and browser-selection text extraction with editable Copy and Download TXT actions.
- Vendored `pdf-lib` locally and documented its MIT license.

## 1.9.1 — 2026-09-08

- Fixed the vertical page scrubber direction.
- Enabled range-first PDF.js loading for remote and selected local files.
- Reduced scroll-time layout work while keeping nearby-page rendering lazy.

## 1.9.0 — 2026-09-03

- Added Nord, Catppuccin Mocha, Solarized Dark, Dracula, and Sepia Paper themes.
- Added editable current/total page navigation with first, previous, next, and last controls.
- Added an auto-hiding vertical page scrubber with continuous drag navigation.
- Avoided sending credentials when downloading remote or local PDF sources.

## 1.8.0 — 2026-09-02

- Added viewport-based lazy page rendering and bounded canvas memory.
- Reduced canvas rendering cost while retaining selectable text.
- Kept the current page and pointer/viewport anchor stable during zoom.
- Added Material-inspired themes and custom text/background colors.
- Added local `file:///` PDF support and bundled PDF.js WebAssembly decoders.
