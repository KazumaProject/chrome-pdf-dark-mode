# Dark PDF Viewer

[日本語](README.ja.md)

A local-first Chrome extension for reading PDFs with comfortable dark themes, selectable text, familiar zoom controls, and lazy page rendering.

## Features

- Sixteen reading presets, including Nord, Catppuccin Mocha, Solarized Dark, Dracula, Sepia Paper, warm paper, high contrast, original colors, and custom text/background colors
- Fast lazy rendering: only pages near the viewport are rendered
- Selectable and copyable PDF text
- Editable current/total page navigation with first, previous, next, and last controls
- Auto-hiding vertical page scrubber for fast document navigation
- `Ctrl` + mouse wheel, `Ctrl` + `+`, `Ctrl` + `-`, and `Ctrl` + `0` zoom shortcuts
- Stable zoom anchoring that keeps the current page and reading position
- Local `file:///` PDFs, drag-and-drop files, PDF links, and HTTP/HTTPS PDF URLs
- Completely local PDF processing with no analytics or developer-operated server

## Install manually

1. Download the latest release ZIP and extract it.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted extension directory containing `manifest.json`.

For PDFs opened from `file:///C:/...`, open the extension's details page and enable **Allow access to file URLs**. Alternatively, use **Open PDF** or drag a PDF into the viewer; those methods do not require file-URL permission.

## Use

- Open a PDF and click the Dark PDF Viewer toolbar icon.
- Right-click a PDF link and select **Open PDF in Dark Mode**.
- Select **Open PDF** or drag a local PDF into the viewer.
- Choose a preset from **Reading**, or select custom **Text** and **Paper** colors.

### Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + mouse wheel | Zoom around the pointer |
| `Ctrl` + `+` / `Ctrl` + `-` | Zoom around the viewport center |
| `Ctrl` + `0` | Fit width |
| `Ctrl` + `O` | Open a PDF |
| `D` | Toggle dark mode |
| `Ctrl` + `C` | Copy selected PDF text |

Scanned image-only PDFs require OCR before their text can be selected.

## Development

The extension uses Manifest V3 and bundles Mozilla PDF.js. It does not load executable code from remote servers.

```bash
npm test
```

On Windows, create a Chrome Web Store ZIP with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-store.ps1
```

See [Chrome Web Store publishing instructions](docs/CHROME_WEB_STORE.md).

### Releases

After merging a version into `main`, push a matching tag such as `v1.9.0`:

```bash
git tag v1.9.0
git push origin v1.9.0
```

The release workflow validates the tag against `manifest.json`, packages the extension, and publishes the ZIP to a GitHub Release.

## Privacy

PDF contents and reading preferences stay on the device. See the [Privacy Policy](PRIVACY_POLICY.md).

## License

Extension code is available under the [MIT License](LICENSE). Mozilla PDF.js remains under its own license; see [Third-Party Notices](THIRD_PARTY_NOTICES.md) and `vendor/PDFJS-LICENSE.txt`.
