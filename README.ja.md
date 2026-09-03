# Dark PDF Viewer

[English](README.md)

PDFを快適なダークテーマで閲覧できるChrome拡張機能です。文字の選択・コピー、一般的なズーム操作、表示中のページだけを処理する遅延描画に対応しています。

## 主な機能

- Nord、Catppuccin Mocha、Solarized Dark、Dracula、Sepia Paper、暖色、高コントラスト、元の色、カスタム文字色・背景色を含む16種類の表示プリセット
- 画面付近のページだけを処理する軽量な遅延描画
- PDF内テキストの選択とコピー
- 現在ページ/総ページ数の入力と、先頭・前・次・末尾ページのナビゲーション
- 表示・非表示を自動で切り替える縦型ページスクラバー
- `Ctrl` + マウスホイール、`Ctrl` + `+`、`Ctrl` + `-`、`Ctrl` + `0`によるズーム
- 現在のページと読んでいる位置を維持するズーム
- `file:///`のローカルPDF、ドラッグ＆ドロップ、PDFリンク、HTTP/HTTPS URL
- 解析や外部サーバーを使用しないローカルPDF処理

## 手動インストール

1. 最新リリースのZIPをダウンロードして展開します。
2. Chromeで`chrome://extensions`を開きます。
3. **デベロッパー モード**を有効にします。
4. **パッケージ化されていない拡張機能を読み込む**を選択します。
5. `manifest.json`が入っている展開後のフォルダーを選択します。

`file:///C:/...`で開いたPDFを直接変換する場合は、拡張機能の詳細画面で**ファイルのURLへのアクセスを許可する**を有効にしてください。**Open PDF**またはドラッグ＆ドロップで開く場合、この許可は不要です。

## 使い方

- PDFを開き、ツールバーのDark PDF Viewerアイコンをクリックします。
- PDFリンクを右クリックし、**Open PDF in Dark Mode**を選択します。
- **Open PDF**を押すか、PDFをビューアーへドラッグします。
- **Reading**からテーマを選択するか、**Text**と**Paper**で色を設定します。

### ショートカット

| ショートカット | 操作 |
| --- | --- |
| `Ctrl` + マウスホイール | マウスポインター位置を基準にズーム |
| `Ctrl` + `+` / `Ctrl` + `-` | 画面中央を基準にズーム |
| `Ctrl` + `0` | 幅に合わせる |
| `Ctrl` + `O` | PDFを開く |
| `D` | ダークモード切り替え |
| `Ctrl` + `C` | 選択したPDFテキストをコピー |

画像としてスキャンされたPDFの文字選択には、事前にOCR処理が必要です。

## 開発

Manifest V3と同梱のMozilla PDF.jsを使用しています。外部サーバーから実行コードを読み込むことはありません。

```bash
npm test
```

WindowsでChrome Web Store用ZIPを作成する場合：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-store.ps1
```

[Chrome Web Store公開手順](docs/CHROME_WEB_STORE.ja.md)も参照してください。

### リリース

バージョンを`main`へマージした後、`v1.9.0`のように`manifest.json`と一致するタグをプッシュします。

```bash
git tag v1.9.0
git push origin v1.9.0
```

リリースワークフローがタグと`manifest.json`のバージョンを検証し、拡張機能ZIPを作成してGitHub Releaseへ公開します。

## プライバシー

PDFの内容と表示設定は端末内に保持されます。[プライバシーポリシー](PRIVACY_POLICY.ja.md)をご確認ください。

## ライセンス

拡張機能のコードは[MIT License](LICENSE)で公開します。Mozilla PDF.jsには個別のライセンスが適用されます。[Third-Party Notices](THIRD_PARTY_NOTICES.md)および`vendor/PDFJS-LICENSE.txt`をご確認ください。
