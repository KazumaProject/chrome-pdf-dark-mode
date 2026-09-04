# Release Guide

[日本語](RELEASE.ja.md)

This project creates a GitHub Release after a version change is merged into `main`. The release workflow reads the version from `manifest.json`, creates the matching tag, and publishes the extension ZIP.

## Before release

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
4. Merge the pull request. The release workflow runs automatically after the merge.

## Merge to release

After the pull request is merged, no manual tag command is required. The workflow runs for the push to `main` and creates a tag whose name is `v` followed by the exact manifest version.

For example, when `manifest.json` contains `1.9.0`, the workflow creates `v1.9.0` at the merged commit. Do not force-move or overwrite an existing release tag.

## What happens automatically

The `Release extension` workflow will:

1. Run for pushes to `main`.
2. Confirm `manifest.json` and `package.json` contain the same semantic version.
3. Check whether the matching tag or release already exists so reruns do not overwrite it.
4. Run the full test suite and `scripts/package-store.ps1` on the GitHub Actions runner.
5. Create the matching `vX.Y.Z` tag and GitHub Release with `Dark-PDF-Viewer-Chrome-Web-Store-vX.Y.Z.zip` attached.

The workflow does not publish to the Chrome Web Store. Upload the generated ZIP manually by following the [Chrome Web Store publishing instructions](CHROME_WEB_STORE.md).

## Verify the release

- Open the repository’s **Actions** tab and confirm `Release extension` succeeded.
- Open **Releases** and confirm the new release tag and ZIP asset are present.
- Install the ZIP or load the unpacked package through `chrome://extensions` and perform the release smoke test.

## If the workflow fails

- If the manifest and package versions differ, correct them in a new pull request and merge again.
- If the matching tag already points to another commit, bump the version; never force-move the tag.
- If packaging fails, run `powershell -ExecutionPolicy Bypass -File scripts/package-store.ps1` locally and inspect the error before retrying the workflow.
