// === Smalruby: This file is Smalruby-specific (Ruby String extension converter) ===

/**
 * Build blockInfo mutation data for isDynamic string method blocks.
 * The mutation must contain the full blockInfo so that domToMutation
 * can reconstruct the block's inputs.
 * @param {string} blockType - 'reporter' or 'command'.
 * @param {string} method - the Ruby method name (e.g. 'delete', 'delete!').
 * @param {string} menuName - the menu name for the METHOD dropdown.
 * @param {object} argumentsByMethod - the argumentsByMethod config.
 * @param {object} menuItems - the menuItems config.
 * @returns {object} mutation object for _createBlock.
 */
const buildMutation = function (blockType, method, menuName, argumentsByMethod, menuItems) {
    const config = argumentsByMethod[method];
    const blockInfo = {
        blockType,
        isDynamic: true,
        text: config.text,
        arguments: config.arguments,
        argumentsByMethod,
        menuItems
    };
    return {
        tagName: 'mutation',
        children: [],
        blockInfo: blockInfo,
        warp: 'false'
    };
};

// Shared argumentsByMethod configs
const stringMethodRArgs = {
    delete: {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] )',
        arguments: {
            STRING: {type: 'string', defaultValue: 'hello world'},
            METHOD: {type: 'string', menu: 'stringMethodRMenu', defaultValue: 'delete'},
            ARG1: {type: 'string', defaultValue: 'l'}
        }
    }
};

const stringMethodCArgs = {
    'delete!': {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] )',
        arguments: {
            STRING: {type: 'string', defaultValue: 'hello world'},
            METHOD: {type: 'string', menu: 'stringMethodCMenu', defaultValue: 'delete!'},
            ARG1: {type: 'string', defaultValue: 'l'}
        }
    }
};

const stringMethodRMenuItems = {stringMethodRMenu: [['delete', 'delete']]};
const stringMethodCMenuItems = {stringMethodCMenu: [['delete!', 'delete!']]};

/**
 * Converter for Smalruby Ruby String extension blocks.
 */
const SmalrubyRubyConverter = {
    register: function (converter) {
        // String#delete (returns value - REPORTER)
        converter.registerOnSend(['string', 'block', 'variable'], 'delete', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const mutation = buildMutation(
                'reporter', 'delete', 'stringMethodRMenu',
                stringMethodRArgs, stringMethodRMenuItems
            );
            const block = converter._createBlock('ruby_stringMethodR', 'value', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'hello world');
            converter._addField(block, 'METHOD', 'delete');
            converter._addTextInput(block, 'ARG1', args[0], 'l');
            return block;
        });

        // String#delete! (mutates in place - COMMAND)
        // Only variables are valid receivers for bang methods (they modify in place)
        converter.registerOnSend(['variable'], 'delete!', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const mutation = buildMutation(
                'command', 'delete!', 'stringMethodCMenu',
                stringMethodCArgs, stringMethodCMenuItems
            );
            const block = converter._createBlock('ruby_stringMethodC', 'statement', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'hello world');
            converter._addField(block, 'METHOD', 'delete!');
            converter._addTextInput(block, 'ARG1', args[0], 'l');
            return block;
        });
    }
};

export default SmalrubyRubyConverter;
