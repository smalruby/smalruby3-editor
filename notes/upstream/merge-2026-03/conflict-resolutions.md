# Conflict Resolutions - 2026-03 Upstream Merge

## Files with Conflicts

### Known Conflicts (Resolved)
- [x] `package-lock.json` - Regenerated with `npm install --legacy-peer-deps`
- [x] `packages/scratch-gui/package.json` - Kept @smalruby naming, merged deps
- [x] `packages/scratch-render/package.json` - Kept @smalruby naming, bumped version
- [x] `packages/scratch-svg-renderer/package.json` - Kept @smalruby naming, bumped version
- [x] `packages/scratch-vm/package.json` - Kept @smalruby naming, bumped version
- [x] `packages/task-herder/package.json` - Kept @smalruby naming, bumped version

### Unexpected Conflicts (Manual Resolution)
- [x] `.github/workflows/ci.yml` (DU) - Kept deletion (Smalruby uses own CI)
- [x] `packages/scratch-gui/src/lib/settings/color-mode/dark/__mocks__/index.js` (DU) - Accepted upstream
- [x] `packages/scratch-gui/src/lib/settings/color-mode/default/__mocks__/index.js` (DU) - Accepted upstream
- [x] `packages/scratch-gui/eslint.config.mjs` - Kept Smalruby additions + upstream globalIgnores, updated import/core-modules to import-x/core-modules
- [x] `packages/scratch-gui/src/containers/blocks.jsx` - Kept Smalruby logic (Ruby tab guard, fromRuby cleanup), updated ScratchBlocks API calls to v2.0.0
- [x] `packages/scratch-gui/test/integration/blocks-standalone.test.js` - Imported both `until` and `scopeForFlyoutBlock`
- [x] `packages/scratch-gui/test/integration/blocks.test.js` - Imported both `until` and `scopeForFlyoutBlock`
- [x] `packages/scratch-gui/test/integration/localization.test.js` - Kept Smalruby version (Japanese locale test)

## Post-Merge Fixes
- Added `blockDisplayInitialState` export alias to `block-display.js` reducer
- Added `redux` to `import-x/no-unresolved` ignore in eslint config
- Fixed `colorMode` destructuring in blocks.jsx (needed by CustomProcedures)
- Added `react`, `react-dom`, `redux` as direct dependencies (were peer deps only)

## ScratchBlocks v2.0.0 API Changes Applied
- `ScratchBlocks.prompt` → `ScratchBlocks.dialog.setPrompt()`
- `ScratchBlocks.statusButtonCallback` → `ScratchBlocks.StatusIndicatorLabel.statusButtonCallback`
- `ScratchBlocks.Xml.textToDom` → `ScratchBlocks.utils.xml.textToDom`
- `ScratchBlocks.Xml.clearWorkspaceAndLoadFromXml` → `ScratchBlocks.clearWorkspaceAndLoadFromXml`
- `this.workspace.reportValue()` → `this.ScratchBlocks.reportValue()`
