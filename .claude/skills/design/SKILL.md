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

- After each phase completes: run lint → commit → push
- After the **first push**: create a PR with Implementation Steps as a checkbox list
- Subsequent phases push to the same PR
- After each push (except the first): update the PR body to check off the completed phase's checkbox
- This allows fine-grained progress tracking via PR checkboxes

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
3. **[PASS]** lint + unit test confirmation
4. **[COMMIT & PUSH]** `<type>: <description>`
5. **[MAKE PR]** (first push only)
6. **[UPDATE PR]** Check off this phase's checkbox in PR body (after second push onward)

(Repeat for each phase)

**Phase Final: Integration Tests（post-implementation）**

- Write integration tests for regression detection
- lint + all tests (unit + integration) pass
- **[COMMIT & PUSH]** `test: add integration tests for <feature>`

### Test Plan

| Type | Timing | Target |
|------|--------|--------|
| Unit tests (TDD) | Before implementation (RED → GREEN) | core logic |
| Integration tests | After implementation | round-trip, UI behavior |

### Risks & Open Questions
- ...
```

Wait for explicit user approval ("looks good", "OK", "yes", etc.) before proceeding to Phase 4.

## Phase 4: GitHub Issue Creation

After user approves the design, create the GitHub Issue using a temporary file:

```bash
cat > /tmp/design-issue-body.md <<'EOF'
## Goal
<goal>

## Affected Files
<list>

## Implementation Steps
<checkbox list using `- [ ]` markdown syntax>

## Test Plan
<list>

## Risks & Open Questions
<list>
EOF

gh issue create \
  --repo smalruby/smalruby3-editor \
  --title "<type>: <short description>" \
  --body-file /tmp/design-issue-body.md

rm /tmp/design-issue-body.md
```

Issue title must follow Conventional Commits style (`feat:`, `fix:`, `refactor:`, etc.).

## Final Report (Japanese)

Report the result to the user in Japanese:
- Show the created issue URL
- Briefly summarize what was designed and created
- Note any open questions that need follow-up

---

**Important**: Do NOT start implementation. This skill only investigates, designs, and creates the Issue.
