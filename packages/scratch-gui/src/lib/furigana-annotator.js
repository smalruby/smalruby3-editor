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
        this._lineOffsets = this._buildLineOffsets(this._sourceCode);
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

    _buildLineOffsets (source) {
        const offsets = [0]; // line 1 starts at byte offset 0
        for (let i = 0; i < source.length; i++) {
            if (source[i] === '\n') {
                offsets.push(i + 1);
            }
        }
        return offsets;
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
        return {
            line: lo + 1, // 1-based
            column: byteOffset - offsets[lo] // 0-based byte offset from line start
        };
    }

    _addAnnotation (loc, label) {
        if (!loc) return;
        const {line, column} = this._locToLineCol(loc.startOffset);
        const endColumn = column + loc.length;
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
        return this._sourceCode.slice(loc.startOffset, loc.startOffset + loc.length);
    }

    _isStringType (node) {
        if (!node) return false;
        const name = node.constructor.name;
        return name === 'StringNode' ||
            name === 'InterpolatedStringNode' ||
            name === 'ConcatStringNode';
    }

    /**
     * Dispatch to _handleXxxNode handler, or fall back to walking children.
     * @param {object} node - prism AST node
     */
    _walkNode (node) {
        if (!node || typeof node !== 'object' || !node.constructor) return;
        const typeName = node.constructor.name;
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
        this._addAnnotation(node.operatorLoc, '紐付けろ');
        this._walkNode(node.value);
    }

    _handleLocalVariableReadNode (node) {
        this._addAnnotation(node.location, `変数${node.name}`);
    }

    _handleInstanceVariableWriteNode (node) {
        // @name → 変数name (strip @)
        this._addAnnotation(node.nameLoc, `変数${node.name.slice(1)}`);
        this._addAnnotation(node.operatorLoc, '紐付けろ');
        this._walkNode(node.value);
    }

    _handleInstanceVariableReadNode (node) {
        this._addAnnotation(node.location, `変数${node.name.slice(1)}`);
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
                this._addAnnotation(node.messageLoc, '表示しろ');
                break;
            case 'gets':
                this._addAnnotation(node.messageLoc, '入力文字列を取得');
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
            this._addAnnotation(node.ifKeywordLoc, 'もしも');
        } else if (keyword === 'elsif') {
            this._addAnnotation(node.ifKeywordLoc, 'そうではなく');
        }
        if (node.endKeywordLoc) {
            this._addAnnotation(node.endKeywordLoc, '分岐終了');
        }
        this._walkNode(node.predicate);
        this._walkNode(node.statements);
        this._walkNode(node.subsequent);
    }

    _handleElseNode (node) {
        this._addAnnotation(node.elseKeywordLoc, 'そうでなければ');
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
