// SPDX-License-Identifier: MIT
// ja-notation: the shape of the Japanese syntax tree (JaAST). See ./LICENSE.
//
// A JaAST is plain JSON (no classes), so the Node and the Ruby implementations
// can share test data. Every node has `type`, `line` (1-based line of the
// Japanese source) and `column` (0-based). Statements that span lines also
// have `endLine`.
//
// Program      { settings, body: [Statement] }
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
//   Comment      { text }                       (a line that is only a comment)
//   Block statements also have `closeLine` (the line the block ends on) and
//   `closeAfter` (the last line before the code after the block); the Ruby
//   writer uses them for the line map.
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
//   Unary    { operator: '-' | '+' | 'not', operand }
//   Binary   { operator, left, right }  operator: + - * / ÷ % == != < <= > >= and or .. ...

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
    'Comment',
];

/** The types of the expressions. */
const EXPRESSION_TYPES = ['Number', 'String', 'Boolean', 'Name', 'Index', 'ArrayLiteral', 'Call', 'Unary', 'Binary'];

export { EXPRESSION_TYPES, STATEMENT_TYPES };
