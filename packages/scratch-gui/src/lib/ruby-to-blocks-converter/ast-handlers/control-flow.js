import _ from 'lodash';

const Opal = global.Opal || window.Opal;

/**
 * Control flow AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ControlFlowHandlers = {
    _onIf (node) {
        this._checkNumChildren(node, 3);

        const saved = this._saveContext();

        const preBlocks = [];
        let cond = this._processCondition(node.children[0]);
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        const statement = this._processStatement(node.children[1]);
        let elseStatement;
        if (node.children[2] !== Opal.nil ||
            (node.$loc().$else && node.$loc().$else() !== Opal.nil)) {
            elseStatement = this._processStatement(node.children[2]);
        }

        let block = this._callConvertersHandler('onIf', cond, statement, elseStatement);
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

    _onUntil (node) {
        this._checkNumChildren(node, 2);

        const saved = this._saveContext();

        const preBlocks = [];
        let cond = this._processCondition(node.children[0]);
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        const statement = this._processStatement(node.children[1]);

        let block = this._callConvertersHandler('onUntil', cond, statement);
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

    _onAnd (node) {
        this._checkNumChildren(node, 2);

        const preBlocks = [];
        const operands = node.children.map(childNode => {
            const result = this._processCondition(childNode);
            const s = this._splitPreBlocksAndValue(result);
            preBlocks.push(...s.preBlocks);
            return s.value;
        });

        const block = this._callConvertersHandler('onAnd', operands);
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

    _onOr (node) {
        this._checkNumChildren(node, 2);

        const preBlocks = [];
        const operands = node.children.map(childNode => {
            const result = this._processCondition(childNode);
            const s = this._splitPreBlocksAndValue(result);
            preBlocks.push(...s.preBlocks);
            return s.value;
        });

        const block = this._callConvertersHandler('onOr', operands);
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

    _onDef (node) {
        this._checkNumChildren(node, 3);

        const saved = this._saveContext();

        // Convert def to a format compatible with onDefs handler (receiver = nil)
        const defsNode = {
            type: 'defs',
            children: [Opal.nil, node.children[0], node.children[1], node.children[2]],
            $loc: node.$loc
        };

        let block = this._callConvertersHandler('onDefs', defsNode, saved);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        return block;
    },

    _onDefs (node) {
        this._checkNumChildren(node, 4);

        const saved = this._saveContext();

        let block = this._callConvertersHandler('onDefs', node, saved);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        return block;
    }
};

export default ControlFlowHandlers;
