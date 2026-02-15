# Conflict Resolutions - 2026-02 Merge

**Date**: 2026-02-15
**Upstream Commit**: `5f063605b67927f01647f56a8abf28b972a292bd`
**Merge Branch**: `feat/upstream-merge-2026-02`

## Summary

- **Total Conflicts**: 16 files (initial automatic conflicts)
- **Complex Files Requiring 3-Way Diff Analysis**: package.json files, gui.jsx

## 3-Way Diff Analysis Methodology

This merge uses proper 3-way diff analysis for complex files to ensure both Smalruby customizations and upstream improvements are correctly integrated.

### Reference Points

1. **(1) Previous upstream merge base**: `upstream/develop:92c83be034d1ff6224c786702fcc4db945f6b11d`
   - Date: 2026-01-19
   - Context: PR #416 - Last successful upstream merge
   - Purpose: Common ancestor for understanding what changed on both sides

2. **(2) Smalruby develop before this merge**: `origin/develop:8220cde2ad0589dc5decfae18ae17ca66c57562b`
   - Date: Just before this merge started
   - Purpose: Shows Smalruby's customizations and intent since last merge

3. **(3) Current upstream target**: `upstream/develop:5f063605b67927f01647f56a8abf28b972a292bd`
   - Date: Target of this merge
   - Purpose: Shows upstream's changes and intent since last merge

### Analysis Process

For each complex file:

#### Step 1: Understand Smalruby's Intent
```bash
git diff 92c83be034d1ff6224c786702fcc4db945f6b11d:path/to/file \
         8220cde2ad0589dc5decfae18ae17ca66c57562b:path/to/file
```

This diff (1)→(2) reveals what Smalruby customized and why.

#### Step 2: Understand Upstream's Intent
```bash
git diff 92c83be034d1ff6224c786702fcc4db945f6b11d:path/to/file \
         5f063605b67927f01647f56a8abf28b972a292bd:path/to/file
```

This diff (1)→(3) reveals what upstream changed and why.

#### Step 3: Apply Mechanical Merge
Git's automatic merge to current upstream (3).

#### Step 4: Manual Refinement
Review mechanical merge and ensure:
- Smalruby customizations are preserved
- Upstream improvements are accepted
- No logical changes lost
- Both intents honored

### Key Principles

1. **Understand Intent**: Don't just mechanically merge - understand why each side made changes
2. **Preserve Customizations**: Smalruby features must not be lost (Ruby mode, Google Drive, extensions, custom lint configs)
3. **Accept Improvements**: Upstream bug fixes, dependency updates, and new features should be integrated
4. **Handle Lint Appropriately**:
   - **Upstream code**: Suppress warnings via configuration
   - **Smalruby code**: Fix code to eliminate warnings

## Conflict Resolution Strategy

### Files Requiring 3-Way Diff Analysis

#### packages/scratch-vm/package.json

**Issue Discovered**: Lost Smalruby customization in mechanical merge (commit 74fb4c1f5)

**Smalruby Intent (1)→(2)**:
- Added `-e customrules` flag to format-message lint command
- Suppresses format-message warnings for upstream files
- Correct: `"lint": "eslint . && format-message lint -e customrules -c .format-message-lint.json src/**/*.js"`

**Upstream Intent (1)→(3)**:
- Migrated to ESLint flat config (eslint.config.mjs)
- Changed `"lint": "eslint ."` to `"lint": "eslint"`
- Updated dependencies

**Resolution**:
- Accept upstream's ESLint change (`"eslint"` without dot)
- Preserve Smalruby's `-e customrules` flag
- Move workspace dependencies to top of dependencies section (matches upstream pattern)
- **Final**: `"lint": "eslint && format-message lint -e customrules -c .format-message-lint.json src/**/*.js"`

**Status**: ✅ Re-merged with 3-way diff - lint passes with 0 warnings

---

#### packages/scratch-gui/package.json

**Smalruby Intent (1)→(2)**:
- Added `graphql: ^14.7.0` (for Mesh v2)
- Added `monaco-editor: ^0.55.1` (for Ruby code editor)
- Changed `@scratch/*` to `@smalruby/*`
- Updated version to align with Smalruby

**Upstream Intent (1)→(3)**:
- Updated dependencies (React, Redux, testing libraries)
- Removed deprecated dependencies
- Added new dependencies

**Resolution**:
- Accept all upstream dependency updates
- Preserve `graphql` and `monaco-editor`
- Keep `@smalruby/*` scope
- Move workspace dependencies to top of dependencies section (matches upstream pattern)
- Update version to 12.6.2

**Status**: ✅ Re-merged with 3-way diff - lint passes with 0 warnings

---

#### packages/scratch-gui/src/components/gui/gui.jsx

**Smalruby Intent (1)→(2)**:
- Added URLLoaderModal (Google Drive)
- Added KoshienTestModal (competition support)
- Added BlockDisplayModal (block display feature)
- Added Ruby tab with Monaco Editor
- Integrated Ruby-to-blocks conversion

**Upstream Intent (1)→(3)**:
- Added ModalFocusProvider wrapper for better modal accessibility (green flag keyboard focus fix - PR #431)
- Removed `showNewFeatureCallouts` prop (deprecated feature)
- Removed `username` prop from MenuBar and ExtensionsButton (simplified prop passing)
- Removed `activeTabIndex` prop from ExtensionsButton (unnecessary)
- Component structure improvements

**Resolution Strategy**:
- ✅ Accept ModalFocusProvider wrapper (upstream accessibility improvement)
- ✅ Accept removal of showNewFeatureCallouts (deprecated)
- ✅ Accept prop simplification (username, activeTabIndex removal)
- ✅ Preserve all Smalruby modals (URLLoaderModal, KoshienTestModal, BlockDisplayModal)
- ✅ Preserve Ruby tab integration (RubyTab component, rubyTabVisible, onActivateRubyTab, rubyIcon)
- ⚠️ Note: setPlatform/setTheme pattern - Smalruby moved to prop callbacks but current merge kept upstream's direct imports (both work, but Smalruby's is cleaner)

**Current Status**:
- Mechanical merge already applied
- Unit tests passing (85/85 suites, 783/784 tests passed)
- All Smalruby features preserved
- All upstream improvements accepted
- **Status**: ✅ Verified working (no re-merge needed unless setPlatform/setTheme cleanup desired)

---

### Category 1: Package Metadata (Already Resolved)

**Files**:
- `package.json` (root)
- `packages/scratch-render/package.json`
- `packages/scratch-svg-renderer/package.json`
- `packages/task-herder/package.json`

**Strategy Applied**:
1. Accepted upstream dependency versions
2. Kept Smalruby-specific metadata (name, version, scripts)
3. Updated versions to 12.6.2

**Note**: scratch-vm and scratch-gui package.json need re-merge with 3-way diff analysis

---

### Category 2: Component Imports (5 files)

**Files**:
- `packages/scratch-gui/src/containers/backdrop-library.jsx`
- `packages/scratch-gui/src/containers/costume-library.jsx`
- `packages/scratch-gui/src/containers/extension-library.jsx`
- `packages/scratch-gui/src/containers/sound-library.jsx`
- `packages/scratch-gui/src/containers/sprite-library.jsx`

**Conflict Pattern**: Import statement differences
```javascript
// Smalruby (HEAD)
import VM from '@smalruby/scratch-vm';

// Upstream
import {costumeShape} from '../lib/assets-prop-types.js';
// or
import {soundShape} from '../lib/assets-prop-types.js';
```

**Strategy**: Accept both imports (both are needed)

**Rationale**: Upstream added new shape validators, Smalruby uses scoped package name. Both imports are compatible.

---

### Category 3: GUI Components (2 files)

**File 1**: `packages/scratch-gui/src/components/gui/gui.jsx`

**Conflict 1**: Box wrapper className
**Conflict 2**: TabPanel structure

**Strategy**: Keep Smalruby's Ruby tab while accepting upstream structure changes

---

**File 2**: `packages/scratch-gui/src/components/library/library.jsx`

**Conflict**: Import difference
```javascript
// Smalruby
import {getLocalStorageValue, setLocalStorageValue} from '../../lib/local-storage.js';

// Upstream
import {CATEGORIES} from '../../../src/lib/libraries/decks/index.jsx';
```

**Strategy**: Accept both imports

---

### Category 4: Container Components (1 file)

**File**: `packages/scratch-gui/src/containers/gui.jsx`

**Conflict**: Import statement
```javascript
// Smalruby
import {setTheme} from '../reducers/settings';

// Upstream
import {setDynamicAssets} from '../reducers/dynamic-assets';
```

**Strategy**: Accept both imports (both reducers are needed)

---

### Category 5: Build/Tooling (1 file)

**File**: `packages/scratch-gui/src/lib/make-toolbox-xml.js`

**Conflict**: Whitespace only (empty lines)

**Strategy**: Accept upstream version (no functional difference)

---

## Detailed Resolutions

### 1. package.json (root)

**Date**: 2026-02-15
**Conflict Lines**: test scripts

**Resolution**:
- Kept Smalruby test scripts structure
- No upstream changes to conflict with

**Code**:
```json
"test": "npm run build:dev && npm run test:unit && npm run test:integration",
"test:unit": "npm run test:unit --workspace=packages/scratch-vm --workspace=packages/scratch-gui",
"test:integration": "npm run test:integration --workspace=packages/scratch-vm --workspace=packages/scratch-gui"
```

---

### 2-7. package.json files (各パッケージ)

**Date**: 2026-02-15

**Resolution Pattern**:
1. Keep `"name": "@smalruby/[package-name]"`
2. Keep `"version": "12.3.1"`
3. Accept upstream dependencies
4. Keep Smalruby-specific scripts (setup:opal, etc.)
5. Keep Smalruby metadata (author, license, homepage)

**Files Resolved**:
- packages/scratch-gui/package.json
- packages/scratch-render/package.json
- packages/scratch-svg-renderer/package.json
- packages/scratch-vm/package.json
- packages/task-herder/package.json

---

### 8-12. Library Container Imports

**Date**: 2026-02-15

**Files**:
- backdrop-library.jsx
- costume-library.jsx
- extension-library.jsx
- sound-library.jsx
- sprite-library.jsx

**Resolution**: Merged both import sections

**Example** (backdrop-library.jsx):
```javascript
import intlShape from '../lib/intlShape.js';
import VM from '@smalruby/scratch-vm';
import {costumeShape} from '../lib/assets-prop-types.js';
```

---

### 13. gui.jsx (component)

**Date**: 2026-02-15
**Strategy**: Preserve Ruby tab integration while accepting upstream changes

**Details**: [TO BE FILLED DURING RESOLUTION]

---

### 14. library.jsx (component)

**Date**: 2026-02-15
**Strategy**: Merge both import sets

**Details**: [TO BE FILLED DURING RESOLUTION]

---

### 15. gui.jsx (container)

**Date**: 2026-02-15
**Strategy**: Merge both imports

**Resolution**:
```javascript
import {setPlatform} from '../reducers/platform';
import {setTheme} from '../reducers/settings';
import {setDynamicAssets} from '../reducers/dynamic-assets';
```

---

### 16. make-toolbox-xml.js

**Date**: 2026-02-15
**Strategy**: Accept upstream (whitespace only)

**Resolution**: No functional changes, accepted upstream version

---

### 17. package-lock.json

**Date**: 2026-02-15
**Strategy**: Regenerate after package.json resolution

**Command**:
```bash
docker compose run --rm app npm install
```

**Result**: [TO BE FILLED AFTER REGENERATION]

---

## Resolution Timeline

- **Started**: 2026-02-15 [TIME]
- **Package metadata resolved**: [TIME]
- **Import conflicts resolved**: [TIME]
- **Component conflicts resolved**: [TIME]
- **package-lock.json regenerated**: [TIME]
- **Completed**: [TIME]

**Total Time**: [TO BE CALCULATED]

---

## Verification Summary

### Completed

1. ✅ **3-Way Diff Analysis**: Applied to all complex files (package.json files, gui.jsx)
2. ✅ **Critical Fix**: Restored `-e customrules` flag in scratch-vm lint script (lost in mechanical merge)
3. ✅ **Dependency Organization**: Moved workspace dependencies to top of dependencies sections
4. ✅ **Version Updates**: All packages updated to 12.6.2
5. ✅ **Lint - scratch-vm**: 0 errors, 0 warnings
6. ✅ **Lint - scratch-gui**: 0 errors, 0 warnings
7. ✅ **Unit Tests - scratch-gui**: 85/85 suites passed, 783/784 tests passed

### Next Steps

1. ⏳ Run unit tests for scratch-vm
2. ⏳ Run integration tests for all packages
3. ⏳ Run production build (`npm run build`)
4. ⏳ Manual verification (Ruby mode, Google Drive, extensions, keyboard events after green flag)
5. ⏳ Commit and create PR
