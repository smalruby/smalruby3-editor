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

        // v1: self.when(:makey_key_pressed, "space") do ... end. Registered after `when` of event.js
        // (event is registered first), so that event's forms are tried first as before.
        converter.registerOnSendWithBlock('self', 'when', 2, 0, (params) => {
            const { receiver, args, rubyBlock } = params;
            if (!converter._isSelf(receiver) || !converter._isSymbol(args[0])) return null;

            switch (converter._getSymbolValue(args[0])) {
                case 'makey_key_pressed':
                    if (converter.isStringOrBlock(args[1])) {
                        const block = converter.createBlock('makeymakey_whenMakeyKeyPressed', 'hat');
                        converter.addInput(
                            block,
                            'KEY',
                            converter.createFieldBlock('makeymakey_menu_KEY', 'KEY', args[1]),
                        );
                        converter.setParent(rubyBlock, block);
                        return block;
                    }
                    break;
                case 'makey_pressed_in_oder':
                    if (converter.isStringOrBlock(args[1])) {
                        const block = converter.createBlock('makeymakey_whenCodePressed', 'hat');
                        converter.addInput(
                            block,
                            'SEQUENCE',
                            converter.createFieldBlock('makeymakey_menu_SEQUENCE', 'SEQUENCE', args[1]),
                        );
                        converter.setParent(rubyBlock, block);
                        return block;
                    }
                    break;
            }
            return null;
        });
    },
};

export default MakeyMakeyConverter;
