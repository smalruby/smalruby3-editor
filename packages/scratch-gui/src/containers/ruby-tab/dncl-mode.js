// === Smalruby: This file is Smalruby-specific (DNCL language mode for Monaco) ===

// DNCL keywords that increase indentation
const INCREASE_INDENT_KEYWORDS = ['なら', 'ならば', 'そうでなければ', 'そうでなくもし']

// DNCL keywords that decrease indentation
const DECREASE_INDENT_KEYWORDS = ['を実行する', 'を繰り返す', 'と定義する', 'そうでなければ', 'そうでなくもし']

// Japanese Unicode ranges
const JA = '\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF'

/**
 * Monaco language configuration for DNCL mode.
 */
export const dnclLanguageConfiguration = {
  wordPattern: new RegExp(
    `(-?\\d*\\.\\d\\w*)|([a-zA-Z_${JA}][\\w${JA}]*)`,
  ),
  indentationRules: {
    increaseIndentPattern: new RegExp(
      `^\\s*(?:もし\\s.+\\s(?:なら|ならば)|そうでなくもし\\s.+\\s(?:なら|ならば)|そうでなければ|.+\\sの間|.+\\sずつ(?:増やし|減らし)ながら|関数\\s.+)$`,
    ),
    decreaseIndentPattern: new RegExp(
      `^\\s*(?:${DECREASE_INDENT_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|そうでなくもし\\s).*$`,
    ),
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
    ['「', '」'],
    ['【', '】'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '「', close: '」' },
    { open: '【', close: '】' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '「', close: '」' },
    { open: '【', close: '】' },
  ],
  comments: {
    lineComment: '#',
  },
}

/**
 * Monarch tokenizer for DNCL syntax highlighting.
 */
export const dnclLanguage = {
  defaultToken: '',
  tokenPostfix: '.dncl',

  controlKeywords: [
    'もし',
    'なら',
    'ならば',
    'そうでなければ',
    'そうでなくもし',
    'を実行する',
    'の間',
    'を繰り返す',
    'ずつ増やしながら',
    'ずつ減らしながら',
    'から',
    'まで',
    'を',
    '関数',
    '返す',
    'と定義する',
  ],

  builtinFunctions: ['表示する', '要素数', '整数', '文字列', '乱数'],

  operators: ['かつ', 'または', 'でない'],

  booleans: ['真', '偽'],

  symbols: /[=><!~?:&|+\-*/^%÷≦≧←]+/,

  tokenizer: {
    root: [
      // Comments
      [/#.*$/, 'comment'],

      // Japanese bracket strings
      [/「[^」]*」/, 'string'],

      // String literals
      [/"/, { token: 'string.quote', next: '@string' }],

      // Numbers
      [/\d+(\.\d+)?/, 'number'],

      // Input placeholder
      [/【外部からの入力】/, 'keyword'],

      // Identifiers — check against keyword lists
      [
        /[a-zA-Z_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF][\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]*/,
        {
          cases: {
            '@controlKeywords': 'keyword',
            '@builtinFunctions': 'type.identifier',
            '@operators': 'keyword.operator',
            '@booleans': 'constant.language',
            '@default': 'identifier',
          },
        },
      ],

      // Operators and symbols
      [/÷/, 'operator'],
      [/\/\//, 'operator'],
      [/≦|≧/, 'operator'],
      [/←/, 'operator'],
      [/@symbols/, 'operator'],

      // Brackets
      [/[{}()[\]【】「」]/, '@brackets'],

      // Whitespace
      [/\s+/, 'white'],
    ],

    string: [
      [/[^"\\]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', next: '@pop' }],
    ],
  },
}
