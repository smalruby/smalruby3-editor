# Upstream Tracking — ベースラインとバージョン誤認の回避

upstream (`scratchfoundation/scratch-editor`) との追従で **過去2回バージョンを誤認**した。
その再発を防ぐための恒久ルール。マージ手順そのものは `.claude/skills/upstream-merge/` を参照。

## 正規ベースライン（必ずここを基準にする）

| 項目 | 値 | 出典 |
|------|----|----|
| upstream scratch-editor | **tag `v13.7.2`**（commit `352a334b`） | `.upstream-merge-history.json` の `lastMerge.upstreamCommit` |
| scratch-blocks | **`v2.1.19`**（modern Blockly） | 上記 tag の package.json = smalruby の deps |

差分比較・調査は **常に `.upstream-merge-history.json` の `lastMerge.upstreamCommit`（= リリースタグ）を基準**にする。

## ⚠️ develop-trap（バージョン誤認の常習犯）

ghq の `scratchfoundation/scratch-editor` **ローカル `develop` ブランチは stale で
scratch-blocks `1.3.0`（pre-spork / classic Blockly）を指すことがある**。これを基準に
差分を取ると「smalruby は v1.3.0 / `colour` ベースが正しい」と **誤判定** する。

- **絶対ルール**: 手動 diff は `git fetch upstream tag vX.Y.Z` 後の **タグ ref のみ** を基準にする。
  `develop`（特に ghq ローカル）を基準にしない。
- ref 比較例（checkout 不要・安全）:
  ```bash
  diff -u <(git -C <ghq>/scratch-editor show vX.Y.Z:PATH) <(git -C /app show <branch>:PATH)
  ```
- scratch-blocks を見るときは tag `vX.Y.Z`（現行は `v2.1.19`）を checkout して参照。

## pre-spork 巻き戻しの残債（次マージで lost-fix と誤認しないこと）

- 2026-03 (Issue #270, commit `84f87e9152`) で 22 ファイルを pre-spork (v1.3.0) へ巻き戻し、
  その後 v13.7.2 マージで scratch-blocks を v2.1.19 へ戻したが一部ファイルを再移行しなかった。
- **#751**（Issue #749 の Phase 1）で color/blockJSON/hat 系を v13.7.2 へ再整合済み。
- **残債は `.upstream-merge-history.json` の `postMergeReverts` に登録済み**（次マージで phase1 が自動警告する）。
  追跡は **Issue #752**。これらのファイルの DIFF は **意図的な乖離であり upstream の取りこぼしではない**。

## チェックリスト（upstream マージ前）

1. ベースライン = `lastMerge.upstreamCommit`（タグ）。`develop` を基準にしていないか確認。
2. `postMergeReverts` を確認し、残債ファイルの扱い（再整合 or 据え置き）を決める。
3. `bin/upstream-divergence-audit <merge-target>` の DIFF のうち、`postMergeReverts` に
   載っているものは lost-fix ではない（#752 の残債）と認識する。
