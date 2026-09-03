# Chrome Web Store Listing Copy

## English

### Name

Dark PDF Viewer

### Summary

Read PDFs in comfortable dark themes with selectable text, custom colors, and fast lazy rendering.

### Detailed description

Dark PDF Viewer turns PDFs into a comfortable, customizable reading experience without sending your documents to an external service.

Features:

- Nord, Catppuccin Mocha, Solarized Dark, Dracula, Sepia Paper, Material-inspired dark themes, warm paper, high contrast, pure black, original colors, and custom text/background colors
- Selectable and copyable PDF text
- Editable current/total page navigation with first, previous, next, and last controls
- Auto-hiding vertical page scrubber for fast navigation through long PDFs
- Fast lazy rendering that processes only pages near the viewport
- Familiar Ctrl + mouse wheel and keyboard zoom shortcuts
- Stable zoom that keeps the current page and reading position
- Support for local files, file URLs, PDF links, drag-and-drop, and remote PDF URLs
- Local PDF processing using bundled Mozilla PDF.js

PDF files and reading preferences remain on your device. The extension contains no analytics and does not use a developer-operated server.

Note: Text in scanned image-only PDFs cannot be selected unless the PDF already includes an OCR text layer.

### Category

Productivity

### Single purpose

Display user-selected PDF documents in customizable dark reading themes while preserving standard PDF reading controls and selectable text.

### Permission justifications

**activeTab**  
Used only when the user clicks the extension toolbar icon, so the extension can identify the PDF in the active tab and replace that tab with the local dark viewer.

**contextMenus**  
Adds “Open PDF in Dark Mode” to link context menus so a user can explicitly open a PDF link in the viewer.

**storage**  
Stores theme, text color, background color, brightness, and contrast preferences locally in Chrome.

**Host permissions: `http://*/*` and `https://*/*`**  
Allows the viewer to retrieve a PDF directly from the HTTP or HTTPS URL explicitly opened by the user. The extension does not inject scripts into arbitrary sites and does not send the PDF to a developer-operated server.

**Host permission: `file:///*`**  
Allows a user to open a local file URL after separately enabling Chrome’s “Allow access to file URLs” switch. Local files remain on the device.

### Remote code declaration

No, I am not using remote code. All JavaScript, PDF.js code, fonts, character maps, and WebAssembly decoders are included in the extension package.

### Data use declaration

The extension does not collect user data. PDF contents and URLs are processed only to provide the user-requested viewer functionality and are not transmitted to the developer or a developer-operated server. Display settings are stored locally.

### Test instructions

No account or credentials are required. Upload and install the extension, select “Open PDF,” choose any PDF, and test themes, page navigation, zoom, and text selection. To test a `file:///` URL, enable “Allow access to file URLs” on the extension details page.

## 日本語

### 名前

Dark PDF Viewer

### 概要

ダークテーマ、文字選択、カスタム配色、軽量な遅延描画に対応したPDFビューアーです。

### 詳細な説明

Dark PDF Viewerは、PDFを外部サービスへ送信せず、快適でカスタマイズ可能な読書表示へ変換します。

主な機能：

- Nord、Catppuccin Mocha、Solarized Dark、Dracula、Sepia Paper、Material風ダークテーマ、暖色、高コントラスト、Pure Black、元の色、カスタム文字色・背景色
- PDF内テキストの選択とコピー
- 現在ページ/総ページ数の入力と、先頭・前・次・末尾ページのナビゲーション
- 長いPDFをすばやく移動できる自動表示・非表示の縦型ページスクラバー
- 画面付近のページだけを処理する軽量な遅延描画
- Ctrl + マウスホイールと一般的なキーボードズーム
- 現在のページと読んでいる位置を維持するズーム
- ローカルファイル、ファイルURL、PDFリンク、ドラッグ＆ドロップ、リモートPDF URL
- 同梱のMozilla PDF.jsによるローカルPDF処理

PDFと表示設定は端末内に留まります。アクセス解析や開発者が運営するサーバーは使用しません。

注意：画像としてスキャンされたPDFにOCRテキストレイヤーが含まれていない場合、文字は選択できません。

### カテゴリー

仕事効率化（Productivity）

### 単一目的

ユーザーが選択したPDFを、一般的なPDF操作と文字選択を維持したまま、カスタマイズ可能なダークテーマで表示します。

### 権限の説明

**activeTab**  
ユーザーがツールバーアイコンをクリックしたときだけ、現在のPDFタブを特定し、そのタブをローカルのダークビューアーへ切り替えるために使用します。

**contextMenus**  
ユーザーがPDFリンクを明示的にビューアーで開けるよう、右クリックメニューへ「Open PDF in Dark Mode」を追加します。

**storage**  
テーマ、文字色、背景色、明るさ、コントラストをChrome内へローカル保存します。

**`http://*/*`および`https://*/*`**  
ユーザーが明示的に開いたHTTP/HTTPS URLからPDFを直接取得します。任意のサイトへスクリプトを挿入せず、PDFを開発者サーバーへ送信しません。

**`file:///*`**  
Chromeの「ファイルのURLへのアクセスを許可する」をユーザーが別途有効にした場合、ローカルファイルURLを開くために使用します。ファイルは端末内に留まります。

### リモートコード

使用しません。JavaScript、PDF.js、フォント、文字マップ、WebAssemblyデコーダーはすべて拡張機能に同梱しています。

### データ利用

ユーザーデータを収集しません。PDF内容とURLは、ユーザーが要求したビューアー機能の提供にのみ使用し、開発者または開発者サーバーへ送信しません。表示設定はローカル保存されます。

### テスト手順

アカウントや認証情報は不要です。拡張機能をインストールし、「Open PDF」で任意のPDFを選択して、テーマ、ズーム、文字選択を確認してください。`file:///` URLを確認する場合は、拡張機能の詳細画面で「ファイルのURLへのアクセスを許可する」を有効にします。
