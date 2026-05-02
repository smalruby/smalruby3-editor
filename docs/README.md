# smalruby3-editor 機能ドキュメント

smalruby3-editor の機能ドキュメントは **ユーザーストーリー単位** で 1 機能 = 1 ディレクトリにまとめている。

各 `docs/<feature>/` は scratch-gui を起点に、scratch-vm（拡張機能・ランタイム）、`infra/`（API・relay）、`ruby/`（gem）を**横断的に参照**する統合ドキュメント。「この機能を知りたければここだけ見れば OK」を目指す。

体系の設計経緯と運用方針は **Issue [#610](https://github.com/smalruby/smalruby3-editor/issues/610)** および **`.claude/rules/documentation.md`** を参照。

## 機能ドキュメント一覧

> 凡例:
> - 🆕 **Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能
> - 🔧 **upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> - ⬆️ **upstream そのまま** — upstream の実装をほぼそのまま利用
> - ⏳ 執筆未着手 / ✏️ 執筆中 / ✅ 執筆完了

### A. コアエディタ系

| 機能 | upstream 区分 | 状態 |
|---|---|---|
| `project-management/` — プロジェクト新規作成・読込・保存・タイトル編集・URL ローダー・SB3 ダウンロード | 🔧 改良 | ⏳ |
| `block-editor/` — ブロックパレット・ツールボックス・ワークスペース・変数モニター・カスタムブロック | 🔧 改良 | ⏳ |
| `stage/` — ステージ表示・緑旗/停止・ステージサイズ・背景・watermark・表示モード | ⬆️ そのまま | ⏳ |
| `sprite/` — スプライト一覧・選択・追加・座標/向き/サイズ編集 | ⬆️ そのまま | ⏳ |
| `costume/` — コスチュームタブ・ペイントエディタ・コスチュームライブラリ・コスチューム操作ブロック | ⬆️ そのまま | ⏳ |
| `sound/` — 音タブ・サウンドエディタ・サウンドライブラリ・録音・音操作ブロック | ⬆️ そのまま | ⏳ |

### B. Smalruby 独自エディタ機能

| 機能 | upstream 区分 | 状態 |
|---|---|---|
| `ruby-editor/` — Ruby タブ・Monaco・ruby-toolbar・ruby-generator・ruby-to-blocks-converter | 🆕 独自 | ⏳ |
| [`furigana/`](furigana/) — ふりがな表示モード（マッピング表のみ既存） | 🆕 独自 | ✏️ |
| `dncl/` — 日本語プログラミング (DNCL) モード | 🆕 独自 | ⏳ |
| `rubytee/` — AI アシスタント (scratch-gui + infra 統合) | 🆕 独自 | ⏳ |
| `backpack/` — バックパック (mesh v1 → v2 移行ロジック含む) | 🔧 改良 | ⏳ |

### C. 統合・連携機能

| 機能 | upstream 区分 | 状態 |
|---|---|---|
| [`google-drive/`](google-drive/) — Google Drive 保存・読込（API setup のみ既存） | 🆕 独自 | ✏️ |
| [`classroom/`](classroom/) — クラスルーム機能（既存・充実） | 🆕 独自 | ✅ |
| [`mesh-v2/`](mesh-v2/) — Mesh v2 ネットワーク (cost.md のみ既存) | 🆕 独自 | ✏️ |
| `device-connection/` — connection-modal 共通基盤 | 🔧 改良 | ⏳ |

### D. 拡張機能

| 機能 | upstream 区分 | 状態 |
|---|---|---|
| `extension-music/` | ⬆️ そのまま | ⏳ |
| `extension-pen/` | ⬆️ そのまま | ⏳ |
| `extension-video-sensing/` | ⬆️ そのまま | ⏳ |
| `extension-face-sensing/` | ⬆️ そのまま | ⏳ |
| `extension-text2speech/` | ⬆️ そのまま | ⏳ |
| `extension-translate/` | ⬆️ そのまま | ⏳ |
| `extension-makeymakey/` (`defaultHidden: true`) | ⬆️ そのまま | ⏳ |
| `extension-microbit/` (`defaultHidden: true`) | ⬆️ そのまま | ⏳ |
| `extension-microbit-more/` | 🆕 独自 | ⏳ |
| `extension-gdxfor/` (`defaultHidden: true`) | ⬆️ そのまま | ⏳ |
| `extension-ev3/` (`defaultHidden: true`) | ⬆️ そのまま | ⏳ |
| `extension-boost/` (`defaultHidden: true`) | ⬆️ そのまま | ⏳ |
| `extension-wedo2/` (`defaultHidden: true`) | ⬆️ そのまま | ⏳ |
| `extension-mesh-v2/` | 🆕 独自 | ⏳ |
| `extension-smalrubot-s1/` | 🆕 独自 | ⏳ |
| `extension-koshien/` | 🆕 独自 | ⏳ |
| `extension-smalruby-ruby/` | 🆕 独自 | ⏳ |
| `extension-tm2scratch/` | 🆕 独自 | ⏳ |
| `extension-g2s/` | 🆕 独自 | ⏳ |
| `extension-speech2text/` | ⬆️ そのまま | ⏳ |

### E. UI 基盤・体験

| 機能 | upstream 区分 | 状態 |
|---|---|---|
| [`mobile-ui/`](mobile-ui/) — モバイル/タブレット UI 全般（旧 `docs/sp/`） | 🆕 独自 | ✏️ |
| `menu-bar/` — メニューバー・言語切替・アカウントメニュー・tutorial-tooltip | 🔧 改良 | ⏳ |
| `tutorial/` — cards・tips-library・tutorial-onboarding・classroom-tutorial | 🔧 改良 | ⏳ |
| `alerts/` — alerts・crash-message・error-boundary・coming-soon・browser/webgl-modal | ⬆️ そのまま | ⏳ |
| `settings/` — テーマ・フォント・各種設定 | ⬆️ そのまま | ⏳ |
| `screenshot/` — blocks-screenshot・ruby-screenshot | 🆕 独自 | ⏳ |

### その他

- [`adr/`](adr/) — Architecture Decision Records (Smalruby 独自の ADR)
- `smalruby-language-spec*.md` — Smalruby 言語仕様（機能 docs とは別カテゴリ）
- `smalruby-dncl-spec.ja.md` — DNCL モードの言語仕様

## ドキュメント執筆テンプレート

新しい機能ドキュメントを書くときは [`_template.md`](_template.md) をコピーして使う。
