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
    reverse: {
        text: '文字列 [STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'stringMethodRMenu', defaultValue: 'reverse'},
        }
    },
    delete: {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] )',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'stringMethodRMenu', defaultValue: 'delete'},
            ARG1: {type: 'string', defaultValue: 'arg1'}
        }
    },
    gsub: {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] [ARG2] )',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'stringMethodRMenu', defaultValue: 'gsub'},
            ARG1: {type: 'string', defaultValue: 'arg1'},
            ARG2: {type: 'string', defaultValue: 'arg2'}
        }
    }
};

const stringMethodCArgs = {
    'delete!': {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] )',
        arguments: {
            STRING: {type: 'string', menu: 'variableNames', defaultValue: ' '},
            METHOD: {type: 'string', menu: 'stringMethodCMenu', defaultValue: 'delete!'},
            ARG1: {type: 'string', defaultValue: 'arg1'}
        }
    },
    'gsub!': {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] [ARG2] )',
        arguments: {
            STRING: {type: 'string', menu: 'variableNames', defaultValue: ' '},
            METHOD: {type: 'string', menu: 'stringMethodCMenu', defaultValue: 'gsub!'},
            ARG1: {type: 'string', defaultValue: 'arg1'},
            ARG2: {type: 'string', defaultValue: 'arg2'}
        }
    }
};

const stringMethodRMenuItems = {stringMethodRMenu: [['reverse', 'reverse'], ['delete', 'delete'], ['gsub', 'gsub']]};
const stringMethodCMenuItems = {stringMethodCMenu: [['delete!', 'delete!'], ['gsub!', 'gsub!']]};

/**
 * Converter for Smalruby Ruby String extension blocks.
 */
const SmalrubyRubyConverter = {
    register: function (converter) {
        // String#reverse (returns value - REPORTER, 0 args)
        converter.registerOnSend(['string', 'block', 'variable'], 'reverse', 0, params => {
            const {receiver} = params;

            const mutation = buildMutation(
                'reporter', 'reverse', 'stringMethodRMenu',
                stringMethodRArgs, stringMethodRMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_stringMethodR', 'value', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'string');
            converter._addField(block, 'METHOD', 'reverse');
            return block;
        });

        // String#delete (returns value - REPORTER)
        converter.registerOnSend(['string', 'block', 'variable'], 'delete', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const mutation = buildMutation(
                'reporter', 'delete', 'stringMethodRMenu',
                stringMethodRArgs, stringMethodRMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_stringMethodR', 'value', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'string');
            converter._addField(block, 'METHOD', 'delete');
            converter._addTextInput(block, 'ARG1', args[0], 'arg1');
            return block;
        });

        // String#delete! (mutates in place - COMMAND)
        // Only variables are valid receivers for bang methods (they modify in place)
        converter.registerOnSend(['variable'], 'delete!', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const varInfo = converter.lookupVariableFromVariableBlock(receiver);
            if (!varInfo) return null;

            const mutation = buildMutation(
                'command', 'delete!', 'stringMethodCMenu',
                stringMethodCArgs, stringMethodCMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_stringMethodC', 'statement', {mutation});
            converter._addField(block, 'STRING', varInfo.name);
            converter._addField(block, 'METHOD', 'delete!');
            converter._addTextInput(block, 'ARG1', args[0], 'arg1');
            return block;
        });

        // String#gsub (returns value - REPORTER, 2 args)
        converter.registerOnSend(['string', 'block', 'variable'], 'gsub', 2, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1])) return null;

            const mutation = buildMutation(
                'reporter', 'gsub', 'stringMethodRMenu',
                stringMethodRArgs, stringMethodRMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_stringMethodR', 'value', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'string');
            converter._addField(block, 'METHOD', 'gsub');
            converter._addTextInput(block, 'ARG1', args[0], 'arg1');
            converter._addTextInput(block, 'ARG2', args[1], 'arg2');
            return block;
        });

        // String#gsub! (mutates in place - COMMAND, 2 args)
        converter.registerOnSend(['variable'], 'gsub!', 2, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1])) return null;

            const varInfo = converter.lookupVariableFromVariableBlock(receiver);
            if (!varInfo) return null;

            const mutation = buildMutation(
                'command', 'gsub!', 'stringMethodCMenu',
                stringMethodCArgs, stringMethodCMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_stringMethodC', 'statement', {mutation});
            converter._addField(block, 'STRING', varInfo.name);
            converter._addField(block, 'METHOD', 'gsub!');
            converter._addTextInput(block, 'ARG1', args[0], 'arg1');
            converter._addTextInput(block, 'ARG2', args[1], 'arg2');
            return block;
        });
    }
};

export default SmalrubyRubyConverter;
