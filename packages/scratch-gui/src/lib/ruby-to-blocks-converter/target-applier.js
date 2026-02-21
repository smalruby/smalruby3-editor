import {Variable, LOCAL_VARIABLE_PATTERN} from './constants';

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

        ['variables', 'lists', 'localVariables'].forEach(storeName => {
            Object.keys(this._context[storeName]).forEach(name => {
                const variable = this._context[storeName][name];
                if (variable.isArgument) return;

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

        Object.keys(this._context.broadcastMsgs).forEach(name => {
            const broadcastMsg = this._context.broadcastMsgs[name];
            if (!Object.prototype.hasOwnProperty.call(stage.variables, broadcastMsg.id)) {
                stage.createVariable(broadcastMsg.id, broadcastMsg.name, Variable.BROADCAST_MESSAGE_TYPE);
            }
        });

        const extensionPromises = [];
        this._context.extensionIDs.forEach(extensionID => {
            if (!this.vm.extensionManager.isExtensionLoaded(extensionID)) {
                extensionPromises.push(this.vm.extensionManager.loadExtensionURL(extensionID));
            }
        });

        return Promise.all(extensionPromises).then(() => {
            Object.keys(target.blocks._blocks).forEach(blockId => {
                target.blocks.deleteBlock(blockId);
            });
            target.comments = {};

            Object.keys(this._context.blocks).forEach(blockId => {
                target.blocks.createBlock(this._context.blocks[blockId]);
            });

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
                    if (typeof target.setCostume === 'function') {
                        target.setCostume(classInfo.current_costume);
                    } else {
                        target.currentCostume = classInfo.current_costume;
                    }
                }
                if (has('rotation_style')) {
                    if (typeof target.setRotationStyle === 'function') {
                        target.setRotationStyle(classInfo.rotation_style);
                    } else {
                        target.rotationStyle = classInfo.rotation_style;
                    }
                }
            }

            this.vm.emitWorkspaceUpdate();
            if (classInfo && typeof this.vm.emitTargetsUpdate === 'function') {
                this.vm.emitTargetsUpdate();
            }
        });
    }
};

export default TargetApplier;
