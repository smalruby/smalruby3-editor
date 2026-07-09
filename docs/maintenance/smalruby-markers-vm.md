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
| `src/extensions/scratch3_translate/index.js` | translate CORS proxy | 翻訳 URL を Smalruby の**汎用** CORS プロキシ (`https://api.smalruby.app/cors-proxy?url=<encoded 翻訳URL>`) で包む。Scratch の翻訳サービスは CORS を scratch.mit.edu 限定にしたため smalruby.app からの直叩きが失敗する。汎用 cors-proxy はテキスト応答をそのまま返すので専用 Lambda (`/scratch-api-proxy/translate`) は不要 (obsolete)。`serverURL` は upstream の値 (`https://translate-service.scratch.mit.edu/`) のまま維持し、URL 組み立て箇所だけラップするので upstream 差分が最小。text2speech (#859) と同じ方式に統一 (#862)。過去にマーカー無しで上書きした版が v13.7.2 upstream マージで静かに revert された (#857) ため、マーカーで囲んで次回以降のマージで検知できるようにする |
| `src/extensions/scratch3_text2speech/index.js` | synthesis CORS proxy | 音声合成 URL を Smalruby の**汎用** CORS プロキシ (`https://api.smalruby.app/cors-proxy?url=<encoded 合成URL>`) で包む。Scratch の音声合成サービスは CORS を scratch.mit.edu 限定にしたため smalruby.app からの直叩きが失敗する。汎用 cors-proxy はバイナリ音声を Base64 で返却する (API Gateway がバイト列にデコード) ので専用 Lambda は不要。`SERVER_HOST` は upstream の値のまま維持し、URL 組み立て箇所だけラップするので upstream 差分が最小。translate (#857) と同じ根本原因 (#859) |

## ⚠️ 既知の未マーカー改変（upstream マージ時に注意）

以下の upstream ファイルには **標準マーカー（`=== Smalruby: Start/End ===`）で囲まれていない
Smalruby 改変**が存在する。マーカーが無いため upstream マージのコンフリクト解決で
**静かに revert されるリスク**がある（translate proxy が実際に #857 で消えた前例あり）。
マージ時はこの表も突き合わせて維持を確認すること。将来これらに標準マーカーを付けたら
上の一覧へ移動する。

| ファイル | 改変内容 |
|----------|----------|
| `src/virtual-machine.js` | mesh v1→v2 移行の統合: `serialization/smalruby-migration.js` からの import、プロジェクトロード時の `options.migrateMeshV1ToV2` 分岐（`// smalruby: mesh V1 to V2 migration` の小文字コメントのみ）、追加メソッド `hasMeshV1Project` / `hasKoshienProject` / `migrateMeshV1InBackpackBlocks` / `migrateMeshV1InBackpackSprite`、バックパック複製時の v1 opcode 書き換え |
| `src/extension-support/extension-manager.js` | `builtinExtensions` オブジェクトリテラル内の直書き 3 行: `mesh` / `meshV2` / `smalrubotS1`（マーカーブロックは `registerSmalrubyExtensions` の呼び出しのみを囲んでおり、この 3 行は囲まれていない） |

## 関連ファイル

マーカーで囲まれたコードが参照するファイル:
- `src/extension-support/smalruby-extensions.js` — extension-manager.js のマーカーから参照
- `src/serialization/smalruby-migration.js` — virtual-machine.js の未マーカー改変から参照（mesh v1→v2 移行・koshien 検出）
- `test/unit/blocks_operators_regex.js` — scratch3_operators.js の regex support のテスト
- `test/unit/extension_translate_proxy.js` — scratch3_translate/index.js の translate CORS proxy のテスト
- `test/unit/extension_text2speech_proxy.js` — scratch3_text2speech/index.js の synthesis CORS proxy のテスト
