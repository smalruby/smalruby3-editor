// === Smalruby: This file is Smalruby-specific (Ruby method config data) ===

/**
 * Build blockInfo mutation data for isDynamic method blocks.
 * @param {string} method - The Ruby method name.
 * @param {string} menuName - The menu name for the METHOD dropdown.
 * @param {object} argumentsByMethod - The argumentsByMethod config.
 * @param {object} menuItems - The menuItems config.
 * @returns {object} mutation object for _createBlock.
 */
const buildMutation = function (method, menuName, argumentsByMethod, menuItems) {
    const config = argumentsByMethod[method];
    if (!config) return null;
    const blockInfo = {
        blockType: 'command',
        isDynamic: true,
        text: config.text,
        arguments: config.arguments,
        argumentsByMethod,
        menuItems,
    };
    return {
        tagName: 'mutation',
        children: [],
        blockInfo: blockInfo,
        warp: 'false',
    };
};

// --- argumentsByMethod configs ---

const stringMethodArgs = {
    reverse: {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hello' },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'reverse',
            },
        },
    },
    upcase: {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hello' },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'upcase',
            },
        },
    },
    downcase: {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'Hello' },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'downcase',
            },
        },
    },
    'empty?': {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: '' },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'empty?',
            },
        },
    },
    lines: {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hello' },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'lines',
            },
        },
    },
    delete: {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] )',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hello' },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'delete',
            },
            ARG1: { type: 'string', defaultValue: 'l' },
        },
    },
    gsub: {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] , [ARG2] )',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hello' },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'gsub',
            },
            ARG1: { type: 'string', defaultValue: 'l' },
            ARG2: { type: 'string', defaultValue: 'r' },
        },
    },
    'reverse!': {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: 'string',
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'reverse!',
            },
        },
    },
    'delete!': {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] )',
        arguments: {
            RECEIVER: {
                type: 'string',
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'delete!',
            },
            ARG1: { type: 'string', defaultValue: 'l' },
        },
    },
    'gsub!': {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] , [ARG2] )',
        arguments: {
            RECEIVER: {
                type: 'string',
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: 'gsub!',
            },
            ARG1: { type: 'string', defaultValue: 'l' },
            ARG2: { type: 'string', defaultValue: 'r' },
        },
    },
    '*': {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] )',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hello' },
            METHOD: {
                type: 'string',
                menu: 'stringMethodMenu',
                defaultValue: '*',
            },
            ARG1: { type: 'string', defaultValue: '3' },
        },
    },
};

const stringMethodMenuItems = {
    stringMethodMenu: [
        ['reverse', 'reverse'],
        ['upcase', 'upcase'],
        ['downcase', 'downcase'],
        ['empty?', 'empty?'],
        ['lines', 'lines'],
        ['delete', 'delete'],
        ['gsub', 'gsub'],
        ['reverse!', 'reverse!'],
        ['delete!', 'delete!'],
        ['gsub!', 'gsub!'],
        ['*', '*'],
    ],
};

const arrayMethodArgs = {
    max: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'list' },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'max',
            },
        },
    },
    min: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'list' },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'min',
            },
        },
    },
    sort: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'list' },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'sort',
            },
        },
    },
    reverse: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'list' },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'reverse',
            },
        },
    },
    first: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'list' },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'first',
            },
        },
    },
    last: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'list' },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'last',
            },
        },
    },
    'empty?': {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'list' },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'empty?',
            },
        },
    },
    join: {
        text: 'Array [RECEIVER] . [METHOD] ( [ARG1] )',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'list' },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'join',
            },
            ARG1: { type: 'string', defaultValue: '' },
        },
    },
    'sort!': {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: 'string',
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'sort!',
            },
        },
    },
    'reverse!': {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: 'string',
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: 'string',
                menu: 'arrayMethodMenu',
                defaultValue: 'reverse!',
            },
        },
    },
};

const arrayMethodMenuItems = {
    arrayMethodMenu: [
        ['max', 'max'],
        ['min', 'min'],
        ['sort', 'sort'],
        ['reverse', 'reverse'],
        ['first', 'first'],
        ['last', 'last'],
        ['empty?', 'empty?'],
        ['join', 'join'],
        ['sort!', 'sort!'],
        ['reverse!', 'reverse!'],
    ],
};

const hashMethodArgs = {
    keys: {
        text: 'Hash [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hash' },
            METHOD: {
                type: 'string',
                menu: 'hashMethodMenu',
                defaultValue: 'keys',
            },
        },
    },
    values: {
        text: 'Hash [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hash' },
            METHOD: {
                type: 'string',
                menu: 'hashMethodMenu',
                defaultValue: 'values',
            },
        },
    },
    'empty?': {
        text: 'Hash [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: 'string', defaultValue: 'hash' },
            METHOD: {
                type: 'string',
                menu: 'hashMethodMenu',
                defaultValue: 'empty?',
            },
        },
    },
};

const hashMethodMenuItems = {
    hashMethodMenu: [
        ['keys', 'keys'],
        ['values', 'values'],
        ['empty?', 'empty?'],
    ],
};

export {
    buildMutation,
    stringMethodArgs,
    stringMethodMenuItems,
    arrayMethodArgs,
    arrayMethodMenuItems,
    hashMethodArgs,
    hashMethodMenuItems,
};
