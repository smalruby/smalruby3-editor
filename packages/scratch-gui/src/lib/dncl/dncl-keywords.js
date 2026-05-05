// === Smalruby: This file is Smalruby-specific (DNCL transpiler keywords) ===

/**
 * Known DNCL keywords that should NOT be treated as variable references.
 */
const DNCL_KEYWORDS = new Set([
  '表示する',
  '含む',
  '要素数',
  '整数',
  '文字列',
  '乱数',
  '四捨五入',
  '切り捨て',
  '切り上げ',
  '絶対値',
  '平方根',
  '真',
  '偽',
  'かつ',
  'または',
  'でない',
  'もし',
  'なら',
  'ならば',
  'そうでなければ',
  'そうでなくもし',
  'を実行する',
  'の間',
  'を繰り返す',
  'から',
  'まで',
  'ずつ',
  '増やしながら',
  '減らしながら',
  '関数',
  '返す',
  'と定義する',
])

/**
 * Known Ruby/numeric literals and built-in names that should not be
 * prefixed with `@`.
 */
const RUBY_LITERALS = new Set([
  'true',
  'false',
  'nil',
  'answer',
  'say',
  'puts',
  'print',
  'ask',
  'rand',
  'ask_and_wait',
  'return',
  'if',
  'elsif',
  'else',
  'end',
  'while',
  'do',
  'def',
  'to_i',
  'to_s',
  'to_f',
  'length',
  'step',
  'round',
  'floor',
  'ceil',
  'abs',
  'include?',
  'Math',
])

export { DNCL_KEYWORDS, RUBY_LITERALS }
