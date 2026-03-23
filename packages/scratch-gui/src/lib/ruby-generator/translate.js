/**
 * Define Ruby code generator for Translate Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    const isV2 = () => String(Generator.version) === '2';

    Generator.translate_getTranslate = function (block) {
        const words = Generator.valueToCode(block, 'WORDS', Generator.ORDER_NONE) || null;
        const language = Generator.valueToCode(block, 'LANGUAGE', Generator.ORDER_NONE);
        if (isV2()) {
            return [`translate.call(${words}, ${language})`, Generator.ORDER_FUNCTION_CALL];
        }
        return [`translate(${words}, ${language})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.translate_menu_languages = Generator.text2speech_menu_languages;

    Generator.translate_getViewerLanguage = function () {
        if (isV2()) {
            return ['translate.language', Generator.ORDER_FUNCTION_CALL];
        }
        return ['language', Generator.ORDER_ATOMIC];
    };

    return Generator;
}
