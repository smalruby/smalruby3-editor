# scratch-svg-renderer 内部仕様

> **⬆️ upstream そのまま** — `packages/scratch-svg-renderer/` は upstream Scratch Foundation の実装をそのまま利用。Smalruby 独自の改変はパッケージスコープ (`@smalruby/scratch-svg-renderer`) のリブランドのみ。

`packages/scratch-svg-renderer/` は **SVG コスチュームの前処理パッケージ**。SVG を WebGL レンダラーに渡せる形 (Canvas / Bitmap) に変換するために、サニタイズ・正規化・フォントインライン化・ラスタ化を行う。

## なぜ独立パッケージなのか

1. **セキュリティ重要**: ユーザーがアップロードする SVG に悪意あるコンテンツ (script, 外部 URL など) が含まれる可能性 → 独立した sanitization 層
2. **重い依存** (DOMPurify, css-tree): WebGL レンダラーから切り離すことで、SVG 不使用のシナリオでロードしない
3. **再利用性**: scratch-paint (ペイントエディタ)、コスチュームインポーターなど、レンダラー以外からも使う
4. **Vector → Raster ブリッジ**: WebGL は SVG をネイティブ描画できないため、Canvas 経由でラスタ化する必要がある

## 対象読者

- **SVG コスチューム関連のバグ**を調査する人
- **Scratch 2.0 由来の SVG quirks** に対応した何かを追加・修正する人
- **フォント処理**を理解したい人

## 概要

| 項目 | 値 |
|---|---|
| バージョン | 13.0.0 (upstream 同期) |
| Entry | `packages/scratch-svg-renderer/src/index.js` (関数群を export) |
| 主要依存 | `css-tree` (CSS パース), `isomorphic-dompurify` (SVG サニタイズ), `transformation-matrix` (2D 行列), `base64-js` |

## 公開 API (`src/index.js`)

```js
{
    SVGRenderer,           // (deprecated) quirks-mode renderer クラス
    loadSvgString,         // SVG 文字列をパース・検証して DOM tree を返す
    serializeSvgToString,  // DOM tree を文字列化
    sanitizeSvg,           // 危険なコンテンツを除去
    convertFonts,          // フォント形式変換 (WOFF ↔ TTF)
    inlineSvgFonts,        // フォント定義を <defs> に埋め込む
    BitmapAdapter          // SVG を Canvas にラスタ化
}
```

クラスではなく**関数群**として提供される。

## 主要モジュール

### `load-svg-string.js`

SVG 文字列の取り込みのメインフロー：

1. **XML パース** (DOMParser またはサーバ環境では xmldom)
2. **Scratch 2.0 quirks 修正**:
   - 誤った viewBox の補正
   - width/height 欠落の補完
   - 古い style 属性の正規化
3. **境界計測** (実際の表示サイズの計算)
4. **DOM tree + メタデータ** を返す

### `sanitize-svg.js`

セキュリティの要。`isomorphic-dompurify` で以下を除去・無害化：

- **外部 URL 参照** (`xlink:href` で http:// / https:// を指すもの)
- **`url()` 参照**で外部リソース (フォント、画像) を指すもの
- **スクリプト** (`<script>`, イベントハンドラ属性)
- **`data:` URL** (例外: 安全な `data:image/...` のみ許可)
- 不正な構造の修正

→ ユーザーアップロード SVG の XSS 攻撃を防ぐ。

### `font-inliner.js` + `font-converter.js`

Canvas での描画は **HTML カスタムフォントをリンクできない**ため、SVG 内のフォント定義を **base64 エンコードしたフォントデータとして `<defs>` に埋め込む** 必要がある：

1. SVG 内の `font-family` 属性をスキャン
2. `scratch-render-fonts` パッケージから対応するフォントデータ (WOFF / TTF) を取得
3. `<style>@font-face { ... }</style>` を SVG の `<defs>` に注入
4. これで Canvas 描画時に正しいフォントで描画される

### `bitmap-adapter.js`

SVG → Canvas ラスタ化の本体：

```
1. SVG bounds を計測
2. Canvas を bounds に合わせてリサイズ
3. ctx.drawImage() で SVG をデータ URL 経由で描画
4. ctx.getImageData() で ImageData (pixel array) を取得
5. 回転中心情報 + bitmap を返す
```

これが `scratch-render` の SVGSkin が WebGL テクスチャをアップロードするときの入力。

### `transform-applier.js`

SVG の `transform=""` 属性 (translate / rotate / scale / skew / matrix) をパースして 2D 行列として適用するユーティリティ。

### `svg-renderer.js` (deprecated)

旧 quirks-mode の `SVGRenderer` クラス。新規コードでは使わない。後方互換のため残置。

## scratch-render との連携

```
SVG コスチューム (string)
  ↓
scratch-svg-renderer:
  loadSvgString → sanitizeSvg → inlineSvgFonts → DOM tree
  ↓
scratch-render の SVGSkin:
  BitmapAdapter で Canvas にラスタ化
  ↓
WebGL texture upload
```

## upstream との差分

**ゼロ** (パッケージスコープのリブランドのみ):
- `package.json` の `"name": "@smalruby/scratch-svg-renderer"`
- 内部実装は upstream 同期

upstream マージ時の競合は基本的に発生しない。

## 関連ドキュメント

- [`scratch-render/README.md`](../scratch-render/README.md) — WebGL レンダラー (本パッケージの主要利用者)
- 上流: [scratch-svg-renderer GitHub](https://github.com/scratchfoundation/scratch-svg-renderer)

## 関連 Issue

特になし (upstream 同期で進化)。
