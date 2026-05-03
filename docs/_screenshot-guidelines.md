# Screenshot Guidelines

機能ドキュメントに付けるスクリーンショットの**配置・命名・撮影**ルール。Issue #616 で確立。

## 配置場所

各機能のスクリーンショットは **`docs/<feature>/screenshots/`** 配下に置く。

```
docs/
├── mobile-ui/
│   └── screenshots/
│       ├── 02-code-palette-open.png
│       ├── 03-code-palette-closed.png
│       └── ...
├── classroom/
│   └── images/   ← 既存。screenshots/ に統一しない（既存リンク維持のため）
└── rubytee/
    └── screenshots/
        └── ...
```

> 例外: `docs/classroom/` は既存ドキュメントが `images/` を使っているため維持する（リンク互換性のため）。新規機能では `screenshots/` を使う。

## 命名規則

`<番号>-<内容>-<viewport>.png`

- **番号**: 2 桁ゼロ埋め。順番にユーザーの操作フローを追うと自然な順序になるよう付ける
- **内容**: ケバブケースで簡潔に内容を表す（英語または日本語ローマ字）
- **viewport**: 撮影時の viewport サイズ。viewport 非依存のスクショは省略可

例:
- `01-overview-1280x800.png` — Desktop での全体表示
- `02-modal-open-1024x768.png` — モーダル開いた状態 (iPad landscape)
- `03-mobile-portrait-390x844.png` — モバイル縦向き
- `costume-tab.png` — viewport 関係なし、特定タブの状態のみ

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

満足する 1 枚だけを `docs/<feature>/screenshots/` に `git mv tmp/xxx.png docs/<feature>/screenshots/01-overview-1280x800.png` のように移動。途中経過の `v2`, `v3` 等は `tmp/` に残して、後で削除。

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

![ふりがなモード](screenshots/01-furigana-mode-1280x800.png)

ruby-toolbar 上部のセグメントで切替...
```

## レビュー観点

スクリーンショットの PR では以下を確認：

- [ ] viewport プリセットに従っているか
- [ ] 命名規則 (`<番号>-<内容>-<viewport>.png`) に従っているか
- [ ] `docs/<feature>/screenshots/` に配置されているか
- [ ] 機能 README.md から参照されているか（孤立ファイルを残さない）
- [ ] 同等のスクショが複数残っていないか（`v2`, `v3` の中間ファイルが混入していないか）

## 関連ドキュメント

- `docs/_screenshot-inventory.md` — 既存未追跡 PNG の棚卸し
- `docs/mobile-ui/playwright.md` — Playwright MCP の URL パラメータ・viewport 詳細
- `.claude/rules/scratch-gui/mobile-ui.md` — SP / iPad リグレッション確認手順
