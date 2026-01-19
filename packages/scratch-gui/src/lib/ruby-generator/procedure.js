/**
 * Define Ruby code generator for Procedures Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @return {RubyGenerator} same as param.
 */
export default function (Generator) {
    // Helper function to convert argument names to snake_case lowercase
    const toSnakeCaseLowercase = function (name) {
        return name
            // Replace any sequence of non-alphanumeric characters except underscores with underscore
            .replace(/[^a-zA-Z0-9_]+/g, '_')
            // Convert camelCase to snake_case: insert underscore before uppercase letters
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            // Convert to lowercase
            .toLowerCase();
    };

    Generator.procedures_definition = function (block) {
        block.isStatement = true;
        const customBlock = Generator.getInputTargetBlock(block, 'custom_block');
        return Generator.blockToCode(customBlock);
    };

    const blockToMethod = function (block, isCall) {
        let methodName = block.mutation.proccode.split(' ')
            .filter(i => !/^%[sb]$/.test(i))
            .join('_');
        if (methodName.length === 0) {
            methodName = 'procedure';
        }
        const args = [];
        const paramNamesIdsAndDefaults =
              Generator.currentTarget.blocks.getProcedureParamNamesIdsAndDefaults(block.mutation.proccode);
        if (isCall) {
            const ids = paramNamesIdsAndDefaults[1];
            const defaults = paramNamesIdsAndDefaults[2];
            for (let i = 0; i < ids.length; i++) {
                let value;
                if (block.inputs[ids[i]]) {
                    value = Generator.valueToCode(block, ids[i], Generator.ORDER_NONE);
                } else {
                    value = defaults[i];
                }
                args.push(Generator.nosToCode(value));
            }
        } else {
            for (let i = 0; i < paramNamesIdsAndDefaults[0].length; i++) {
                // Convert argument name to snake_case lowercase
                let paramName = Generator.escapeVariableName(paramNamesIdsAndDefaults[0][i]);
                paramName = toSnakeCaseLowercase(paramName);
                args.push(paramName);
            }
        }
        const argsString = args.length > 0 ? `(${args.join(', ')})` : '';
        return `${isCall ? '' : 'def self.'}${methodName}${argsString}\n`;
    };

    Generator.procedures_call = function (block) {
        return blockToMethod(block, true);
    };

    Generator.procedures_prototype = function (block) {
        return blockToMethod(block, false);
    };

    Generator.argument_reporter_boolean = function (block) {
        const paramName = toSnakeCaseLowercase(Generator.escapeVariableName(Generator.getFieldValue(block, 'VALUE')));
        return [paramName, Generator.ORDER_ATOMIC];
    };

    Generator.argument_reporter_string_number = function (block) {
        const paramName = toSnakeCaseLowercase(Generator.escapeVariableName(Generator.getFieldValue(block, 'VALUE')));
        return [paramName, Generator.ORDER_ATOMIC];
    };

    return Generator;
}
