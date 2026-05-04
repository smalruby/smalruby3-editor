// TODO: access `BlockType` and `ArgumentType` without reaching into VM
// Should we move these into a new extension support module or something?
import {ArgumentType, BlockType} from '@smalruby/scratch-vm';

/**
 * Build the scratch-blocks argument list from blockInfo text and arguments.
 * Handles input_value (STRING, BOOLEAN) and field_dropdown (menu with menuItems).
 * @param {object} blockInfo - parsed blockInfo containing text, arguments, and optional menuItems.
 * @returns {{scratchBlocksStyleText: string, args: Array}} - the interpolation text and args array.
 */
const buildInterpolationArgs = function (blockInfo) {
    const args = [];
    let argCount = 0;
    const scratchBlocksStyleText = blockInfo.text.replace(/\[(.+?)]/g, (match, argName) => {
        const arg = blockInfo.arguments[argName];
        // === Smalruby: Start of menu field support ===
        if (arg.menu && blockInfo.menuItems && blockInfo.menuItems[arg.menu]) {
            args.push({
                type: 'field_dropdown',
                name: argName,
                options: blockInfo.menuItems[arg.menu]
            });
            return `%${++argCount}`;
        }
        // === Smalruby: End of menu field support ===
        switch (arg.type) {
        case ArgumentType.STRING:
            args.push({type: 'input_value', name: argName});
            break;
        case ArgumentType.BOOLEAN:
            args.push({type: 'input_value', name: argName, check: 'Boolean'});
            break;
        }
        return `%${++argCount}`;
    });
    return {scratchBlocksStyleText, args};
};

// === Smalruby: Start of argumentsByMethod support ===

/**
 * Build a FieldVerticalSeparator instance compatible with both v1 and v2
 * scratch-blocks. v2 only registers the field via `fieldRegistry`, so the
 * v1-style `new ScratchBlocks.FieldVerticalSeparator()` constructor call
 * throws "is not a constructor" at runtime.
 * @param {object} ScratchBlocks - the ScratchBlocks namespace.
 * @returns {object|null} the field instance, or null if unavailable.
 */
const makeVerticalSeparator = function (ScratchBlocks) {
    if (typeof ScratchBlocks.FieldVerticalSeparator === 'function') {
        return new ScratchBlocks.FieldVerticalSeparator();
    }
    if (ScratchBlocks.fieldRegistry &&
        typeof ScratchBlocks.fieldRegistry.fromJson === 'function') {
        return ScratchBlocks.fieldRegistry.fromJson({type: 'field_vertical_separator'});
    }
    return null;
};

/**
 * Parse block text template into an array of components.
 * Each component is either {type: 'label', text} or {type: 'arg', name}.
 * @param {string} text - block text with [ARG_NAME] placeholders.
 * @returns {Array<object>} parsed components.
 */
const parseBlockText = function (text) {
    const components = [];
    let lastIndex = 0;
    const regex = /\[(.+?)]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            components.push({type: 'label', text: text.substring(lastIndex, match.index)});
        }
        components.push({type: 'arg', name: match[1]});
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        components.push({type: 'label', text: text.substring(lastIndex)});
    }
    return components;
};

/**
 * Disconnect all blocks from inputs and save connection info.
 * Follows the procedures_call disconnectOldBlocks_ pattern.
 * @param {object} block - the scratch-blocks Block instance.
 * @returns {object} connectionMap keyed by input name.
 */
const disconnectOldBlocks = function (block) {
    const connectionMap = {};
    for (let i = 0; i < block.inputList.length; i++) {
        const input = block.inputList[i];
        if (input.connection) {
            const target = input.connection.targetBlock();
            connectionMap[input.name] = {
                shadow: input.connection.getShadowDom(),
                block: target
            };
            input.connection.setShadowDom(null);
            if (target) {
                input.connection.disconnect();
            }
        }
    }
    return connectionMap;
};

/**
 * Remove all inputs by disposing them directly.
 * Follows the procedures_call removeAllInputs_ pattern.
 * @param {object} block - the scratch-blocks Block instance.
 */
const removeAllInputs = function (block) {
    for (let i = 0; i < block.inputList.length; i++) {
        block.inputList[i].dispose();
    }
    block.inputList = [];
};

/**
 * Create all inputs from blockInfo text and arguments.
 * Uses appendValueInput/appendDummyInput instead of interpolate_.
 * Follows the procedures_call createAllInputs_ pattern.
 * @param {object} block - the scratch-blocks Block instance.
 * @param {object} blockInfo - parsed blockInfo with text, arguments, menuItems.
 * @param {object} connectionMap - saved connections from disconnectOldBlocks.
 * @param {object} ScratchBlocks - the ScratchBlocks namespace (for FieldDropdown).
 * @param {boolean} skipShadows - if true, skip creating shadow blocks (XML parser will handle them).
 * @param {object} categoryInfo - extension category info (for resolving dynamic menus).
 */
const createAllInputs = function (block, blockInfo, connectionMap, ScratchBlocks, skipShadows, categoryInfo) {
    const components = parseBlockText(blockInfo.text);
    let pendingLabels = [];
    let inputIndex = 0;

    // Add extension icon at the start of the block (matching runtime._convertBlockForScratchBlocks)
    const iconURI = (blockInfo.blockIconURI || (categoryInfo && categoryInfo.blockIconURI));
    if (iconURI) {
        pendingLabels.push({
            fieldImage: true,
            src: iconURI,
            width: 40,
            height: 40
        });
        pendingLabels.push({fieldVerticalSeparator: true});
    }

    for (const component of components) {
        if (component.type === 'label') {
            pendingLabels.push(component.text);
        } else {
            // component.type === 'arg'
            const argName = component.name;
            const arg = blockInfo.arguments[argName];

            if (arg.menu) {
                // Menu field (dropdown) — attach to pending labels, don't create a value input.
                // Resolution order:
                // 1. Static menuItems embedded in blockInfo (for argumentsByMethod menus)
                // 2. Dynamic menu from categoryInfo.menuInfo (for runtime-resolved menus like variableNames)
                // 3. Fallback: single option with defaultValue
                let options = blockInfo.menuItems && blockInfo.menuItems[arg.menu];
                if (!options && categoryInfo && categoryInfo.menuInfo && categoryInfo.menuInfo[arg.menu]) {
                    const menuInfo = categoryInfo.menuInfo[arg.menu];
                    if (typeof menuInfo.items === 'function') {
                        options = menuInfo.items();
                    } else if (Array.isArray(menuInfo.items)) {
                        options = menuInfo.items;
                    }
                    // Normalize items to [text, value] pairs
                    if (options && options.length > 0 && !Array.isArray(options[0])) {
                        options = options.map(item => (
                            (typeof item === 'object' && item.text) ?
                                [item.text, item.value] :
                                [String(item), String(item)]
                        )
                        );
                    }
                }
                if (!options) {
                    options = [[String(arg.defaultValue || ' '), String(arg.defaultValue || ' ')]];
                }
                pendingLabels.push({fieldDropdown: true, name: argName, options: options});
            } else {
                // Value input
                const input = block.appendValueInput(argName);
                if (arg.type === ArgumentType.BOOLEAN) {
                    input.setCheck('Boolean');
                }

                // Add pending labels and fields to this input
                for (const label of pendingLabels) {
                    if (typeof label === 'string') {
                        input.appendField(label);
                    } else if (label.fieldDropdown) {
                        input.appendField(new ScratchBlocks.FieldDropdown(label.options), label.name);
                    } else if (label.fieldImage) {
                        input.appendField(new ScratchBlocks.FieldImage(
                            label.src, label.width, label.height
                        ));
                    } else if (label.fieldVerticalSeparator) {
                        const sep = makeVerticalSeparator(ScratchBlocks);
                        if (sep) input.appendField(sep);
                    }
                }
                pendingLabels = [];

                // Reconnect saved block or create default shadow
                if (connectionMap && connectionMap[argName]) {
                    const saveInfo = connectionMap[argName];
                    if (saveInfo.block) {
                        saveInfo.block.outputConnection.connect(input.connection);
                    }
                    if (saveInfo.shadow) {
                        input.connection.setShadowDom(saveInfo.shadow);
                    }
                    connectionMap[argName] = null;
                } else if (!skipShadows && typeof arg.defaultValue !== 'undefined' && input.connection) {
                    // Create shadow block with default value for new inputs.
                    // Skip on initial domToMutation — the XML parser will create shadows from toolbox XML.
                    const shadowDom = document.createElement('shadow');
                    shadowDom.setAttribute('type', 'text');
                    const fieldDom = document.createElement('field');
                    fieldDom.setAttribute('name', 'TEXT');
                    fieldDom.textContent = String(arg.defaultValue);
                    shadowDom.appendChild(fieldDom);
                    input.connection.setShadowDom(shadowDom);
                    input.connection.respawnShadow_();
                }
                inputIndex++;
            }
        }
    }

    // Any remaining labels go into a dummy input
    if (pendingLabels.length > 0) {
        const dummyInput = block.appendDummyInput();
        for (const label of pendingLabels) {
            if (typeof label === 'string') {
                dummyInput.appendField(label);
            } else if (label.fieldDropdown) {
                dummyInput.appendField(new ScratchBlocks.FieldDropdown(label.options), label.name);
            } else if (label.fieldImage) {
                dummyInput.appendField(new ScratchBlocks.FieldImage(
                    label.src, label.width, label.height
                ));
            } else if (label.fieldVerticalSeparator) {
                const sep = makeVerticalSeparator(ScratchBlocks);
                if (sep) dummyInput.appendField(sep);
            }
        }
    }
};

/**
 * Rebuild the block's inputs based on new blockInfo.
 * Follows the procedures_call updateDisplay_ pattern (scratch-blocks v2):
 * disconnect → remove → create → dispose orphans. **Do NOT toggle
 * `block.rendered` and do NOT call `block.initSvg()` / `block.render()`
 * manually** — Blockly v12's `Input.appendField` is now responsible for
 * initialising fresh fields based on the block state:
 *
 *   appendField(field, name) {
 *     field.setSourceBlock(this.sourceBlock);
 *     this.sourceBlock.initialized && this.initField(field);
 *     this.sourceBlock.rendered && this.sourceBlock.queueRender();
 *   }
 *   initField(field) {
 *     this.sourceBlock.rendered ? field.init() : field.initModel();
 *   }
 *
 * If we set `block.rendered = false` before `appendField` runs, only
 * `field.initModel()` is called and the SVG `<text>` element of a fresh
 * `FieldDropdown` is never created. The follow-up `block.initSvg()` is
 * a no-op because `block.initialized` is already `true` (initSvg has a
 * one-shot guard), so the missing text element is never repaired and
 * the next render throws `Field.getTextContent()` "The text content is
 * null." (issue #634).
 *
 * scratch-blocks v2's own `procedures.ts updateDisplay_` does exactly
 * the no-rendered-toggle pattern below.
 * @param {object} block - the scratch-blocks Block instance.
 * @param {object} newBlockInfo - the new blockInfo to build from.
 * @param {object} ScratchBlocks - the ScratchBlocks namespace.
 * @param {boolean} skipShadows - if true, skip creating shadow blocks.
 * @param {object} categoryInfo - extension category info (for resolving dynamic menus).
 */
const updateBlockDisplay = function (block, newBlockInfo, ScratchBlocks, skipShadows, categoryInfo) {
    const connectionMap = disconnectOldBlocks(block);
    removeAllInputs(block);
    createAllInputs(block, newBlockInfo, connectionMap, ScratchBlocks, skipShadows, categoryInfo);

    // Clean up orphaned shadow blocks
    if (connectionMap) {
        for (const id in connectionMap) {
            const saveInfo = connectionMap[id];
            if (saveInfo && saveInfo.block && saveInfo.block.isShadow()) {
                saveInfo.block.dispose();
            }
        }
    }

    // For freshly-built blocks (block.initialized === false), the
    // appendField calls above did NOT trigger field.init() because
    // Blockly v12's `Input.initField` checks `block.initialized` first.
    // Call `block.initSvg()` to walk inputList and run `field.init()`
    // for every field, which creates each field's SVG `<text>` element
    // (the missing `getTextContent()` target — issue #634).
    //
    // `initSvg()` is idempotent via its one-shot guard, so calling it on
    // an already-initialized block is a no-op. `render()` then re-measures
    // and lays out the block with the new inputs/fields.
    if (block.initSvg && !block.isInsertionMarker()) {
        block.initSvg();
        if (block.render) {
            block.render();
        }
    }
};

/**
 * Set up a validator on the METHOD dropdown field that dynamically rebuilds
 * the block's inputs when a different method is selected.
 * Uses the procedures_call updateDisplay_ pattern for reliable input reconstruction.
 * @param {object} block - the scratch-blocks Block instance.
 * @param {object} blockInfo - the current parsed blockInfo.
 * @param {object} ScratchBlocks - the ScratchBlocks namespace.
 * @param {object} categoryInfo - extension category info (for resolving dynamic menus).
 */
const setupMethodValidator = function (block, blockInfo, ScratchBlocks, categoryInfo) {
    const methodFieldName = blockInfo.methodFieldName || 'METHOD';
    const methodField = block.getField(methodFieldName);
    if (!methodField) return;

    const argumentsByMethod = blockInfo.argumentsByMethod;

    methodField.setValidator(newValue => {
        if (!argumentsByMethod[newValue]) return newValue;

        const newConfig = argumentsByMethod[newValue];
        const currentBlockInfo = JSON.parse(block.blockInfoText);

        // If text hasn't changed, no rebuild needed
        if (currentBlockInfo.text === newConfig.text) return newValue;

        ScratchBlocks.Events.setGroup(true);
        const oldMutation = ScratchBlocks.utils.xml.domToText(block.mutationToDom());

        // Build new blockInfo with the selected method's config
        const newBlockInfo = Object.assign({}, currentBlockInfo, {
            text: newConfig.text,
            arguments: newConfig.arguments
        });
        block.blockInfoText = JSON.stringify(newBlockInfo);

        // Rebuild block display using procedures_call pattern
        updateBlockDisplay(block, newBlockInfo, ScratchBlocks, false, categoryInfo);

        // Set the dropdown value on the newly created field
        const oldMethodValue = currentBlockInfo.arguments[methodFieldName]?.defaultValue || '';
        const newMethodField = block.getField(methodFieldName);
        if (newMethodField) {
            newMethodField.setValue(newValue);
        }

        // Re-attach the validator to the new dropdown field
        setupMethodValidator(block, newBlockInfo, ScratchBlocks, categoryInfo);

        // Fire field change event so the VM updates its blocks model
        ScratchBlocks.Events.fire(new ScratchBlocks.Events.BlockChange(
            block, 'field', methodFieldName, oldMethodValue, newValue
        ));

        // Fire mutation change event for undo/redo
        const newMutation = ScratchBlocks.utils.xml.domToText(block.mutationToDom());
        ScratchBlocks.Events.fire(new ScratchBlocks.Events.BlockChange(
            block, 'mutation', null, oldMutation, newMutation
        ));

        ScratchBlocks.Events.setGroup(false);

        // Return null to prevent default setValue (we already set it above)
        return null;
    });
};
// === Smalruby: End of argumentsByMethod support ===

/**
 * Define a block using extension info which has the ability to dynamically determine (and update) its layout.
 * This functionality is used for extension blocks which can change its properties based on different state
 * information. For example, the `control_stop` block changes its shape based on which menu item is selected
 * and a variable block changes its text to reflect the variable name without using an editable field.
 * @param {object} ScratchBlocks - The ScratchBlocks name space.
 * @param {object} categoryInfo - Information about this block's extension category, including any menus and icons.
 * @param {object} staticBlockInfo - The base block information before any dynamic changes.
 * @param {string} extendedOpcode - The opcode for the block (including the extension ID).
 */
// TODO: grow this until it can fully replace `_convertForScratchBlocks` in the VM runtime
const defineDynamicBlock = (ScratchBlocks, categoryInfo, staticBlockInfo, extendedOpcode) => ({
    init: function () {
        const blockJson = {
            type: extendedOpcode,
            inputsInline: true,
            category: categoryInfo.name,
            colour: categoryInfo.color1,
            colourSecondary: categoryInfo.color2,
            colourTertiary: categoryInfo.color3
        };
        // There is a scratch-blocks / Blockly extension called "scratch_extension" which adjusts the styling of
        // blocks to allow for an icon, a feature of Scratch extension blocks. However, Scratch "core" extension
        // blocks don't have icons and so they should not use 'scratch_extension'. Adding a scratch-blocks / Blockly
        // extension after `jsonInit` isn't fully supported (?), so we decide now whether there will be an icon.
        if (staticBlockInfo.blockIconURI || categoryInfo.blockIconURI) {
            blockJson.extensions = ['scratch_extension'];
        }
        // initialize the basics of the block, to be overridden & extended later by `domToMutation`
        this.jsonInit(blockJson);
        // initialize the cached block info used to carry block info from `domToMutation` to `mutationToDom`
        this.blockInfoText = '{}';
        // we need a block info update (through `domToMutation`) before we have a completely initialized block
        this.needsBlockInfoUpdate = true;
    },
    mutationToDom: function () {
        const container = document.createElement('mutation');
        container.setAttribute('blockInfo', this.blockInfoText);
        return container;
    },
    domToMutation: function (xmlElement) {
        const blockInfoText = xmlElement.getAttribute('blockInfo');
        if (!blockInfoText) return;

        // === Smalruby: Start of argumentsByMethod support ===
        // For blocks with argumentsByMethod, allow multiple domToMutation calls
        // (needed for undo/redo and project load).
        // For other blocks, preserve the original one-time guard.
        const hasArgumentsByMethod = JSON.parse(blockInfoText).argumentsByMethod;
        if (!this.needsBlockInfoUpdate && !hasArgumentsByMethod) {
            throw new Error('Attempted to update block info twice');
        }
        const isFirstCall = !!this.needsBlockInfoUpdate;
        // === Smalruby: End of argumentsByMethod support ===

        delete this.needsBlockInfoUpdate;
        this.blockInfoText = blockInfoText;
        const blockInfo = JSON.parse(blockInfoText);

        switch (blockInfo.blockType) {
        case BlockType.COMMAND:
        case BlockType.CONDITIONAL:
        case BlockType.LOOP:
            this.setOutputShape(ScratchBlocks.OUTPUT_SHAPE_SQUARE);
            this.setPreviousStatement(true);
            this.setNextStatement(!blockInfo.isTerminal);
            break;
        case BlockType.REPORTER:
            this.setOutput(true);
            this.setOutputShape(ScratchBlocks.OUTPUT_SHAPE_ROUND);
            if (!blockInfo.disableMonitor) {
                this.setCheckboxInFlyout(true);
            }
            break;
        case BlockType.BOOLEAN:
            this.setOutput(true);
            this.setOutputShape(ScratchBlocks.OUTPUT_SHAPE_HEXAGONAL);
            break;
        case BlockType.HAT:
        case BlockType.EVENT:
            this.setOutputShape(ScratchBlocks.OUTPUT_SHAPE_SQUARE);
            this.setNextStatement(true);
            break;
        }

        if (blockInfo.color1 || blockInfo.color2 || blockInfo.color3) {
            // `setColour` handles undefined parameters by adjusting defined colors
            this.setColour(blockInfo.color1, blockInfo.color2, blockInfo.color3);
        }

        // === Smalruby: Start of argumentsByMethod layout ===
        if (blockInfo.argumentsByMethod) {
            // Use manual input construction (procedures_call pattern)
            // for blocks with dynamic arguments.
            // On first call (from XML parser), skip shadow creation —
            // the XML parser will create shadows from the toolbox XML.
            updateBlockDisplay(this, blockInfo, ScratchBlocks, isFirstCall, categoryInfo);
            setupMethodValidator(this, blockInfo, ScratchBlocks, categoryInfo);
        } else {
            // Original interpolate_ path for standard dynamic blocks
            const {scratchBlocksStyleText, args} = buildInterpolationArgs(blockInfo);
            this.interpolate_(scratchBlocksStyleText, args);
        }
        // === Smalruby: End of argumentsByMethod layout ===
    }
});

export default defineDynamicBlock;
