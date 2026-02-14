# Conflict Resolutions - 2026-02 Merge

**Date**: 2026-02-15
**Upstream Commit**: `5f063605b67927f01647f56a8abf28b972a292bd`
**Merge Branch**: `feat/upstream-merge-2026-02`

## Summary

- **Total Conflicts**: 16 files
- **Conflict Categories**:
  - Package metadata: 6 files (package.json, package-lock.json in各パッケージ)
  - Component imports: 5 files (library containers)
  - GUI components: 2 files (gui.jsx, library.jsx)
  - Build/tooling: 1 file (make-toolbox-xml.js)
  - State management: 2 files (gui.jsx container, gui.jsx component)

## Conflict Resolution Strategy

### Category 1: Package Metadata (6 files)

**Files**:
- `package.json` (root)
- `package-lock.json` (root)
- `packages/scratch-gui/package.json`
- `packages/scratch-render/package.json`
- `packages/scratch-svg-renderer/package.json`
- `packages/scratch-vm/package.json`
- `packages/task-herder/package.json`

**Strategy**:
1. Accept upstream dependency versions
2. Keep Smalruby-specific metadata (name, version, scripts)
3. Regenerate `package-lock.json` with `npm install` after resolving package.json files

**Rationale**: Upstream has the latest dependency versions we need. Smalruby package names (@smalruby/*) and custom scripts must be preserved.

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

## Next Steps

1. ✅ Resolve all conflicts
2. ⏳ Run linting
3. ⏳ Run unit tests
4. ⏳ Run integration tests
5. ⏳ Run build
6. ⏳ Manual verification
7. ⏳ Commit and push
