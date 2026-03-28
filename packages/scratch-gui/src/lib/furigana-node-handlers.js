// === Smalruby: This file is Smalruby-specific (furigana node handlers) ===
import { SPECIAL_STRING_LABELS } from './furigana-label-map'

/**
 * AST node handler methods for FuriganaAnnotator.
 * Covers: variables, literals, control flow, and logical operators.
 * These are mixed into FuriganaAnnotator.prototype via Object.assign.
 */
const nodeHandlers = {
  // ---- Variables ----

  _handleLocalVariableWriteNode(node) {
    this._addAnnotation(node.nameLoc, `変数${node.name}`)
    this._addAnnotation(node.operatorLoc, '紐付ける')
    this._walkNode(node.value)
  },

  _handleLocalVariableReadNode(node) {
    this._addAnnotation(node.location, `変数${node.name}`)
  },

  _handleLocalVariableOperatorWriteNode(node) {
    this._addAnnotation(node.nameLoc, `変数${node.name}`)
    this._addAnnotation(node.binaryOperatorLoc, this._opAsgnLabel(node.binaryOperator, node.value))
    this._walkNode(node.value)
  },

  _handleInstanceVariableWriteNode(node) {
    this._addAnnotation(node.nameLoc, `インスタンス変数${node.name.slice(1)}`)
    this._addAnnotation(node.operatorLoc, '紐付ける')
    this._walkNode(node.value)
  },

  _handleInstanceVariableReadNode(node) {
    this._addAnnotation(node.location, `インスタンス変数${node.name.slice(1)}`)
  },

  _handleInstanceVariableOperatorWriteNode(node) {
    this._addAnnotation(node.nameLoc, `インスタンス変数${node.name.slice(1)}`)
    this._addAnnotation(node.binaryOperatorLoc, this._opAsgnLabel(node.binaryOperator, node.value))
    this._walkNode(node.value)
  },

  _handleGlobalVariableWriteNode(node) {
    this._addAnnotation(node.nameLoc, `グローバル変数${node.name.slice(1)}`)
    this._addAnnotation(node.operatorLoc, '紐付ける')
    this._walkNode(node.value)
  },

  _handleGlobalVariableReadNode(node) {
    this._addAnnotation(node.location, `グローバル変数${node.name.slice(1)}`)
  },

  _handleGlobalVariableOperatorWriteNode(node) {
    this._addAnnotation(node.nameLoc, `グローバル変数${node.name.slice(1)}`)
    this._addAnnotation(node.binaryOperatorLoc, this._opAsgnLabel(node.binaryOperator, node.value))
    this._walkNode(node.value)
  },

  /**
   * Returns furigana label for operator-assignment (+=, -=, *=, etc.)
   * @param {string} binaryOperator - e.g. '+', '-', '*', '/', '%', '**'
   * @param {object} valueNode - prism AST node for the RHS
   */
  _opAsgnLabel(binaryOperator, valueNode) {
    switch (binaryOperator) {
      case '+':
        return this._isStringType(valueNode) ? 'と連結' : 'ずつ増やす'
      case '-':
        return 'ずつ減らす'
      case '*':
        return '倍にする'
      case '/':
        return '分の1にする'
      case '%':
        return '余りにする'
      case '**':
        return 'べき乗にする'
      default:
        return binaryOperator
    }
  },

  // ---- Literals ----

  _handleIntegerNode(node) {
    const text = this._getSourceText(node.location)
    if (this._argUnit) {
      this._addAnnotation(node.location, `${text}${this._argUnit}`)
    } else {
      this._addAnnotation(node.location, `数値${text}`)
    }
  },

  _handleFloatNode(node) {
    const text = this._getSourceText(node.location)
    if (this._argUnit) {
      this._addAnnotation(node.location, `${text}${this._argUnit}`)
    } else {
      this._addAnnotation(node.location, `数値${text}`)
    }
  },

  _handleTrueNode(node) {
    this._addAnnotation(node.location, '真')
  },

  _handleFalseNode(node) {
    this._addAnnotation(node.location, '偽')
  },

  _handleSymbolNode(node) {
    const unescaped = node.unescaped
    const content = unescaped && typeof unescaped === 'object' ? unescaped.value : unescaped
    this._addAnnotation(node.location, `シンボル「${content}」`)
  },

  // === Smalruby: Start of regex literal furigana ===
  _handleRegularExpressionNode(node) {
    const text = this._getSourceText(node.location)
    this._addAnnotation(node.location, `正規表現${text}`)
  },
  // === Smalruby: End of regex literal furigana ===

  // === Smalruby: Start of array/hash/super furigana ===
  _handleArrayNode(node) {
    this._addAnnotation(node.location, '配列')
    if (node.elements) {
      node.elements.forEach(el => this._walkNode(el))
    }
  },

  _handleHashNode(node) {
    this._addAnnotation(node.location, 'ハッシュ')
    this._walkChildren(node)
  },

  _handleForwardingSuperNode(node) {
    this._addAnnotation(node.location, 'オーバーライドしているメソッドを呼ぶ')
  },

  _handleSuperNode(node) {
    this._addAnnotation(node.keywordLoc, 'オーバーライドしているメソッドを呼ぶ')
    this._walkChildren(node)
  },
  // === Smalruby: End of array/hash/super furigana ===

  _handleStringNode(node) {
    const unescaped = node.unescaped
    const content = unescaped && typeof unescaped === 'object' ? unescaped.value : unescaped
    // Check context-specific string label map/function first
    if (this._stringLabelMap) {
      if (typeof this._stringLabelMap === 'function') {
        const fnLabel = this._stringLabelMap(content)
        if (fnLabel) {
          this._addAnnotation(node.location, fnLabel)
          return
        }
      } else if (this._stringLabelMap[content]) {
        this._addAnnotation(node.location, this._stringLabelMap[content])
        return
      }
    }
    const specialLabel = SPECIAL_STRING_LABELS[content]
    this._addAnnotation(node.location, specialLabel || `文字列「${content}」`)
  },

  // ---- Control flow: if / elsif / else ----

  _handleIfNode(node) {
    const keyword = this._getSourceText(node.ifKeywordLoc)
    if (keyword === 'if') {
      this._addAnnotation(node.ifKeywordLoc, 'もし')
      if (node.endKeywordLoc) {
        this._addAnnotation(node.endKeywordLoc, '分岐終了')
      }
    } else if (keyword === 'elsif') {
      this._addAnnotation(node.ifKeywordLoc, 'ではなく')
    }
    this._walkNode(node.predicate)
    this._walkNode(node.statements)
    this._walkNode(node.subsequent)
  },

  _handleElseNode(node) {
    this._addAnnotation(node.elseKeywordLoc, 'でなければ')
    this._walkNode(node.statements)
  },

  // ---- Control flow: until ----

  _handleUntilNode(node) {
    this._addAnnotation(node.keywordLoc, 'まで繰り返す')
    if (node.closingLoc) {
      this._addAnnotation(node.closingLoc, '繰り返し終了')
    }
    this._walkNode(node.predicate)
    this._walkNode(node.statements)
  },

  // ---- Control flow: while ----

  _handleWhileNode(node) {
    this._addAnnotation(node.keywordLoc, '真である限り繰り返す')
    if (node.closingLoc) {
      this._addAnnotation(node.closingLoc, '繰り返し終了')
    }
    this._walkNode(node.predicate)
    this._walkNode(node.statements)
  },

  // ---- Method definition ----

  _handleDefNode(node) {
    this._addAnnotation(node.defKeywordLoc, 'メソッド作成')
    if (node.nameLoc) {
      if (node.name === 'initialize') {
        this._addAnnotation(node.nameLoc, '初期設定')
      } else {
        this._addAnnotation(node.nameLoc, `${node.name}という名前`)
      }
    }
    if (node.endKeywordLoc) {
      this._addAnnotation(node.endKeywordLoc, '作成終了')
    }
    if (node.parameters) this._walkNode(node.parameters)
    if (node.body) this._walkNode(node.body)
  },

  _handleRequiredParameterNode(node) {
    this._addAnnotation(node.location, `引数${node.name}`)
  },

  _handleOptionalParameterNode(node) {
    this._addAnnotation(node.nameLoc || node.location, `引数${node.name}`)
    this._walkNode(node.value)
  },

  // ---- return ----

  _handleReturnNode(node) {
    this._addAnnotation(node.keywordLoc, '呼び出し元に返す')
    this._walkChildren(node)
  },

  // ---- module definition ----

  _handleModuleNode(node) {
    this._addAnnotation(node.moduleKeywordLoc, 'モジュール作成')
    if (node.endKeywordLoc) {
      this._addAnnotation(node.endKeywordLoc, '作成終了')
    }
    this._walkChildren(node)
  },

  // ---- class definition ----

  _handleClassNode(node) {
    this._addAnnotation(node.classKeywordLoc, 'クラス作成')
    if (node.endKeywordLoc) {
      this._addAnnotation(node.endKeywordLoc, '作成終了')
    }
    this._walkChildren(node)
  },

  // ---- case / when ----

  _handleCaseNode(node) {
    this._addAnnotation(node.caseKeywordLoc, '状態分岐')
    if (node.endKeywordLoc) {
      this._addAnnotation(node.endKeywordLoc, '分岐終了')
    }
    if (node.predicate) this._walkNode(node.predicate)
    if (node.conditions) node.conditions.forEach(c => this._walkNode(c))
    if (node.elseClause) this._walkNode(node.elseClause)
  },

  _handleWhenNode(node) {
    this._addAnnotation(node.keywordLoc, 'のとき')
    if (node.conditions) node.conditions.forEach(c => this._walkNode(c))
    if (node.statements) this._walkNode(node.statements)
  },

  // ---- Logical operators ----

  _handleAndNode(node) {
    this._addAnnotation(node.operatorLoc, 'かつ')
    this._walkNode(node.left)
    this._walkNode(node.right)
  },

  _handleOrNode(node) {
    this._addAnnotation(node.operatorLoc, 'または')
    this._walkNode(node.left)
    this._walkNode(node.right)
  },
}

export { nodeHandlers }
