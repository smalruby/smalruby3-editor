# 拡張機能: Smalruby Koshien

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された拡張機能

- **Smalruby ランタイム対応**: ❌（ブラウザ専用）
- **デフォルト表示**: ✅（拡張機能ライブラリにデフォルトで表示される）

## 概要

**スモウルビー甲子園**（Smalruby Koshien）競技用の拡張機能。プレイヤー（参加者の AI プログラム）がマップ上を移動し、アイテムを集めながらゴールを目指すターン制の競技。本拡張は競技と同じルールで動く**内蔵の練習ゲーム（モック）**を持ち、マップ情報取得、移動コマンド、ルート計算などのブロックを 1 つずつ実行しながら AI をデバッグできる。

内蔵練習ゲームの特徴:

- **本番と同じルール**: 1 ターンに行動 2 回まで・移動は 1 回・移動はターン終了時に確定（予約制）・水たまり/ダイナマイト/ばくだん/妨害キャラ/歩行ボーナス/ゴールボーナス/50 ターン制限。ルール違反は本番と同じエラーメッセージで報告される
- **壁時計タイムアウトなし**: 本番の 1 ターン制限時間は再現しない。考えながら 1 命令ずつ試せる
- **相手 AI を選べる**: ゴール優先 / アイテム優先 / 停止 / ランダム（練習設定モーダル）
- **オリジナル練習マップを同梱**: 競技マップと同じ形式（17×17・外周壁・ゴール 1 つ・ダイナマイトなしで到達可能）の Smalruby 専用マップ

## ユーザーストーリー

- **競技参加者の小学生・中学生**として、自分の AI プログラム (Smalruby スクリプト) を競技サーバに接続して動かしたい
- **教師**として、生徒たちがチームでアルゴリズムを考えて競い合う題材として使いたい
- **大会運営**として、競技用のサーバと共通の API でやり取りできる拡張機能を提供したい
- **プログラミング学習者**として、ターン制ゲームを通じて経路探索などのアルゴリズムを学びたい

## UI / 操作フロー

1. ブロックパレットの「拡張機能を追加」から **Smalruby Koshien** を選ぶ（このとき練習ゲームパネルが開く）
2. ブロックパレットに Koshien 専用ブロックが表示される
3. `connectGame` ブロックで練習ゲームを開始（パネルが再表示される）
4. ターンごとに `getMapArea` でマップ情報を取得し、`moveTo` などで移動を予約
5. `turnOver` でターンを終了すると、移動・設置が確定し、相手 AI と妨害キャラが動く
6. パネルの盤面・スコア・ログで結果を確認しながら 4〜5 を繰り返して AI を育てる

### 練習ゲームパネル（koshien-mock-panel）

![練習ゲームパネル](screenshots/0102-practice-game-panel-1280x800.png)

移動・最小化・閉じるができる常駐パネル。盤面全体（地形・アイテム・両プレイヤー・妨害キャラ。自分の AI が未探索のマスは暗く表示）、ターン数、スコア、残り行動・移動・ダイナマイト・ばくだん、そして**すべての行動とルールエラーのログ**を表示する。1380×600px（Chromebook）の画面でも全体が見えるサイズ。

- 表示タイミング: 拡張機能の追加時 / `connectGame` 実行時に自動で開く
- 閉じた後: メニューバーの「スモウルビー甲子園 > 練習ゲームパネル」から再表示
- 盤面のスプライトは公式ビューアの画像を許可を得て同梱

#### 「すべて」/「じぶん」表示切替

![じぶん表示](screenshots/0104-practice-panel-my-view-1280x800.png)

盤面は 2 つの表示をボタンで切り替えられる:

- **すべて**: ゲームの真の状態（未探索マスにはうすい影）
- **じぶん**: 自分の AI が知っている情報だけ。各マスは**最後に探索した時点の値**のまま
  （アイテムを取っても、そのマスを再探索するまで残って見える）。未探索マスは暗色、
  ゴールは接続時に教えられるので金枠で表示、相手は最後に視界に入った位置にだけ表示。
  「すべて」と見比べることで「探索していないから差分が出ている」ことを確認できる

### 練習設定モーダル（koshien-settings-modal）

![練習設定モーダル](screenshots/0103-practice-settings-1280x800.png)

メニューバーの「スモウルビー甲子園 > 練習設定」から開く。練習マップ・自分のプレイヤー（player1/player2）・相手 AI（ゴール優先/アイテム優先/停止/ランダム）を選ぶ。設定は localStorage（`smalruby:koshienMockConfig`）に保存され、次に `connectGame` を実行したときから使われる。

### Koshien テストモーダル

開発・デバッグ用の **Koshien テストモーダル** (`koshien-test-modal`) があり、競技サーバなしでローカルテストができる。

「AIを試す」では、編集中スプライト単体ではなく **プロジェクト全体（ステージ + すべての
スプライト）** を 1 つのプログラムとして出力する。これは「AIを保存」が書き出す `.rb` と
**同一の生成結果**であり、競技で実際に動く AI そのもの。「試す」と「保存」が同じコードに
なるよう、両者は `generateProjectCode`（`src/lib/ruby-script-preview.js`）を共有する。
編集中スプライトだけを出力すると、AI 本体が別スプライトにある場合やステージ選択中に
「中身が空の小さな AI」と誤判定され、後述のフォールバック導線も出ない（Issue #845）。
ステージを先頭に出力するので「すべてのスプライトでつかう」グローバル変数・リスト
（例: `$最短経路`）がステージの `def initialize` で初期化され、実行可能になる（v1 / v2 両対応）。
Ruby タブで編集中の未保存コードも `targetsCode` で取り込むため、ブロックへ変換する前の
状態でもそのまま試せる。

AI ソースは base64 化してビューアの `?player1=data:<base64>` クエリパラメータに渡す
（`src/lib/koshien-test-url.js` の `buildKoshienTestUrl` / `encodeAiToPlayerParam`）。
ただし複雑な AI（経路探索など）はソースが長く、URL 長制限（`MAX_KOSHIEN_TEST_URL_LENGTH`
= 8000 文字）を超えてビューアの起動に失敗しうる。そのため URL が長すぎる場合は
`buildKoshienTestPlan` が `tooLong: true` を返し、モーダルは **AI 無しの URL でビューアを
ロード**（デフォルト AI）したうえで、**AI を `.rb` ファイルとして保存する導線**
（`koshien-test-too-long-banner` / `koshien-test-download-ai`）を表示する。
ユーザーは保存した `.rb` をビューアから読み込んで試す。単純な AI の従来挙動（URL 直結）は維持される。

## 主要ファイル

### scratch-gui

#### コンポーネント

- `packages/scratch-gui/src/components/koshien-mock-panel/` — 練習ゲームパネル（canvas 盤面 + ステータス + ログ、公式スプライト画像を同梱）
- `packages/scratch-gui/src/containers/koshien-mock-panel.jsx` — パネルの VM 連携（`KOSHIEN_MOCK_STATE` / `EXTENSION_ADDED` イベント購読、自動オープン）
- `packages/scratch-gui/src/components/koshien-settings-modal/` — 練習設定モーダル
- `packages/scratch-gui/src/components/koshien-test-modal/koshien-test-modal.jsx` — テスト用モーダル
- `packages/scratch-gui/src/lib/ruby-script-preview.js` — コード生成。`generatePreviewCode`（編集中スプライトのプレビュー用）と `generateProjectCode`（プロジェクト全体。「AIを試す」「AIを保存」が共有）

#### ライブラリ

- `packages/scratch-gui/src/lib/koshien-mock-config.js` — 練習ゲーム設定（localStorage）と `runtime.getKoshienMockConfig` の配線
- `packages/scratch-gui/src/lib/libraries/extensions/koshien/` — 拡張機能登録（アイコン、descriptions）
- `packages/scratch-gui/src/lib/ruby-generator/koshien.js` — Koshien ブロック → Ruby 変換
- `packages/scratch-gui/src/lib/ruby-to-blocks-converter/koshien*` — Ruby → Koshien ブロック変換

#### Redux

- `packages/scratch-gui/src/reducers/koshien-file.js` — Koshien ファイル管理 state
- `packages/scratch-gui/src/reducers/koshien-mock-panel.js` — 練習ゲームパネルの表示状態
- AI 保存ステータス（rubytee からの自動保存と連動）

#### スニペット

- `packages/scratch-gui/src/containers/ruby-tab/koshien-snippets.json` — Monaco エディタの Koshien コード補完

### scratch-vm

- `packages/scratch-vm/src/extensions/koshien/index.js` — 拡張機能本体（ブロック定義と、練習ゲームを操作するクライアント。行動回数の抑止・ログ・状態ブロードキャスト）
- `packages/scratch-vm/src/extensions/koshien/mock-game.js` — 練習ゲームエンジン（ターン解決・採点・妨害キャラ）
- `packages/scratch-vm/src/extensions/koshien/mock-rival.js` — 内蔵の相手 AI（ゴール優先/アイテム優先/停止/ランダム）
- `packages/scratch-vm/src/extensions/koshien/mock-maps.js` — 同梱のオリジナル練習マップ
- `packages/scratch-vm/src/extensions/koshien/map-utils.js` — マップ文字列・経路計算などの共有ユーティリティ

### infra

なし（Koshien 競技サーバは別リポジトリで管理）。

## ブロックパレット

![ブロックパレット](screenshots/0101-block-palette-1280x800.png)

## 関連ブロック（主要 opcode）

| opcode | 説明 |
|---|---|
| `connectGame` | 競技サーバに接続 |
| `getMapArea`, `map`, `mapFrom`, `mapAll` | マップ情報の取得 |
| `moveTo` | 指定位置への移動 |
| `calcGoalRoute`, `calcRoute` | ゴールまでの経路計算 |
| `setItem`, `locateObjects` | アイテム配置・検出 |
| `targetCoordinate`, `position`, `positionOf` | 座標操作 |
| `turnOver` | ターンを終了する（移動・設置が確定し、次のターンへ） |
| `setMessage`, `object` | メッセージ・オブジェクト送信 |

> 各ブロックの Ruby 表現は [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) を参照。

## 設定・データ永続化

- `koshien-file` reducer で Koshien プロジェクトファイルの状態を管理
- 練習ゲーム設定は localStorage `smalruby:koshienMockConfig`（マップ / 自分のプレイヤー / 相手 AI）

## テスト

- VM 単体テスト: `packages/scratch-vm/test/unit/extension_koshien.js`（ブロック/クライアント）、`koshien_mock_game.js`（ゲームエンジン）、`koshien_map_utils.js`（ユーティリティ）
- GUI 単体テスト: `packages/scratch-gui/test/unit/lib/koshien-mock-config.test.js`、`test/unit/components/koshien-settings-modal.test.jsx`、`test/unit/components/koshien-mock-panel.test.jsx`、`test/unit/reducers/koshien-mock-panel-reducer.test.js`

## 関連ドキュメント

- [`docs/rubytee/`](../rubytee/) — Koshien プロジェクトの自動保存連携
- [`docs/extension-smalruby-ruby/`](../extension-smalruby-ruby/) — 競技プログラム作成時に活用される Ruby 拡張

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*koshien` で grep）。
