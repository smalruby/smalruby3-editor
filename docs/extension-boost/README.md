# 拡張機能: LEGO BOOST

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

- **Smalruby ランタイム対応**: ❌（smalruby3 gem 未対応。Web Bluetooth 経由）
- **デフォルト表示**: ❌（`defaultHidden: true`）— 拡張機能ライブラリで「見る」ボタンを押すと表示
- **collaborator**: LEGO

## 概要

[LEGO BOOST](https://www.lego.com/en-us/themes/boost) を Smalruby から制御する拡張機能。BOOST のモーター・LED・距離センサ・カラーセンサを Web Bluetooth 経由で操作。upstream Scratch 標準。

## ユーザーストーリー

- **LEGO BOOST を持っている小学生**として、LEGO ロボットを Smalruby から動かしたい
- **保護者**として、市販の LEGO 教材で子供のプログラミング学習をさせたい

## 主要ファイル

- 拡張機能登録: `packages/scratch-gui/src/lib/libraries/extensions/index.jsx` の `extensionId: 'boost'` (`defaultHidden: true`)
- VM 実装: `packages/scratch-vm/src/extensions/scratch3_boost/`

## 関連ブロック（主要 opcode）

| opcode | 説明 |
|---|---|
| `boost_motorOnFor` / `boost_motorOnForRotation` | モーター動作（時間/回転） |
| `boost_motorOn` / `boost_motorOff` | モーター ON/OFF |
| `boost_setMotorPower` | モーターパワー設定 |
| `boost_setMotorDirection` | 方向設定 |
| `boost_whenColor` | カラーセンサが N の時 |
| `boost_getColor` | カラーセンサ値 |
| `boost_seeingColor` | カラー検出中か |
| `boost_whenTilted` | 傾いたとき |
| `boost_setLightHue` | LED の色 |

## 動作環境

- **対応ブラウザ**: Chrome / Edge (Web Bluetooth サポート)

## 関連ドキュメント

- 上流: [scratch-vm のドキュメント](https://github.com/scratchfoundation/scratch-vm)
