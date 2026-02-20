import _ from 'lodash';

/**
 * Assignment AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const AssignmentHandlers = {
    visitCallOperatorWriteNode (node) {
        // e.g. a.b += c
        const saved = this._saveContext();

        const preBlocks = [];
        let lh = this.visit(node.receiver);
        let split = this._splitPreBlocksAndValue(lh);
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
