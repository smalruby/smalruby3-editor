/**
 * Define Ruby code generator for the console blocks. The Japanese mode writes
 * `表示する` / `【外部からの入力】` with them (docs/dncl/design.md, chapter 5).
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.smalrubyConsole_print = function (block) {
        let text = Generator.valueToCode(block, 'TEXT', Generator.ORDER_NONE) || Generator.quote_('');
        const argumentType = Generator.rubyMarkerValue(block, '@ruby:argument:1:type:');
        const quoted = /^(["']).*\1$/.test(text);
        if ((argumentType === 'Integer' || argumentType === 'Float') && quoted) {
            const value = text.slice(1, -1);
            if (value !== '' && !isNaN(Number(value))) text = value;
        }
        return `console.puts(${text})\n`;
    };

    Generator.smalrubyConsole_input = function () {
        return ['console.gets', Generator.ORDER_FUNCTION_CALL];
    };

    return Generator;
}
