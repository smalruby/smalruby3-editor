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
        'change_effect_by', 'set_effect', 'go_to_layer', 'go_layers',
        'costume_number', 'costume_name', 'backdrop_number', 'backdrop_name',
        'next_costume', 'next_backdrop', 'clear_graphic_effects', 'show', 'hide', 'size',
        // Control
        'sleep', 'repeat', 'loop', 'forever', 'stop', 'create_clone', 'times',
        'when_start_as_a_clone', 'delete_this_clone',
        // Events (often used as hats)
        'when_flag_clicked', 'when_key_pressed', 'when_clicked',
        'when_backdrop_switches_to', 'when_greater_than', 'when_receive', 'broadcast', 'broadcast_and_wait',
        // Sound
        'play_sound_until_done', 'start_sound', 'stop_all_sounds',
        'change_sound_effect_by', 'set_sound_effect', 'clear_sound_effects',
        'change_volume_by', 'volume',
        // Sensing
        'touching?', 'touching_color?', 'color_is_touching_color?', 'distance_to',
        'ask_and_wait', 'answer', 'key_pressed?', 'mouse_down?', 'mouse_x', 'mouse_y',
        'loudness', 'timer', 'reset_timer', 'current', 'days_since_2000', 'username',
        // Pen
        'clear', 'stamp', 'pen_down', 'pen_up', 'change_pen_color_by', 'set_pen_color_to',
        'change_pen_size_by', 'set_pen_size_to'
    ],

    operators: [
        '=', '>', '<', '!', '~', '?', ':',
        '==', '<=', '>=', '!=', '&&', '||', '++', '--',
        '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>', '=>'
    ],

    symbols: /[=><!~?:&|+\-*/^%]+/,

    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
        root: [
            // Identifiers and keywords
            [/[a-zA-Z_]\w*[!?]?/, {
                cases: {
                    '@keywords': 'keyword',
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
