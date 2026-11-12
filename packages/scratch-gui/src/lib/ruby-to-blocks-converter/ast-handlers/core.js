import _ from 'lodash';
import { defineMessages } from 'react-intl';
import { RubyToBlocksConverterError } from '../errors';
import { isKnownListReceiver } from '../variable-hash-ops';

const messages = defineMessages({
    conditionIsNotBoolean: {
        defaultMessage: 'condition is not boolean: {SOURCE}.\nUse a comparison operator (==, <, >, etc.).',
        description: 'Error message when if/until condition is not a boolean expression',
        id: 'gui.smalruby3.rubyToBlocksConverter.conditionIsNotBoolean',
    },
    includeNotStatementBlocks: {
        defaultMessage:
            '"{ SOURCE }" is not a command, so it cannot be written here.' +
            '\nWrite a command (e.g. move(10)) instead, or delete this line.',
        description:
            'Error message when a line that is not a command (e.g. a symbol such as :a) is written ' +
            'in a block body (do ... end, if, a method definition)',
        id: 'gui.smalruby3.rubyToBlocksConverter.includeNotStatementBlocks',
    },
    eventInsideBlock: {
        defaultMessage:
            '"{ SOURCE }" is an event, so it cannot be placed inside another block.' +
            '\nMove it out of the block so that it starts a script of its own.',
        description: 'Error message when an event (hat) block is written inside a block body (do ... end)',
        id: 'gui.smalruby3.rubyToBlocksConverter.eventInsideBlock',
    },
    defInsideBlock: {
        defaultMessage:
            '"{ SOURCE }" defines a method, so it cannot be written inside a block or a method.' +
            '\nMove the whole method, from "{ SOURCE }" to its "end", out of the block or the method.',
        description:
            'Error message when a method definition (def) is written inside a block body ' +
            '(do ... end, if, ...) or a method body',
        id: 'gui.smalruby3.rubyToBlocksConverter.defInsideBlock',
    },
    valueAsStatement: {
        defaultMessage:
            '"{ SOURCE }" is a value, so it cannot be written as a command by itself.' +
            '\nUse it in a command (e.g. say({ SOURCE })) or set it to a variable.',
        description:
            'Error message when a value (reporter) is written as a line by itself inside a block body ' +
            'or before the last line of a method body',
        id: 'gui.smalruby3.rubyToBlocksConverter.valueAsStatement',
    },
    cannotReturnValue: {
        defaultMessage:
            '"{ SOURCE }" cannot be returned from a method, because there is no block for this value.' +
            '\nReturn a number, a string, true / false, or a variable instead.',
        description:
            'Error message when a method returns a value that no block can hold (e.g. self or an array), ' +
            'with return or on the last line of the method',
        id: 'gui.smalruby3.rubyToBlocksConverter.cannotReturnValue',
    },
    cannotReturnList: {
        defaultMessage:
            '"{ SOURCE }" is a list, so it cannot be returned from a method.' +
            '\nReturn an item of the list (e.g. return { SOURCE }[0]) or a variable instead.',
        description:
            'Error message when a method returns a list (e.g. return @a), ' +
            'with return or on the last line of the method',
        id: 'gui.smalruby3.rubyToBlocksConverter.cannotReturnList',
    },
    returnMultipleValues: {
        defaultMessage:
            '"{ SOURCE }" returns more than one value, but a method can return only one value.' +
            '\nReturn one value (e.g. return { FIRST }).',
        description: 'Error message when return has more than one value (e.g. return "a", "b")',
        id: 'gui.smalruby3.rubyToBlocksConverter.returnMultipleValues',
    },
});

// Values with no block of their own: they cannot be a method's return value (issue #1553).
const UNRETURNABLE_PRIMITIVE_TYPES = ['self', 'array', 'hash', 'const', 'regexp'];

/**
 * Core AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const CoreHandlers = {
    visitProgramNode(node) {
        // The top-level lines are checked too (see `_checkStatementInBody`).
        const savedBodyKind = this._context.statementBodyKind;
        this._context.statementBodyKind = 'top';
        try {
            return this.visit(node.statements);
        } finally {
            this._context.statementBodyKind = savedBodyKind;
        }
    },

    visitStatementsNode(node) {
        const savedInMyBlockDefinition = this._context.inMyBlockDefinition;
        this._context.inMyBlockDefinition = false;
        // Only the statements directly in a block body are checked: a nested body sets it again.
        const bodyKind = this._context.statementBodyKind;
        this._context.statementBodyKind = null;
        const blocks = [];
        node.body.forEach((childNode, index) => {
            // Reset per-statement operator indices so each statement's operators are independently indexed.
            // This ensures `1 != 50\n2 != 60` produces two blocks both with index :1, while
            // `1 != 50 && 2 != 60` (a single expression) produces indices :1 and :2.
            // Note: literalCallIndices are NOT reset per-statement - they accumulate across statements.
            this._context.methodCallIndices = {};
            this._context.savedReturnValueInStatement = false;
            if (bodyKind && bodyKind !== 'top' && this._getNodeTypeName(childNode) === 'DefNode') {
                // On any line, not only on the first one (#1554). The body of a class is not a block
                // body (`bodyKind` is null), so a method written directly in a class is still converted;
                // neither is the top level (`bodyKind` is 'top').
                throw new RubyToBlocksConverterError(
                    childNode,
                    this._translator(messages.defInsideBlock, { SOURCE: this._firstLineSource(childNode) }),
                );
            }
            const block = this.visit(childNode);
            if (bodyKind) {
                this._checkStatementInBody(childNode, block, bodyKind, index === node.body.length - 1);
            }
            if (_.isArray(block)) {
                block.forEach((b) => {
                    blocks.push(b);
                });
            } else {
                blocks.push(block);
            }
        });
        this._context.inMyBlockDefinition = savedInMyBlockDefinition;
        this._context.statementBodyKind = bodyKind;

        let prevBlock = null;
        const result = [];
        blocks.forEach((block) => {
            switch (this._getBlockType(block)) {
                case 'statement':
                    if (prevBlock) {
                        prevBlock.next = block.id;
                        block.parent = prevBlock.id;
                    } else {
                        result.push(block);
                    }

                    if (block.next) {
                        const b = this._lastBlock(block);
                        if (this._getBlockType(b) === 'statement') {
                            prevBlock = b;
                        } else {
                            prevBlock = null;
                        }
                    } else {
                        prevBlock = block;
                    }
                    break;
                case 'terminate':
                    if (prevBlock) {
                        prevBlock.next = block.id;
                        block.parent = prevBlock.id;
                    } else {
                        result.push(block);
                    }
                    prevBlock = null;
                    break;
                case 'value':
                case 'value_boolean':
                case 'value_variable':
                case 'value_boolean_variable':
                case 'hat':
                case 'primitive':
                    result.push(block);
                    prevBlock = null;
            }
        });
        return result;
    },

    /**
     * Throw an error for a statement in a block body (`do ... end`, `if`, ...) or a method body (`def`)
     * that cannot be placed there, instead of leaving it as a block attached to nothing (#1544):
     * - an event (hat), e.g. `when_clicked do ... end` inside `when_flag_clicked do ... end`;
     *   it is neither linked in the body nor a script of its own, so it and its body would be lost.
     * - a value written as a line by itself, e.g. `x` or `1 + 2`; it cannot be linked either.
     *   In a method body, the last line is the return value, so only the lines before it are checked (#1549).
     * - a symbol written as a line by itself, e.g. `:a`; it is not a command. On the second or a later
     *   line of a block body it was dropped silently (#1550).
     * - a value no block can hold, e.g. `self`, `{a: 1}`, `Foo`, `/a/` or `"#{x}"`, written as a line by itself;
     *   it became a string such as "self", or was dropped (#1553, #1558). This is also checked at the top level.
     * A method definition (`def`) does not come here: `visitStatementsNode` has already thrown an error
     * for it (#1554).
     * A value made by splitting one statement (e.g. the return value of `"a".reverse`, which
     * comes as an array after its command) is not checked.
     * @param {object} node - The statement node.
     * @param {object|Array} result - What visiting the statement returned.
     * @param {string} bodyKind - 'top', 'block' or 'method' (see `statementBodyKind` of the context).
     * @param {boolean} isLast - Whether the statement is the last one in the body.
     */
    _checkStatementInBody(node, result, bodyKind, isLast) {
        const blocks = _.isArray(result) ? result : [result];
        const isInterpolated = !result && /^Interpolated/.test(this._getNodeTypeName(node) || '');
        if (bodyKind === 'top') {
            // At the top level, events and values may stand alone; only a value no block can hold
            // (e.g. `self`, which became the string "self") is an error (#1558).
            if (
                isInterpolated ||
                (!_.isArray(result) && this._isUnreturnableValue(result) && result.type !== 'array')
            ) {
                throw this._notCommandError(node);
            }
            return;
        }
        if (
            blocks.some(
                (b) => this._isBlock(b) && this._getBlockType(b) === 'hat' && b.opcode !== 'procedures_definition',
            )
        ) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.eventInsideBlock, { SOURCE: this._firstLineSource(node) }),
            );
        }
        if (bodyKind === 'method' && isLast) {
            // The last line is the return value: a value no block can hold would be dropped (#1553).
            if (isInterpolated || (!_.isArray(result) && this._isUnreturnableValue(result))) {
                throw this._cannotReturnError(node);
            }
            // A list would become 0 (#1557).
            if (!_.isArray(result) && this._isListValue(result)) {
                throw this._cannotReturnListError(node);
            }
            return;
        }
        if (blocks.length !== 1) {
            return;
        }
        const Primitive = require('../primitive').default;
        const value = blocks[0];
        if (value instanceof Primitive && value.type === 'sym') {
            throw this._notCommandError(node);
        }
        // A value no block can hold (e.g. `self`, `[1]`, `Foo`, `"#{x}"`) before the last line of a method
        // dropped the rest of the method silently (#1553). In a block body it became a string such as
        // "self" or "[object Map]", or was dropped (#1558); an array there comes back as written, so it stays.
        const isUnreturnable = this._isUnreturnableValue(value) && (bodyKind === 'method' || value.type !== 'array');
        if (isUnreturnable || (!value && isInterpolated)) {
            throw this._notCommandError(node);
        }
        // In a block body, other literals (e.g. `"abc"`) become an assignment to a temporary
        // variable (see `_processStatement`); in a method body they are values.
        const isValue = this._isValueBlock(value) && value.opcode !== 'data_setvariableto';
        const isLiteral =
            value instanceof Primitive &&
            (this._isNumber(value) ||
                this._isString(value) ||
                this._isTrue(value) ||
                this._isFalse(value) ||
                this.isNil(value));
        if (isValue || (bodyKind === 'method' && isLiteral)) {
            throw this._valueAsStatementError(node);
        }
    },

    /**
     * The first line of the source of a node, to show in an error message.
     * @param {object} node - The node.
     * @returns {string} The first line of the source.
     */
    _firstLineSource(node) {
        return this._getSource(node).split('\n')[0].trim();
    },

    /**
     * The error for a value written as a line by itself (e.g. `x` or `1 + 2`).
     * @param {object} node - The node of the line.
     * @returns {RubyToBlocksConverterError} The error.
     */
    _valueAsStatementError(node) {
        // The source is also shown as `say(...)`, so a value written over several lines is put on one line.
        const source = this._getSource(node)
            .replace(/\s*\n\s*/g, ' ')
            .trim();
        return new RubyToBlocksConverterError(node, this._translator(messages.valueAsStatement, { SOURCE: source }));
    },

    /**
     * Whether a value has no block of its own, so it cannot be a method's return value
     * (e.g. `self`, `[1, 2]`, `Foo`) (issue #1553).
     * @param {*} value - What visiting the value returned.
     * @returns {boolean} Whether the value cannot be returned.
     */
    _isUnreturnableValue(value) {
        const Primitive = require('../primitive').default;
        return value instanceof Primitive && UNRETURNABLE_PRIMITIVE_TYPES.includes(value.type);
    },

    /**
     * Whether a value is a list (e.g. `@a` after `@a = []`): no value block keeps it a list (issue #1557).
     * @param {*} value - What visiting the value returned.
     * @returns {boolean} Whether the value is a list.
     */
    _isListValue(value) {
        // A read of a list variable comes as a data_variable block: look the name up in the lists.
        return isKnownListReceiver(this, value);
    },

    /**
     * The statements in parentheses (e.g. `(x + 1)` has one, `(a; b)` has two, `()` has none).
     * @param {object} node - The ParenthesesNode.
     * @returns {Array} The statement nodes.
     */
    _parenthesesStatements(node) {
        if (!node.body) {
            return [];
        }
        if (this._getNodeTypeName(node.body) === 'StatementsNode') {
            return node.body.body;
        }
        return [node.body];
    },

    /**
     * The error for a list returned from a method (issue #1557).
     * @param {object} node - The node of the value.
     * @returns {RubyToBlocksConverterError} The error.
     */
    _cannotReturnListError(node) {
        return new RubyToBlocksConverterError(
            node,
            this._translator(messages.cannotReturnList, { SOURCE: this._firstLineSource(node) }),
        );
    },

    /**
     * The error for a value that cannot be returned from a method (issue #1553).
     * @param {object} node - The node of the value.
     * @returns {RubyToBlocksConverterError} The error.
     */
    _cannotReturnError(node) {
        const source = this._getSource(node)
            .replace(/\s*\n\s*/g, ' ')
            .trim();
        return new RubyToBlocksConverterError(node, this._translator(messages.cannotReturnValue, { SOURCE: source }));
    },

    /**
     * The error for `return` with more than one value (e.g. `return "a", "b"`) (issue #1553).
     * @param {object} node - The return node.
     * @param {object} firstNode - The node of the first value.
     * @returns {RubyToBlocksConverterError} The error.
     */
    _returnMultipleValuesError(node, firstNode) {
        return new RubyToBlocksConverterError(
            node,
            this._translator(messages.returnMultipleValues, {
                SOURCE: this._firstLineSource(node),
                FIRST: this._getSource(firstNode)
                    .replace(/\s*\n\s*/g, ' ')
                    .trim(),
            }),
        );
    },

    /**
     * The error for a line that is not a command (e.g. `:a`) in a block body or a method body.
     * @param {object} node - The node of the line.
     * @returns {RubyToBlocksConverterError} The error.
     */
    _notCommandError(node) {
        return new RubyToBlocksConverterError(
            node,
            this._translator(messages.includeNotStatementBlocks, { SOURCE: this._firstLineSource(node) }),
        );
    },

    visitBeginNode(node) {
        return this.visit(node.statements);
    },

    _processCondition(node) {
        let cond = this.visit(node);
        const split = this._splitPreBlocksAndValue(cond);
        if (split.preBlocks.length > 0) {
            // === Smalruby: Start of returnValue to returnValueTruthy conversion ===
            // When a smalrubyRuby method is used in a boolean context (if/unless
            // condition), replace the returnValue REPORTER with returnValueTruthy
            // BOOLEAN so it can be used as a condition input.
            let value = split.value;
            if (this._isBlock(value) && value.opcode === 'smalrubyRuby_returnValue') {
                this._discardBlock(value);
                value = this._createBlock('smalrubyRuby_returnValueTruthy', 'value_boolean');
            }
            // === Smalruby: End of returnValue to returnValueTruthy conversion ===
            if (!this._isFalseOrBooleanBlock(value)) {
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(messages.conditionIsNotBoolean, { SOURCE: this._getSource(node) }),
                );
            }
            return [...split.preBlocks, value];
        }
        cond = split.value;
        if (!this._isFalseOrBooleanBlock(cond)) {
            if (this._isBlock(cond) && cond.opcode === 'data_variable') {
                this._context.variableHint = this._getRubyVariableName(cond);
                cond = this._wrapVariableAsBooleanCondition(cond);
            } else {
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(messages.conditionIsNotBoolean, { SOURCE: this._getSource(node) }),
                );
            }
        }
        return cond;
    },

    _processStatement(node, inMyBlockDefinition = null) {
        const savedInMyBlockDefinition = this._context.inMyBlockDefinition;
        if (inMyBlockDefinition !== null) {
            this._context.inMyBlockDefinition = inMyBlockDefinition;
        }
        const savedBodyKind = this._context.statementBodyKind;
        this._context.statementBodyKind = 'block';
        let blocks;
        try {
            blocks = this.visit(node);
        } finally {
            this._context.statementBodyKind = savedBodyKind;
        }
        if (!_.isArray(blocks)) {
            blocks = [blocks];
        }
        // === Smalruby: Start of bare literal in statement context ===
        const Primitive = require('../primitive').default;
        blocks = blocks.map((b) => {
            if (b instanceof Primitive && b.type !== 'sym') {
                return this._convertBareLiteralToAssignment(b);
            }
            return b;
        });
        blocks = blocks.flat();
        // === Smalruby: End of bare literal in statement context ===
        // === Smalruby: Start of statement-only linking ===
        // Link only statement/terminate blocks, skipping value blocks (e.g.,
        // orphan returnValue REPORTERs from auto-split). Value blocks in a
        // next-chain corrupt the generator output because blockToCode returns
        // [code, order] tuples that get string-concatenated as garbage.
        if (blocks.length >= 2 && this._isBlock(blocks[0])) {
            let prevIdx = this._isStatementBlock(blocks[0]) ? 0 : -1;
            for (let i = 1; i < blocks.length; i++) {
                if (this._isBlock(blocks[i]) && this._isStatementBlock(blocks[i])) {
                    if (prevIdx >= 0) {
                        // Link to the end of the previous chain: it can already have statements
                        // after it (e.g. `move(10)` → the `"a".reverse` command), and linking to
                        // its head would cut them off.
                        const tail = this._lastBlock(blocks[prevIdx]);
                        tail.next = blocks[i].id;
                        blocks[i].parent = tail.id;
                    }
                    prevIdx = i;
                }
            }
        }
        // A value block after the first one is not linked nor used (e.g. the returnValue
        // REPORTER of `"a".reverse` written as a statement): drop it, or it is left as an orphan.
        // An event (hat) or a method definition does not come here: an error has already been thrown
        // for it (#1544, #1554).
        blocks.slice(1).forEach((b) => {
            if (this._isBlock(b) && !this._isStatementBlock(b) && this._getBlockType(b) !== 'hat' && !b.parent) {
                this._discardBlock(b);
            }
        });
        // === Smalruby: End of statement-only linking ===
        const block = blocks[0];
        if (block !== null && typeof block !== 'undefined' && !this._isStatementBlock(block)) {
            if (!(this._context.inMyBlockDefinition && block.opcode === 'data_setvariableto')) {
                this._context.inMyBlockDefinition = savedInMyBlockDefinition;
                throw this._notCommandError(this._nodeOfBlock(block) || this._firstStatementNode(node));
            }
        }
        this._context.inMyBlockDefinition = savedInMyBlockDefinition;
        return block;
    },

    /**
     * The node a block (or a primitive) was made from, if it is known.
     * @param {object} block - The block or the primitive.
     * @returns {object|null} The node.
     */
    _nodeOfBlock(block) {
        if (block && block.node) {
            return block.node;
        }
        if (this._isBlock(block)) {
            for (const [n, id] of this._context.nodeToBlockMap.entries()) {
                if (id === block.id) {
                    return n;
                }
            }
        }
        return null;
    },

    /**
     * The first statement in a body node (e.g. `StatementsNode`, `ElseNode`), or the node itself.
     * @param {object} node - The body node.
     * @returns {object} The first statement node.
     */
    _firstStatementNode(node) {
        let n = node;
        if (n && n.statements) {
            n = n.statements;
        }
        if (n && n.body && n.body.length > 0) {
            return n.body[0];
        }
        return n || node;
    },

    _getBlockIdFromResult(result) {
        if (this._isBlock(result)) {
            return result.id;
        }
        if (_.isArray(result) && result.length > 0 && this._isBlock(result[result.length - 1])) {
            return result[result.length - 1].id;
        }
        return null;
    },

    _splitPreBlocksAndValue(result) {
        if (_.isArray(result) && result.length === 1) {
            // Single element array - extract the value
            return {
                preBlocks: [],
                value: result[0],
            };
        }
        if (_.isArray(result) && result.length > 0 && this._isBlock(result[0])) {
            return {
                preBlocks: result.slice(0, result.length - 1),
                value: result[result.length - 1],
            };
        }
        return {
            preBlocks: [],
            value: result,
        };
    },
};

export default CoreHandlers;
