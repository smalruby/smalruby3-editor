# dist ビルドの動作確認手順

## 概要

本番環境（smalruby.app）へのデプロイ用に最適化された `dist/` ビルドの動作確認手順です。

## 前提条件

- Docker がインストールされている
- リポジトリをクローン済み
- `.env` ファイルが設定されている（GTM_ID など）

## 手順

### 1. 開発ビルド（build/）の確認

開発環境用のビルドを確認します。

```bash
# 開発サーバーを起動
docker compose up app

# ブラウザでアクセス
open http://localhost:8601
```

**確認ポイント**:
- ✅ アプリケーションが正常に表示される
- ✅ ソースマップが利用可能（開発ツールでソースコードが見える）
- ✅ Console ログが表示される

### 2. 本番ビルド（dist/）の確認

本番環境用のビルドを確認します。

```bash
# dist ビルドを作成してサーバーを起動
docker compose run --rm app bash -c "cd packages/scratch-gui && npm run start:dist"

# ブラウザでアクセス
open http://localhost:8602
```

**確認ポイント**:
- ✅ アプリケーションが正常に表示される
- ✅ JS ファイルが圧縮されている（DevTools → Network タブで確認）
- ✅ ソースマップがない（ファイルサイズが小さい）
- ✅ Service Worker が登録されている（DevTools → Application → Service Workers）
- ✅ PWA Manifest が登録されている（DevTools → Application → Manifest）
- ✅ GTM が動作している（GTM_ID が設定されている場合、dataLayer を確認）

### 3. ビルドサイズの確認

```bash
# build/ のサイズを確認
docker compose run --rm app bash -c "du -sh packages/scratch-gui/build"

# dist/ のサイズを確認
docker compose run --rm app bash -c "du -sh packages/scratch-gui/dist"
```

**期待値**:
- `dist/` は圧縮されているため、JS ファイルサイズが小さい
- ソースマップがないため、全体のサイズも小さい

### 4. 個別ビルドコマンド

必要に応じて、個別にビルドを実行できます。

#### dist/ のみビルド

```bash
docker compose run --rm app bash -c "cd packages/scratch-gui && npm run build:dist-html"
```

#### build/ のみビルド

```bash
docker compose run --rm app bash -c "cd packages/scratch-gui && npm run build:dev"
```

#### 両方をビルド

```bash
docker compose run --rm app npm run build
```

## トラブルシューティング

### ビルドが "Killed" で終了する

**原因**: TerserPlugin がメモリ不足でプロセスが強制終了されている

**解決策**: 既に `parallel: 1` に設定済み。これ以上の最適化は難しい。

### dist/ に HTML が生成されない

**原因**: webpack.config.js の distWithHtmlConfig が正しく設定されていない

**確認**:
```bash
# webpack.config.js を確認
cat packages/scratch-gui/webpack.config.js | grep -A 50 "distWithHtmlConfig"
```

### Service Worker が登録されない

**原因**: HTTPS または localhost 以外でアクセスしている

**解決策**: localhost でアクセスするか、HTTPS でアクセスする

## CI/CD での確認

GitHub Actions でのビルドログを確認します。

1. GitHub Actions のページを開く: https://github.com/smalruby/smalruby3-editor/actions
2. 最新のワークフローをクリック
3. "build-and-deploy" ジョブのログを確認
4. "Run Build" ステップで dist/ が生成されることを確認
5. "Deploy to smalruby.app GitHub Pages" ステップで dist/ がデプロイされることを確認

## デプロイ後の確認

### smalruby.app (production)

```bash
# 本番環境にアクセス
open https://smalruby.app
```

**確認ポイント**:
- ✅ アプリケーションが正常に表示される
- ✅ JS ファイルが圧縮されている
- ✅ Service Worker が動作している
- ✅ PWA としてインストール可能
- ✅ GTM が動作している（dataLayer を確認）

### smalruby3-editor GitHub Pages (staging)

```bash
# ステージング環境にアクセス
open https://smalruby.github.io/smalruby3-editor/
```

**確認ポイント**:
- ✅ アプリケーションが正常に表示される
- ✅ 開発ビルド（build/）が使用されている
- ✅ Service Worker が動作している

## 関連ファイル

- `packages/scratch-gui/webpack.config.js` - distWithHtmlConfig の定義
- `packages/scratch-gui/package.json` - build:dist-html, start:dist スクリプト
- `.github/workflows/ci-cd.yml` - デプロイ設定
- `.env.example` - 環境変数の例

## 参考資料

- [調査レポート](.claude/investigation-dist-build.md)
- [Issue #44](https://github.com/smalruby/smalruby3-editor/issues/44)
