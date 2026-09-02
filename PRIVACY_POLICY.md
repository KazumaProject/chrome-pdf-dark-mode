# Privacy Policy for Dark PDF Viewer

Effective date: September 2, 2026

Dark PDF Viewer is designed to process PDFs locally in the user's browser.

## Data collection

Dark PDF Viewer does not collect, transmit, sell, or share personal information, browsing history, PDF contents, or usage analytics with the developer or any developer-operated server.

## Local processing and storage

- PDF documents are parsed and rendered locally by the bundled Mozilla PDF.js library.
- Theme, color, brightness, and contrast preferences are stored locally through Chrome's extension storage.
- When the user chooses a remote PDF URL, Chrome requests that PDF directly from its original website. The extension does not proxy it through a developer-operated service.
- Local files selected by the user, dropped into the viewer, or opened through an allowed `file:///` URL remain on the user's device.

## Permissions

The extension uses permissions only to open its viewer, add a PDF-link context menu, remember display preferences, and read a PDF from the location explicitly selected by the user. Permission details are documented in [`docs/STORE_LISTING.md`](docs/STORE_LISTING.md).

## Remote code

The extension does not download or execute remote code. PDF.js, fonts, character maps, and WebAssembly decoders are included in the extension package.

## Changes

Material changes to this policy will be published in this repository with an updated effective date.

## Contact

Questions can be submitted through [GitHub Issues](https://github.com/KazumaProject/chrome-pdf-dark-mode/issues).
