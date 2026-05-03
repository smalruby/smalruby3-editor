# 拡張機能: Vernier Go Direct Force & Acceleration (gdxfor)

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

- **Smalruby ランタイム対応**: ❌（smalruby3 gem 未対応。Web Bluetooth 経由）
- **デフォルト表示**: ❌（`defaultHidden: true`）— 拡張機能ライブラリで「見る」ボタンを押すと表示
- **collaborator**: Vernier

## 概要

[Vernier の Go Direct Force & Acceleration センサ](https://www.vernier.com/product/go-direct-force-acceleration-sensor/) を Smalruby から制御する拡張機能。理科教育向けの精密な力・加速度測定。upstream Scratch 標準。

## ユーザーストーリー

- **理科の授業で実験する中学生・高校生**として、力や加速度のリアルなデータを Smalruby に取り込みたい
- **教師（理科）**として、振り子・斜面実験などをデジタル化したい

## 主要ファイル

- 拡張機能登録: `packages/scratch-gui/src/lib/libraries/extensions/index.jsx` の `extensionId: 'gdxfor'` (`defaultHidden: true`)
- VM 実装: `packages/scratch-vm/src/extensions/scratch3_gdx_for/`

## 関連ブロック（主要 opcode）

| opcode | 説明 |
|---|---|
| `gdxfor_whenForcePushedOrPulled` | 力をかけたとき |
| `gdxfor_getForce` | 力（N）|
| `gdxfor_whenAccelerationCompare` | 加速度の比較 |
| `gdxfor_getAcceleration` | 加速度 |
| `gdxfor_isFreeFalling` | 自由落下中か |
| `gdxfor_whenSpinDirection` | 回転方向検知 |

## 動作環境

- **対応ブラウザ**: Chrome / Edge (Web Bluetooth サポート)

## 関連ドキュメント

- 上流: [scratch-vm のドキュメント](https://github.com/scratchfoundation/scratch-vm)
- [Vernier 公式](https://www.vernier.com/)
