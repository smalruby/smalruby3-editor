// === Smalruby: This file is Smalruby-specific (visitDefNode and related helpers for control flow) ===
import {defineMessages} from 'react-intl';
import {RubyToBlocksConverterError} from '../errors';

const messages = defineMessages({
    initializeOutsideClass: {
        defaultMessage: 'def initialize can only be used inside a class definition.' +
            '\nWrap it in a class (e.g. class Sprite1 ... end).',
        description: 'Error message when def initialize is used outside a class',
        id: 'gui.smalruby3.rubyToBlocksConverter.initializeOutsideClass'
    }
});

/**
 * DefNode handler for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ControlFlowDef = {
    visitDefNode (node) {
        // Reject def initialize outside a class — it must be inside a class definition
        if (node.name === 'initialize') {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.initializeOutsideClass)
            );
        }

        const saved = this._saveContext();

        // Convert DefNode to a format compatible with onDefs handler
        // In Prism, DefNode has receiver, name, parameters, body.

        let block = this._callConvertersHandler('onDefs', node, saved);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        return block;
    }
};

export default ControlFlowDef;
