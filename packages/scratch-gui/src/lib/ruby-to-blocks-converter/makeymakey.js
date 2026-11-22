import { menuArg, registerSendTable } from './send-table';

const Makey = 'makey';

// The hats of `makey` (send-table.js). The key and the sequence are a string or a value block.
const MAKEY_SENDS = [
    {
        receiver: Makey,
        name: 'when_key_pressed',
        opcode: 'makeymakey_whenMakeyKeyPressed',
        hat: true,
        changesReceiver: true,
        args: [menuArg('KEY', 'makeymakey_menu_KEY', 'KEY', { orBlock: true })],
    },
    {
        receiver: Makey,
        name: 'when_pressed_in_oder',
        opcode: 'makeymakey_whenCodePressed',
        hat: true,
        changesReceiver: true,
        args: [menuArg('SEQUENCE', 'makeymakey_menu_SEQUENCE', 'SEQUENCE', { orBlock: true })],
    },
];

/**
 * MakeyMakey converter
 */
const MakeyMakeyConverter = {
    sends: MAKEY_SENDS,

    register: function (converter) {
        // `makey` itself is a Ruby expression that the calls of the table turn into their blocks.
        converter.registerOnSend('self', Makey, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(Makey, node);
        });

        registerSendTable(converter, MAKEY_SENDS);
    },

    /**
     * v1: `self.when(:makey_key_pressed, "space") do ... end`. It was the old `onSend`, tried only
     * after every handler of the call had given way, so `register-converters.js` registers it after
     * all the converters: the handlers of `self.when` with two arguments of event, EV3 and GdxFor
     * are still tried first.
     * @param {object} converter - The converter.
     */
    registerLast: function (converter) {
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
