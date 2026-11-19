// The Ruby of the console blocks (docs/extension-smalruby-console/README.md).
//
// `console.puts(x)` and `console.gets` are the form the Japanese mode writes for
// `表示する` and `【外部からの入力】` (src/lib/dncl/ja-notation-table.js), so the
// blocks also stay the same through the Ruby tab. Ruby's own `puts` / `gets`
// are not the console (docs/dncl/design.md, chapter 5).
const CONSOLE = 'console';

const SmalrubyConsoleConverter = {
    register: function (converter) {
        converter.registerOnSend('self', CONSOLE, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(CONSOLE, node);
        });

        // console.puts(x)
        converter.registerOnSend(CONSOLE, 'puts', 1, (params) => {
            const { receiver, args } = params;
            if (!converter._isNumberOrStringOrBlock(args[0])) return null;
            const block = converter.changeRubyExpressionBlock(receiver, 'smalrubyConsole_print', 'statement');
            const arg = args[0];
            if (!converter._isNumber(arg)) {
                converter.addTextInput(block, 'TEXT', arg, 'こんにちは！');
                return block;
            }
            // A number is kept a number in the Ruby (`console.puts(3)`, not `"3"`).
            converter.addTextInput(block, 'TEXT', arg.toString(), 'こんにちは！');
            const isInteger = arg.type === 'int' || (arg.type !== 'float' && Number.isInteger(Number(arg)));
            block.comment = converter.createComment(
                `@ruby:argument:1:type:${isInteger ? 'Integer' : 'Float'}`,
                block.id,
            );
            return block;
        });

        // console.gets
        converter.registerOnSend(CONSOLE, 'gets', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(receiver, 'smalrubyConsole_input', 'value');
        });
    },
};

export default SmalrubyConsoleConverter;
