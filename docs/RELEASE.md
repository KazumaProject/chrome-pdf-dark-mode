# Release Guide

[日本語](RELEASE.ja.md)

This project creates a GitHub Release when a version tag is pushed. The tag must point to a commit already contained in `main`, and its version must match `manifest.json`.

## Before tagging

1. Update the version in `manifest.json` and `package.json`.
2. Run the tests from the repository root:

   ```bash
   node tests/viewer-utils.mjs
   node tests/static-layout.mjs
   node tests/background.mjs
   node --check viewer.js
   node --check background.js
   ```

3. Open and review the pull request into `main`.
4. Merge the pull request. Do not tag an unmerged feature branch.

## Push the release tag

After the pull request is merged, update the local `main` branch and create an annotated tag whose name is `v` followed by the exact manifest version:

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.9.0 -m "Dark PDF Viewer v1.9.0"
git push origin v1.9.0
```

For another version, replace `1.9.0` in both the tag and the message. Do not force-move or overwrite an existing release tag.

## What happens automatically

The `Release extension` workflow will:

1. Run for tags matching `v*.*.*`.
2. Confirm the tag version matches `manifest.json`.
3. Confirm the tagged commit is already contained in `main`.
4. Run `scripts/package-store.ps1` on the GitHub Actions runner.
5. Create a GitHub Release and attach `Dark-PDF-Viewer-Chrome-Web-Store-vX.Y.Z.zip`.

The workflow does not publish to the Chrome Web Store. Upload the generated ZIP manually by following the [Chrome Web Store publishing instructions](CHROME_WEB_STORE.md).

## Verify the release

- Open the repository’s **Actions** tab and confirm `Release extension` succeeded.
- Open **Releases** and confirm the new release tag and ZIP asset are present.
- Install the ZIP or load the unpacked package through `chrome://extensions` and perform the release smoke test.

## If the workflow fails

- If the tag does not match `manifest.json`, correct the version in a new commit and use a new version tag.
- If the tag is not based on `main`, merge the pull request first and create a new version tag from `main`.
- If packaging fails, run `powershell -ExecutionPolicy Bypass -File scripts/package-store.ps1` locally and inspect the error before retrying the workflow.
