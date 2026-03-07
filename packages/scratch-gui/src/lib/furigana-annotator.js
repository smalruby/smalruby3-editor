/**
 * Annotates Ruby source code with furigana (Japanese reading aids).
 *
 * Usage:
 *   const annotator = new FuriganaAnnotator();
 *   const annotations = annotator.annotate(sourceCode, prism.parse(sourceCode));
 *   // annotations: Map<lineNumber, Array<{startColumn, endColumn, label}>>
 *   //   lineNumber: 1-based
 *   //   startColumn: 0-based byte offset from line start
 *   //   endColumn: 0-based byte offset (exclusive)
 *   //   label: furigana string (e.g. '変数answer', '紐付けろ', '数値10')
 */
class FuriganaAnnotator {
    /**
     * @param {string} sourceCode - Ruby source code
     * @param {object|null} parseResult - Result from prism.parse(sourceCode)
     * @returns {Map} line→annotations map
     */
    annotate (sourceCode, parseResult) {
        this._annotations = new Map();
        this._sourceCode = sourceCode || '';
        this._buildMappings(this._sourceCode);
        if (parseResult && parseResult.value) {
            this._walkNode(parseResult.value);
        }
        // Sort annotations within each line by startColumn
        for (const anns of this._annotations.values()) {
            anns.sort((a, b) => a.startColumn - b.startColumn);
        }
        return this._annotations;
    }

    // ---- Internal helpers ----

    /**
     * Build UTF-8 byte-based line offsets and a byteToChar mapping.
     * Prism gives byte offsets, but Monaco uses character (JS) columns.
     */
    _buildMappings (source) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(source);

        // byteToChar[byteIdx] = corresponding JS char index
        this._byteToChar = new Uint32Array(bytes.length + 1);
        let byteIdx = 0;
        let charIdx = 0;
        for (const codePoint of source) { // iterates Unicode code points
            const cpByteLen = encoder.encode(codePoint).length;
            for (let b = 0; b < cpByteLen; b++) {
                this._byteToChar[byteIdx + b] = charIdx;
            }
            byteIdx += cpByteLen;
            charIdx++;
        }
        this._byteToChar[byteIdx] = charIdx; // sentinel at end

        // line byte offsets: _lineOffsets[n] = byte index where line (n+1) starts
        this._lineOffsets = [0];
        for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] === 0x0a) { // '\n'
                this._lineOffsets.push(i + 1);
            }
        }
    }

    _locToLineCol (byteOffset) {
        const offsets = this._lineOffsets;
        let lo = 0;
        let hi = offsets.length - 1;
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2);
            if (offsets[mid] <= byteOffset) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        const lineStartByte = offsets[lo];
        // Column in JS chars (for correct pixel positioning with Monaco)
        const column = this._byteToChar[byteOffset] - this._byteToChar[lineStartByte];
        return {
            line: lo + 1, // 1-based
            column
        };
    }

    _addAnnotation (loc, label) {
        if (!loc) return;
        const {line, column} = this._locToLineCol(loc.startOffset);
        const endByteOffset = loc.startOffset + loc.length;
        const lineStartByte = this._lineOffsets[line - 1];
        const endColumn = (
            this._byteToChar[Math.min(endByteOffset, this._byteToChar.length - 1)] -
            this._byteToChar[lineStartByte]
        );
        if (!this._annotations.has(line)) {
            this._annotations.set(line, []);
        }
        this._annotations.get(line).push({
            startColumn: column,
            endColumn,
            label
        });
    }

    _getSourceText (loc) {
        if (!loc) return '';
        const startChar = this._byteToChar[loc.startOffset];
        const endByte = Math.min(loc.startOffset + loc.length, this._byteToChar.length - 1);
        const endChar = this._byteToChar[endByte];
        return this._sourceCode.slice(startChar, endChar);
    }

    _isStringType (node) {
        if (!node) return false;
        const t = typeof node.toJSON === 'function' ? node.toJSON().type : null;
        return t === 'StringNode' ||
            t === 'InterpolatedStringNode' ||
            t === 'ConcatStringNode';
    }

    /**
     * Dispatch to _handleXxxNode handler, or fall back to walking children.
     * Uses node.toJSON().type (a stable string literal) instead of
     * node.constructor.name, which gets mangled by minification in production
     * builds (terser renames class names).
     * @param {object} node - prism AST node
     */
    _walkNode (node) {
        if (!node || typeof node !== 'object') return;
        const typeName = typeof node.toJSON === 'function' ? node.toJSON().type : null;
        if (!typeName) return;
        const handler = this[`_handle${typeName}`];
        if (handler) {
            handler.call(this, node);
        } else {
            this._walkChildren(node);
        }
    }

    /**
     * Walk all child nodes using prism's built-in childNodes() method.
     * @param {object} node - prism AST node
     */
    _walkChildren (node) {
        if (typeof node.childNodes === 'function') {
            node.childNodes().forEach(child => {
                if (child) this._walkNode(child);
            });
        }
    }

    // ---- Variables ----

    _handleLocalVariableWriteNode (node) {
        this._addAnnotation(node.nameLoc, `変数${node.name}`);
        this._addAnnotation(node.operatorLoc, '紐付ける');
        this._walkNode(node.value);
    }

    _handleLocalVariableReadNode (node) {
        this._addAnnotation(node.location, `変数${node.name}`);
    }

    _handleLocalVariableOperatorWriteNode (node) {
        this._addAnnotation(node.nameLoc, `変数${node.name}`);
        this._addAnnotation(node.binaryOperatorLoc, this._opAsgnLabel(node.binaryOperator, node.value));
        this._walkNode(node.value);
    }

    _handleInstanceVariableWriteNode (node) {
        // @name → インスタンス変数name (strip @)
        this._addAnnotation(node.nameLoc, `インスタンス変数${node.name.slice(1)}`);
        this._addAnnotation(node.operatorLoc, '紐付ける');
        this._walkNode(node.value);
    }

    _handleInstanceVariableReadNode (node) {
        this._addAnnotation(node.location, `インスタンス変数${node.name.slice(1)}`);
    }

    _handleInstanceVariableOperatorWriteNode (node) {
        this._addAnnotation(node.nameLoc, `インスタンス変数${node.name.slice(1)}`);
        this._addAnnotation(node.binaryOperatorLoc, this._opAsgnLabel(node.binaryOperator, node.value));
        this._walkNode(node.value);
    }

    _handleGlobalVariableWriteNode (node) {
        // $name → グローバル変数name (strip $)
        this._addAnnotation(node.nameLoc, `グローバル変数${node.name.slice(1)}`);
        this._addAnnotation(node.operatorLoc, '紐付ける');
        this._walkNode(node.value);
    }

    _handleGlobalVariableReadNode (node) {
        this._addAnnotation(node.location, `グローバル変数${node.name.slice(1)}`);
    }

    _handleGlobalVariableOperatorWriteNode (node) {
        this._addAnnotation(node.nameLoc, `グローバル変数${node.name.slice(1)}`);
        this._addAnnotation(node.binaryOperatorLoc, this._opAsgnLabel(node.binaryOperator, node.value));
        this._walkNode(node.value);
    }

    /**
     * Returns furigana label for operator-assignment (+=, -=, *=, etc.)
     * @param {string} binaryOperator - e.g. '+', '-', '*', '/', '%', '**'
     * @param {object} valueNode - prism AST node for the RHS
     */
    _opAsgnLabel (binaryOperator, valueNode) {
        switch (binaryOperator) {
        case '+':
            return this._isStringType(valueNode) ? 'と連結' : 'ずつ増やす';
        case '-':
            return 'ずつ減らす';
        case '*':
            return '倍にする';
        case '/':
            return '分の1にする';
        case '%':
            return '余りにする';
        case '**':
            return 'べき乗にする';
        default:
            return binaryOperator;
        }
    }

    // ---- Literals ----

    _handleIntegerNode (node) {
        const text = this._getSourceText(node.location);
        this._addAnnotation(node.location, `数値${text}`);
    }

    _handleFloatNode (node) {
        const text = this._getSourceText(node.location);
        this._addAnnotation(node.location, `数値${text}`);
    }

    _handleTrueNode (node) {
        this._addAnnotation(node.location, '真');
    }

    _handleFalseNode (node) {
        this._addAnnotation(node.location, '偽');
    }

    _handleStringNode (node) {
        // unescaped is an object { encoding, validEncoding, value } in this prism version
        const unescaped = node.unescaped;
        const content = (unescaped && typeof unescaped === 'object') ?
            unescaped.value : unescaped;
        this._addAnnotation(node.location, `文字列「${content}」`);
    }

    // ---- Method calls ----

    _handleCallNode (node) {
        const name = node.name;

        if (node.receiver) {
            // Method calls with receiver (operators, conversions, ...)
            switch (name) {
            case 'to_i':
                this._addAnnotation(node.messageLoc, '整数化');
                break;
            case 'to_f':
                this._addAnnotation(node.messageLoc, '浮動小数点数化');
                break;
            case 'to_s':
                this._addAnnotation(node.messageLoc, '文字列化');
                break;
            case '+':
                this._addAnnotation(
                    node.messageLoc,
                    this._isStringType(node.receiver) ? '連結' : '足す'
                );
                break;
            case '-':
                this._addAnnotation(node.messageLoc, '引く');
                break;
            case '*':
                this._addAnnotation(node.messageLoc, '掛ける');
                break;
            case '/':
                this._addAnnotation(node.messageLoc, '割る');
                break;
            case '%':
                this._addAnnotation(node.messageLoc, '余り');
                break;
            case '**':
                this._addAnnotation(node.messageLoc, 'べき乗');
                break;
            case '+@':
                this._addAnnotation(node.messageLoc, '正');
                break;
            case '-@':
                this._addAnnotation(node.messageLoc, '負');
                break;
            case '<=':
                this._addAnnotation(node.messageLoc, '以下');
                break;
            case '>=':
                this._addAnnotation(node.messageLoc, '以上');
                break;
            case '<':
                this._addAnnotation(node.messageLoc, '小さい');
                break;
            case '>':
                this._addAnnotation(node.messageLoc, '大きい');
                break;
            case '==':
                this._addAnnotation(node.messageLoc, '等しい');
                break;
            case '!=':
                this._addAnnotation(node.messageLoc, '等しくない');
                break;
            case '!':
                this._addAnnotation(node.messageLoc, 'ではない');
                break;
            default:
                break;
            }
        } else {
            // Top-level method calls (puts, gets, print, ...)
            switch (name) {
            case 'puts':
            case 'print':
                this._addAnnotation(node.messageLoc, '表示する');
                break;
            case 'gets':
                this._addAnnotation(node.messageLoc, '入力する');
                break;
            case 'wait':
                this._addAnnotation(node.messageLoc, '待つ');
                break;
            default:
                break;
            }
        }

        // Explicit child traversal
        if (node.receiver) this._walkNode(node.receiver);
        if (node.arguments_) {
            node.arguments_.arguments_.forEach(arg => this._walkNode(arg));
        }
        if (node.block) this._walkNode(node.block);
    }

    // ---- Control flow: if / elsif / else ----

    _handleIfNode (node) {
        const keyword = this._getSourceText(node.ifKeywordLoc);
        if (keyword === 'if') {
            this._addAnnotation(node.ifKeywordLoc, 'もし');
            // Only the outermost if adds 分岐終了 (elsif shares the same endKeywordLoc)
            if (node.endKeywordLoc) {
                this._addAnnotation(node.endKeywordLoc, '分岐終了');
            }
        } else if (keyword === 'elsif') {
            this._addAnnotation(node.ifKeywordLoc, 'ではなく');
        }
        this._walkNode(node.predicate);
        this._walkNode(node.statements);
        this._walkNode(node.subsequent);
    }

    _handleElseNode (node) {
        this._addAnnotation(node.elseKeywordLoc, 'でなければ');
        this._walkNode(node.statements);
    }

    // ---- Control flow: until ----

    _handleUntilNode (node) {
        this._addAnnotation(node.keywordLoc, 'まで繰り返す');
        if (node.closingLoc) {
            this._addAnnotation(node.closingLoc, 'ブロック終了');
        }
        this._walkNode(node.predicate);
        this._walkNode(node.statements);
    }

    // ---- Control flow: while ----

    _handleWhileNode (node) {
        this._addAnnotation(node.keywordLoc, '繰り返す');
        if (node.closingLoc) {
            this._addAnnotation(node.closingLoc, 'ブロック終了');
        }
        this._walkNode(node.predicate);
        this._walkNode(node.statements);
    }

    // ---- Method definition ----

    _handleDefNode (node) {
        this._addAnnotation(node.defKeywordLoc, 'メソッド作成');
        if (node.endKeywordLoc) {
            this._addAnnotation(node.endKeywordLoc, '作成終了');
        }
        if (node.parameters) this._walkNode(node.parameters);
        if (node.body) this._walkNode(node.body);
    }

    // ---- case / when ----

    _handleCaseNode (node) {
        this._addAnnotation(node.caseKeywordLoc, '状態分岐');
        if (node.endKeywordLoc) {
            this._addAnnotation(node.endKeywordLoc, '分岐終了');
        }
        if (node.predicate) this._walkNode(node.predicate);
        if (node.conditions) node.conditions.forEach(c => this._walkNode(c));
        if (node.elseClause) this._walkNode(node.elseClause);
    }

    _handleWhenNode (node) {
        this._addAnnotation(node.keywordLoc, 'のとき');
        if (node.conditions) node.conditions.forEach(c => this._walkNode(c));
        if (node.statements) this._walkNode(node.statements);
    }

    // ---- Logical operators ----

    _handleAndNode (node) {
        this._addAnnotation(node.operatorLoc, 'かつ');
        this._walkNode(node.left);
        this._walkNode(node.right);
    }

    _handleOrNode (node) {
        this._addAnnotation(node.operatorLoc, 'または');
        this._walkNode(node.left);
        this._walkNode(node.right);
    }
}

export default FuriganaAnnotator;
