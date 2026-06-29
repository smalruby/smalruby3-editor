# Smalruby Marker Blocks (scratch-vm)

scratch-vm の **upstream ファイルに埋め込んだ Smalruby マーカー**の一覧。マーカーの書式・ルールは
`.claude/rules/code-style.md` の「Smalruby Marker Comments」を参照。

> このファイルは `.claude/` の外（`docs/maintenance/`）に置く。実装中に頻繁に編集するため、
> Claude Code の「設定ファイル編集」確認プロンプトで自動実行が止まらないようにするのが目的。

**重要**: Smalruby 固有ファイル（`packages/scratch-vm/.prettierignore` のホワイトリストに含まれるファイル）には
マーカー不要。このファイルに記載するのは **upstream ファイルに埋め込んだマーカーのみ**。

## 現在のマーカー一覧

| ファイル | 機能名 | 説明 |
|----------|--------|------|
| `src/extension-support/extension-manager.js` | extension registration | Smalruby 拡張機能の登録 |
| `src/blocks/scratch3_operators.js` | regex support | operator_contains で正規表現マッチングをサポート |
| `src/engine/comment.js` | toXML modernization | Blockly v12 対応: `pinned="${!minimized}"` + `collapsed="${minimized}"` (v2.1.19 deserializer が読む属性、v13.7.2 整合 #751) + (0,0) 時の x/y 属性省略 (Smalruby 独自) |
| `src/engine/runtime.js` | toolboxitemid for extension categories | Blockly v12 対応: 拡張機能のカテゴリ XML に `toolboxitemid` 属性を追加。Blockly v12 の ContinuousToolbox は `toolboxitemid` から id を読むため、未指定だと `blockly-XXX` の auto-id が StatusIndicatorLabel.extensionId に伝搬し、`!` 接続モーダルが拡張機能を見つけられず scanning で固まる |
| `src/engine/runtime.js` | BEFORE_STEP event | upstream v13.7.2 が削除した `BEFORE_STEP` イベント（getter + `_step` での emit）を維持。Mesh v2 (broadcast-receiver.js / mesh-service.js) が毎フレーム queued remote events を流すために購読している |
| `src/engine/blocks.js` | XML coords guard | `blockToXML` で x/y が finite number のときだけ XML 属性を出力。Ruby → blocks 変換の x/y 未指定 (undefined) を scratch-blocks v2 に正しく伝え、`fromRuby` 再レイアウト経路を維持する |
| `src/engine/blocks.js` | orphaned-parent guard | `getTopLevelScript` で `block.parent` が this._blocks に存在しない場合に停止。Ruby → blocks 変換中の孤立 parent id で `undefined.parent` 参照クラッシュを防ぐ |

## 関連ファイル

マーカーで囲まれたコードが参照するファイル:
- `src/extension-support/smalruby-extensions.js` — extension-manager.js のマーカーから参照
- `test/unit/blocks_operators_regex.js` — scratch3_operators.js の regex support のテスト
