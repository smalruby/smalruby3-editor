# smalruby3-editor

**Smalruby 3** は、MIT の [Scratch 3.0](https://github.com/scratchfoundation/scratch-editor) を fork した Ruby ベースのビジュアルプログラミング環境のモノレポです。

公式サイト: <https://smalruby.app>

## はじめに

| あなたが知りたいこと | 読むべきドキュメント |
|---|---|
| **新しく参加した。何から読めばいい？** | [`CONTRIBUTING.md`](CONTRIBUTING.md) → [`docs/architecture-overview.md`](docs/architecture-overview.md) |
| **○○機能はどう動いている？** | [`docs/README.md`](docs/README.md) (42+ 機能の索引) |
| **VM の内部実装が知りたい** | [`docs/scratch-vm/`](docs/scratch-vm/) |
| **AWS インフラの全体像** | [`docs/infra/`](docs/infra/) |
| **デスクトップ Ruby 実行 (smalruby3 gem)** | [`docs/smalruby3-gem/`](docs/smalruby3-gem/) |
| **Smalruby Ruby の言語仕様** | [`docs/smalruby-language-spec.ja.md`](docs/smalruby-language-spec.ja.md) |
| **AI アシスタントへの指示 (Claude Code 等)** | [`CLAUDE.md`](CLAUDE.md) + [`.claude/rules/`](.claude/rules/) |

## モノレポ構成

```
smalruby3-editor/
├── packages/                    npm workspaces (Web フロントエンド + VM)
│   ├── scratch-gui/             React UI、Monaco Ruby エディタ
│   ├── scratch-vm/              ブロック実行 VM
│   ├── scratch-render/          WebGL ステージレンダラー
│   ├── scratch-svg-renderer/    SVG 前処理
│   └── task-herder/             非同期タスクキュー
│
├── infra/                       AWS CDK インフラ (各々独立プロジェクト)
│   ├── smalruby-mesh-v2/        リアルタイム通信 (AppSync + DynamoDB)
│   ├── smalruby-rubytee-relay/  AI チャット (Lambda + Anthropic Claude)
│   ├── smalruby-classroom/      クラス管理 (Lambda + DDB + S3)
│   └── smalruby-api/            共通 API (CORS proxy / Mesh zone / Scratch proxy)
│
├── ruby/                        Ruby SDL2 デスクトップランタイム
│   ├── smalruby3/               smalruby3 gem (本体)
│   ├── ruby-sdl2/               SDL2 Ruby バインディング (submodule, fork)
│   └── rsdl/                    macOS SDL2 ラッパー (submodule, fork)
│
├── docs/                        Smalruby 独自ドキュメント (機能 / 内部仕様 / インフラ)
├── .claude/                     Claude Code 用ルール・スキル・設定
├── scripts/                     モノレポ全体のビルドスクリプト
└── .github/workflows/           CI/CD 設定
```

詳細図は [`docs/architecture-overview.md`](docs/architecture-overview.md) 参照。

## クイックスタート

### 必要なもの

- **Docker** (推奨。すべての開発作業に使用)
- Git (submodule サポート)

### セットアップ

```bash
git clone --recurse-submodules git@github.com:smalruby/smalruby3-editor.git
cd smalruby3-editor

# 環境変数 (.env)
cp .env.example .env
# .env を編集: GOOGLE_CLIENT_ID, MESH_GRAPHQL_ENDPOINT, RUBYTEE_RELAY_ENDPOINT 等

# 依存インストール + ビルド (Docker 経由)
docker compose run --rm app npm install
docker compose run --rm app npm run build:dev
```

### 開発サーバー起動

```bash
docker compose up app          # http://localhost:8601
```

詳細な開発フロー・テスト・PR 作成手順は [`CONTRIBUTING.md`](CONTRIBUTING.md) を参照。

## 主な機能

- **ブロックプログラミング** — Scratch 3 ベースの GUI
- **Ruby モード** — Monaco エディタで Ruby を書き、ブロックと相互変換
- **ふりがなモード / DNCL モード** — 日本語学習者向け表示モード
- **Rubytee (AI アシスタント)** — Anthropic Claude API でコード生成支援
- **Mesh v2** — 複数のスモウルビー間でリアルタイム通信
- **Smalruby Classroom** — 教室での課題提出・管理
- **Smalrubot S1 / micro:bit / LEGO 等** — 多数の物理デバイス連携
- **Google Drive 連携** — 自分の Drive に作品保存
- **デスクトップ実行** — Ruby SDL2 でネイティブ実行 (smalruby3 gem)

各機能の詳細は [`docs/README.md`](docs/README.md) を参照。

## ライセンス

各パッケージの LICENSE ファイルを参照。

upstream の Scratch は Scratch Foundation のもの。Smalruby は同 Foundation のオープンソース活動に感謝しつつ、独自の進化を続けています。

## 寄付

[Scratch](https://scratch.mit.edu) は無料で提供されています。継続的な開発のため、[寄付](https://secure.donationpay.org/scratchfoundation/) を検討してください。
