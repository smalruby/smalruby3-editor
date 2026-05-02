# <機能名>

<!--
冒頭に upstream との関係を 1 つだけ選んで残す。
拡張機能の場合は、その下のランタイム対応セクションも残す。
-->

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: <1〜2 行の要約>

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

<!-- 拡張機能の場合のみ残す -->
- **Smalruby ランタイム対応**: ✅ / ❌ <!-- smalruby3 gem / Ruby SDL2 ランタイム側で動作するか -->
- **デフォルト表示**: ✅ / ❌ <!-- defaultHidden: true の場合は ❌ -->

## 概要

ユーザーから見たこの機能の目的とユースケースを 1〜3 段落で。

## ユーザーストーリー

- 〜として、〜したい、〜のために
- 〜として、〜したい、〜のために

## UI / 操作フロー

スクリーンショットや操作手順。スクリーンショットは `<feature>/screenshots/` 配下に置く。

## 主要ファイル

- **scratch-gui**:
  - `packages/scratch-gui/src/components/<...>/`
  - `packages/scratch-gui/src/containers/<...>.jsx`
  - `packages/scratch-gui/src/lib/<...>`
  - `packages/scratch-gui/src/reducers/<...>.js`
- **scratch-vm** (拡張機能の場合):
  - `packages/scratch-vm/src/extensions/<...>/`
- **infra** (該当する場合):
  - `infra/<project>/`
- **ruby** (該当する場合):
  - `ruby/smalruby3/<...>`

## 関連ブロック（あれば）

機能と**深く結びついたブロックのみ**を列挙する。各ブロックの詳細仕様は触れず、`docs/smalruby-language-spec*.md` を参照する。

例: コスチューム機能なら `looks_switchcostumeto`, `looks_nextcostume` のみを書き、`looks_say` などは含めない。

| ブロック ID | 説明 |
|---|---|
| `<opcode>` | この機能におけるブロックの役割 |

## 設定・データ永続化

- **localStorage キー**: `smalruby:<key>` — 用途
- **Redux reducer**: `<reducer-name>` — 状態の構造
- **API エンドポイント**: `<URL>` — 用途

## upstream との差分（🔧 upstream 改良 の場合）

- 何を、なぜ、どう変えているか
- マーカーコメント (`// === Smalruby: Start of ... ===`) の場所への参照

## 関連ドキュメント

- 関連する他の `docs/<feature>/`
- 関連する `.claude/rules/`
- 関連する Issue / PR
