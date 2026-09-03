# Publish on the Chrome Web Store

[日本語](CHROME_WEB_STORE.ja.md)

This repository is prepared for a public Chrome Web Store submission. Publishing must be completed from the owner's Google account.

## 1. Register the developer account

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
2. Accept the developer agreement and pay the one-time registration fee shown by Google.
3. Add and verify the developer contact email.
4. Enable 2-Step Verification on the Google account. Google requires it for publishing and updates.

Official reference: [Register your developer account](https://developer.chrome.com/docs/webstore/register)

## 2. Build and test the upload package

Run the test suite from the repository root:

```bash
npm test
```

On Windows, generate the upload package:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-store.ps1
```

This creates `dist/Dark-PDF-Viewer-Chrome-Web-Store-v1.8.0.zip`. The ZIP has `manifest.json` at its root, as required for extension upload.

Before submission, load the repository directory through `chrome://extensions` and test:

- A local PDF selected with **Open PDF**
- A `file:///C:/...` PDF after enabling file URL access
- An HTTP/HTTPS PDF
- Dark themes and custom colors
- Zoom shortcuts and stable page position
- Text selection and copying

## 3. Create the store item

1. In the Developer Dashboard, select **New item**.
2. Upload the Web Store ZIP from `dist/`.
3. Use the paste-ready English and Japanese content in [`STORE_LISTING.md`](STORE_LISTING.md).
4. Select **Productivity** as the primary category.
5. Upload:
   - `icons/icon128.png` as the 128×128 store icon
   - `store-assets/screenshot-1.png` as the required 1280×800 screenshot
   - `store-assets/small-promo-tile.png` as the 440×280 small promo tile
6. Homepage URL: `https://github.com/KazumaProject/chrome-pdf-dark-mode`
7. Support URL: `https://github.com/KazumaProject/chrome-pdf-dark-mode/issues`
8. Privacy policy URL: `https://github.com/KazumaProject/chrome-pdf-dark-mode/blob/main/PRIVACY_POLICY.md`

Official reference: [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)

## 4. Complete Privacy practices

Copy the single-purpose statement and each permission justification from [`STORE_LISTING.md`](STORE_LISTING.md).

- Remote code: **No, I am not using remote code.**
- Data collection: disclose that the extension does not collect user data.
- Limited use certifications: certify only after confirming the statements in the dashboard.
- Privacy policy: use the public GitHub URL for `PRIVACY_POLICY.md`.

Official reference: [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

## 5. Distribution and review

1. Set visibility to **Public**.
2. Select the intended regions (all supported regions is reasonable for this extension).
3. Save the draft and select **Submit for Review**.
4. For the first release, deferred publishing is safer: after approval, test the approved listing and publish manually within 30 days.

Review may take longer when broad host permissions are requested. Monitor the developer email for approval, rejection, or policy questions.

Official references: [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish), [Review process](https://developer.chrome.com/docs/webstore/review-process)

## Permission review note

The extension requests HTTP, HTTPS, and optional user-enabled file URL access because it must read the PDF selected by the user from its original location. It does not inject scripts into arbitrary websites and does not send PDF contents to a developer server. Keep this explanation consistent across the listing, privacy disclosures, and privacy policy.
