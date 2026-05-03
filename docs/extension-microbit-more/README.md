# 拡張機能: micro:bit More

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された拡張機能（Yengawa Lab の [microbit-more](https://github.com/microbit-more/) との連携実装）

- **Smalruby ランタイム対応**: ❌（smalruby3 gem は未対応。BLE / Web Serial を使うためブラウザ専用）
- **デフォルト表示**: ✅（拡張機能ライブラリにデフォルトで表示される）

## 概要

**micro:bit More**（マイクロビット モア）は、標準の Scratch micro:bit 拡張機能に対して大幅に機能を拡張した拡張機能。upstream の `microbit` 拡張がボタン・LED マトリクス・加速度の基本機能のみなのに対し、**More** は以下を追加：

- **詳細なセンサ**: 温度、明るさ、磁気、コンパス方位、ピッチ・ロール、音レベル
- **ジェスチャ**: 振る、ロゴタッチ、傾きなど多数
- **ピン I/O**: デジタル / アナログの入出力、プルアップ/ダウン、サーボ、PWM
- **音楽**: トーン再生
- **テキスト表示**: 文字列の流し表示

接続方式は **BLE (Bluetooth Low Energy)** と **Web Serial** の両対応。

カスタムファームウェア (microbit-more 公式) を micro:bit に書き込んだ上で利用する。ファームウェア書き込みは別ツールまたは本拡張内のフラッシャから実行できる。

## ユーザーストーリー

- **micro:bit を持っている小学生・中学生**として、加速度や温度センサを使ったプログラムを Smalruby で書きたい
- **教師**として、micro:bit の全センサとピンを Smalruby から使えるようにしたい
- **メイカー**として、micro:bit + 各種センサ・モーターで作品を作りたい
- **理科教育**として、温度・明るさ・磁気を測定する実験を Smalruby から制御したい

## UI / 操作フロー

1. **ファームウェア書き込み**: micro:bit More 用の HEX を micro:bit に書き込む（標準 micro:bit ファームウェアからの差し替え）
2. ブロックパレットの「拡張機能を追加」から **micro:bit More** を選ぶ
3. 接続モーダルで BLE または Web Serial を選択
4. ペアリング後、各種センサ・I/O ブロックを使う

## 主要ファイル

### scratch-gui

- `packages/scratch-gui/src/lib/libraries/extensions/microbitMore/` — 拡張機能登録（アイコン、descriptions、collaborator: 'Yengawa Lab'）
- `packages/scratch-gui/src/lib/microbit-more-update.js` — micro:bit More ファームウェア更新（DAPjs + microbit-universal-hex）
- `packages/scratch-gui/src/lib/microbit-update.js` — 標準 micro:bit ファームウェア更新（参考）
- `packages/scratch-gui/src/lib/ruby-generator/microbit_more.js` — microbit-more ブロック → Ruby 変換

### scratch-vm

- `packages/scratch-vm/src/extensions/microbitMore/index.js` — 拡張機能本体
- `packages/scratch-vm/src/extensions/microbitMore/ble-llk.js` — BLE 通信
- `packages/scratch-vm/src/extensions/microbitMore/serial-web.js` — Web Serial 通信
- `packages/scratch-vm/src/extensions/microbitMore/translations.json` — i18n

### infra

なし。

## 関連ブロック（主要 opcode）

### ボタン・ジェスチャ・タッチ

| opcode | 説明 |
|---|---|
| `whenButtonEvent` / `isButtonPressed` | ボタンイベント |
| `whenGesture` | ジェスチャ Hat |
| `whenTouchEvent` / `isPinTouched` | タッチ |

### LED 表示

| opcode | 説明 |
|---|---|
| `displayMatrix` | LED マトリクス |
| `display`, `displayClear` | アイコン表示・クリア |
| `displayText` | 文字列流し表示 |

### 傾き・加速度

| opcode | 説明 |
|---|---|
| `whenTilted` / `isTilted` / `getTiltAngle` | 傾き検出 |
| `getPitch`, `getRoll` | ピッチ・ロール |
| `getAcceleration` | 加速度 |

### センサ

| opcode | 説明 |
|---|---|
| `getLightLevel` | 明るさ |
| `getTemperature` | 温度 |
| `getCompassHeading` | コンパス方位 |
| `getMagneticForce` | 磁気 |
| `getSoundLevel` | 音レベル |

### ピン I/O

| opcode | 説明 |
|---|---|
| `whenPinConnected` | ピン接続 Hat |
| `whenConnectionChanged` | 接続状態変化 Hat |
| `setPullMode` | プルアップ/ダウン設定 |
| `isPinHigh`, `getAnalogValue` | ピン状態取得 |
| `setDigitalOut`, `setAnalogOut`, `setServo` | デジタル/アナログ/サーボ出力 |
| `playTone` | トーン再生 |

> 各ブロックの Ruby 表現は [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) を参照。

## 設定・データ永続化

なし。

## 動作環境

- **対応ブラウザ**:
  - **BLE**: Chrome / Edge (Web Bluetooth サポート)
  - **Web Serial**: Chrome / Edge
- **必須**: micro:bit More カスタムファームウェアを micro:bit に書き込んでおくこと

## ライセンス

- 本拡張は Yengawa Lab の microbit-more プロジェクト由来
- ブロック定義の collaborator として "Yengawa Lab" を表示

## 関連ドキュメント

- 上流: [microbit-more (Yengawa Lab)](https://github.com/microbit-more/)
- [`docs/extension-microbit/`](../extension-microbit/) — upstream の標準 micro:bit 拡張 (準備中)
- [`docs/device-connection/`](../device-connection/) — connection-modal 共通基盤 (準備中)

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*microbit_more|microbitMore` で grep）。
