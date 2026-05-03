# Screenshot Guidelines

機能ドキュメントに付けるスクリーンショットの**配置・命名・撮影**ルール。Issue #616 で確立。

## 配置場所

各機能のスクリーンショットは **`docs/<feature>/screenshots/`** 配下に置く。**例外なく統一する**。

```
docs/
├── mobile-ui/
│   └── screenshots/
│       ├── 0101-portrait-gate.png
│       ├── 0102-overview.png
│       └── ...
├── classroom/
│   └── screenshots/
│       ├── 0101-menu-bar.png
│       ├── 0201-teacher-login.png
│       └── ...
└── rubytee/
    └── screenshots/
        └── ...
```

## 命名規則

`<番号4桁>-<内容>[-<viewport>].png`

### 番号 (4 桁)

**上 2 桁 = 中項目 (subcategory)、下 2 桁 = 中項目内の連番**

- 中項目で機能をグループ分けする (例: 全般 / 先生フロー / 生徒フロー)
- 中項目内の連番は **飛び番号 OK**（後から追加しても番号を振り直さない）
- 例: `0101`, `0102`, `0103`, ..., `0109`, `0201`, `0202`, ..., `0901` (小項目を後から追加しても既存ファイル名は変えない)

```
0101  ← 中項目 01 の 1 番目
0102  ← 中項目 01 の 2 番目
0103  ← 中項目 01 の 3 番目
0201  ← 中項目 02 の 1 番目
0301  ← 中項目 03 の 1 番目
0901  ← 中項目 09 の 1 番目（飛び番号 OK）
```

**メリット**: 後からスクリーンショットを追加しても、既存ファイル名や doc 内の参照を変更する必要がない。

### 内容

ケバブケースで簡潔に内容を表す（英語または日本語ローマ字）。

### viewport (省略可)

撮影時の viewport サイズ。viewport 非依存のスクリーンショット（モーダル全体など）は省略可。

例:
- `0101-overview-1280x800.png` — 中項目 01「全般」の 1 番目、Desktop 全体表示
- `0102-modal-open-1024x768.png` — 中項目 01 の 2 番目、モーダル開（iPad landscape）
- `0301-mobile-portrait-390x844.png` — 中項目 03 の 1 番目、モバイル縦向き
- `0501-costume-tab.png` — 中項目 05 の 1 番目、viewport 非依存

### 中項目の決め方

中項目は機能ごとに**ユーザー視点で意味のあるグループ**で決める。READMEの章立てと整合させると後から見つけやすい。

例（`docs/classroom/`）:
- `01` 全般・エントリポイント (例: メニューバーボタン)
- `02` 先生フロー (login → dashboard → create → detail)
- `03` 生徒フロー (join → seat → joined → status → submit)

例（`docs/mobile-ui/`）:
- `01` 切替判定 (orientation gate, narrow-screen warning)
- `02` MobileGui の各タブ (code, costume, sound, ruby)
- `03` ドロワー / ツールバー / スプライトパネル
- `04` iPad portrait/landscape / desktop
- `05` 検証用ベースライン

## Viewport プリセット

`docs/mobile-ui/playwright.md` で定義済みの viewport を使い回す：

| プリセット名 | 解像度 | 用途 |
|---|---|---|
| desktop | 1280×800 | 標準的な PC |
| iPad portrait | 768×1024 | iPad 縦持ち |
| iPad landscape | 1024×768 | iPad 横持ち |
| iPad mini portrait | 744×1133 | iPad mini 縦持ち |
| iPhone landscape | 844×390 | スマホ横持ち（MobileGui 発火） |
| iPhone portrait | 390×844 | スマホ縦持ち（縦持ち警告表示） |

## 撮影手順 (Playwright MCP)

### 1. 開発サーバを起動

```bash
docker compose up -d app
until curl -sf -o /dev/null http://localhost:8601; do sleep 5; done
```

### 2. URL パラメータで初期状態を制御

`docs/mobile-ui/playwright.md` の URL パラメータ表を参照。基本的に `?no_beforeunload=1` は必須。

```
http://localhost:8601?no_beforeunload=1&tab=ruby&ruby_version=2&rubyMode=furigana
```

### 3. viewport をプリセットに揃える

Playwright MCP の `browser_resize` で viewport を指定。

### 4. スクリーンショット撮影

撮影先は **必ず `tmp/`** に出力する（後述）。

### 5. レビュー → 確定 → `docs/<feature>/screenshots/` に移動

満足する 1 枚だけを `docs/<feature>/screenshots/` に `git mv tmp/xxx.png docs/<feature>/screenshots/0101-overview-1280x800.png` のように移動。途中経過の `v2`, `v3` 等は `tmp/` に残して、後で削除。

## 一時ファイルの保存場所

**Playwright MCP 等で撮影した中間ファイルは `tmp/` (リポジトリ root) に保存する**。`tmp/` は `.gitignore` 対象なので、リポジトリを汚染しない。

```bash
# 撮影例
mkdir -p tmp
# Playwright MCP の browser_take_screenshot を tmp/screenshot.png に出力
```

> **歴史的経緯**: Issue #616 以前は root 直下にスクリーンショットが直接保存され、未追跡 PNG が 130 枚以上溜まる事態になった。今後は必ず `tmp/` に保存する。詳細は `docs/_screenshot-inventory.md` 参照。

## 機能ドキュメントへの埋め込み

機能の README.md からスクリーンショットを参照する例：

```markdown
## UI / 操作フロー

### Ruby タブの 3 モード

![ふりがなモード](screenshots/0101-furigana-mode-1280x800.png)

ruby-toolbar 上部のセグメントで切替...
```

## レビュー観点

スクリーンショットの PR では以下を確認：

- [ ] viewport プリセットに従っているか
- [ ] 命名規則 (`<番号4桁>-<内容>-<viewport>.png`) に従っているか
- [ ] 4 桁の **上 2 桁が中項目 / 下 2 桁が連番** になっているか
- [ ] `docs/<feature>/screenshots/` に配置されているか（`images/` 等の旧名を使っていないか）
- [ ] 機能 README.md から参照されているか（孤立ファイルを残さない）
- [ ] 同等のスクショが複数残っていないか（`v2`, `v3` の中間ファイルが混入していないか）

## 関連ドキュメント

- `docs/_screenshot-inventory.md` — 既存未追跡 PNG の棚卸し
- `docs/mobile-ui/playwright.md` — Playwright MCP の URL パラメータ・viewport 詳細
- `.claude/rules/scratch-gui/mobile-ui.md` — SP / iPad リグレッション確認手順
