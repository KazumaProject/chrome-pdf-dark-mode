# Chrome Web Storeで公開する方法

[English](CHROME_WEB_STORE.md)

このリポジトリはChrome Web Storeへの一般公開申請に使用できる状態です。公開手続きは所有者のGoogleアカウントから行う必要があります。

## 1. デベロッパーアカウントを登録

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)を開きます。
2. デベロッパー契約へ同意し、Googleが表示する1回限りの登録料を支払います。
3. デベロッパー連絡先メールアドレスを追加して確認します。
4. Googleアカウントの2段階認証を有効にします。公開と更新には2段階認証が必要です。

公式資料：[デベロッパーアカウントの登録](https://developer.chrome.com/docs/webstore/register)

## 2. アップロード用ZIPを作成してテスト

リポジトリのルートでテストを実行します。

```bash
npm test
```

Windowsでアップロード用ZIPを作成します。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-store.ps1
```

`dist/Dark-PDF-Viewer-Chrome-Web-Store-v1.9.1.zip`が作成されます。ZIPのルートにはアップロードに必要な`manifest.json`が配置されます。

申請前に`chrome://extensions`からリポジトリのフォルダーを読み込み、次を確認してください。

- **Open PDF**で選択したローカルPDF
- ファイルURLアクセスを許可した後の`file:///C:/...` PDF
- HTTP/HTTPS PDF
- ダークテーマ、カスタム色、ページナビゲーション
- ズームショートカットと現在位置の維持
- 文字の選択とコピー

## 3. ストアアイテムを作成

1. Developer Dashboardで**New item**を選択します。
2. `dist/`内のWeb Store用ZIPをアップロードします。
3. [`STORE_LISTING.md`](STORE_LISTING.md)にある英語・日本語の文章を入力します。
4. メインカテゴリーは**Productivity**を選択します。
5. 次の画像をアップロードします。
   - 128×128アイコン：`icons/icon128.png`
   - 1280×800スクリーンショット：`store-assets/screenshot-1.png`
   - 440×280小型プロモーション画像：`store-assets/small-promo-tile.png`
6. ホームページURL：`https://github.com/KazumaProject/chrome-pdf-dark-mode`
7. サポートURL：`https://github.com/KazumaProject/chrome-pdf-dark-mode/issues`
8. プライバシーポリシーURL：`https://github.com/KazumaProject/chrome-pdf-dark-mode/blob/main/PRIVACY_POLICY.md`

公式資料：[ストア掲載情報の入力](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)

## 4. Privacy practicesを入力

[`STORE_LISTING.md`](STORE_LISTING.md)の単一目的と各権限の説明をコピーします。

- Remote code：**No, I am not using remote code.**
- Data collection：ユーザーデータを収集しないことを申告します。
- Limited use：ダッシュボードの各内容を確認したうえで認証します。
- Privacy policy：GitHub上の`PRIVACY_POLICY.md`公開URLを入力します。

公式資料：[プライバシー項目の入力](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

## 5. 公開範囲と審査

1. 公開範囲を**Public**にします。
2. 対象地域を選択します。この拡張機能では全対応地域が妥当です。
3. 下書きを保存し、**Submit for Review**を選択します。
4. 初回はDeferred publishingを推奨します。承認後に内容を確認し、30日以内に手動公開します。

広いホスト権限があるため、審査に時間がかかる可能性があります。承認、却下、確認事項が届くデベロッパーメールを確認してください。

公式資料：[Chrome Web Storeへの公開](https://developer.chrome.com/docs/webstore/publish)、[審査プロセス](https://developer.chrome.com/docs/webstore/review-process)

## 権限説明の注意

ユーザーが指定した元の場所からPDFを読み込むため、HTTP、HTTPS、およびユーザーが有効にしたファイルURLへのアクセスを要求します。任意のWebサイトへスクリプトを挿入せず、PDF内容を開発者サーバーへ送信しません。この説明をストア掲載情報、Privacy practices、プライバシーポリシーで統一してください。
