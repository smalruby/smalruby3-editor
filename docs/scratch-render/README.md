# scratch-render 内部仕様

> **⬆️ upstream そのまま** — `packages/scratch-render/` は upstream Scratch Foundation の実装をそのまま利用。Smalruby 独自の改変はパッケージスコープ (`@smalruby/scratch-render`) のリブランドのみ。

`packages/scratch-render/` は **WebGL ベースのステージレンダラー**。スプライト・背景・ペンレイヤー・吹き出しを Canvas 上に描画する。scratch-vm から呼ばれて、毎フレーム再描画する。

## 対象読者

- **描画バグの調査**をする開発者
- **新しいエフェクト**を追加したい人
- **新しい Skin 種別**を追加したい人 (例: Smalruby 独自の描画レイヤー)
- VM とレンダラー間の API を理解したい人

## 概要

| 項目 | 値 |
|---|---|
| バージョン | 13.0.0 (upstream 同期) |
| Entry | `packages/scratch-render/src/index.js` (`RenderWebGL` を export) |
| 主要依存 | `twgl.js` (WebGL utility), `hull.js` (衝突判定), `@smalruby/scratch-svg-renderer` (SVG 処理) |
| ステージサイズ | 480 × 360 (xLeft=-240, xRight=240, yBottom=-180, yTop=180) |
| ステージ境界 fence | 15px (スプライトを画面外に出ないようクランプ) |

## ざっくり構造

```
RenderWebGL (公開 API)
  ├─ canvas: HTMLCanvasElement
  ├─ gl: WebGLRenderingContext (twgl.js でラップ)
  ├─ _drawables: Map<id, Drawable>
  ├─ _skins: Map<id, Skin>
  ├─ _layerGroups: { name → drawableID[] }   (z-order)
  ├─ _shaderManager: ShaderManager
  └─ メソッド:
       - createDrawable(group) → drawableID
       - updateDrawable(id, props)
       - updateDrawableEffect(id, effectName, value)
       - updateDrawableSkinId(id, skinID)
       - createBitmapSkin(...)/createSVGSkin(...)/createPenSkin(...)/createTextBubbleSkin(...)
       - draw()                              ← 毎フレーム呼ぶ
       - setLayerGroupOrdering(["backdrop", "pen", "sprites", "sky"])

Drawable (スプライト・背景・吹き出し等の 1 個)
  ├─ skin: Skin (テクスチャ供給元)
  ├─ position, rotation, scale, visible
  ├─ effects: { color, fisheye, whirl, pixelate, mosaic, brightness, ghost }
  ├─ enabledEffects: bitmask (有効なエフェクトのみシェーダ分岐)
  └─ silhouette: 衝突判定用 (Skin 経由)

Skin (抽象基底)
  ├─ BitmapSkin    — PNG/JPG コスチューム
  ├─ SVGSkin       — SVG コスチューム (scratch-svg-renderer 経由でラスタ化)
  ├─ PenSkin       — ペン描画レイヤー (動的に更新される WebGL テクスチャ)
  └─ TextBubbleSkin — say/think の吹き出し

ShaderManager
  ├─ EFFECT_INFO: { color, fisheye, whirl, pixelate, mosaic, brightness, ghost }
  └─ enabledEffects ビットマスクに応じてシェーダプログラムを選択
```

## VM ↔ Renderer の繋がり

`scratch-vm` の `Runtime` がレンダラーへの参照を持ち、以下のフローで描画する：

```
1. プロジェクトロード時:
   for sprite of targets:
     skinID = renderer.createBitmapSkin(...) または createSVGSkin(...)
     drawableID = renderer.createDrawable('sprites')
     renderer.updateDrawableSkinId(drawableID, skinID)

2. ブロック実行時 (move, set x など):
   renderer.updateDrawablePosition(drawableID, [x, y])
   renderer.updateDrawableDirection(drawableID, direction)
   renderer.updateDrawableScale(drawableID, [size, size])

3. エフェクトブロック実行時:
   renderer.updateDrawableEffect(drawableID, 'color', 25)

4. 毎フレーム:
   renderer.draw()   ← 全 drawables を z-order で描画
```

実際のコール元は `packages/scratch-vm/src/sprites/rendered-target.js` の `setXY`, `setDirection`, `setSize` 等。

## エフェクト一覧

`src/ShaderManager.js` で定義されている 7 種類：

| エフェクト | uniform | 入力範囲 | shape 変化 | 説明 |
|---|---|---|---|---|
| **color** | `u_color` | 0–200 (200 で 1 周) | × | 色相シフト |
| **fisheye** | `u_fisheye` | -100 to ∞ | ✅ | 魚眼レンズ歪み |
| **whirl** | `u_whirl` | ±∞ (degrees) | ✅ | 回転的歪み |
| **pixelate** | `u_pixelate` | 1–512 | ✅ | ピクセル化 |
| **mosaic** | `u_mosaic` | 1–512 | ✅ | モザイク |
| **brightness** | `u_brightness` | -100 to +100 | × | 明度変化 |
| **ghost** | `u_ghost` | 0–100 (%) | × | 透明度 |

**shape 変化系**は衝突判定の silhouette を invalidate する (再生成が必要)。

### 新しいエフェクトの追加

1. `src/ShaderManager.js` の `EFFECT_INFO` にエントリ追加
2. `src/shaders/sprite.frag` に `#ifdef ENABLE_EFFECTNAME` で実装追加
3. `Drawable.js` に uniform を追加
4. テストを `test/integration/` に追加

## レイヤー (z-order)

`setLayerGroupOrdering(['backdrop', 'pen', 'sprites', 'sky'])` で順序を指定：

| レイヤー | 用途 |
|---|---|
| `backdrop` | ステージの背景 |
| `pen` | ペン拡張の描画レイヤー (PenSkin) |
| `sprites` | スプライト群 |
| `sky` | UI overlay (今後拡張用) |

各 drawable は **作成時にどのレイヤーグループに属するか**を指定する。

## Skin 種別

### BitmapSkin

PNG / JPG コスチューム。WebGL テクスチャに直接アップロード。

### SVGSkin

SVG コスチューム。**`scratch-svg-renderer` でサニタイズ・正規化** → Canvas にラスタ化 → WebGL テクスチャ。

複数の MIP レベル (異なる scale でのラスタ化結果) を保持し、表示倍率に応じて適切なものを選ぶ (= テクスチャ品質の維持)。

### PenSkin

ペン拡張機能の描画レイヤー。**動的に更新される WebGL フレームバッファ**として実装され、ブロックから線分・スタンプを書き加えていく。

### TextBubbleSkin

say / think の吹き出し。テキストレイアウト → Canvas 描画 → テクスチャ化。

### 新しい Skin 種別の追加

1. `Skin` 基底クラスを継承したクラスを `src/MySkin.js` に作成
2. `_uploadTexture()` でテクスチャ生成、`_silhouette` 更新を実装
3. `RenderWebGL.createMySkin(...)` ファクトリメソッドを追加
4. テストを追加

## 衝突判定 (Silhouette)

`src/Silhouette.js`:

- **CPU パス**: drawable 単位で convex hull (`hull.js`) を計算、特定座標の色を見て touching を判定
- **GPU パス**: オフスクリーンテクスチャに描画 → `readPixels()` で touching 判定 (warped shapes に有効、低速)

## デバッグ機能

- `setDebugCanvas(canvas)` — シェーダ出力やピッキング情報を別 Canvas に描画
- ブラウザコンソールで `window.smalruby.runtime.renderer` から RenderWebGL インスタンスにアクセス可能

## upstream との差分

**ゼロ** (パッケージスコープのリブランドのみ):
- `package.json` の `"name": "@smalruby/scratch-render"`
- 内部実装は upstream 同期 (146+ コミットの履歴を fork 後も維持)

upstream マージ時の競合は基本的に発生しない (機能改変なし)。

## 関連ドキュメント

- [`scratch-svg-renderer/README.md`](../scratch-svg-renderer/README.md) — SVG 前処理 (本パッケージから依存)
- [`scratch-vm/architecture.md`](../scratch-vm/architecture.md) — VM 側からの呼び出しフロー
- 上流: [scratch-render GitHub](https://github.com/scratchfoundation/scratch-render)

## 関連 Issue

特になし (upstream 同期で進化)。
