// === Smalruby: This file is Smalruby-specific (Ruby String extension converter) ===

/**
 * Converter for Smalruby Ruby String extension blocks.
 */
const SmalrubyRubyConverter = {
    register: function (converter) {
        // String#delete (returns value - REPORTER)
        converter.registerOnSend(['string', 'block', 'variable'], 'delete', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const block = converter._createBlock('ruby_stringMethodR', 'value');
            converter._addTextInput(block, 'STRING', receiver, 'hello world');
            converter._addField(block, 'METHOD', 'delete');
            converter._addTextInput(block, 'ARG1', args[0], 'l');
            return block;
        });

        // String#delete! (mutates in place - COMMAND)
        converter.registerOnSend(['string', 'block', 'variable'], 'delete!', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const block = converter._createBlock('ruby_stringMethodC', 'statement');
            converter._addTextInput(block, 'STRING', receiver, 'hello world');
            converter._addField(block, 'METHOD', 'delete!');
            converter._addTextInput(block, 'ARG1', args[0], 'l');
            return block;
        });
    }
};

export default SmalrubyRubyConverter;
