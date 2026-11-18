// SPDX-License-Identifier: MIT
// ja-notation: the shape of the Japanese syntax tree (JaAST). See ../LICENSE.
//
// A JaAST is plain JSON (no classes), so the Node and the Ruby implementations
// can share test data. Every node has `type`, `line` (1-based line of the
// Japanese source) and `column` (0-based). Statements that span lines also
// have `endLine`.
//
// Program      { settings, body: [Statement], lineCount?, blankLines? }
//   (`settings`: `{indexBase: 0 | 1, commentMarker: '#' | '//', logicNote}`,
//   read from the sentences at the top of the program; see ./settings.js.
//   The indexes in the JaAST are the indexes of the Japanese: `buildRuby`
//   shifts them for the Ruby and `readRuby` shifts them back.)
//   (`lineCount` / `blankLines`: the lines of the source and the ones with
//   nothing on them, which `writeJa` keeps; `readRuby` gives them.)
//
// Statements:
//   Assign       { target: Name | Index, value: Expression }
//   OpAssign     { target: Name | Index, operator: '+' | '-' | '*' | '/' | '%', value }
//   MultiAssign  { targets: [Name | Index], values: [Expression] }
//   Input        { target: Name | Index, kind: 'external' | 'integer' | 'string' }
//   ExpressionStatement { expression }
//   If           { branches: [{ condition, body, line }], elseBody: [Statement] | null, elseLine }
//   While        { condition, body }
//   For          { variable: Name, from, to, step, direction: 'up' | 'down', body }
//   FunctionDef  { name, params: [string], body }
//   Return       { value: Expression | null }
//   Append       { target: Name, value: Expression }   (`A に 値 を追加する`: at the end of the array)
//   Comment      { text }                       (a line that is only a comment; `text`
//                                               starts with `#` whatever the comment mark is)
//   RubyCode     { text }                       (Ruby with no Japanese form, as written; `readRuby` only)
//   Block statements also have `closeLine` (the line the block ends on) and
//   `closeAfter` (the last line before the code after the block); the Ruby
//   writer uses them for the line map. A block closed by a line of its own
//   (`を実行する`, the DNCL-like form) has `closeOwnLine: true`, and
//   `closeComment` when that line has a comment.
//   Any statement may have `comment` (the `# ...` at the end of its line).
//
// Expressions:
//   Number   { value }            the digits as a decimal number (`017` is `17`)
//   String   { raw }              the literal as written, with its quotes
//   Boolean  { value }            真 / 偽
//   Name     { name }
//   Index    { target, index }
//   ArrayLiteral { elements }
//   Call     { name, args }       a function, built in or defined in the program
//   Unary    { operator: '-' | '+' | 'not', operand, parens? }
//            (`parens`: `readRuby` saw the operand of `not` in parentheses; `writeJa` keeps them)
//   Binary   { operator, left, right }  operator: + - * / ÷ % == != < <= > >= and or .. ...
//   RubyCode { text }             Ruby with no Japanese form (`$g`, `nil`), as written
//
// A minus before a quotient is on its left: `-a ÷ 2` is Binary(÷, Unary(-, a), 2)
// and means `-(a ÷ 2)`, as `parse` reads it.

/** The types of the statements. */
const STATEMENT_TYPES = [
    'Assign',
    'OpAssign',
    'MultiAssign',
    'Input',
    'ExpressionStatement',
    'If',
    'While',
    'For',
    'FunctionDef',
    'Return',
    'Append',
    'Comment',
    'RubyCode',
];

/** The types of the expressions. */
const EXPRESSION_TYPES = [
    'Number',
    'String',
    'Boolean',
    'Name',
    'Index',
    'ArrayLiteral',
    'Call',
    'Unary',
    'Binary',
    'RubyCode',
];

export { EXPRESSION_TYPES, STATEMENT_TYPES };
