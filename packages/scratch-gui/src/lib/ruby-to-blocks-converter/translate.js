import { menuArg, registerSendTable, textArg } from './send-table';

const Translate = 'translate';

// The words (a number too) and the language (a string or a value block).
const translateArgs = () => [
    textArg('WORDS', void 0, { number: true }),
    menuArg('LANGUAGE', 'translate_menu_languages', 'languages', { orBlock: true }),
];

// The calls of version 1 (`translate(words, language)`, `language`), read in version 2 too.
const TRANSLATE_V1_SENDS = [
    { receiver: 'self', name: 'translate', opcode: 'translate_getTranslate', type: 'value', args: translateArgs() },
    { receiver: 'self', name: 'language', opcode: 'translate_getViewerLanguage', type: 'value' },
];

// The calls of version 2 on `translate` (`translate.call(words, language)`, `translate.language`).
const TRANSLATE_SENDS = [
    {
        receiver: Translate,
        name: 'call',
        opcode: 'translate_getTranslate',
        type: 'value',
        changesReceiver: true,
        args: translateArgs(),
    },
    {
        receiver: Translate,
        name: 'language',
        opcode: 'translate_getViewerLanguage',
        type: 'value',
        changesReceiver: true,
    },
];

/**
 * Translate converter
 */
const TranslateConverter = {
    sends: [...TRANSLATE_V1_SENDS, ...TRANSLATE_SENDS],

    register: function (converter) {
        registerSendTable(converter, TRANSLATE_V1_SENDS);

        // v2: `translate` itself is a Ruby expression that the calls of the table turn into their blocks.
        ['sprite', 'stage'].forEach((receiver) =>
            converter.registerOnSend(receiver, Translate, 0, (params) => {
                const { node } = params;
                return converter.createRubyExpressionBlock(Translate, node);
            }),
        );

        registerSendTable(converter, TRANSLATE_SENDS);
    },
};

export default TranslateConverter;
