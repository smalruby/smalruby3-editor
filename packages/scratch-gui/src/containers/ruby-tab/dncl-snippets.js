// === Smalruby: This file is Smalruby-specific (DNCL completion snippets) ===

/**
 * DNCL snippet definitions for Monaco completion provider.
 * Each snippet has a label (trigger text), insertText (with tab stops),
 * and documentation.
 *
 * The insertText uses Monaco snippet syntax ($1, $2, etc.) which
 * looks like template literal expressions but is intentional.
 */
/* eslint-disable no-template-curly-in-string */
const DNCL_SNIPPETS = [
  {
    label: 'もし...ならば',
    insertText: 'もし ${1:条件} ならば\n  ${2}\nを実行する',
    documentation: '条件分岐（if）',
  },
  {
    label: 'もし...そうでなければ',
    insertText:
      'もし ${1:条件} ならば\n  ${2}\nそうでなければ\n  ${3}\nを実行する',
    documentation: '条件分岐（if-else）',
  },
  {
    label: '繰り返し（増やす）',
    insertText:
      '${1:i} を ${2:1} から ${3:10} まで ${4:1} ずつ増やしながら\n  ${5}\nを繰り返す',
    documentation: '順次繰り返し（for ループ・昇順）',
  },
  {
    label: '繰り返し（減らす）',
    insertText:
      '${1:i} を ${2:10} から ${3:0} まで ${4:1} ずつ減らしながら\n  ${5}\nを繰り返す',
    documentation: '順次繰り返し（for ループ・降順）',
  },
  {
    label: '条件の間繰り返す',
    insertText: '${1:条件} の間\n  ${2}\nを繰り返す',
    documentation: '条件繰り返し（while ループ）',
  },
  {
    label: '関数定義',
    insertText: '関数 ${1:名前}(${2:引数})\n  ${3}\nと定義する',
    documentation: '関数を定義する',
  },
  {
    label: '表示する',
    insertText: '表示する(${1})',
    documentation: '値を表示する',
  },
  {
    label: '【外部からの入力】',
    insertText: '${1:変数} = 【外部からの入力】',
    documentation: '外部からの入力を受け取る',
  },
  {
    label: '要素数',
    insertText: '要素数(${1:配列名})',
    documentation: '配列の要素数を取得する',
  },
  {
    label: '整数',
    insertText: '整数(${1:値})',
    documentation: '整数に変換する',
  },
  {
    label: '文字列',
    insertText: '文字列(${1:値})',
    documentation: '文字列に変換する',
  },
  {
    label: '乱数',
    insertText: '乱数(${1:範囲})',
    documentation: '乱数を生成する',
  },
]
/* eslint-enable no-template-curly-in-string */

/**
 * DNCL completion provider for Monaco editor.
 */
class DnclSnippetsCompleter {
  /**
   * Provide completion items for DNCL mode.
   * @param {object} model - Monaco text model.
   * @param {object} position - Cursor position.
   * @param {object} _context - Completion context (unused).
   * @param {object} _token - Cancellation token (unused).
   * @param {object} monaco - Monaco namespace.
   * @returns {object} Completion list.
   */
  provideCompletionItems(model, position, _context, _token, monaco) {
    const word = model.getWordUntilPosition(position)
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    }

    const suggestions = DNCL_SNIPPETS.map((snippet) => ({
      label: snippet.label,
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: snippet.insertText,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: snippet.documentation,
      range,
    }))

    return { suggestions }
  }
}

export { DnclSnippetsCompleter, DNCL_SNIPPETS }
