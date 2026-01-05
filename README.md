# WEBカタログ - 見開きレイアウト + リアルページめくり

実店舗タブレット設置・営業資料用のページめくりUI実装
**本物の本のようなページカール効果と影で、臨場感のある閲覧体験を提供**

## プロジェクト構成

```
webcatalog-sample/          (64MB)
├── index.html              # メインHTML (3.7KB)
├── styles.css              # スタイルシート (11KB)
├── app.js                  # メインロジック (17KB)
├── libs/                   # ライブラリ（128KB）
│   ├── jquery.min.js       # jQuery 3.7.1 (85KB)
│   ├── turn.min.js         # turn.js 4 (33KB)
│   └── hash.js             # URLハッシュ管理 (2.9KB)
├── images/                 # ページ画像（63MB）
│   ├── page-01.jpg
│   ├── page-02.jpg
│   └── ... (page-12.jpg)
├── README.md               # このファイル (10KB)
├── OPERATION_MANUAL.md     # 運用マニュアル (6.7KB)
└── SECURITY.md             # セキュリティポリシー (4.8KB)
```

## 主な機能

### ✅ 実装済み仕様

| 機能 | 実装内容 |
|------|---------|
| **見開きレイアウト** | 左右2ページ同時表示（本物の本のような体験） |
| **リアルページめくり** | StPageFlipによる3Dページカール効果 + 動的な影 |
| **余白なし表示** | 画像を余白なしフル表示（object-fit: cover） |
| **角からめくり** | 上下左右すべての角からドラッグ可能 |
| ページめくり | ドラッグ/スワイプ（タッチ・マウス両対応） |
| ナビゲーション | 下部ボタン + 左右矢印ヒント + キーボード |
| 初回ガイド | localStorage管理、3秒後自動消去 |
| ページ指定 | URLパラメータ `?pNo=4` 対応 |
| 画像最適化 | 遅延読み込み + 優先プリロード |
| エラー処理 | 読み込み失敗時のフォールバック表示 |
| レスポンシブ | スマホ・タブレット・PC対応（自動リサイズ） |
| 二重入力防止 | 300ms デバウンス実装 |
| アクセシビリティ | キーボード操作、ARIA対応 |

### 🛠 技術スタック

- **フロントエンド**: JavaScript (ES6+) + **jQuery 3.7.1** (最新安定版)
- **ページめくりライブラリ**: turn.js 4
  - 本物のようなページカール効果
  - 動的な影とグラデーション
  - ハードウェアアクセラレーション対応
  - タッチ・マウス両対応
  - すべての角からめくれる
- **スタイル**: CSS3 (Grid, Flexbox, Custom Properties)
- **パフォーマンス**: 画像プリロード、requestIdleCallback
- **ローカルライブラリ**: すべてのライブラリをローカルに配置（オフライン動作可能）

### 🎯 最重要ゴールへの対応

1. **使いやすさ** - 迷わない設計
   - 見開きレイアウトで直感的
   - 明示的な下部ナビゲーション
   - 左右の矢印ヒント
   - 最初/最後のページで無効化表示
   - ページ番号常時表示（例: 1-2 / 12）

2. **安定性** - 端末差・回線差対応
   - 画像読み込みタイムアウト: 10秒
   - 自動リトライ: 2回
   - エラー時のフォールバック表示
   - 画像なしでもUIは動作

3. **速さ** - 初回表示最適化
   - 現在ページ + 前後2枚を優先ロード
   - 残りはアイドル時にプリロード
   - 遅延読み込み（Lazy Loading）
   - 150dpi JPEG最適化

4. **保守性** - ページ追加が簡単
   - `CONFIG.TOTAL_PAGES` 変更のみ
   - 画像命名規則統一（page-01.jpg〜）
   - モジュール化されたコード
   - 詳細コメント

5. **見た目** - 整ったデザイン
   - 過剰演出なし
   - 軽いトランジション（350ms）
   - 弱めのシャドウ
   - ダークテーマ統一

## 🔒 セキュリティ

### セキュリティ対応状況

✅ **対応済み**
- **jQuery 3.7.1使用**: 既知の脆弱性（CVE-2020-11023, CVE-2020-11022など）を修正
- **XSS対策**: ユーザー入力を受け取らない設計
- **ローカルライブラリ**: CDN依存なし、改ざんリスク低減
- **Content-Type検証**: 画像のみ読み込み

### セキュリティベストプラクティス

本番環境で使用する場合の推奨事項：

#### 1. Content Security Policy (CSP)の設定

HTMLの`<head>`に追加：
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data:;">
```

#### 2. HTTPSの使用
```
本番環境では必ずHTTPSを使用してください。
Let's Encryptなどで無料のSSL証明書を取得可能。
```

#### 3. 定期的なライブラリ更新
```bash
# jQueryのバージョン確認
grep "jQuery v" libs/jquery.min.js

# 最新版の確認
curl -s https://code.jquery.com/ | grep "3\."
```

### 既知の制限事項

⚠️ **注意点**
- turn.js 4は2012年リリース（メンテナンス終了）
- セキュリティアップデートなし
- **本カタログでは問題なし**（ユーザー入力なし、画像表示のみ）
- 将来的にフォーム追加等する場合は再評価が必要

---

## クイックスタート

### 1. ローカルサーバー起動

```bash
# Python 3の場合
python3 -m http.server 8000

# または
npx serve
```

### 2. ブラウザでアクセス

```
http://localhost:8000/
```

### 3. 特定ページから開始

```
http://localhost:8000/?pNo=5
```

## ページの追加・差し替え

### 画像を追加する場合

1. **画像を配置**
   ```bash
   # images/ディレクトリに追加
   images/page-13.jpg
   images/page-14.jpg
   ```

2. **総ページ数を更新**
   ```javascript
   // app.js の CONFIG を編集
   const CONFIG = {
       TOTAL_PAGES: 14,  // ← ここを変更
       // ...
   };
   ```

3. **完了** - 他の変更は不要

### 画像を差し替える場合

- 該当するファイルを上書きするだけ
- ファイル名規則: `page-XX.jpg` (XXは01〜12の2桁)
- キャッシュクリア: Ctrl+Shift+R (Win) / Cmd+Shift+R (Mac)

### PDFから画像を再抽出する場合

```bash
# 仮想環境を作成（初回のみ）
python3 -m venv venv
source venv/bin/activate
pip install PyMuPDF pillow

# 抽出スクリプト実行
python extract_pdf_pages.py
```

## 設定カスタマイズ

### app.js の CONFIG 定数

```javascript
const CONFIG = {
    TOTAL_PAGES: 12,              // 総ページ数
    IMAGE_BASE_PATH: 'images/',   // 画像ディレクトリ
    IMAGE_FORMAT: 'jpg',          // 画像フォーマット
    PRELOAD_RANGE: 2,             // プリロード範囲（前後N枚）
    GUIDE_DISPLAY_DURATION: 3000, // ガイド表示時間（ms）
    DRAG_THRESHOLD: 30,           // ドラッグ判定閾値（px）
    FLIP_ANIMATION_DURATION: 500, // アニメーション時間（ms）
    IMAGE_LOAD_TIMEOUT: 10000,    // 読み込みタイムアウト（ms）
    RETRY_COUNT: 2,               // リトライ回数
};
```

### styles.css のカラーパレット

```css
:root {
    --color-bg: #1a1a1a;          /* 背景色 */
    --color-surface: #2a2a2a;     /* サーフェス色 */
    --color-text: #ffffff;        /* テキスト色 */
    --color-primary: #4a9eff;     /* プライマリ色 */
    /* ... */
}
```

## 動作環境

### 推奨ブラウザ

| ブラウザ | バージョン |
|---------|-----------|
| Chrome  | 90+ |
| Safari  | 14+ |
| Edge    | 90+ |
| Firefox | 88+ |

### 推奨デバイス

- **タブレット**: iPad (第5世代以降)、Android 10+
- **スマートフォン**: iPhone 8以降、Android 10+
- **PC**: Windows 10+、macOS 10.14+

### 画面解像度

- 最小: 375px × 667px (iPhone SE)
- 推奨: 768px × 1024px (iPad)
- 最大: 制限なし

## パフォーマンス

### 初回表示時間（目安）

| 回線速度 | 初回表示 |
|---------|---------|
| 4G LTE  | 1-2秒 |
| Wi-Fi   | 0.5-1秒 |
| 光回線  | 0.3-0.5秒 |

### 最適化ポイント

- ✅ 優先画像のみ初回ロード（現在ページ ± 2枚）
- ✅ 残りはアイドル時にバックグラウンドロード
- ✅ 画像遅延読み込み（Lazy Loading）
- ✅ JPEG最適化（150dpi、品質85%）

## トラブルシューティング

### 画像が表示されない

1. **画像パスを確認**
   - `images/page-01.jpg` が存在するか
   - ファイル名の形式が正しいか（2桁ゼロパディング）

2. **サーバーで開いているか確認**
   - `file://` では動作しない可能性あり
   - ローカルサーバー経由でアクセス

3. **ブラウザコンソールを確認**
   - F12 → Console タブ
   - エラーメッセージを確認

### ページめくりが動作しない

1. **JavaScriptエラーを確認**
   - ブラウザコンソールでエラーをチェック

2. **ドラッグ距離を確認**
   - 最低30px以上ドラッグする必要あり
   - `CONFIG.DRAG_THRESHOLD` で調整可能

3. **二重タップを避ける**
   - 300ms以内の連続操作は無視される

### ガイドが毎回表示される

- **localStorageをクリア**
  ```javascript
  // ブラウザコンソールで実行
  localStorage.removeItem('catalog_guide_shown');
  ```

## 本番デプロイ

### 静的ホスティングサービス

推奨サービス:
- **Netlify** - ドラッグ&ドロップで即デプロイ
- **Vercel** - GitHub連携で自動デプロイ
- **GitHub Pages** - 無料、独自ドメイン対応

### デプロイ手順（Netlify例）

1. [Netlify](https://www.netlify.com/)にアクセス
2. プロジェクトフォルダをドラッグ&ドロップ
3. 公開URL取得
4. 完了

### 画像最適化（推奨）

本番環境では画像をさらに最適化:

```bash
# ImageMagickで一括最適化
for f in images/*.jpg; do
  convert "$f" -quality 85 -sampling-factor 4:2:0 "$f"
done
```

## ライセンス

プロジェクト固有のライセンスに従う

## サポート

問題が発生した場合:
1. このREADMEのトラブルシューティングを確認
2. ブラウザコンソールでエラーログを確認
3. プロジェクト管理者に問い合わせ

---

**開発環境**: macOS 14+, Python 3.13+
**最終更新**: 2026-01-05
# web-catalog
