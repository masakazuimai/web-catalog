# セキュリティポリシー

## サポートされているバージョン

このプロジェクトで使用しているライブラリのバージョンとセキュリティ状況：

| ライブラリ | バージョン | セキュリティ状況 | 更新推奨 |
|-----------|-----------|----------------|---------|
| jQuery    | 3.7.1     | ✅ 安全 (最新安定版) | - |
| turn.js   | 4.0       | ⚠️ メンテナンス終了 | 本用途では問題なし |

## 既知の脆弱性と対応

### jQuery

**過去の脆弱性（修正済み）:**
- **CVE-2020-11023**: XSS脆弱性（jQuery < 3.5.0）
  - **影響**: `<option>`要素を含むHTMLの処理で任意コード実行
  - **対応**: jQuery 3.7.1使用により修正済み

- **CVE-2020-11022**: XSS脆弱性（jQuery < 3.5.0）
  - **影響**: DOM操作メソッドで任意コード実行
  - **対応**: jQuery 3.7.1使用により修正済み

**現在の状況**: ✅ 既知の脆弱性なし

### turn.js

**状況**: 2012年リリース、メンテナンス終了

**リスク評価**:
- ✅ **低リスク**: 本カタログでは以下の理由で問題なし
  - ユーザー入力を受け取らない
  - 外部データを処理しない
  - 画像表示のみの用途
  - DOM操作は制御された範囲のみ

**注意事項**:
- 将来的にユーザー入力機能を追加する場合は再評価が必要
- フォーム、コメント機能などを追加する場合は別のライブラリを検討

## セキュリティ対策

### 実装済みの対策

1. **Content Security Policy (CSP)**
   - インラインスクリプトの制限
   - 外部リソースの読み込み制限
   - XSS攻撃の緩和

2. **ローカルライブラリ使用**
   - CDN依存なし
   - 改ざんリスクの低減
   - オフライン動作

3. **入力検証**
   - ユーザー入力を受け取らない設計
   - URLパラメータは数値のみ検証
   - 画像パスはホワイトリスト方式

4. **エラーハンドリング**
   - 画像読み込み失敗時の適切な処理
   - タイムアウト設定
   - エラーメッセージのサニタイズ

### 本番環境での推奨設定

#### 1. HTTPSの強制

```nginx
# Nginxの例
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # その他のSSL設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

#### 2. セキュリティヘッダーの追加

```nginx
# Nginxの例
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

#### 3. ファイルアクセス制限

```nginx
# Nginxの例
location ~ /\. {
    deny all;
}

location ~ \.(git|py|sh|md)$ {
    deny all;
}
```

## 脆弱性の報告

セキュリティ上の問題を発見した場合：

1. **公開Issueに投稿しない**
2. プロジェクト管理者に直接連絡
3. 以下の情報を含める：
   - 脆弱性の詳細
   - 再現手順
   - 影響範囲
   - 可能であれば修正案

## セキュリティチェックリスト

本番環境にデプロイする前の確認項目：

- [ ] jQueryが最新の安定版（3.5.0以上）
- [ ] HTTPSが有効化されている
- [ ] CSPヘッダーが設定されている
- [ ] セキュリティヘッダーが設定されている
- [ ] 不要なファイル（.py, .sh, .gitなど）が除外されている
- [ ] ログイン機能など追加する場合は別途セキュリティレビュー実施
- [ ] 定期的なライブラリ更新の運用が確立されている

## ライブラリの更新手順

### jQueryの更新

```bash
# 1. 最新版をダウンロード
curl -o libs/jquery.min.js https://code.jquery.com/jquery-3.7.1.min.js

# 2. バージョン確認
grep "jQuery v" libs/jquery.min.js

# 3. テスト
# ブラウザで動作確認

# 4. 本番デプロイ
```

### セキュリティアップデート通知の購読

推奨サービス：
- [Snyk](https://snyk.io/) - オープンソースの脆弱性スキャン
- [Dependabot](https://github.com/dependabot) - GitHubの自動更新
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - npmパッケージのチェック

## 参考リンク

- [jQuery Security](https://jquery.com/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Let's Encrypt](https://letsencrypt.org/) - 無料SSL証明書

---

**最終更新**: 2026-01-05
**担当者**: プロジェクト管理者
