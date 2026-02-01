# dist ビルド調査レポート

## タスク（目的）

smalruby3-editor の本番デプロイ用に、最適化された production ビルドを `dist/` ディレクトリに HTML 付きで出力する仕組みを追加する。

### デプロイ先と使用ディレクトリ

- **smalruby.app (本番)**: `dist/` を使用（最適化されたビルド）
- **smalruby3-editor (develop)**: `build/` を使用（プレビュー用）
- **PR ブランチ**: `build/` を使用（プレビュー用）

## 問題点

### 現状

- `build/` ディレクトリ: 開発ビルド（HTML + JS、圧縮なし、ソースマップあり）
- `dist/` ディレクトリ: JS ライブラリのみ（HTML なし）

### 発生している問題

webpack で `dist/` に HTML を出力しようとすると、TerserPlugin の段階でビルドが失敗する。

```
<s> [webpack.Progress] 92% sealing asset processing TerserPlugin
npm error Lifecycle script `build:dist-html` failed with error:
npm error code 1
```

エラーメッセージの詳細が表示されないため、原因の特定が困難。

## 調査内容

### 1. webpack.config.js の分析

#### 既存の設定

- **buildConfig** (lines 193-269):
  - 出力先: `build/`
  - HTML を生成（HtmlWebpackPlugin）
  - PWA サポート（ServiceWorker, Manifest）
  - エントリーポイント: `src/playground/index.jsx`

- **buildWithPwaConfig** (lines 271-305):
  - buildConfig をベースに PWA プラグインを追加
  - 出力先: `build/`

- **distConfig** (lines 154-179):
  - 出力先: `dist/`
  - JS ライブラリのみ（scratch-gui.js）
  - HTML を生成しない
  - `clean: false` 設定

- **distStandaloneConfig** (lines 182-190):
  - 出力先: `dist/`
  - スタンドアロン版 JS（scratch-gui-standalone.js）
  - HTML を生成しない

#### 試した設定

**アプローチ 1**: buildWithPwaConfig.clone() をベースに distWithHtmlConfig を作成

```javascript
const distWithHtmlConfig = buildWithPwaConfig.clone()
    .merge({
        output: {
            path: path.resolve(__dirname, 'dist')
        }
    });
```

**結果**: TerserPlugin でビルド失敗

**アプローチ 2**: buildConfig.clone() をベースに distWithHtmlConfig を作成

```javascript
const distWithHtmlConfig = buildConfig.clone()
    .merge({
        output: {
            path: path.resolve(__dirname, 'dist')
        }
    })
    .addPlugin(new WorkboxPlugin.GenerateSW({...}))
    .addPlugin(new WebpackPwaManifest({...}));
```

**結果**: TerserPlugin でビルド失敗

### 2. index.jsx vs standalone.jsx の調査

#### index.jsx (render-gui.jsx)
- 通常の Smalruby GUI
- React 18 の `createRoot()` を使用
- `onClickLogo` が `https://smalruby.jp` にリダイレクト
- Redux ベースの通常実装
- **デプロイに適している**

#### standalone.jsx (render-gui-standalone.jsx)
- スタンドアロン版（埋め込み用）
- `onClickLogo` が `https://scratch.mit.edu`（upstream のまま）
- 独自のステート管理
- **ライブラリとして配布する用途**

### 3. build スクリプトの分析

```json
"build:dev": "BUILD_TYPE=dev webpack"
  → build/ に HTML + JS（開発ビルド）

"build:dist": "cross-env NODE_ENV=production BUILD_TYPE=dist webpack"
  → dist/ に scratch-gui.js のみ（ライブラリ配布用）

"build:dist-standalone": "cross-env NODE_ENV=production BUILD_TYPE=dist-standalone webpack"
  → dist/ に scratch-gui-standalone.js のみ（使用していない）
```

## 考えられる問題

### 1. output 設定の競合

- distConfig に `clean: false` が設定されている
- buildConfig から継承した設定と競合している可能性

### 2. library 設定の干渉

- distConfig には `output.library` の設定がある
- HTML 出力時にこの設定が干渉している可能性

### 3. ScratchWebpackConfigBuilder の .clone() の挙動

- .clone() が正しく動作していない可能性
- 内部状態が正しくコピーされていない可能性

### 4. TerserPlugin の設定

- 本番モードでの TerserPlugin の動作
- 圧縮処理中にエラーが発生している

### 5. publicPath の設定

- buildConfig: `publicPath: ''`
- distConfig: `publicPath: 'auto'`
- この違いが影響している可能性

## 現在の状態

### 変更したファイル

1. **webpack.config.js**
   - distWithHtmlConfig を追加（エラーで失敗）
   - BUILD_TYPE='dist-html' のケースを追加

2. **package.json**
   - `build:dist-html` スクリプトを追加
   - build スクリプトから `build:dist` と `build:dist-standalone` を削除

3. **.github/workflows/ci-cd.yml**
   - smalruby.app へのデプロイで `dist/` を使用するように変更
   - smalruby3-editor へのデプロイで `dist/` を使用するように変更（要修正）

### ビルドエラーログ

```
<s> [webpack.Progress] 92% sealing asset processing TerserPlugin
npm error Lifecycle script `build:dist-html` failed with error:
npm error code 1
npm error path /app/packages/scratch-gui
npm error workspace @smalruby/scratch-gui@12.3.1
npm error location /app/packages/scratch-gui
npm error command failed
npm error command sh -c cross-env NODE_ENV=production BUILD_TYPE=dist-html webpack
```

## 解決策

### 原因

TerserPlugin が複数の大きなエントリーポイントを並列で圧縮しようとした際に、メモリ不足またはタイムアウトで "Killed" になることが原因。

### 実装した解決策

#### 1. webpack.config.js

```javascript
// build the production website in `dist/` with HTML, PWA, and optimized assets
const distWithHtmlConfig = buildConfig.clone()
    .merge({
        devtool: false, // Disable source maps for production
        output: {
            path: path.resolve(__dirname, 'dist'),
            clean: false
        },
        optimization: {
            minimize: true,
            minimizer: [
                new (require('terser-webpack-plugin'))({
                    parallel: 1, // Limit parallel processing to avoid memory issues
                    terserOptions: {
                        compress: {
                            drop_console: false // Keep console for debugging
                        }
                    }
                })
            ]
        }
    })
    .addPlugin(
        new WorkboxPlugin.GenerateSW({
            disableDevLogs: !process.env.DEBUG,
            clientsClaim: true,
            skipWaiting: true,
            additionalManifestEntries: assetsManifest,
            exclude: [
                /\.DS_Store/
            ],
            maximumFileSizeToCacheInBytes: 64 * 1024 * 1024
        })
    )
    .addPlugin(
        new WebpackPwaManifest({
            publicPath: './',
            name: 'Smalruby',
            short_name: 'Smalruby',
            description: 'GraphicaL User Interface for creating and running Smalruby 3.0 projects',
            background_color: '#ffffff',
            orientation: 'any',
            crossorigin: 'use-credentials',
            inject: true,
            ios: {
                'apple-mobile-web-app-title': 'Smalruby',
                'apple-mobile-web-app-status-bar-style': 'default'
            },
            icons: [
                {
                    src: path.resolve('static/pwa-icon.png'),
                    sizes: [96, 128, 192, 256, 384, 512]
                }
            ]
        })
    );
```

**重要なポイント**:
- `buildConfig.clone()` をベースにする（HTML 生成とエントリーポイントを継承）
- `devtool: false` でソースマップを削除
- `optimization.minimize: true` で圧縮を有効化
- `TerserPlugin` の `parallel: 1` で並列処理を制限してメモリ不足を回避
- PWA プラグイン（WorkboxPlugin, WebpackPwaManifest）を追加

#### 2. package.json

```json
"build:dist-html": "cross-env NODE_ENV=production BUILD_TYPE=dist-html webpack"
```

#### 3. ci-cd.yml

```yaml
# smalruby.app (production): dist/ を使用
- name: Deploy to smalruby.app GitHub Pages
  with:
    publish_dir: ./packages/scratch-gui/dist

# smalruby3-editor GitHub Pages (staging): build/ を使用
- name: Deploy to smalruby3-editor GitHub Pages
  with:
    publish_dir: ./packages/scratch-gui/build
```

### ビルド結果

- ビルド時間: 約 3.6 分
- JS ファイルが圧縮されている（各エントリーポイント約 20MB）
- ソースマップなし
- Service Worker 生成済み
- HTML ファイル 5 個生成

### デプロイ構成

| 環境 | URL | ディレクトリ | 用途 |
|------|-----|--------------|------|
| Production | https://smalruby.app | `dist/` | 本番環境（最適化済み） |
| Staging | https://smalruby.github.io/smalruby3-editor/ | `build/` | ステージング環境 |
| PR Preview | https://smalruby.github.io/smalruby3-editor/{branch}/ | `build/` | プレビュー環境 |

## 次のステップ（デバッグ候補）

### 1. エラーログの詳細を確認

```bash
# webpack のエラーログを詳細に出力
docker compose run --rm app bash -c "cd packages/scratch-gui && NODE_ENV=production BUILD_TYPE=dist-html npx webpack --stats=errors-only"
```

### 2. TerserPlugin を無効化してテスト

webpack.config.js で一時的に TerserPlugin を無効化して、HTML が生成されるか確認。

### 3. mode を development に変更してテスト

NODE_ENV=production の代わりに development でビルドして、問題を切り分ける。

### 4. output 設定を明示的に指定

```javascript
const distWithHtmlConfig = buildConfig.clone()
    .merge({
        mode: 'production',
        output: {
            path: path.resolve(__dirname, 'dist'),
            publicPath: '',
            clean: true,
            library: undefined
        }
    })
    // PWA プラグインを追加
```

### 5. 別のアプローチ: build/ を dist/ にコピー

webpack の設定を変更せず、CI/CD で build/ を dist/ にコピーする方法。

```yaml
- name: Prepare deployment files for smalruby.app
  if: github.ref == 'refs/heads/develop'
  run: |
    cp -r packages/scratch-gui/build packages/scratch-gui/dist
    touch packages/scratch-gui/dist/.nojekyll
```

## 参考情報

### upstream scratch-gui の設計思想

- `dist/` はライブラリとして配布することが目的
- HTML を含むウェブサイトは `build/` に出力
- smalruby3-editor では HTML を含むウェブサイトをデプロイしたい

### ビルド時間の考慮

- `build:dev`: HTML 生成 + PWA → 約 100%
- `build:dist`: JS のみ → 約 80%
- `build:dist-html`（新規）: HTML 生成 + PWA → 約 100%
- standalone を削除すれば、新規の dist-html を追加してもほぼ同じビルド時間

## 関連ファイル

- `packages/scratch-gui/webpack.config.js`
- `packages/scratch-gui/package.json`
- `packages/scratch-gui/src/playground/index.jsx`
- `packages/scratch-gui/src/playground/render-gui.jsx`
- `.github/workflows/ci-cd.yml`
