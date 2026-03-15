---
name: design
description: Investigate the codebase based on requirements, produce a detailed design, and create a GitHub Issue. Use when planning a new feature or immediately before starting implementation.
argument-hint: "[feature description or issue number]"
disable-model-invocation: true
---

# /design - Investigate & Design, then Create GitHub Issue

Investigate the codebase for `$ARGUMENTS`, produce a detailed design, and create a GitHub Issue.

## Phase 1: Requirement Clarification

- Parse the feature name and goal from `$ARGUMENTS` or conversation context
- If `$ARGUMENTS` is a GitHub issue number, fetch it first:
  ```
  gh issue view <number> --repo smalruby/smalruby3-editor
  ```
- If the requirement is unclear, ask one clarifying question before proceeding
- Read relevant memory files (`project_overview`, `style_and_conventions`) for context

## Phase 2: Codebase Investigation

Investigate relevant parts of the codebase efficiently using Serena symbolic tools.

1. **Identify affected packages** under `packages/` (scratch-gui, scratch-vm, etc.)
2. **Explore related symbols and files**
   - Use `get_symbols_overview`, `find_symbol`, `search_for_pattern` to locate related code
   - Read only the bodies of symbols directly relevant to the feature
   - Note key file paths, class/function names, and existing patterns
3. **Identify constraints and risks**
   - Cross-package dependencies
   - Upstream Scratch code areas (harder to modify safely)
   - Existing tests that may be affected

## Phase 3: Design

Produce a structured design and **present it to the user for approval** before creating the Issue.

### TDD Policy

- Plan implementation using **Test-Driven Development (TDD)**:
  - For each phase: **[RED]** write failing unit test first → **[GREEN]** implement to pass → **[PASS]** confirm
  - UI-related features take too long to test interactively, so **only unit tests follow TDD**
  - **Integration tests are written after implementation** (for regression detection), not before

### Commit & PR Strategy

- After each phase completes: run lint + affected tests → commit → push
- **ローカルでは変更に直接関係するテストのみ実行する。全テストスイートは CI が自動実行するため、ローカルでの全体実行は不要。**
- After the **first push**: create a PR with Implementation Steps as a checkbox list
- Subsequent phases push to the same PR
- After each push (except the first): update the PR body to check off the completed phase's checkbox
- This allows fine-grained progress tracking via PR checkboxes

### Risks & Open Questions → User Interview

Risks & Open Questions を洗い出した後、**各項目についてユーザーにインタビュー**する：

1. リスクや未確定事項をリストアップする
2. 各項目について、以下のいずれかをユーザーに確認する：
   - **今すぐ調査する**: コードベースや外部ドキュメントを調べて解決する
   - **設計判断を仰ぐ**: ユーザーの意見・方針を聞いて決定する
   - **後回しにする**: 実装フェーズで判明次第対応する（Issue に記載）
3. インタビュー結果を設計に反映し、解決済みの項目は Risks から除外する

### Definition of Done (DoD)

設計には必ず **DoD（完了の定義）** を含める。DoD は Playwright MCP を積極的に活用した**ブラウザ上での動作確認**を含む：

1. **ユニットテスト**: 全関連テストが pass
2. **Integration テスト**: round-trip や UI 動作の回帰テストが pass
3. **CI 通過**: PR の CI が全て green
4. **ブラウザ確認（Playwright MCP）**: CI 完了後、PR コメントのプレビュー URL を使って Playwright MCP でブラウザ上の動作を確認する。具体的な確認項目を DoD に定義する
5. **コードレビュー対応**: レビュー指摘があれば対応

### Design Template

```markdown
## Feature: <name>

### Goal
One-paragraph description of what the feature does and why.

### Affected Files
- `path/to/file` — reason

### Implementation Steps（TDD + Commit Strategy）

**Phase N: <phase name>**

1. **[RED]** Add/update unit tests (confirm they fail)
2. **[GREEN]** Implement to make tests pass
3. **[PASS]** lint + affected tests confirmation (full suite runs on CI)
4. **[COMMIT & PUSH]** `<type>: <description>`
5. **[MAKE PR]** (first push only)
6. **[UPDATE PR]** Check off this phase's checkbox in PR body (after second push onward)

(Repeat for each phase)

**Phase Final: Integration Tests（post-implementation）**

- Write integration tests for regression detection
- lint + affected tests pass (full suite runs on CI)
- **[COMMIT & PUSH]** `test: add integration tests for <feature>`

**Phase DoD: CI 完了待ち + ブラウザ確認**

- CI の完了を待つ（`gh run watch` または PR checks を確認）
- CI が green になったら、PR コメントに記載されたプレビュー URL を取得
- Playwright MCP を使ってブラウザ上で DoD の各確認項目を実施
- 全項目 OK なら PR の DoD チェックボックスを更新

### Definition of Done
- [ ] ユニットテスト pass
- [ ] Integration テスト pass
- [ ] lint pass
- [ ] CI green
- [ ] ブラウザ確認（Playwright MCP）:
  - [ ] <具体的な確認項目1>
  - [ ] <具体的な確認項目2>
  - [ ] ...

### Test Plan

| Type | Timing | Target |
|------|--------|--------|
| Unit tests (TDD) | Before implementation (RED → GREEN) | core logic |
| Integration tests | After implementation | round-trip, UI behavior |
| Browser verification | After CI green | Playwright MCP で DoD 確認 |

### Risks & Open Questions
- ... (インタビュー後、未解決のもののみ残す)
```

### Phase 3a: Risks & Open Questions インタビュー

設計案を提示した後、**DoD が明確に定まるまでユーザーインタビューを繰り返す**：

1. Risks & Open Questions を提示し、各項目について：
   - 「今すぐ調査しますか？」
   - 「設計判断をお願いできますか？」
   - 「実装時に判断で良いですか？」
   を確認する

2. ユーザーの回答に基づき設計を更新する

3. **DoD のブラウザ確認項目**を具体化し、ユーザーに提示する：
   - 「この確認項目で十分ですか？」
   - 「他に確認したい動作はありますか？」

4. DoD が明確になり、ユーザーが承認するまでこのループを繰り返す

**Issue 作成時点で DoD は完全に確定していること。** 曖昧な DoD のまま Issue を作成しない。

Wait for explicit user approval ("looks good", "OK", "yes", etc.) on the **complete design including DoD** before proceeding to Phase 4.

## Phase 4: GitHub Issue Creation

After user approves the design, create the GitHub Issue using the Write tool and a temporary file:

1. Use the **Write tool** to write the issue body to `/tmp/design-issue-body.md`:

   ```markdown
   ## Goal
   <goal>

   ## Affected Files
   <list>

   ## Implementation Steps
   <checkbox list using `- [ ]` markdown syntax>

   ## Definition of Done
   <checkbox list — ブラウザ確認項目を含む>

   ## Test Plan
   <list>

   ## Risks & Open Questions
   <list>
   ```

2. Then run:

   ```bash
   gh issue create \
     --repo smalruby/smalruby3-editor \
     --title "<type>: <short description>" \
     --body-file /tmp/design-issue-body.md

   rm /tmp/design-issue-body.md
   ```

Issue title must follow Conventional Commits style (`feat:`, `fix:`, `refactor:`, etc.).

## Phase 5: Final Report (Japanese)

Report the result to the user in Japanese:
- Show the created issue URL
- Briefly summarize what was designed and created
- Note any open questions that need follow-up

---

**Important**: Do NOT start implementation. This skill only investigates, designs, and creates the Issue.

## Implementation 完了後のフロー（実装時に参照）

実装スキルから参照される最終フェーズの手順：

### CI 完了待ち + DoD ブラウザ確認

1. **CI 完了を待つ**:
   ```bash
   gh pr checks <PR番号> --repo smalruby/smalruby3-editor --watch
   ```
   または `gh run watch` で CI の完了を監視する

2. **プレビュー URL を取得**:
   - PR のコメントからデプロイプレビュー URL を取得する
   - URL が無い場合はローカルの `http://localhost:8601` を使用（`docker compose up app` が必要）

3. **Playwright MCP でブラウザ確認**:
   - DoD に定義された各確認項目を Playwright MCP で実施
   - `?no_beforeunload=1` パラメータを必ず付与
   - スクリーンショットを撮って確認結果を記録
   - 問題があれば修正コミットを追加

4. **PR の DoD チェックボックスを更新**:
   - 確認完了した項目をチェック済みに更新
