# チュートリアル拡充 進捗トラッカー

> **🚧 一時ドキュメント** — チュートリアル拡充 4 Phase 完了時に削除予定。Issue [#682](https://github.com/smalruby/smalruby3-editor/issues/682) の進捗をリアルタイムに反映するためのワーキングドキュメント。
>
> Phase の最終形・設計判断は [`improvement-plan.md`](improvement-plan.md) を参照。

## サマリー

| Phase | Issue | 状態 | 規模 | 画像 |
|---|---|---|---|---|
| Phase 1 — Mesh 再分類 | [#678](https://github.com/smalruby/smalruby3-editor/issues/678) | ✅ マージ済み (PR #683) | 1 PR | 不要 |
| 基盤 — `setup` プロパティ | (Phase 2 sub-issue 内) | ✅ マージ済み (PR #684) | 1 PR | 不要 |
| Phase 2 — Ruby 拡充 | [#679](https://github.com/smalruby/smalruby3-editor/issues/679) | 🟢 7/7 deck 実装済み (`ruby-basics-1-numbers` 〜 `-7-next`。deck 7 は TryRuby 導線) | 2〜3 PR | ~50 枚 |
| Phase 3 — Block 4 シリーズ | [#680](https://github.com/smalruby/smalruby3-editor/issues/680) | ⚪️ 未着手 (書誌情報待ち) | 4 PR | ~76 枚 |
| Phase 4 — DNCL | [#681](https://github.com/smalruby/smalruby3-editor/issues/681) | 🟡 進行中 (`dnclBasics` 前半 3 deck: display / variables / conditionals) | 3〜4 PR | ~70 枚 |

凡例: ⚪️ 未着手 / 🟡 進行中 / 🟢 完了 (PR レビュー待ち含む) / ✅ マージ済み / ❌ 中断

## Phase 1: Mesh チュートリアルを 3 カテゴリ × 3 lv に再分類

**Issue**: [#678](https://github.com/smalruby/smalruby3-editor/issues/678) / **ブランチ**: `feature/tutorial-mesh-recategorize`

### 完了項目

- [x] `tutorial-tags.js` — `CATEGORIES.chatApp` を削除、`meshStep1/2/3` を追加
- [x] `library.jsx` — local messages 定義から `[CATEGORIES.chatApp]` を削除、`[CATEGORIES.meshStep1/2/3]` を追加
- [x] `decks/index.jsx` — 9 deck の `category:` 参照を新キーに更新
  - `chat-1-basic-{1,2,3}` → `meshStep1`
  - `chat-2-sprites-{1,2,3}` → `meshStep2`
  - `chat-3-mesh-{1,2,3}` → `meshStep3`
- [x] `locales/en.js` — `gui.library.chatApp` を削除、`gui.library.meshStep1/2/3` を追加
- [x] `locales/ja.js` — 同上 (日本語ベース)
- [x] `locales/ja-Hira.js` — 同上 (ひらがなベース)
- [x] `docs/tutorial/improvement-plan.md` — Phase 1〜4 の設計を集約
- [x] `docs/tutorial/progress.md` — 本ドキュメント新規作成

### 残項目 (本 PR で対応)

- [ ] `npm run lint` でエラー・警告ゼロを確認
- [ ] Playwright で `tipsLibrary` を開き、3 カテゴリが想定順序で表示されることを確認
- [ ] 各カテゴリ配下に Lv1/Lv2/Lv3 が並ぶことを確認
- [ ] PR 作成

### 設計判断メモ

- **`tag-messages.js` は更新しない** — `gui.libraryCategories.*` のメッセージ ID は library.jsx の rendering path から参照されておらず、`tag-messages.js` の `gettingStarted` / `chatApp` エントリは vestigial。新カテゴリも追加しない。本物の rendering 経路 (`gui.library.*` を持つ local messages in library.jsx) のみを更新する。
- **deck ID はリネームしない** — `chat-1-basic-1` 等の既存 ID は URL 互換性のためそのまま維持。`category:` 参照のみ更新。
- **`tags: ['mesh']` も維持** — タグフィルタは引き続き "Mesh" 1 つで全 9 deck をまとめて絞り込めることを期待する利用者がいる可能性があるため、新カテゴリ追加と並行してタグは維持する。
- **カテゴリ名は「通信入門」共通プレフィックス + ① ② ③ 番号付け** — PR レビューで「3 カテゴリの関係性が伝わらない」と指摘を受け、ストーリー型単独名から番号付きシリーズ名に変更。Step 3 の Lv1 deck 名も「メッシュ拡張機能でつながろう」→「メッシュでつながろう」に短縮し Lv2/Lv3 と表記揃え。

## Phase 2 以降の TODO 抜粋

### 基盤 (Phase 2 前半): `setup` プロパティ

- [x] `src/lib/deck-setup.js` 新規追加 (`applyDeckSetup` ヘルパー)
- [x] deck 定義の type 拡張 (`{ tab, rubyMode, extensions, rubyVersion }`) — `rubyVersion` も適用 (`dispatch(setRubyVersion)` + `persistRubyVersion`、不正値は無視)
- [x] `tips-library.jsx` で deck 起動時に setup を適用 (vm prop 接続含む)
- [x] `activateTab` / `setDnclMode` / `vm.extensionManager.loadExtensionURL` の冪等な呼び出し
- [x] ロード失敗時のグレースフルデグレード (`console.warn` のみ、deck は開く)
- [x] ふりがなフラグも考慮した rubyMode の動作 (`smalruby:furiganaEnabled` localStorage の同期)
- [x] `test/unit/lib/deck-setup.test.js` で 13 ケースの単体テスト (全 pass)

### Phase 3 着手前に必要 (外部要因)

- [ ] 書籍「キラキラRuby」(仮称) の正式タイトル・出版社・ISBN・購入リンク確定
- [ ] 著者 (藤村健吾氏) からの書籍引用許諾

## 削除タイミング

全 4 Phase の Issue (#678/679/680/681) が close され、`improvement-plan.md` の内容が `docs/tutorial/README.md` 等の正規ドキュメントに統合されたら本ファイル (`progress.md`) は削除する。`improvement-plan.md` も同タイミングで削除予定。
