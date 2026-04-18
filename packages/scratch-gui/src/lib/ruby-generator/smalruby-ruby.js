// === Smalruby: This file is Smalruby-specific (Ruby extension generator) ===

/**
 * Define Ruby code generator for Smalruby Ruby Extension Blocks
 * @param {object} Generator - The RubyGenerator
 * @returns {object} same as param.
 */
export default function (Generator) {
    // --- Class method COMMAND blocks ---
    // All produce: receiver.method or receiver.method(args)
    // as a statement (with trailing \n).

    const generateMethodCall = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const method = Generator.getFieldValue(block, 'METHOD') || 'reverse';
        const isBang = method.endsWith('!');

        let receiver;
        if (isBang) {
            // Bang method: RECEIVER is a field (variable name)
            const varName = Generator.getFieldValue(block, 'RECEIVER') || '';
            receiver = Generator.variableNameByName(varName) || 'nil';
        } else {
            // Non-bang: RECEIVER is an input (value)
            receiver =
                Generator.valueToCode(block, 'RECEIVER', order) ||
                Generator.quote_('');
        }

        const hasArg1 = block.inputs && block.inputs.ARG1;
        if (!hasArg1) {
            return `${receiver}.${method}\n`;
        }

        const arg1 =
            Generator.valueToCode(block, 'ARG1', order) ||
            Generator.quote_('');
        const arg2 = Generator.valueToCode(block, 'ARG2', order);

        const args = [arg1];
        if (arg2) args.push(arg2);

        return `${receiver}.${method}(${args.join(', ')})\n`;
    };

    Generator.smalrubyRuby_stringMethod = generateMethodCall;
    Generator.smalrubyRuby_arrayMethod = generateMethodCall;
    Generator.smalrubyRuby_hashMethod = generateMethodCall;

    // --- Return value (REPORTER) ---
    Generator.smalrubyRuby_returnValue = function (_block) {
        // In Ruby, the return value is implicit — the method call expression itself.
        // The converter emits a preceding method call COMMAND block; the generator
        // should reconstruct the inline expression. For now, emit a placeholder
        // that the round-trip converter can recognise.
        return ['_rv_', Generator.ORDER_ATOMIC];
    };

    // --- Return value truthy? (BOOLEAN) ---
    Generator.smalrubyRuby_returnValueTruthy = function (_block) {
        return ['_rv_truthy_', Generator.ORDER_ATOMIC];
    };

    return Generator;
}
