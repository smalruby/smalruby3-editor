# Scratch-VM Core Execution Engine - Comprehensive Analysis

This document provides detailed implementation specifics from scratch-vm's core execution engine for reimplementation in Ruby.

## 3-1. Runtime Frame Loop Details

### Constants
- **THREAD_STEP_INTERVAL**: 1000/60 ms (~16.67ms) - 60 FPS target
- **THREAD_STEP_INTERVAL_COMPATIBILITY**: 1000/30 ms (~33.33ms) - 30 FPS compat mode
- **WORK_TIME**: 75% of currentStepTime (12.5ms at 60fps, 25ms at 30fps)

### currentStepTime Calculation
```
currentStepTime = compatibility_mode ? 33.33 : 16.67
WORK_TIME = 0.75 * currentStepTime
```
Set in `runtime.start()` when stepping interval initialized.

### _step() Method Loop (Frame Execution)
Called every `currentStepTime` milliseconds via `setInterval()`:

1. **Emit BEFORE_STEP event**
2. **Clean killed threads**: Filter out threads with `isKilled` flag
3. **Edge-activated hat processing**:
   - Iterate all hat metadata
   - If `hat.edgeActivated === true`, call `startHats(hatType)`
4. **Monitor blocks update** via `_pushMonitors()`
5. **Main thread stepping** via `sequencer.stepThreads()`
6. **Update glows** for visual feedback (script highlighting)
7. **Emit project run status**
8. **Renderer draw** if renderer exists
9. **Emit TARGETS_UPDATE if needed**
10. **Emit MONITORS_UPDATE if monitor state changed**

### Thread Management Per Frame

**Thread lifecycle states**:
- `STATUS_RUNNING`: Normal execution
- `STATUS_YIELD`: Block asked for yield (e.g., wait), will resume next frame
- `STATUS_YIELD_TICK`: Yield just for one tick, automatically reset
- `STATUS_PROMISE_WAIT`: Waiting for async operation
- `STATUS_DONE`: Thread finished

### Turbo Mode Mechanics
- **turboMode boolean flag** on Runtime
- When enabled: WORK_TIME budget constraint **ignored** in stepThreads loop
- Loop condition: `(this.runtime.turboMode || !this.runtime.redrawRequested)`
- Effect: Threads run continuously until completion or WORK_TIME exhausted (if !turboMode)
- No redraw requested check when turboMode enabled

### Compatibility Mode
- `setCompatibilityMode(bool)`: Switches between 60fps and 30fps
- Restarts the stepping interval when changed

## 3-2. Block Execution Pipeline Details

### High-Level Block Input Evaluation (Depth-First)
Blocks are pre-computed into an **operation list (_ops)** during BlockCached initialization:

1. **Recursive input traversal** during cache creation
2. For each input block that's not a shadow:
   - Add its _ops to parent's _ops
   - Mark as non-last operation (sets _parentKey, _parentValues)
3. Shadow blocks (static values) evaluated immediately during init
4. Final operation is the block itself if it has a function

### Execution Flow in execute.js
1. Get current block from thread stack
2. Retrieve BlockCached from cache (or flyoutBlocks)
3. Iterate through _ops array:
   - For each operation, call `blockFunction(argValues, blockUtility)`
   - Results bubble up to parent via _parentKey
   - Exception: lastOperation results are reported via thread

### Block Function Execution
```javascript
const primitiveReportedValue = blockFunction(argValues, blockUtility)
```
- argValues contains: all fields + resolved input values + mutation
- blockUtility provides access to: sequencer, thread, target, runtime
- Return value: primitive value OR Promise

### Promise Handling (Async Blocks)
If `primitiveReportedValue` is a Promise:
1. Set `thread.status = Thread.STATUS_PROMISE_WAIT`
2. Store already-reported values in `currentStackFrame.reported`
3. Mark current reporting block in `currentStackFrame.reporting`
4. Break the operations loop
5. When promise resolves:
   - Call `handleReport()` to process resolved value
   - Pop stack and find next block
   - Resume thread on next frame

### Report Handling (handleReport)
For non-hat, last-operation blocks:
- Push value to `thread.pushReportedValue()`
- If at stack top: 
  - Visual report if stackClick
  - Update monitor if `thread.updateMonitor`
- Set `thread.status = STATUS_RUNNING`

### Block Type Differences

**COMMAND blocks** (no return):
- Execute for side effects
- Can yield, wait, or branch
- Status managed by block via util.yield()

**REPORTER blocks** (return values):
- Evaluated as inputs to parent blocks
- Value stored in parent's argValues
- Shown visually only if at stack top + stackClick

**BOOLEAN blocks**:
- Special reporters returning true/false
- Used in conditions

**HAT blocks** (event responders):
- Entry points for threads
- Status == HAT means: "execute predicate"
- Edge-activated: checked every frame if edgeActivated === true
- Non-edge: checked only on startHats()

## 3-3. Hat Block System

### Hat Metadata
Hats registered via `getHats()` return:
```javascript
{
  opcode: {
    restartExistingThreads: boolean,
    edgeActivated: boolean
  }
}
```

### startHats(opcode, optMatchFields, optTarget)
**Execution**:
1. Verify hat exists in `_hats` registry
2. Iterate all scripts via `allScriptsByOpcodeDo()`
3. For each matching script:
   - **Match fields** (broadcast name, etc.) against optMatchFields
   - If restartExistingThreads=true:
     - Stop existing thread with same topBlock
     - Restart it (_restartThread)
   - Else: skip if thread already running with same topBlock
4. Create new thread via `_pushThread(topBlockId, target)`
5. **Execute newly created threads immediately** in a loop:
   - Call `execute(sequencer, thread)` once
   - Call `thread.goToNextBlock()`
6. Return list of started threads

### Edge-Activated Hat Mechanics
In `_step()` each frame:
```javascript
for (const hatType in this._hats) {
  if (hat.edgeActivated) {
    this.startHats(hatType)
  }
}
```

In execute.js `handleReport()` for hat blocks:
```javascript
if (getIsEdgeActivatedHat(opcode)) {
  if (!thread.stackClick) {
    hasOldEdgeValue = target.hasEdgeActivatedValue(blockId)
    oldEdgeValue = target.updateEdgeActivatedValue(blockId, newValue)
    
    // Transition detection: false->true OR no prior value + true
    edgeWasActivated = !hasOldEdgeValue ? newValue : (!oldEdgeValue && newValue)
    
    if (!edgeWasActivated) {
      sequencer.retireThread(thread)
    }
  }
} else if (!resolvedValue) {
  // Non-edge: retire if predicate false
  sequencer.retireThread(thread)
}
```

## 3-4. Clone System

### Clone Creation (makeClone on RenderedTarget)
1. Check `runtime.clonesAvailable()` - returns `_cloneCounter < MAX_CLONES` (300)
2. Increment counter: `runtime.changeCloneCounter(1)`
3. Create new RenderedTarget via `sprite.createClone()`
4. **Copy all properties** from original:
   - x, y, direction
   - draggable, visible, size
   - currentCostume, rotationStyle
   - effects (shallow copy via Clone.simple)
   - variables (duplicateVariables)
   - _edgeActivatedHatValues (shallow copy)
5. Initialize drawable
6. Return new clone

### What's Shared vs Copied
**Shared**:
- blocks (all clones of a sprite share the same block definitions)
- costumes
- sounds
- soundBank

**Copied**:
- All variable values (duplicateVariables creates new Variable instances)
- All visual state (x, y, direction, effects, costume, etc.)
- Edge-activated hat values

### Clone Limit Enforcement
- `Runtime.MAX_CLONES = 300`
- `_cloneCounter` tracks total active clones
- Increment on clone creation
- Decrement on clone deletion via disposeTarget

### Clone Deletion (deleteClone block)
1. Check if original (return if yes)
2. Call `runtime.disposeTarget(clone)`
3. Call `runtime.stopForTarget(clone)` - stops all threads

## 3-5. Variable/List System

### Variable Types
```javascript
Variable.SCALAR_TYPE = '' (default scalar/number)
Variable.LIST_TYPE = 'list' (arrays)
Variable.BROADCAST_MESSAGE_TYPE = 'broadcast_msg'
```

### Variable Initialization
- SCALAR: value = 0
- LIST: value = []
- BROADCAST: value = name (the broadcast name itself)

### Variable Scope Model
**Lookup hierarchy** (lookupVariableById):
1. Check target's own variables
2. If not found and target is not stage: check stage's variables (globals)
3. Return found or undefined

**Creation**:
- Called via `lookupOrCreateVariable(id, name)`
- Creates NEW Variable instance on target
- Added to target.variables dictionary keyed by id

### Monitor System
Monitors are executed every frame via separate thread pool:

**_pushMonitors()**:
- Called once per frame before normal thread stepping
- Executes monitorBlocks (blocks in monitor mode)

**Monitor block handling**:
- data_variable (get variable) block with isMonitored=true
- Creates thread with `updateMonitor=true` flag
- Thread execution stores reported value in monitor state
- Uses `requestUpdateMonitor()` to update Map

### List Operations Implementation (scratch3_data.js)
Key methods:
- `getListContents`: Returns list.value array
  - If monitor thread: returns copy if changed, else original
- `addToList(args, util)`: Push value to list array
- `deleteOfList`: Remove item by index (1-based)
- `deleteAllOfList`: Clear array
- `insertAtList`: Insert at index (1-based)
- `replaceItemOfList`: Replace at index
- `getItemOfList`: Get by index (1-based, wraps around)
- `getItemNumOfList`: Find index of value
- `lengthOfList`: Return list.value.length
- `listContainsItem`: Check if value exists

All list operations are **synchronous** and modify list in place.

### getMonitored Blocks
Blocks that support monitoring return metadata via getMonitored():
- Maps opcode to info for monitor display
- Variables automatically have monitors if isMonitored

## Key Implementation Considerations for Ruby

### Frame Loop Timing
- Use `Time.now` for millisecond precision
- setInterval equivalent: EventMachine or Thread.sleep in loop
- Budget tracking: `timer.start()` and `timer.timeElapsed()`

### Thread Status State Machine
- Track all 6 status values
- Check status before each operation
- Update status carefully (don't lose PROMISE_WAIT state)

### Stack Management
- Use arrays for block stack (stack of block IDs)
- Stack frames for procedure context and loop state
- Frame reuse pool for performance

### Operation Pre-compilation
- BlockCached caches operation list during block creation
- This is critical for performance - evaluate inputs once, then reuse
- Invalidate cache when block definition changes

### Promise/Async Handling
- Store reporting state so resumed blocks get correct values
- Ruby: use Fiber/Thread for promise handling
- Restore execution context when promise resolves

### Hat Block Edge Detection
- Must track previous value for each hat block on each target
- Only trigger on false->true transition (not on repeated true)
- Exception: manual stack click always triggers

### Clone Limit
- Hard limit of 300
- Enforce before creating clone
- Track in single counter

### Compatibility with Scratch 2
- currentMSecs updated once per frame (updateCurrentMSecs)
- Used for Wait block timing
- In Scratch 2, this was used for frame-independent timing