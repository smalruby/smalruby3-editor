# Documentation Placement

smalruby3-editor のドキュメントは「**ユーザーストーリー単位**」で 1 機能 = 1 ディレクトリにまとめ、リポジトリ直下の `docs/` に集約する。

詳細な体系設計と運用方針は Issue #610 を参照。

## 配置ルール

### `docs/<feature>/` (リポジトリ直下) — Smalruby 独自ドキュメント

- smalruby3-editor で作成した独自ドキュメントは **必ず `docs/<feature>/` に置く**
- scratch-gui だけでなく scratch-vm, infra, ruby/ などを横断的に参照する**統合ドキュメント**にする
- 例: `docs/rubytee/` は scratch-gui の UI と `infra/smalruby-rubytee-relay/` の Lambda 双方をカバーする
- 「この機能を知りたければここだけ見れば OK」を目指す

### `packages/<package>/docs/` — upstream Scratch のドキュメント専用

- このディレクトリは **upstream (Scratch Foundation) 由来のドキュメントを置く場所**
- 新規に Smalruby 独自ドキュメントをここに作らない
- upstream から fork してきたドキュメントが既にある場合のみ存在する
- マイグレーション中の例外: 既存の `packages/scratch-gui/docs/` 配下に残る Smalruby 独自ドキュメントは、順次 `docs/` 配下に移動する (Issue #610 参照)

### `infra/<project>/docs/` — infra プロジェクト固有のドキュメント

- 各 CDK プロジェクトの**実装詳細・運用手順**は `infra/<project>/docs/` に置いてよい
- ただし**機能としての全体像**（UI も含む）は `docs/<feature>/` に集約し、`infra/<project>/docs/` から参照される側にする

### `ruby/<gem>/` — Ruby gem 固有のドキュメント

- 各 gem の README と doc は gem ディレクトリ内に置く
- 機能横断ドキュメント（VM の Ruby ランタイム挙動など）は `docs/<feature>/` に集約

## 各機能ドキュメントの必須要素

各 `docs/<feature>/` の主ドキュメント (README.md または同等) の冒頭で **必ず以下を明記**：

### 1. upstream との関係

3 区分のうち 1 つを選んで冒頭に表示：

```markdown
> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能
```

または

```markdown
> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> 改良点: <1〜2 行の要約>
```

または

```markdown
> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用
```

### 2. 拡張機能の場合の追加情報

`docs/extension-*/` には上記に加えて以下を冒頭に表示：

```markdown
- **Smalruby ランタイム対応**: ✅ / ❌ (smalruby3 gem / Ruby SDL2 ランタイム側で動作するか)
- **デフォルト表示**: ✅ / ❌ (`defaultHidden: true` の有無)
```

## 推奨テンプレート

`docs/_template.md` を参照（Phase 1 完了後に整備）。

## 開発ワークフローの DoD（ドキュメント・スクリーンショット更新）

**コードを変更する PR の Definition of Done に必ず以下を含めること**：

### ドキュメント更新

| 変更内容 | 必要な docs 更新 |
|---|---|
| 機能の挙動・仕様を変えた | 該当機能の `docs/<feature>/README.md` を更新 |
| 新しいファイルを追加した | `docs/<feature>/README.md` の「主要ファイル」セクションを更新 |
| 設定 (localStorage / URL パラメータ / 環境変数) を増減した | 「設定・データ永続化」セクションを更新 |
| ブロック (opcode) を増減した | 「関連ブロック」セクションを更新 + 言語仕様 docs (`docs/smalruby-language-spec*.ja.md`) も検討 |
| upstream マーカーを追加・削除した | `docs/maintenance/smalruby-markers-gui.md` を更新 |
| upstream との差分が増減した | `docs/<feature>/README.md` 冒頭の **🆕 / 🔧 / ⬆️** 区分を見直し |

### スクリーンショット更新

UI に視覚的な変更があった場合、`docs/<feature>/screenshots/` を更新する：

| 変更内容 | 必要な screenshot 更新 |
|---|---|
| 既存画面のレイアウト・色・テキストを変えた | 既存スクリーンショットを撮り直し（**ファイル名は変更しない**）|
| 新しい画面・モーダル・状態を追加した | 新しい番号で追加（中項目を維持、下 2 桁を進める。例: 既存 `0103` → 新規 `0104` または飛び番号 `0109`）|
| 機能を削除した | 該当スクリーンショットを削除 + README から参照を削除 |

撮影手順は `docs/_screenshot-guidelines.md` 参照。

### PR チェックリスト（自分で確認）

```
- [ ] コード変更が機能の挙動を変えた → 該当 docs/<feature>/README.md を更新した
- [ ] UI に視覚的変更があった → 該当 docs/<feature>/screenshots/ を更新・追加した
- [ ] 新ファイル / 設定 / ブロック / マーカーを追加した → 該当箇所の docs を更新した
- [ ] upstream との差分関係が変化した → upstream 区分バッジを見直した
```

### 例外

以下のケースでは docs/screenshot 更新は不要：
- バグ修正で挙動が「あるべき姿」に戻っただけ
- 内部リファクタリングで外部から見えるものが変わらない
- テスト追加・リント修正のみ
- 新機能を `defaultHidden: true` で隠している間（公開時に更新）

ただし**バグの内容自体が docs に記載されていた場合**は、その記述を更新する必要がある。
