# Web Catalog

ページめくりアニメーション付きの Web カタログです。

## 機能

- ページめくりアニメーション (turn.js 使用)
- サムネイル付きページ一覧
- ズーム機能
- メモ・付箋機能
- モバイル対応レスポンシブデザイン
- ページジャンプ機能

## 技術スタック

- HTML / CSS / JavaScript
- jQuery / jQuery UI
- turn.js (ページめくりライブラリ)
- Noto Sans JP (Google Fonts)

## ローカルでの確認

ローカルサーバーで起動してください。

```bash
# Python 3の場合
python -m http.server 8000

# Node.jsの場合
npx serve
```

ブラウザで `http://localhost:8000` を開きます。

## デプロイ

GitHub Actions で`main`ブランチへのプッシュ時に自動デプロイされます。

### 必要な Secrets

GitHub リポジトリの Settings → Secrets and variables に以下を設定:

| Secret 名        | 説明                   |
| ---------------- | ---------------------- |
| `FTP_SERVER`     | FTP サーバーホスト名   |
| `FTP_USERNAME`   | FTP ユーザー名         |
| `FTP_PASSWORD`   | FTP パスワード         |
| `FTP_SERVER_DIR` | デプロイ先ディレクトリ |

## ディレクトリ構成

```
web-catalog/
├── index.html          # メインHTML
├── styles.css          # スタイルシート
├── app.js              # メインJavaScript
├── images/             # カタログ画像
├── libs/               # ライブラリ (jQuery, turn.js等)
└── .github/workflows/  # GitHub Actions設定
```

## ライセンス

All rights reserved.
