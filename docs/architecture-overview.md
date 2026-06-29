# Smalruby 3 アーキテクチャ概要

Smalruby 3 モノレポ全体のアーキテクチャを 1 枚にまとめる。**何がどこにあるか、どう繋がっているか、どこに何を追加すべきか**を判断するための地図。

## 1 枚図

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              ユーザー (子供 / 教師 / 保護者)                       │
└──────────────────────┬─────────────────────────┬──────────────────────────────────┘
                       │                         │
                       │ ブラウザ                  │ Mac / Windows ネイティブ
                       ▼                         ▼
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  Web フロントエンド                  │  │  デスクトップランタイム                │
│  https://smalruby.app                │  │  ruby/smalruby3/ (gem)              │
│                                      │  │                                      │
│  ├─ packages/scratch-gui             │  │  ├─ lib/smalruby3/                  │
│  │   (React UI、Monaco Ruby エディタ)  │  │  │  (Ruby DSL、Fiber 並列、Asset)    │
│  ├─ packages/scratch-vm              │  │  ├─ ext/smalruby3_imageutil (Rust)  │
│  │   (Sequencer、Thread、execute)    │  │  ├─ ext/smalruby3_launcher (macOS)  │
│  ├─ packages/scratch-render          │  │  └─ ruby/ruby-sdl2 (submodule)      │
│  │   (WebGL、Drawable、Skin)         │  │  └─ ruby/rsdl     (submodule)        │
│  ├─ packages/scratch-svg-renderer    │  │                                      │
│  │   (SVG → 描画準備)                 │  └──────────────────────────────────────┘
│  └─ packages/task-herder             │
│      (タスクキュー)                    │
│                                      │
└──────────────┬───────────────────────┘
               │
               │ 各 infra プロジェクトに HTTPS で接続
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  AWS インフラ (ap-northeast-1, infra/)                       │
│                                                                              │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │ smalruby-mesh-v2    │  │ smalruby-rubytee-     │  │ smalruby-classroom │ │
│  │ AppSync + DynamoDB  │  │ relay                 │  │ Lambda + DDB + S3  │ │
│  │ graphql.api.        │  │ Lambda + DDB          │  │ classroom.api.     │ │
│  │  smalruby.app       │  │ rubytee.api.          │  │  smalruby.app      │ │
│  │                     │  │  smalruby.app         │  │                    │ │
│  │ → リアルタイム通信     │  │ → Anthropic Claude    │  │ → Google Classroom │ │
│  │   (broadcast,       │  │   API リレー           │  │   連携、提出物管理   │ │
│  │   global var sync)  │  │                       │  │                    │ │
│  └─────────────────────┘  └──────────────────────┘  └────────────────────┘ │
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │ smalruby-api        │                                                    │
│  │ Lambda × 4          │                                                    │
│  │ api.smalruby.app    │                                                    │
│  │                     │                                                    │
│  │ - cors-proxy        │                                                    │
│  │ - mesh-domain       │                                                    │
│  │ - scratch-api-      │                                                    │
│  │   proxy/projects    │                                                    │
│  │ - scratch-api-      │                                                    │
│  │   proxy/translate   │                                                    │
│  └─────────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
              ▲                          ▲                       ▲
              │                          │                       │
        ┌─────┴──────┐           ┌──────┴──────┐         ┌──────┴──────┐
        │ Anthropic  │           │ Google      │         │ Scratch     │
        │ Claude API │           │ (Classroom, │         │ Foundation  │
        │            │           │  Drive,     │         │ public APIs │
        │            │           │  Translate) │         │             │
        └────────────┘           └─────────────┘         └─────────────┘
```

## 主要パッケージ

| パッケージ | 役割 | 言語 |
|---|---|---|
| `packages/scratch-gui` | React UI、Monaco Ruby エディタ、ブロックパレット、ステージ | JS/JSX |
| `packages/scratch-vm` | ブロック実行 VM (Runtime / Sequencer / Thread / execute) | JS |
| `packages/scratch-render` | WebGL ベースのスプライト描画 | JS |
| `packages/scratch-svg-renderer` | SVG → 描画用前処理 | JS |
| `packages/task-herder` | 非同期タスクキュー (throttle / concurrency) | JS |
| `infra/smalruby-mesh-v2` | リアルタイム通信 (AppSync + DynamoDB) | TS (CDK) + Ruby (resolver) |
| `infra/smalruby-rubytee-relay` | AI チャット (Anthropic Claude relay) | TS (CDK + Lambda) |
| `infra/smalruby-classroom` | クラス管理・課題提出 | TS (CDK + Lambda) |
| `infra/smalruby-api` | 共通 API (CORS proxy / Mesh zone / Scratch API proxy) | TS (CDK + Lambda) |
| `ruby/smalruby3` | デスクトップ Ruby + SDL2 ランタイム (gem) | Ruby + Rust + Swift |
| `ruby/ruby-sdl2` | Ruby SDL2 バインディング (submodule, fork) | Ruby + C |
| `ruby/rsdl` | macOS 用 SDL2 ラッパー (submodule, fork) | Ruby |

## データの流れ

### 1. ユーザーが作品を作る

```
ブラウザ → scratch-gui (React)
        ├─ ブロックパレットでブロックを組み立て (scratch-blocks 経由)
        ├─ ↔ Ruby エディタ (Monaco) で双方向変換 (ruby-generator / ruby-to-blocks-converter)
        └─ コスチューム / サウンド / スプライト追加
```

### 2. ユーザーがプロジェクトを実行 (緑旗)

```
緑旗クリック → scratch-vm.runtime.startHats('event_whenflagclicked')
            → Hat を持つ Thread を生成
            → Sequencer が 30 FPS で Thread を時分割実行
            → 各ブロックの primitive 関数が呼ばれる
            → scratch-render が Drawable をステージに描画
```

### 3. ユーザーがプロジェクトを保存

```
保存 → scratch-vm.toJSON() で project.json 生成
    → scratch-gui がアセットと zip 化 → .sb3 ファイル
    → ブラウザダウンロード or Google Drive アップロード
```

### 4. ユーザーがネットワーク通信を使う (Mesh v2)

```
broadcast / グローバル変数 → scratch-vm の meshV2 拡張
                          → AWS AppSync に GraphQL mutation
                          → 他ノードに subscription 配信 (or polling)
                          → 受信側で broadcast 発火 / 変数更新
```

### 5. ユーザーが AI に質問 (Rubytee)

```
ルビティーボタン → scratch-gui の rubytee-modal
                → POST /generate to rubytee-relay (Lambda)
                → Anthropic Claude API
                → 生成された Ruby コードを Monaco に挿入
```

### 6. ユーザーがデスクトップで実行 (smalruby3 gem)

```
ruby script.rb (or smalruby exec)
    → smalruby3_launcher (macOS) or Xvfb (Docker)
    → Smalruby3.start → Runtime.instance.run
    → Sprite サブクラスを Fiber として並列実行
    → SDL2 で描画 (BitmapSkin / PenSkin / TextBubble)
```

## 主要なディレクトリ判断ガイド

「○○を追加したい」ときどこに置くか：

| 追加するもの | 置く場所 |
|---|---|
| 新しい React コンポーネント (UI) | `packages/scratch-gui/src/components/<name>/` |
| 新しいコンテナ (HOC, Redux 接続) | `packages/scratch-gui/src/containers/<name>.jsx` |
| Ruby ↔ Blocks 変換ロジック | `packages/scratch-gui/src/lib/ruby-generator/` または `ruby-to-blocks-converter/` |
| 新しいブロック (拡張機能) | `packages/scratch-vm/src/extensions/<scratch3_xxx>/` |
| 新しい Smalruby 拡張機能 | `packages/scratch-vm/src/extensions/<name>/` + `packages/scratch-vm/src/extension-support/smalruby-extensions.js` に登録 |
| 新しい AWS サービス (CDK) | `infra/<smalruby-xxx>/` 新規プロジェクト or 既存に追加 |
| デスクトップランタイムの新機能 | `ruby/smalruby3/lib/smalruby3/` |
| Smalruby 独自ドキュメント | `docs/<feature>/` (詳細: `.claude/rules/documentation.md`) |
| upstream Scratch のドキュメント | `packages/<package>/docs/` (例: `packages/scratch-vm/docs/extensions.md`) |

## upstream との関係

すべての `packages/*` は upstream [scratch-editor](https://github.com/scratchfoundation/scratch-editor) から fork。upstream の develop ブランチを定期的にマージする。

差分管理：
- **Smalruby 独自ファイル**: 専用ディレクトリ (`smalruby_ruby/`, `koshien/`, `mesh_v2/` 等) または専用ファイル (`smalruby-extensions.js`, `smalruby-migration.js`)
- **upstream ファイルへの追加**: `// === Smalruby: Start of <feature> ===` マーカーで囲む
- **マーカー一覧**: `docs/maintenance/smalruby-markers-gui.md`、`docs/maintenance/smalruby-markers-vm.md`

upstream マージ時の競合を最小化するための設計指針：
1. Smalruby 独自コードは**専用ファイルに集約** (`smalruby-extensions.js` パターン)
2. upstream ファイルへの追加は**最小限** (require 1 行が理想)
3. 大きな機能はクロージャ・mixin・HOC でラップ

## ブラウザ専用 vs ネイティブ専用 vs 両対応

| 機能 | ブラウザ (scratch-vm) | ネイティブ (smalruby3 gem) |
|---|---|---|
| 標準ブロック (motion / looks / control 等) | ✅ | ✅ |
| Pen / Music | ✅ | ✅ |
| Mesh v2 / Rubytee / Classroom | ✅ | ❌ (ブラウザ依存 API) |
| Smalrubot S1 / G2S | ✅ | ❌ (Web Serial) |
| micro:bit / EV3 / BOOST / WeDo | ✅ | ❌ (Web Bluetooth) |
| Video / Face Sensing / TM2Scratch | ✅ | ❌ (getUserMedia / TF.js) |
| Text2Speech / Translate | ✅ | ❌ (HTTP API + 認証) |

→ デスクトップランタイムは **シンプルな Ruby 学習用途**にフォーカス。ブラウザ専用機能は意図的に対応しない。

## 開発・運用の詳細

それぞれの詳細ドキュメント：

| 領域 | 入口 |
|---|---|
| 機能ドキュメント (ユーザー視点) | [`docs/README.md`](README.md) |
| ブラウザ VM 内部 | [`docs/scratch-vm/README.md`](scratch-vm/README.md) |
| AWS インフラ | [`docs/infra/README.md`](infra/README.md) |
| Ruby gem | [`docs/smalruby3-gem/README.md`](smalruby3-gem/README.md) |
| 言語仕様 (Ruby DSL) | [`docs/smalruby-language-spec.ja.md`](smalruby-language-spec.ja.md) |
| 開発ワークフロー | [`CLAUDE.md`](../CLAUDE.md) + [`.claude/rules/`](../.claude/rules/) |
| 新規参加者 | [`CONTRIBUTING.md`](../CONTRIBUTING.md) |

## 関連 Issue / 履歴

主要なドキュメント整備の Issue：
- #610 — 機能ドキュメント体系
- #616 — スクリーンショット
- #620 — scratch-vm 内部仕様
- #625 — 残り (infra / smalruby3-gem / トップレベル / render)

これらの Issue 履歴を読むと、各ドキュメントの設計判断の経緯が分かる。
