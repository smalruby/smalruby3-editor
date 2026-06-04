import {Variable, LOCAL_VARIABLE_PATTERN} from './constants';
import {loadCostume} from '@smalruby/scratch-vm/src/import/load-costume';
import {loadSound} from '@smalruby/scratch-vm/src/import/load-sound';
import spritesLibrary from '../libraries/sprites.json';
import costumesLibrary from '../libraries/costumes.json';
import soundsLibrary from '../libraries/sounds.json';
import backdropsLibrary from '../libraries/backdrops.json';

const spritesMap = new Map(spritesLibrary.map(s => [s.name, s]));
const costumesMap = new Map(costumesLibrary.map(c => [c.name, c]));
const soundsMap = new Map(soundsLibrary.map(s => [s.name, s]));
const backdropsMap = new Map(backdropsLibrary.map(b => [b.name, b]));

/**
 * Mixin for applying blocks to a VM target.
 */
const TargetApplier = {
    /**
     * Apply converted blocks, variables, and comments to the given target.
     * @param {Target} target - VM target to apply blocks to
     * @returns {Promise} Promise that resolves when application is complete
     */
    applyTargetBlocks (target) {
        // Sequence counter to handle re-entrant calls. When classInfo includes
        // costumes/sounds, vm.addCostume triggers emitProjectChanged → React
        // re-render → the useEffect in ruby-tab.jsx may fire again while
        // rubyCode.modified is still true, starting a second applyTargetBlocks.
        // Only the latest call's .then() will proceed; earlier ones bail out.
        const applySeq = (target._smalrubyApplySeq || 0) + 1;
        target._smalrubyApplySeq = applySeq;

        let stage;
        if (target.isStage) {
            stage = target;
        } else {
            stage = this.vm.runtime.getTargetForStage();
        }

        // Delete existing local variables from target before applying new blocks.
        // This prevents ID conflicts when re-executing code with local variables.
        // Local variables are scope-specific and should be recreated on each execution.
        const varsToDelete = [];
        for (const varId in target.variables) {
            const variable = target.variables[varId];
            if (LOCAL_VARIABLE_PATTERN.test(variable.name)) {
                varsToDelete.push(varId);
            }
        }
        varsToDelete.forEach(varId => {
            target.deleteVariable(varId);
        });

        // Handle global/instance/local variables and lists
        // Map of old variable IDs to new IDs (for reusing existing variables)
        const variableIdMap = {};

        // === Smalruby (issue #634): Skip the second occurrence of any
        // (name, scope) pair across stores. The converter's `_onVasgn`
        // eagerly creates a SCALAR in `_context.localVariables` before
        // visiting the RHS, so an array-literal handler that subsequently
        // creates a LIST in `_context.lists` ends up with two variables
        // sharing the same name (e.g. `_a_1_`) but different types and
        // ids. target-applier would push both to the VM target, and
        // scratch-blocks v2 then fails to parse the workspace XML for
        // any block referencing the list. Iterate `lists` first so list
        // wins over the eager scalar; the second iteration of
        // localVariables drops the duplicate. ===
        const seenVarKeys = new Set();
        ['lists', 'variables', 'localVariables'].forEach(storeName => {
            Object.keys(this._context[storeName]).forEach(name => {
                const variable = this._context[storeName][name];
                if (variable.isArgument) return;

                const dedupeKey = `${variable.scope}:${variable.name}`;
                if (seenVarKeys.has(dedupeKey)) {
                    // Older entry from another store wins; remap any later
                    // references through variableIdMap so block fields stay
                    // consistent.
                    return;
                }
                seenVarKeys.add(dedupeKey);

                const oldId = variable.id;
                let existingVar = null;

                if (variable.scope === 'global') {
                    // Check if variable already exists by name and type
                    existingVar = stage.lookupVariableByNameAndType(variable.name, variable.type);
                    if (existingVar) {
                        // Reuse existing variable ID
                        variableIdMap[oldId] = existingVar.id;
                        variable.id = existingVar.id;
                    } else if (Object.prototype.hasOwnProperty.call(stage.variables, variable.id)) {
                        // Variable with this ID already exists
                    } else {
                        stage.createVariable(variable.id, variable.name, variable.type);
                    }
                } else {
                    // For local variables, always create new (they were deleted above)
                    // For instance variables, check if already exists and reuse
                    if (variable.scope !== 'local') {
                        existingVar = target.lookupVariableByNameAndType(variable.name, variable.type, true);
                        if (existingVar) {
                            // Reuse existing variable ID
                            variableIdMap[oldId] = existingVar.id;
                            variable.id = existingVar.id;
                        }
                    }
                    if (existingVar) {
                        // Variable was reused, no need to create
                    } else if (Object.prototype.hasOwnProperty.call(target.variables, variable.id)) {
                        // Variable with this ID already exists
                    } else {
                        target.createVariable(variable.id, variable.name, variable.type);
                    }
                }
            });
        });

        // Apply initialize values to variables/lists
        if (this._context.initializeValues) {
            Object.keys(this._context.initializeValues).forEach(varName => {
                const {value, type} = this._context.initializeValues[varName];
                // Find the variable on the appropriate target
                const varType = type === 'list' ? Variable.LIST_TYPE : Variable.SCALAR_TYPE;
                const owner = target.isStage ? stage : target;
                const existingVar = owner.lookupVariableByNameAndType(varName, varType, !target.isStage);
                if (existingVar) {
                    existingVar.value = value;
                }
            });
        }

        // Update variable IDs in blocks
        Object.keys(this._context.blocks).forEach(blockId => {
            const block = this._context.blocks[blockId];
            if (block.fields) {
                ['VARIABLE', 'LIST'].forEach(fieldName => {
                    const field = block.fields[fieldName];
                    if (field && variableIdMap[field.id]) {
                        field.id = variableIdMap[field.id];
                    }
                });
            }
        });

        // Map of old broadcast IDs to existing IDs (for reusing existing broadcast vars)
        const broadcastIdMap = {};

        Object.keys(this._context.broadcastMsgs).forEach(name => {
            const broadcastMsg = this._context.broadcastMsgs[name];
            // Check if a broadcast variable with the same name already exists in stage
            const existingBroadcast = stage.lookupVariableByNameAndType(
                broadcastMsg.name, Variable.BROADCAST_MESSAGE_TYPE
            );
            if (existingBroadcast) {
                // Reuse existing broadcast variable ID
                broadcastIdMap[broadcastMsg.id] = existingBroadcast.id;
                broadcastMsg.id = existingBroadcast.id;
            } else if (!Object.prototype.hasOwnProperty.call(stage.variables, broadcastMsg.id)) {
                stage.createVariable(broadcastMsg.id, broadcastMsg.name, Variable.BROADCAST_MESSAGE_TYPE);
            }
        });

        // Update BROADCAST_OPTION field IDs in blocks to match existing broadcast variable IDs
        if (Object.keys(broadcastIdMap).length > 0) {
            Object.keys(this._context.blocks).forEach(blockId => {
                const block = this._context.blocks[blockId];
                if (block.fields && block.fields.BROADCAST_OPTION) {
                    const field = block.fields.BROADCAST_OPTION;
                    if (broadcastIdMap[field.id]) {
                        field.id = broadcastIdMap[field.id];
                    }
                }
            });
        }

        const extensionPromises = [];
        this._context.extensionIDs.forEach(extensionID => {
            if (!this.vm.extensionManager.isExtensionLoaded(extensionID)) {
                extensionPromises.push(this.vm.extensionManager.loadExtensionURL(extensionID));
            }
        });

        return Promise.all(extensionPromises).then(() => {
            // If a newer applyTargetBlocks was started, skip this one
            if (target._smalrubyApplySeq !== applySeq) return;

            // Validate the converted graph before touching the target: a
            // non-empty graph with no top-level script serializes to an
            // empty workspace even though apply "succeeds" (issue #710).
            // Note: dangling `parent` references on individual blocks are
            // routine converter output (e.g. re-parented shadows) and are
            // harmless, so only this catastrophic whole-graph case is
            // rejected.
            const contextBlockIds = Object.keys(this._context.blocks);
            const hasTopLevelScript = contextBlockIds.some(blockId => {
                const block = this._context.blocks[blockId];
                return block.topLevel && !block.shadow;
            });
            if (contextBlockIds.length > 0 && !hasTopLevelScript) {
                throw new Error(
                    'Converted block graph is broken: ' +
                    `${contextBlockIds.length} blocks but no top-level script`
                );
            }

            // Replacing the target's blocks is delete-all-then-create and is
            // NOT atomic. If createBlock throws midway the target would be
            // left with a partial (or empty) program while the Ruby tab still
            // shows the code (issue #710). Snapshot the current blocks and
            // comments so any failure can be rolled back.
            // Snapshot each block with a per-block shallow clone:
            // deleteBlock mutates the block objects themselves
            // (_deleteScript flips `topLevel` to false), so holding bare
            // references would corrupt the snapshot.
            const oldBlocks = {};
            Object.keys(target.blocks._blocks).forEach(blockId => {
                oldBlocks[blockId] = Object.assign({}, target.blocks._blocks[blockId]);
            });
            const oldScripts = target.blocks._scripts.slice();
            const oldComments = target.comments;

            try {
                Object.keys(target.blocks._blocks).forEach(blockId => {
                    target.blocks.deleteBlock(blockId);
                });
                target.comments = {};

                Object.keys(this._context.blocks).forEach(blockId => {
                    target.blocks.createBlock(this._context.blocks[blockId]);
                });
            } catch (error) {
                // Roll back to the pre-apply state. Restore the internal
                // containers directly instead of going through createBlock —
                // if createBlock is what just failed, replaying it could
                // fail again and leave the target empty.
                target.blocks._blocks = oldBlocks;
                target.blocks._scripts = oldScripts;
                target.blocks.resetCache();
                target.comments = oldComments;
                this.vm.emitWorkspaceUpdate();
                throw error;
            }

            Object.keys(this._context.comments).forEach(commentId => {
                const comment = this._context.comments[commentId];
                target.createComment(
                    comment.id, comment.blockId, comment.text,
                    comment.x, comment.y, comment.width, comment.height, comment.minimized
                );
            });

            // Apply classInfo attributes to the target using VM setter methods
            // to trigger renderer updates and Redux state changes.
            const classInfo = this._context.classInfo;
            if (classInfo) {
                const has = prop => Object.prototype.hasOwnProperty.call(classInfo, prop);

                if (has('name')) {
                    target.sprite.name = classInfo.name;
                }

                if (has('x') || has('y')) {
                    const newX = has('x') ? classInfo.x : target.x;
                    const newY = has('y') ? classInfo.y : target.y;
                    if (typeof target.setXY === 'function') {
                        target.setXY(newX, newY, true);
                    } else {
                        target.x = newX;
                        target.y = newY;
                    }
                }
                if (has('direction')) {
                    if (typeof target.setDirection === 'function') {
                        target.setDirection(classInfo.direction);
                    } else {
                        target.direction = classInfo.direction;
                    }
                }
                if (has('visible')) {
                    if (typeof target.setVisible === 'function') {
                        target.setVisible(classInfo.visible);
                    } else {
                        target.visible = classInfo.visible;
                    }
                }
                if (has('size')) {
                    if (typeof target.setSize === 'function') {
                        target.setSize(classInfo.size);
                    } else {
                        target.size = classInfo.size;
                    }
                }
                if (has('current_costume')) {
                    // Convert 1-based user input to 0-based internal index
                    const costumeIndex = classInfo.current_costume - 1;
                    if (typeof target.setCostume === 'function') {
                        target.setCostume(costumeIndex);
                    } else {
                        target.currentCostume = costumeIndex;
                    }
                }
                if (has('rotation_style')) {
                    if (typeof target.setRotationStyle === 'function') {
                        target.setRotationStyle(classInfo.rotation_style);
                    } else {
                        target.rotationStyle = classInfo.rotation_style;
                    }
                }

                // Apply current_backdrop (stage-specific, same internal mechanism as current_costume)
                if (has('current_backdrop')) {
                    // Convert 1-based user input to 0-based internal index
                    const backdropIndex = classInfo.current_backdrop - 1;
                    if (typeof target.setCostume === 'function') {
                        target.setCostume(backdropIndex);
                    } else {
                        target.currentCostume = backdropIndex;
                    }
                }

                // Collect new costumes and sounds to load via VM API
                let newCostumes = null;
                let newSounds = null;

                // Apply sprite library data (replaces costumes and sounds)
                if (has('sprite')) {
                    const spriteData = spritesMap.get(classInfo.sprite);
                    if (spriteData) {
                        if (spriteData.costumes) {
                            newCostumes = spriteData.costumes.map(c => Object.assign({}, c));
                        }
                        if (spriteData.sounds) {
                            newSounds = spriteData.sounds.map(s => Object.assign({}, s));
                        }
                    }
                }

                // Apply individual costumes (complete replacement)
                if (has('costumes') && Array.isArray(classInfo.costumes)) {
                    newCostumes = classInfo.costumes.map(name => {
                        const costumeData = costumesMap.get(name);
                        return costumeData ? Object.assign({}, costumeData) : {name};
                    });
                }

                // Apply backdrops (stage-specific, uses backdrop library)
                if (has('backdrops') && Array.isArray(classInfo.backdrops)) {
                    newCostumes = classInfo.backdrops.map(name => {
                        const backdropData = backdropsMap.get(name);
                        return backdropData ? Object.assign({}, backdropData) : {name};
                    });
                }

                // Apply individual sounds (complete replacement)
                if (has('sounds') && Array.isArray(classInfo.sounds)) {
                    newSounds = classInfo.sounds.map(name => {
                        const soundData = soundsMap.get(name);
                        return soundData ? Object.assign({}, soundData) : {name};
                    });
                }

                // Load assets via VM API and replace costumes/sounds
                return this._loadAndReplaceCostumesAndSounds(
                    target, newCostumes, newSounds
                );
            }

            this.vm.emitWorkspaceUpdate();
            if (classInfo && typeof this.vm.emitTargetsUpdate === 'function') {
                this.vm.emitTargetsUpdate();
            }
        });
    }
};

/**
 * Load costume and sound assets via VM API, then replace
 * the target's costumes/sounds arrays.
 * @param {Target} target - VM target to update
 * @param {Array|null} newCostumes - costume data from library, or null
 * @param {Array|null} newSounds - sound data from library, or null
 * @returns {Promise} resolves when all assets are loaded and applied
 */
TargetApplier._loadAndReplaceCostumesAndSounds = function (target, newCostumes, newSounds) {
    const runtime = this.vm.runtime;
    const hasRenderer = runtime && runtime.renderer;
    const hasStorage = runtime && runtime.storage;
    const promises = [];

    if (newCostumes && newCostumes.length > 0) {
        if (hasRenderer && hasStorage) {
            // Load each costume asset directly via loadCostume (from scratch-vm).
            // This creates renderer skins without the side effects of vm.addCostume
            // (no name deduplication, no emitProjectChanged, no re-render triggers).
            const costumeObjs = newCostumes.map(c => ({
                name: c.name,
                rotationCenterX: c.rotationCenterX,
                rotationCenterY: c.rotationCenterY,
                bitmapResolution: c.bitmapResolution,
                skinId: null
            }));
            const costumeChain = costumeObjs.reduce((chain, costumeObj, i) => chain.then(() => {
                const c = newCostumes[i];
                const md5ext = c.md5ext || `${c.assetId}.${c.dataFormat}`;
                return loadCostume(md5ext, costumeObj, runtime, 2);
            }), Promise.resolve());

            promises.push(costumeChain.then(() => {
                // Replace costumes array directly — no name dedup, no min-1 guard
                target.sprite.costumes = costumeObjs;
                target.setCostume(0);
            }));
        } else {
            // Fallback for test environments without renderer/storage
            target.sprite.costumes = newCostumes;
        }
    }

    if (newSounds && newSounds.length > 0) {
        if (hasRenderer && hasStorage) {
            // Load each sound asset directly via loadSound (from scratch-vm).
            const soundObjs = newSounds.map(s => ({
                name: s.name,
                format: s.format || s.dataFormat,
                md5: s.md5ext || `${s.assetId}.${s.dataFormat}`,
                rate: s.rate,
                sampleCount: s.sampleCount
            }));
            const soundBank = target.sprite.soundBank;
            const soundChain = soundObjs.reduce(
                (chain, soundObj) => chain.then(() => loadSound(soundObj, runtime, soundBank)),
                Promise.resolve()
            );

            promises.push(soundChain.then(() => {
                // Replace sounds array directly
                target.sprite.sounds = soundObjs;
            }));
        } else {
            // Fallback for test environments without renderer/storage
            target.sprite.sounds = newSounds;
        }
    }

    if (promises.length === 0) {
        this.vm.emitWorkspaceUpdate();
        if (typeof this.vm.emitTargetsUpdate === 'function') {
            this.vm.emitTargetsUpdate();
        }
        return Promise.resolve();
    }

    return Promise.all(promises).then(() => {
        this.vm.emitWorkspaceUpdate();
        if (typeof this.vm.emitTargetsUpdate === 'function') {
            this.vm.emitTargetsUpdate();
        }
    });
};

export default TargetApplier;
