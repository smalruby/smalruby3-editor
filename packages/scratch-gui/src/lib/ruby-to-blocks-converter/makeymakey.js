import _ from 'lodash';

const Makey = 'makey';

/**
 * MakeyMakey converter
 */
const MakeyMakeyConverter = {
    register: function (converter) {
        converter.registerOnSend('self', Makey, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(Makey, node);
        });

        converter.registerOnSendWithBlock(Makey, 'when_key_pressed', 1, 0, (params) => {
            const { receiver, args, rubyBlock } = params;
            if (!converter.isStringOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'makeymakey_whenMakeyKeyPressed', 'hat');
            converter.addInput(block, 'KEY', converter.createFieldBlock('makeymakey_menu_KEY', 'KEY', args[0]));
            converter.setParent(rubyBlock, block);
            return block;
        });

        converter.registerOnSendWithBlock(Makey, 'when_pressed_in_oder', 1, 0, (params) => {
            const { receiver, args, rubyBlock } = params;
            if (!converter.isStringOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'makeymakey_whenCodePressed', 'hat');
            converter.addInput(
                block,
                'SEQUENCE',
                converter.createFieldBlock('makeymakey_menu_SEQUENCE', 'SEQUENCE', args[0]),
            );
            converter.setParent(rubyBlock, block);
            return block;
        });
    },

    onSend: function (receiver, name, args, rubyBlockArgs, rubyBlock) {
        const hasRubyBlock = typeof rubyBlock !== 'undefined';
        if (
            name === 'when' &&
            this._isSelf(receiver) &&
            args.length === 2 &&
            this._isSymbol(args[0]) &&
            hasRubyBlock &&
            // The hats take no block parameters (`do |x|` was dropped without an error, issue #1909).
            !(rubyBlockArgs && rubyBlockArgs.length > 0)
        ) {
            switch (this._getSymbolValue(args[0])) {
                case 'makey_key_pressed':
                    if (this.isStringOrBlock(args[1])) {
                        const block = this.createBlock('makeymakey_whenMakeyKeyPressed', 'hat');
                        this.addInput(block, 'KEY', this.createFieldBlock('makeymakey_menu_KEY', 'KEY', args[1]));
                        this.setParent(rubyBlock, block);
                        return block;
                    }
                    break;
                case 'makey_pressed_in_oder':
                    if (this.isStringOrBlock(args[1])) {
                        const block = this.createBlock('makeymakey_whenCodePressed', 'hat');
                        this.addInput(
                            block,
                            'SEQUENCE',
                            this.createFieldBlock('makeymakey_menu_SEQUENCE', 'SEQUENCE', args[1]),
                        );
                        this.setParent(rubyBlock, block);
                        return block;
                    }
                    break;
            }
        }
        return null;
    },
};

export default MakeyMakeyConverter;
