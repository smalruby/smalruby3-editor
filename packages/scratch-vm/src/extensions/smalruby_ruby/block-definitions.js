const ArgumentType = require('../../extension-support/argument-type');

/**
 * argumentsByMethod, menuItems, and menus definitions for
 * stringMethod, arrayMethod, and hashMethod blocks.
 */

const stringMethodArgumentsByMethod = {
    reverse: {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hello',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'reverse',
            },
        },
    },
    upcase: {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hello',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'upcase',
            },
        },
    },
    downcase: {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'Hello',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'downcase',
            },
        },
    },
    'empty?': {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: { type: ArgumentType.STRING, defaultValue: '' },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'empty?',
            },
        },
    },
    lines: {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hello',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'lines',
            },
        },
    },
    delete: {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] )',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hello',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'delete',
            },
            ARG1: { type: ArgumentType.STRING, defaultValue: 'l' },
        },
    },
    gsub: {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] , [ARG2] )',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hello',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'gsub',
            },
            ARG1: { type: ArgumentType.STRING, defaultValue: 'l' },
            ARG2: { type: ArgumentType.STRING, defaultValue: 'r' },
        },
    },
    'reverse!': {
        text: 'String [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'reverse!',
            },
        },
    },
    'delete!': {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] )',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'delete!',
            },
            ARG1: { type: ArgumentType.STRING, defaultValue: 'l' },
        },
    },
    'gsub!': {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] , [ARG2] )',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: 'gsub!',
            },
            ARG1: { type: ArgumentType.STRING, defaultValue: 'l' },
            ARG2: { type: ArgumentType.STRING, defaultValue: 'r' },
        },
    },
    '*': {
        text: 'String [RECEIVER] . [METHOD] ( [ARG1] )',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hello',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'stringMethodMenu',
                defaultValue: '*',
            },
            ARG1: { type: ArgumentType.STRING, defaultValue: '3' },
        },
    },
};

const stringMethodMenuItems = [
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
];

const arrayMethodArgumentsByMethod = {
    max: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'list',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'max',
            },
        },
    },
    min: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'list',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'min',
            },
        },
    },
    sort: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'list',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'sort',
            },
        },
    },
    reverse: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'list',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'reverse',
            },
        },
    },
    first: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'list',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'first',
            },
        },
    },
    last: {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'list',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'last',
            },
        },
    },
    'empty?': {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'list',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'empty?',
            },
        },
    },
    join: {
        text: 'Array [RECEIVER] . [METHOD] ( [ARG1] )',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'list',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'join',
            },
            ARG1: { type: ArgumentType.STRING, defaultValue: '' },
        },
    },
    'sort!': {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'sort!',
            },
        },
    },
    'reverse!': {
        text: 'Array [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                menu: 'variableNames',
                defaultValue: ' ',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'arrayMethodMenu',
                defaultValue: 'reverse!',
            },
        },
    },
};

const arrayMethodMenuItems = [
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
];

const hashMethodArgumentsByMethod = {
    keys: {
        text: 'Hash [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hash',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'hashMethodMenu',
                defaultValue: 'keys',
            },
        },
    },
    values: {
        text: 'Hash [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hash',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'hashMethodMenu',
                defaultValue: 'values',
            },
        },
    },
    'empty?': {
        text: 'Hash [RECEIVER] . [METHOD]',
        arguments: {
            RECEIVER: {
                type: ArgumentType.STRING,
                defaultValue: 'hash',
            },
            METHOD: {
                type: ArgumentType.STRING,
                menu: 'hashMethodMenu',
                defaultValue: 'empty?',
            },
        },
    },
};

const hashMethodMenuItems = [
    ['keys', 'keys'],
    ['values', 'values'],
    ['empty?', 'empty?'],
];

const menus = {
    stringMethodMenu: {
        acceptReporters: false,
        items: [
            { text: 'reverse', value: 'reverse' },
            { text: 'upcase', value: 'upcase' },
            { text: 'downcase', value: 'downcase' },
            { text: 'empty?', value: 'empty?' },
            { text: 'lines', value: 'lines' },
            { text: 'delete', value: 'delete' },
            { text: 'gsub', value: 'gsub' },
            { text: 'reverse!', value: 'reverse!' },
            { text: 'delete!', value: 'delete!' },
            { text: 'gsub!', value: 'gsub!' },
            { text: '*', value: '*' },
        ],
    },
    arrayMethodMenu: {
        acceptReporters: false,
        items: [
            { text: 'max', value: 'max' },
            { text: 'min', value: 'min' },
            { text: 'sort', value: 'sort' },
            { text: 'reverse', value: 'reverse' },
            { text: 'first', value: 'first' },
            { text: 'last', value: 'last' },
            { text: 'empty?', value: 'empty?' },
            { text: 'join', value: 'join' },
            { text: 'sort!', value: 'sort!' },
            { text: 'reverse!', value: 'reverse!' },
        ],
    },
    hashMethodMenu: {
        acceptReporters: false,
        items: [
            { text: 'keys', value: 'keys' },
            { text: 'values', value: 'values' },
            { text: 'empty?', value: 'empty?' },
        ],
    },
    arrayMethodWithBlockMenu: {
        acceptReporters: false,
        items: [{ text: 'each', value: 'each' }],
    },
    numberMethodWithBlockMenu: {
        acceptReporters: false,
        items: [{ text: 'times', value: 'times' }],
    },
    blockParamMenu: {
        acceptReporters: false,
        items: [
            { text: '_1', value: '_1' },
            { text: '_2', value: '_2' },
            { text: '_3', value: '_3' },
            { text: '_4', value: '_4' },
            { text: '_5', value: '_5' },
            { text: '_6', value: '_6' },
            { text: '_7', value: '_7' },
            { text: '_8', value: '_8' },
            { text: '_9', value: '_9' },
        ],
    },
    variableNames: {
        acceptReporters: false,
        items: 'getVariableNamesMenuItems',
    },
};

module.exports = {
    stringMethodArgumentsByMethod,
    stringMethodMenuItems,
    arrayMethodArgumentsByMethod,
    arrayMethodMenuItems,
    hashMethodArgumentsByMethod,
    hashMethodMenuItems,
    menus,
};
