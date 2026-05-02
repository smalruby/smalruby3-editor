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
