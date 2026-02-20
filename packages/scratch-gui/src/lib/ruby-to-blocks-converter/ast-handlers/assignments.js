import _ from 'lodash';

/**
 * Assignment AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const AssignmentHandlers = {
    visitCallOperatorWriteNode (node) {
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
        let lh = this.callMethod(receiver, node.readName, [], undefined, undefined, node);
        if (!lh) {
            // Fallback: use receiver directly
            lh = receiver;
        }
        // If lh is a ruby_expression block, fix the source text to be "receiver.readName"
        // The callMethod handler used _getSource(node) which gives the whole assignment expression.
        // We need just the read part (e.g. "pen.color" not "pen.color += 10").
        if (this._isRubyExpression(lh) &&
            receiverNameForLh &&
            receiverNameForLh !== 'sprite' && receiverNameForLh !== 'stage') {
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

    visitLocalVariableOperatorWriteNode (node) {
        return this._onVarOpAsgn(node.name, 'local', node.binaryOperator, node.value, node);
    },

    visitGlobalVariableOperatorWriteNode (node) {
        return this._onVarOpAsgn(node.name, 'global', node.binaryOperator, node.value, node);
    },

    visitInstanceVariableOperatorWriteNode (node) {
        return this._onVarOpAsgn(node.name, 'instance', node.binaryOperator, node.value, node);
    },

    _onVarOpAsgn (name, scope, operator, valueNode, node) {
        const saved = this._saveContext();

        const preBlocks = [];
        const lh = name;

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

    visitLocalVariableWriteNode (node) {
        return this._onVasgn(node.name, 'local', node.value, node);
    },

    visitGlobalVariableWriteNode (node) {
        return this._onVasgn(node.name, 'global', node.value, node);
    },

    visitInstanceVariableWriteNode (node) {
        return this._onVasgn(node.name, 'instance', node.value, node);
    },

    _onVasgn (name, scope, valueNode, node) {
        const saved = this._saveContext();

        const preBlocks = [];
        // Normalize variable name for local variables to match how arguments and other locals are stored
        let varName = name;
        if (scope === 'local') {
            varName = this._toSnakeCaseLowercase(varName);
        }
        const variable = this._lookupOrCreateVariable(varName);
        let rh = this.visit(valueNode);
        const split = this._splitPreBlocksAndValue(rh);
        rh = split.value;
        preBlocks.push(...split.preBlocks);

        let block = this._callConvertersHandler('onVasgn', scope, variable, rh);
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
    }
};

export default AssignmentHandlers;
