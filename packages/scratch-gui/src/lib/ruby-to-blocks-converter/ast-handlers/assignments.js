import _ from 'lodash';
import { defineMessages } from 'react-intl';
import { messages as converterMessages } from '../converter-errors';
import { RubyToBlocksConverterError } from '../errors';

const messages = defineMessages({
    cannotChangeArgument: {
        defaultMessage:
            '"{NAME}" is an argument, so it cannot be changed.' +
            '\nCopy it to another variable and change that one (e.g. x = {NAME}).',
        description: 'Error message when an argument of a method (a function in DNCL) is assigned to',
        id: 'gui.smalruby3.rubyToBlocksConverter.cannotChangeArgument',
    },
});

// The variables a multiple assignment can set, and the kind of each (issue #1814).
const MULTI_WRITE_TARGET_SCOPES = {
    LocalVariableTargetNode: 'local',
    InstanceVariableTargetNode: 'instance',
    GlobalVariableTargetNode: 'global',
};
// The values of a multiple assignment that becomes one assignment for each variable: literals only,
// so that setting the variables one by one is the same as setting them together.
const MULTI_WRITE_LITERAL_TYPES = new Set(['IntegerNode', 'FloatNode', 'StringNode', 'TrueNode', 'FalseNode']);

/**
 * Assignment AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const AssignmentHandlers = {
    visitCallOperatorWriteNode(node) {
        // e.g. self.size += 10 (CallOperatorWriteNode in Prism)
        // node.receiver = self, node.read_name = 'size', node.binaryOperator = '+', node.value = 10
        const saved = this._saveContext();

        const preBlocks = [];

        // Visit the receiver to get the base object (e.g. self)
        let receiver = this.visit(node.receiver);
        let split = this._splitPreBlocksAndValue(receiver);
        receiver = split.value;
        preBlocks.push(...split.preBlocks);

        // Build a synthetic call to get the read value (e.g. self.size, pen.color)
        // This allows the onOpAsgn handlers to recognize the lh as a looks_size block etc.
        // Note: Prism uses camelCase property names (readName, not read_name)
        // Save receiver name BEFORE callMethod, since callMethod may modify the ruby_expression text
        const receiverNameForLh = this._getReceiverName(receiver);
        // eslint-disable-next-line no-undefined
        let lh = this.callMethod(receiver, node.readName, [], undefined, undefined, node);
        if (!lh) {
            // Fallback: use receiver directly
            lh = receiver;
        }
        // If lh is a ruby_expression block, fix the source text to be "receiver.readName"
        // The callMethod handler used _getSource(node) which gives the whole assignment expression.
        // We need just the read part (e.g. "pen.color" not "pen.color += 10").
        if (
            this._isRubyExpression(lh) &&
            receiverNameForLh &&
            receiverNameForLh !== 'sprite' &&
            receiverNameForLh !== 'stage'
        ) {
            const textBlock = this._context.blocks[lh.inputs.EXPRESSION.block];
            if (textBlock) {
                textBlock.fields.TEXT.value = `${receiverNameForLh}.${node.readName}`;
            }
        }
        split = this._splitPreBlocksAndValue(lh);
        lh = split.value;
        preBlocks.push(...split.preBlocks);

        const operator = node.binaryOperator;

        let rh = this.visit(node.value);
        split = this._splitPreBlocksAndValue(rh);
        rh = split.value;
        preBlocks.push(...split.preBlocks);

        // For now, we use a generic onOpAsgn handler
        let block = this._callConvertersHandler('onOpAsgn', lh, operator, rh);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },

    visitLocalVariableOperatorWriteNode(node) {
        return this._onVarOpAsgn(node.name, 'local', node.binaryOperator, node.value, node);
    },

    visitGlobalVariableOperatorWriteNode(node) {
        return this._onVarOpAsgn(node.name, 'global', node.binaryOperator, node.value, node);
    },

    visitInstanceVariableOperatorWriteNode(node) {
        return this._onVarOpAsgn(node.name, 'instance', node.binaryOperator, node.value, node);
    },

    // The argument reporter of a definition cannot be set: assigning to an argument would
    // set another variable of the same name, and the argument would keep its value.
    _rejectArgumentChange(name, scope, node) {
        if (scope !== 'local') return;
        const varName = this._toSnakeCaseLowercase(name);
        const currentScope = this._getCurrentScope();
        const local = currentScope && currentScope.localVars[varName];
        if (local && local.variable.isArgument) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.cannotChangeArgument, { NAME: varName }),
            );
        }
    },

    _onVarOpAsgn(name, scope, operator, valueNode, node) {
        this._rejectArgumentChange(name, scope, node);
        const saved = this._saveContext();

        const preBlocks = [];
        let lh = name;
        if (scope === 'local') {
            const varName = this._toSnakeCaseLowercase(name);
            let rubyBlockArgs;
            if (node.block && node.block.parameters) {
                rubyBlockArgs = this.visit(node.block.parameters);
            }
            let rubyBlock;
            if (node.block) {
                rubyBlock = this._processStatement(node.block.body);
                if (typeof rubyBlock === 'undefined') {
                    rubyBlock = null;
                }
            }
            const block = this.callMethod(null, varName, [], rubyBlockArgs, rubyBlock, node);
            if (block) {
                const splitLh = this._splitPreBlocksAndValue(block);
                lh = splitLh.value;
                preBlocks.push(...splitLh.preBlocks);
            } else {
                lh = varName;
            }
        }

        let rh = this.visit(valueNode);
        const split = this._splitPreBlocksAndValue(rh);
        rh = split.value;
        preBlocks.push(...split.preBlocks);

        let block = this._callConvertersHandler('onOpAsgn', lh, operator, rh);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },

    visitLocalVariableWriteNode(node) {
        return this._onVasgn(node.name, 'local', node.value, node);
    },

    visitGlobalVariableWriteNode(node) {
        return this._onVasgn(node.name, 'global', node.value, node);
    },

    visitInstanceVariableWriteNode(node) {
        return this._onVasgn(node.name, 'instance', node.value, node);
    },

    /**
     * The variables and the values of a multiple assignment that the blocks can do as one
     * assignment for each variable (issue #1814): `a, b = 1, "x"` (literals after `=`, as many as
     * the variables). Ruby works out every value before it sets the variables, so a value that reads
     * a variable or calls a method could differ when the variables are set one by one: the swap
     * `a, b = b, a` is not `a = b` then `b = a`. Such a form, and a splat, an array, an element of a
     * list or nested variables, is not taken.
     * @param {object} node - A MultiWriteNode.
     * @returns {?Array<{target: object, scope: string, value: object}>} The pairs, or null when the
     *   form is not taken.
     */
    _multiWritePairs(node) {
        const value = node.value;
        if (node.rest || node.rights.length > 0) return null;
        if (this._prismNodeType(value) !== 'ArrayNode' || value.openingLoc) return null;
        if (value.elements.length !== node.lefts.length) return null;
        const pairs = [];
        for (let i = 0; i < node.lefts.length; i++) {
            const target = node.lefts[i];
            const scope = MULTI_WRITE_TARGET_SCOPES[this._prismNodeType(target)];
            if (!scope || !MULTI_WRITE_LITERAL_TYPES.has(this._prismNodeType(value.elements[i]))) return null;
            pairs.push({ target, scope, value: value.elements[i] });
        }
        return pairs;
    },

    // `a, b = 1, 2` is `a = 1` then `b = 2`. The blocks have no multiple assignment, so any other
    // form is the error of a wrong instruction (issue #1814).
    visitMultiWriteNode(node) {
        const pairs = this._multiWritePairs(node);
        if (!pairs) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(converterMessages.wrongInstruction, {
                    SOURCE: this._truncateSource(this._getSource(node)),
                }),
            );
        }
        const blocks = [];
        pairs.forEach(({ target, scope, value }) => {
            blocks.push(..._.castArray(this._onVasgn(target.name, scope, value, node)));
        });
        return blocks;
    },

    _onVasgn(name, scope, valueNode, node) {
        this._rejectArgumentChange(name, scope, node);
        const saved = this._saveContext();

        const preBlocks = [];
        // Normalize variable name for local variables to match how arguments and other locals are stored
        let varName = name;
        if (scope === 'local') {
            varName = this._toSnakeCaseLowercase(varName);

            // Backward compatibility: if varName is a registered method on 'sprite' with 1 argument,
            // treat it as a method call (e.g. pen_color = "#ff0000")
            const writeName = `${varName}=`;
            let rubyBlockArgs;
            if (node.block && node.block.parameters) {
                rubyBlockArgs = this.visit(node.block.parameters);
            }
            let rubyBlock;
            if (node.block) {
                rubyBlock = this._processStatement(node.block.body);
                if (typeof rubyBlock === 'undefined') {
                    rubyBlock = null;
                }
            }
            const savedBeforeWriter = this._saveContext();
            // The value is visited again below, so the calls in it must be counted from the same index again.
            const savedMethodCallIndices = Object.assign({}, this._context.methodCallIndices);
            const savedReturnValueInStatement = this._context.savedReturnValueInStatement;
            const block = this.callMethod(null, writeName, [this.visit(valueNode)], rubyBlockArgs, rubyBlock, node);
            if (block) {
                return block;
            }
            // Not a writer method: drop what visiting the value made, as it is visited again below.
            this._restoreContext(savedBeforeWriter);
            this._context.methodCallIndices = savedMethodCallIndices;
            this._context.savedReturnValueInStatement = savedReturnValueInStatement;
        }
        const variable = this._lookupOrCreateVariable(varName);
        // Whether this assignment made the variable: one made only to be set to a hash is left out
        // at the end when nothing uses it (see `_dropUnusedHashVariables`, issue #1666).
        const storeOfVariable = scope === 'local' ? saved.localVariables : saved.variables;
        const madeByThisAssignment = !Object.values(storeOfVariable).includes(variable);
        // Visit the value as a value, like an argument of `say(...)`: a call of a method that returns
        // a value (e.g. `x = bar(1)`, `x = super`) becomes the call followed by its return variable (#1568).
        const savedIsValue = this._context.isValue;
        this._context.isValue = true;
        let rh;
        try {
            rh = this.visit(valueNode);
        } finally {
            this._context.isValue = savedIsValue;
        }
        const split = this._splitPreBlocksAndValue(rh);
        rh = split.value;
        preBlocks.push(...split.preBlocks);

        let block = this._callConvertersHandler('onVasgn', scope, variable, rh);
        if (block && madeByThisAssignment && this._isHash(rh)) {
            variable.madeForHash = true;
        }
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },
};

export default AssignmentHandlers;
