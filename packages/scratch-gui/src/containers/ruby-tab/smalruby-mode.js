// Keywords that increase indentation on the next line
const INCREASE_INDENT_KEYWORDS = [
    'def', 'class', 'module', 'if', 'unless', 'elsif', 'else',
    'case', 'when', 'while', 'until', 'for', 'begin', 'do',
    'rescue', 'ensure'
].join('|');

// Keywords that decrease the current line's indentation.
// "when" is excluded here because Smalruby uses when_xxx methods
// (e.g. when_flag_clicked, when_key_pressed). It is handled
// separately with a trailing space requirement below.
const DECREASE_INDENT_KEYWORDS = [
    'end', 'else', 'elsif', 'rescue', 'ensure'
].join('|');

// Japanese Unicode ranges for word pattern:
// \u3040-\u309F hiragana, \u30A0-\u30FF katakana, \u4E00-\u9FFF kanji
const JA = '\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF';

// Language configuration for Monaco setLanguageConfiguration
export const smalrubyLanguageConfiguration = {
    // Include Japanese characters so that model.getWordUntilPosition()
    // recognizes them as word constituents for completion triggering.
    wordPattern: new RegExp(
        `(-?\\d*\\.\\d\\w*)|([a-zA-Z_${JA}][\\w${JA}]*)`
    ),
    indentationRules: {
        // Match lines starting with block-opening keywords
        // (with negative lookahead for one-liners like
        // "if x then y end"), or lines ending with "do".
        increaseIndentPattern: new RegExp(
            `^\\s*(?:(?:${INCREASE_INDENT_KEYWORDS})` +
            `\\b(?!.*\\bend\\b).*|.*\\bdo\\b\\s*)$`
        ),
        // Word boundary \b prevents matching "send", "blend", etc.
        // "when" requires a trailing space (e.g. "when 1") to avoid
        // false positives with when_xxx method names.
        decreaseIndentPattern: new RegExp(
            `^\\s*(?:(?:${DECREASE_INDENT_KEYWORDS})\\b|when\\s).*$`
        )
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
    ],
    autoClosingPairs: [
        {open: '{', close: '}'},
        {open: '[', close: ']'},
        {open: '(', close: ')'},
        {open: '"', close: '"'},
        {open: "'", close: "'"}
    ],
    surroundingPairs: [
        {open: '{', close: '}'},
        {open: '[', close: ']'},
        {open: '(', close: ')'},
        {open: '"', close: '"'},
        {open: "'", close: "'"}
    ],
    comments: {
        lineComment: '#'
    }
};

// Monarch tokenizer definition for syntax highlighting
export const smalrubyLanguage = {
    defaultToken: '',
    tokenPostfix: '.smalruby',

    keywords: [
        'begin', 'break', 'case', 'class', 'def', 'else', 'elsif', 'end',
        'ensure', 'false', 'for', 'if', 'in', 'module', 'next', 'nil',
        'not', 'or', 'redo', 'rescue', 'retry', 'return', 'self', 'super',
        'then', 'true', 'undef', 'unless', 'until', 'when', 'while', 'yield'
    ],

    smalrubyMethods: [
        // Motion
        'move', 'turn_right', 'turn_left', 'go_to', 'glide', 'point_towards',
        'bounce_if_on_edge', 'x', 'y', 'direction',
        // Looks
        'say', 'think', 'switch_costume', 'switch_backdrop', 'switch_backdrop_and_wait',
        'next_costume', 'next_backdrop',
        'change_effect_by', 'set_effect', 'clear_graphic_effects',
        'go_to_layer', 'go_layers', 'go_to_front', 'go_to_back', 'go_forward', 'go_backward',
        'show', 'hide', 'size',
        'costume_number', 'costume_name', 'backdrop_number', 'backdrop_name',
        // Sound
        'play', 'play_until_done', 'stop_all_sounds',
        'change_sound_effect_by', 'set_sound_effect', 'clear_sound_effects',
        'volume',
        // Events
        'when_flag_clicked', 'when_key_pressed', 'when_clicked',
        'when_backdrop_switches', 'when_greater_than', 'when_receive',
        'broadcast', 'broadcast_and_wait',
        // Control
        'sleep', 'loop', 'forever', 'repeat', 'times', 'stop',
        'create_clone', 'when_start_as_a_clone', 'delete_this_clone',
        // Sensing
        'touching?', 'touching_color?', 'color_is_touching_color?', 'distance',
        'ask', 'answer', 'loudness', 'days_since_2000', 'user_name',
        // Operators / Math
        'rand', 'round', 'abs', 'floor', 'ceil',
        'length', 'include?', 'empty?', 'to_s', 'to_i',
        // Data
        'list', 'push', 'delete_at', 'insert', 'index', 'clear',
        'show_variable', 'hide_variable', 'show_list', 'hide_list',
        // Music
        'play_drum', 'rest', 'play_note', 'tempo',
        // Pen
        'stamp',
        // Class-level settings
        'set_name', 'set_x', 'set_y', 'set_direction', 'set_visible',
        'set_size', 'set_current_costume', 'set_rotation_style'
    ],

    // Smalruby constant/class names used as receivers
    smalrubyConstants: [
        'Keyboard', 'Mouse', 'Timer', 'Time', 'Math', 'Pen'
    ],

    operators: [
        '=', '>', '<', '!', '~', '?', ':',
        '==', '<=', '>=', '!=', '&&', '||',
        '+', '-', '*', '/', '%', '**',
        '+=', '-=', '*=', '/=', '%=',
        '&', '|', '^', '<<', '>>', '=>', '..'
    ],

    symbols: /[=><!~?:&|+\-*/^%]+/,

    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
        root: [
            // Identifiers and keywords
            [/[a-zA-Z_]\w*[!?]?/, {
                cases: {
                    '@keywords': 'keyword',
                    '@smalrubyConstants': 'type',
                    '@smalrubyMethods': 'type.identifier',
                    '@default': 'identifier'
                }
            }],

            // Instance variables
            [/@\w+/, 'variable.instance'],

            // Global variables
            [/\$\w+/, 'variable.global'],

            // Whitespace
            {include: '@whitespace'},

            // Delimiters and operators
            [/[{}()[\]]/, '@brackets'],
            [/@symbols/, {
                cases: {
                    '@operators': 'operator',
                    '@default': ''
                }
            }],

            // Numbers
            [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\d+/, 'number'],

            // Strings
            [/"/, {token: 'string.quote', bracket: '@open', next: '@string'}],

            // Characters
            [/'[^\\']'/, 'string'],
            [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
            [/'/, 'string.invalid']
        ],

        string: [
            [/[^\\"]/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, {token: 'string.quote', bracket: '@close', next: '@pop'}]
        ],

        whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/#.*$/, 'comment']
        ]
    }
};
