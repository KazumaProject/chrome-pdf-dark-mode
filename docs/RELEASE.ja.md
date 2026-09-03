# リリース手順

[English](RELEASE.md)

このプロジェクトは、バージョンタグをプッシュするとGitHub Releaseを作成します。タグは`main`に含まれるコミットを指し、`manifest.json`のバージョンと一致している必要があります。

## タグを作成する前に

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
4. プルリクエストをマージします。マージ前の機能ブランチにはタグを付けないでください。

## リリースタグをプッシュ

プルリクエストをマージした後、ローカルの`main`を更新し、`manifest.json`と一致するバージョンの前に`v`を付けた注釈付きタグを作成します。

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.9.0 -m "Dark PDF Viewer v1.9.0"
git push origin v1.9.0
```

別のバージョンでは、タグとメッセージの`1.9.0`を置き換えます。既存のリリースタグを強制移動・上書きしないでください。

## 自動処理

`Release extension`ワークフローが次を実行します。

1. `v*.*.*`に一致するタグで起動します。
2. タグのバージョンが`manifest.json`と一致することを確認します。
3. タグのコミットが`main`に含まれることを確認します。
4. GitHub Actions上で`scripts/package-store.ps1`を実行します。
5. GitHub Releaseを作成し、`Dark-PDF-Viewer-Chrome-Web-Store-vX.Y.Z.zip`を添付します。

このワークフローはChrome Web Storeへ自動公開しません。生成されたZIPは[Chrome Web Store公開手順](CHROME_WEB_STORE.ja.md)に従って手動でアップロードしてください。

## リリースを確認

- リポジトリの**Actions**タブで`Release extension`が成功したことを確認します。
- **Releases**で新しいタグとZIPファイルを確認します。
- ZIPをインストールするか、`chrome://extensions`から展開したパッケージを読み込み、リリースの動作確認を行います。

## ワークフローが失敗した場合

- タグと`manifest.json`が一致しない場合は、バージョンを修正した新しいコミットを作成し、新しいバージョンタグを使用します。
- タグが`main`に基づいていない場合は、先にプルリクエストをマージし、`main`から新しいバージョンタグを作成します。
- パッケージ作成が失敗した場合は、`powershell -ExecutionPolicy Bypass -File scripts/package-store.ps1`をローカルで実行してエラーを確認してから、ワークフローを再実行します。
