# Upstream Cherry-Pick Policy

upstream (`scratchfoundation/scratch-editor`, `scratchfoundation/scratch-blocks` 等) からの個別コミット取り込み (cherry-pick) を行う際の判断基準。

## 基本方針

**原則として「リリース済み」のコミットだけを取り込む。** 「最新だから」という理由だけで取り込まない。

upstream には:

- `develop` (一般的に最新の安定ブランチ)
- `spork` (Blockly v12 / modern-Blockly 移行用のプレリリース系統)
- 個別の feature/fix ブランチ

が存在し、`develop` に merge されていない / 安定リリースタグ (`vX.Y.Z` 等) が打たれていないコミットは **未リリース** と扱う。未リリースのコミットには、**仕様変更・性能リグレッション・他コミットとの依存** など、単独取り込みでは検知しづらいリスクがある。

## 確認手順

1. **コミットを公開されているか確認**
   ```bash
   cd ~/ghq/github.com/scratchfoundation/scratch-editor
   git fetch -p origin <branch>
   git log --all --oneline | grep <subject keyword>
   ```

2. **どのブランチに含まれているか確認**
   ```bash
   git branch -a --contains <commit-sha>
   ```

3. **タグ (= リリース) に含まれているか確認**
   ```bash
   git tag --contains <commit-sha>
   ```

   - `v12.6.2` のような **stable release タグ** に含まれていれば → リリース済み
   - `v12.7.0-spork.2` のような **プレリリースタグ** のみに含まれていれば → **未リリース**
   - タグなし (= ブランチに置かれているだけ) → **未リリース**

## 取り込み判断

| 状況 | 取り込み可否 |
|------|--------------|
| リリース済み (stable タグに含まれる) | ✅ 取り込み可 (通常のフロー) |
| 未リリース + 我々で再現できる致命的バグ修正 + 我々の依存先に影響あり | ✅ 取り込み可 (理由を commit message に明記) |
| 未リリース + 我々の依存先に影響しない / バグ未確認 | ❌ 取り込まない (upstream のリリースを待つ) |
| 未リリース + 取り込まないと我々のコードが壊れる構造的問題 | ✅ 取り込み可 (理由を ADR / commit message に明記) |

「致命的バグ」の例:
- Smalruby が依存している upstream パッケージのバージョン (例: scratch-blocks v2.x) と組み合わせると、明らかな機能不全 (ブロック複製でコメントが欠落する等) が発生する
- セキュリティ上の問題

## 取り込み時の必須事項

未リリースコミットを cherry-pick する場合は、以下を **必ず** 行う:

1. **commit message に upstream コミット SHA とブランチ名を明記**
   ```
   fix(...): handle modern X events (cherry-picked from upstream spork@29bdbd1fe)
   ```

2. **CLAUDE.md / .claude/rules / コメント等で「upstream の future-state からの先行取り込み」であることを示す**

3. **次の upstream merge 時に該当コミットが既に含まれていないか確認 する** (二重取り込み防止)

4. **取り込み範囲を最小化** — 同じブランチの他のコミットも芋づる式に持ち込まない。我々の問題を解く最小限のコミットだけを取り込む

## 例: scratch-vm の `block_comment_*` イベント対応 (2026-05)

- upstream コミット: `29bdbd1fe` (`fix: handle new custom block comment events #4` by Aaron Dodson)
- 含まれるブランチ: `origin/spork` のみ (`origin/develop` には未マージ)
- 含まれるタグ: `v11.1.0-spork.15`, `v12.7.0-spork.1`, `v12.7.0-spork.2` (**プレリリース**)
- 我々の状況: scratch-blocks v2 (modern-Blockly) を採用済み、新イベント名 (`block_comment_*`) が発行されるが scratch-vm は旧イベント名しか処理しない
- 結論: **致命的バグかつ取り込まないと壊れる構造的問題のため取り込み**。commit message と関連 ADR で明記。
