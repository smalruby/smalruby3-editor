// === Smalruby: This file is Smalruby-specific (Ruby String extension generator) ===

/**
 * Define Ruby code generator for Smalruby Ruby String Blocks
 * @param {object} Generator - The RubyGenerator
 * @returns {object} same as param.
 */
export default function (Generator) {
    Generator.smalrubyRuby_methodR = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const string = Generator.valueToCode(block, 'STRING', order) || Generator.quote_('');
        const method = Generator.getFieldValue(block, 'METHOD') || 'delete';
        const hasArg1 = block.inputs && block.inputs.ARG1;
        if (!hasArg1) {
            // Methods without arguments (e.g. reverse)
            return [`${string}.${method}`, order];
        }

        const arg1 = Generator.valueToCode(block, 'ARG1', order) || Generator.quote_('');
        const arg2 = Generator.valueToCode(block, 'ARG2', order);

        const args = [arg1];
        if (arg2) args.push(arg2);

        return [`${string}.${method}(${args.join(', ')})`, order];
    };

    Generator.smalrubyRuby_methodC = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const varName = Generator.getFieldValue(block, 'STRING') || '';
        const string = Generator.variableNameByName(varName) || 'nil';
        const method = Generator.getFieldValue(block, 'METHOD') || 'delete!';
        const hasArg1 = block.inputs && block.inputs.ARG1;
        if (!hasArg1) {
            return `${string}.${method}\n`;
        }

        const arg1 = Generator.valueToCode(block, 'ARG1', order) || Generator.quote_('');
        const arg2 = Generator.valueToCode(block, 'ARG2', order);

        const args = [arg1];
        if (arg2) args.push(arg2);

        return `${string}.${method}(${args.join(', ')})\n`;
    };

    return Generator;
}
