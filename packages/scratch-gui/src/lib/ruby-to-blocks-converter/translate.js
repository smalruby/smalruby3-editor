import _ from 'lodash';

const Translate = 'translate';

/**
 * Translate converter
 */
const TranslateConverter = {
    register: function (converter) {
        // v1: translate(words, language)
        converter.registerOnSend('self', 'translate', 2, params => {
            const {args} = params;
            if (!converter._isNumberOrStringOrBlock(args[0]) || !converter._isStringOrBlock(args[1])) return null;

            const block = converter._createBlock('translate_getTranslate', 'value');
            converter._addTextInput(block, 'WORDS', args[0]);
            converter._addInput(
                block,
                'LANGUAGE',
                converter._createFieldBlock('translate_menu_languages', 'languages', args[1])
            );
            return block;
        });

        // v1: language
        converter.registerOnSend('self', 'language', 0, () =>
            converter._createBlock('translate_getViewerLanguage', 'value')
        );

        // v2: translate receiver (for translate.call and translate.language)
        converter.registerOnSend('sprite', Translate, 0, params => {
            const {node} = params;
            return converter.createRubyExpressionBlock(Translate, node);
        });
        converter.registerOnSend('stage', Translate, 0, params => {
            const {node} = params;
            return converter.createRubyExpressionBlock(Translate, node);
        });

        // v2: translate.call(words, language)
        converter.registerOnSend(Translate, 'call', 2, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrStringOrBlock(args[0]) || !converter._isStringOrBlock(args[1])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'translate_getTranslate', 'value');
            converter._addTextInput(block, 'WORDS', args[0]);
            converter._addInput(
                block,
                'LANGUAGE',
                converter._createFieldBlock('translate_menu_languages', 'languages', args[1])
            );
            return block;
        });

        // v2: translate.language
        converter.registerOnSend(Translate, 'language', 0, params => {
            const {receiver} = params;
            return converter.changeRubyExpressionBlock(receiver, 'translate_getViewerLanguage', 'value');
        });
    }
};

export default TranslateConverter;
