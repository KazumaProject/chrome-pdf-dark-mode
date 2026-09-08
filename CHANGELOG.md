# Changelog

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
