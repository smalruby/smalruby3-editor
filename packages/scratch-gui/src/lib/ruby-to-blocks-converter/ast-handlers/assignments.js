import _ from 'lodash';

/**
 * Assignment AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const AssignmentHandlers = {
    _onOpAsgn (node) {
        this._checkNumChildren(node, 3);

        const saved = this._saveContext();

        const preBlocks = [];
        let lh = this._process(node.children[0]);
        let split = this._splitPreBlocksAndValue(lh);
        lh = split.value;
        preBlocks.push(...split.preBlocks);

        const operator = node.children[1].toString();

        let rh = this._process(node.children[2]);
        split = this._splitPreBlocksAndValue(rh);
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

    _onVasgn (node, scope) {
        this._checkNumChildren(node, [1, 2]);

        if (node.children.length === 1) {
            return node.children[0].toString();
        }

        const saved = this._saveContext();

        const preBlocks = [];
        const variable = this._lookupOrCreateVariable(node.children[0]);
        let rh = this._process(node.children[1]);
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
    },

    _onGvasgn (node) {
        return this._onVasgn(node, 'global');
    },

    _onIvasgn (node) {
        return this._onVasgn(node, 'instance');
    },

    _onLvasgn (node) {
        return this._onVasgn(node, 'local');
    }
};

export default AssignmentHandlers;
