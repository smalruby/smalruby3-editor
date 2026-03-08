# Test Results - 2026-03 Upstream Merge

## Lint
✅ Passed (3 pre-existing warnings)

## Build
✅ Passed (dev build, warnings only)

## Unit Tests
✅ Passed (183 suites, 1582/1583 passed, 1 skipped)

## Integration Tests
✅ Passed (local)

- smalruby-tutorials.test.js: 3/3 ✅
- block-display-modal.test.js: 7/7 ✅
- gemini-modal.test.js: 1/1 ✅
- ruby-tab-completion-and-indent.test.js: ✅ (skipped: 12)
- tutorial-block-restriction.test.js: 3/3 ✅
- palette-toggle.test.js: 4/4 ✅
- backpack.test.js: ✅
- ruby-tab.test.js: ✅
- menu-bar.test.js: ✅
- project-loading.test.js: ✅
- sprites.test.js: ✅
- blocks.test.js: ✅
- localization.test.js: 4/4 ✅

### Fixes Required for scratch-blocks v2
- `clickText` → `clickBlocksCategory` for toolbox category clicks (DOM structure changed)
- `.blocklyToolboxDiv` → `.blocklyToolbox` CSS selector (class name changed)
- `import Blockly from 'scratch-blocks'` → `import * as Blockly from 'scratch-blocks'` (no default export)
- `Blockly.utils.genUid()` → `Blockly.utils.idGenerator.genUid()` (API changed)
- `Blockly.NAME_TYPE` → `Blockly.Names.NameType` (API changed)

## CI Status
⏳ Running - https://github.com/smalruby/smalruby3-editor/actions/runs/22818709584

### Known CI Issue
- "Lint commit messages" workflow fails due to upstream commits with headers >100 characters. This is expected for merge branches and not a blocking issue.
