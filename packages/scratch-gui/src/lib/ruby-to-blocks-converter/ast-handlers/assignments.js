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
            const allBlocks = _.isArray(block) ? [...preBlocks, ...block] : [...preBlocks, block];
            this._linkBlocks(allBlocks);
            // If there's only one top-level block (all others are linked as children), return it
            // Otherwise return the array (e.g., evacuation blocks need to remain as an array)
            const topLevelBlocks = allBlocks.filter(b => this._isBlock(b) && !b.parent);
            if (topLevelBlocks.length === 1) {
                return topLevelBlocks[0];
            }
            return allBlocks;
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
        // Normalize variable name for local variables to match how arguments are stored
        let varName = node.children[0].toString();
        if (scope === 'local') {
            varName = this._toSnakeCaseLowercase(varName);
        }
        const variable = this._lookupOrCreateVariable(varName);
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
            const allBlocks = _.isArray(block) ? [...preBlocks, ...block] : [...preBlocks, block];
            this._linkBlocks(allBlocks);
            // If there's only one top-level block (all others are linked as children), return it
            // Otherwise return the array (e.g., evacuation blocks need to remain as an array)
            const topLevelBlocks = allBlocks.filter(b => this._isBlock(b) && !b.parent);
            if (topLevelBlocks.length === 1) {
                return topLevelBlocks[0];
            }
            return allBlocks;
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
