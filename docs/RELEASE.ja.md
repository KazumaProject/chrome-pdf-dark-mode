# リリース手順

[English](RELEASE.md)

このプロジェクトは、バージョン変更が`main`へマージされるとGitHub Releaseを作成します。リリースワークフローが`manifest.json`からバージョンを読み取り、一致するタグを作成して拡張機能ZIPを公開します。

## リリース前に

1. `manifest.json`と`package.json`のバージョンを更新します。
2. リポジトリのルートでテストを実行します。

   ```bash
   node tests/viewer-utils.mjs
   node tests/static-layout.mjs
   node tests/background.mjs
   node --check viewer.js
   node --check background.js
   ```

3. `main`向けプルリクエストを確認します。
4. プルリクエストをマージします。マージ後にリリースワークフローが自動実行されます。

## マージしてリリース

プルリクエストをマージした後、タグを手動で作成する必要はありません。`main`へのプッシュでワークフローが実行され、`manifest.json`と一致するバージョンの前に`v`を付けたタグを作成します。

例えば、`manifest.json`が`1.9.0`の場合、マージされたコミットに`v1.9.0`タグが作成されます。既存のリリースタグを強制移動・上書きしないでください。

## 自動処理

`Release extension`ワークフローが次を実行します。

1. `main`へのプッシュで起動します。
2. `manifest.json`と`package.json`のバージョンが同じセマンティックバージョンであることを確認します。
3. 同じタグまたはリリースが存在するか確認し、再実行時に上書きしないようにします。
4. GitHub Actions上でテストと`scripts/package-store.ps1`を実行します。
5. `vX.Y.Z`タグを作成し、`Dark-PDF-Viewer-Chrome-Web-Store-vX.Y.Z.zip`を添付したGitHub Releaseを作成します。

このワークフローはChrome Web Storeへ自動公開しません。生成されたZIPは[Chrome Web Store公開手順](CHROME_WEB_STORE.ja.md)に従って手動でアップロードしてください。

## リリースを確認

- リポジトリの**Actions**タブで`Release extension`が成功したことを確認します。
- **Releases**で新しいタグとZIPファイルを確認します。
- ZIPをインストールするか、`chrome://extensions`から展開したパッケージを読み込み、リリースの動作確認を行います。

## ワークフローが失敗した場合

- マニフェストとパッケージのバージョンが異なる場合は、修正した新しいプルリクエストを作成してマージします。
- 同じタグが別のコミットを指している場合は、バージョンを上げてください。タグを強制移動しないでください。
- パッケージ作成が失敗した場合は、`powershell -ExecutionPolicy Bypass -File scripts/package-store.ps1`をローカルで実行してエラーを確認してから、ワークフローを再実行します。
