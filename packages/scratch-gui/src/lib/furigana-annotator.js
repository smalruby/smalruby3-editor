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
        const specialLabel = FuriganaAnnotator._SPECIAL_STRING_LABELS[content];
        this._addAnnotation(node.location, specialLabel || `文字列「${content}」`);
    }

    // ---- Method calls ----

    _handleCallNode (node) {
        const name = node.name;

        if (node.receiver) {
            // Method calls with receiver
            const receiverType = typeof node.receiver.toJSON === 'function' ?
                node.receiver.toJSON().type : null;
            const receiverName = (receiverType === 'ConstantReadNode') ?
                node.receiver.name : null;

            // ---- Constant-receiver class methods ----
            if (receiverType === 'ConstantReadNode') {
                switch (receiverName) {
                case 'Keyboard':
                    if (name === 'pressed?') {
                        this._addAnnotation(node.messageLoc, 'キーが押されているか');
                    }
                    break;
                case 'Mouse':
                    if (name === 'down?') {
                        this._addAnnotation(node.messageLoc, 'マウスが押されているか');
                    } else if (name === 'x') {
                        this._addAnnotation(node.messageLoc, 'マウスのX座標');
                    } else if (name === 'y') {
                        this._addAnnotation(node.messageLoc, 'マウスのY座標');
                    }
                    break;
                case 'Timer':
                    if (name === 'value') {
                        this._addAnnotation(node.messageLoc, 'タイマー');
                    } else if (name === 'reset') {
                        this._addAnnotation(node.messageLoc, 'タイマーをリセット');
                    }
                    break;
                case 'Pen':
                    if (name === 'clear') {
                        this._addAnnotation(node.messageLoc, '全消去');
                    }
                    break;
                case 'Math':
                    this._annotateMathMethod(node, name);
                    break;
                default:
                    break;
                }
            } else if (receiverType === 'CallNode') {
                // ---- Chained calls: Time.now.xxx ----
                const innerReceiver = node.receiver;
                const innerReceiverType = typeof innerReceiver.toJSON === 'function' ?
                    innerReceiver.toJSON().type : null;
                // Check if it's Time.now chain: outer.name is year/month/etc,
                // node.receiver is CallNode(name=now, receiver=ConstantReadNode(Time))
                const innerName = node.receiver.name;
                if (innerName === 'now') {
                    const innerRec = node.receiver.receiver;
                    const innerRecType = innerRec && typeof innerRec.toJSON === 'function' ?
                        innerRec.toJSON().type : null;
                    if (innerRecType === 'ConstantReadNode' && innerRec.name === 'Time') {
                        this._annotateTimeNowMethod(node, name);
                    }
                }
            } else if (receiverType === 'SelfNode') {
                // ---- self.attr = value ----
                this._annotateSelfSetter(node, name);
            } else if (receiverType === 'LocalVariableReadNode' && node.receiver.name === 'pen') {
                // ---- pen.xxx ----
                this._annotatePenMethod(node, name);
            }

            // ---- Operators and conversions (any receiver) ----
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
            // ---- Numeric / String methods ----
            case 'round':
                this._addAnnotation(node.messageLoc, '四捨五入');
                break;
            case 'abs':
                this._addAnnotation(node.messageLoc, '絶対値');
                break;
            case 'floor':
                this._addAnnotation(node.messageLoc, '切り捨て');
                break;
            case 'ceil':
                this._addAnnotation(node.messageLoc, '切り上げ');
                break;
            case 'length':
                this._addAnnotation(node.messageLoc, '長さ');
                break;
            case 'include?':
                this._addAnnotation(node.messageLoc, '含むか');
                break;
            // ---- Control ----
            case 'times':
                this._addAnnotation(node.messageLoc, '回繰り返す');
                break;
            // ---- List operations ----
            case 'push':
                this._addAnnotation(node.messageLoc, '追加する');
                break;
            case 'delete_at':
                this._addAnnotation(node.messageLoc, '削除する');
                break;
            case 'insert':
                this._addAnnotation(node.messageLoc, '挿入する');
                break;
            case 'index':
                this._addAnnotation(node.messageLoc, '検索する');
                break;
            case 'clear':
                this._addAnnotation(node.messageLoc, '全削除する');
                break;
            default:
                break;
            }
        } else {
            // Top-level method calls (no receiver)
            switch (name) {
            // ---- Standard I/O (legacy) ----
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
            // ---- Motion ----
            case 'move':
                this._addAnnotation(node.messageLoc, '動かす');
                break;
            case 'turn_right':
                this._addAnnotation(node.messageLoc, '右に回す');
                break;
            case 'turn_left':
                this._addAnnotation(node.messageLoc, '左に回す');
                break;
            case 'go_to':
                this._addAnnotation(node.messageLoc, '移動する');
                break;
            case 'glide':
                this._annotateGlide(node);
                break;
            case 'point_towards':
                this._addAnnotation(node.messageLoc, '向く');
                break;
            case 'bounce_if_on_edge':
                this._addAnnotation(node.messageLoc, '端で跳ね返る');
                break;
            // ---- Motion property getters ----
            case 'x':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, 'X座標');
                break;
            case 'y':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, 'Y座標');
                break;
            case 'direction':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, '向き');
                break;
            // ---- Looks ----
            case 'say':
                this._addAnnotation(node.messageLoc, '言う');
                break;
            case 'think':
                this._addAnnotation(node.messageLoc, '考える');
                break;
            case 'switch_costume':
                this._addAnnotation(node.messageLoc, 'コスチュームにする');
                break;
            case 'next_costume':
                this._addAnnotation(node.messageLoc, '次のコスチュームにする');
                break;
            case 'switch_backdrop':
                this._addAnnotation(node.messageLoc, '背景にする');
                break;
            case 'switch_backdrop_and_wait':
                this._addAnnotation(node.messageLoc, '背景にして待つ');
                break;
            case 'next_backdrop':
                this._addAnnotation(node.messageLoc, '次の背景にする');
                break;
            case 'set_effect':
                this._addAnnotation(node.messageLoc, '画像効果を設定');
                break;
            case 'change_effect_by':
                this._addAnnotation(node.messageLoc, '画像効果を変える');
                break;
            case 'clear_graphic_effects':
                this._addAnnotation(node.messageLoc, '画像効果をなくす');
                break;
            case 'show':
                this._addAnnotation(node.messageLoc, '表示する');
                break;
            case 'hide':
                this._addAnnotation(node.messageLoc, '隠す');
                break;
            case 'go_to_layer':
                this._annotateGoToLayer(node);
                break;
            case 'go_layers':
                this._annotateGoLayers(node);
                break;
            // ---- Looks property getters ----
            case 'costume_number':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, 'コスチューム番号');
                break;
            case 'costume_name':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, 'コスチューム名');
                break;
            case 'backdrop_number':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, '背景番号');
                break;
            case 'backdrop_name':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, '背景名');
                break;
            case 'size':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, '大きさ');
                break;
            // ---- Sound ----
            case 'play':
                this._addAnnotation(node.messageLoc, '音を鳴らす');
                break;
            case 'play_until_done':
                this._addAnnotation(node.messageLoc, '音が終わるまで鳴らす');
                break;
            case 'stop_all_sounds':
                this._addAnnotation(node.messageLoc, '音をすべて止める');
                break;
            case 'change_sound_effect_by':
                this._addAnnotation(node.messageLoc, '音の効果を変える');
                break;
            case 'set_sound_effect':
                this._addAnnotation(node.messageLoc, '音の効果を設定');
                break;
            case 'clear_sound_effects':
                this._addAnnotation(node.messageLoc, '音の効果をなくす');
                break;
            case 'volume':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, '音量');
                break;
            // ---- Events ----
            case 'when_flag_clicked':
                this._addAnnotation(node.messageLoc, '旗が押されたとき');
                break;
            case 'when_key_pressed':
                this._addAnnotation(node.messageLoc, 'キーが押されたとき');
                break;
            case 'when_clicked':
                this._addAnnotation(node.messageLoc, 'クリックされたとき');
                break;
            case 'when_backdrop_switches':
                this._addAnnotation(node.messageLoc, '背景が切り替わったとき');
                break;
            case 'when_greater_than':
                this._annotateWhenGreaterThan(node);
                break;
            case 'when_receive':
                this._addAnnotation(node.messageLoc, '受け取ったとき');
                break;
            case 'broadcast':
                this._addAnnotation(node.messageLoc, '送る');
                break;
            case 'broadcast_and_wait':
                this._addAnnotation(node.messageLoc, '送って待つ');
                break;
            // ---- Control ----
            case 'sleep':
                this._addAnnotation(node.messageLoc, '秒待つ');
                break;
            case 'loop':
                this._addAnnotation(node.messageLoc, 'ずっと繰り返す');
                break;
            case 'stop':
                this._addAnnotation(node.messageLoc, '止める');
                break;
            case 'create_clone':
                this._addAnnotation(node.messageLoc, 'クローンを作る');
                break;
            case 'delete_this_clone':
                this._addAnnotation(node.messageLoc, 'このクローンを削除');
                break;
            case 'when_start_as_a_clone':
                this._addAnnotation(node.messageLoc, 'クローンされたとき');
                break;
            // ---- Sensing ----
            case 'touching?':
                this._addAnnotation(node.messageLoc, '触れているか');
                break;
            case 'touching_color?':
                this._addAnnotation(node.messageLoc, '色に触れているか');
                break;
            case 'color_is_touching_color?':
                this._addAnnotation(node.messageLoc, '色が色に触れているか');
                break;
            case 'distance':
                this._addAnnotation(node.messageLoc, '距離');
                break;
            case 'ask':
                this._addAnnotation(node.messageLoc, '質問する');
                break;
            case 'answer':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, '答え');
                break;
            case 'loudness':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, 'マイクの音量');
                break;
            case 'days_since_2000':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, '2000年からの日数');
                break;
            case 'user_name':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, 'ユーザー名');
                break;
            // ---- Operators ----
            case 'rand':
                this._addAnnotation(node.messageLoc, '乱数');
                break;
            // ---- Data ----
            case 'show_variable':
                this._addAnnotation(node.messageLoc, '変数を表示');
                break;
            case 'hide_variable':
                this._addAnnotation(node.messageLoc, '変数を隠す');
                break;
            case 'show_list':
                this._addAnnotation(node.messageLoc, 'リストを表示');
                break;
            case 'hide_list':
                this._addAnnotation(node.messageLoc, 'リストを隠す');
                break;
            // ---- Music ----
            case 'play_drum':
                this._addAnnotation(node.messageLoc, 'ドラムを鳴らす');
                break;
            case 'rest':
                this._annotateRest(node);
                break;
            case 'play_note':
                this._addAnnotation(node.messageLoc, '音符を鳴らす');
                break;
            case 'tempo':
                if (!node.arguments_) this._addAnnotation(node.messageLoc, 'テンポ');
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

    // ---- Dynamic label helpers ----

    /**
     * Returns the string value of the Nth positional argument, or null.
     * @param {object} callNode
     * @param {number} index - 0-based
     */
    _getArgStringValue (callNode, index) {
        const args = callNode.arguments_ && callNode.arguments_.arguments_;
        if (!args || !args[index]) return null;
        const arg = args[index];
        const type = typeof arg.toJSON === 'function' ? arg.toJSON().type : null;
        if (type === 'StringNode') {
            const u = arg.unescaped;
            return (u && typeof u === 'object') ? u.value : u;
        }
        return null;
    }

    /**
     * Returns the source text of the Nth positional argument, or null.
     * @param {object} callNode
     * @param {number} index - 0-based
     */
    _getArgSourceText (callNode, index) {
        const args = callNode.arguments_ && callNode.arguments_.arguments_;
        if (!args || !args[index]) return null;
        return this._getSourceText(args[index].location);
    }

    /**
     * Returns the source text of a keyword argument value by key name, or null.
     * Handles `method(key: value)` style keyword arguments.
     * @param {object} callNode
     * @param {string} key - keyword argument name (e.g. 'secs')
     */
    _getKwargSourceText (callNode, key) {
        const args = callNode.arguments_ && callNode.arguments_.arguments_;
        if (!args) return null;
        for (const arg of args) {
            const type = typeof arg.toJSON === 'function' ? arg.toJSON().type : null;
            if (type === 'KeywordHashNode') {
                // Use childNodes() since .elements may not be directly accessible
                if (typeof arg.childNodes !== 'function') continue;
                for (const assocNode of arg.childNodes()) {
                    if (!assocNode) continue;
                    const assocType = typeof assocNode.toJSON === 'function' ?
                        assocNode.toJSON().type : null;
                    if (assocType === 'AssocNode') {
                        // key is a SymbolNode; use valueLoc for "secs" part of "secs: 1"
                        const keyNode = assocNode.key;
                        if (!keyNode) continue;
                        const keyJ = typeof keyNode.toJSON === 'function' ? keyNode.toJSON() : null;
                        const keyLoc = keyJ && (keyJ.valueLoc || keyJ.location);
                        const keyText = this._getSourceText(keyLoc);
                        if (keyText === key && assocNode.value) {
                            return this._getSourceText(assocNode.value.location);
                        }
                    }
                }
            }
        }
        return null;
    }

    _annotateMathMethod (node, name) {
        const mathLabels = {
            sqrt: '平方根',
            sin: 'sin',
            cos: 'cos',
            tan: 'tan',
            asin: 'asin',
            acos: 'acos',
            atan: 'atan',
            log: 'ln',
            log10: 'log'
        };
        const label = mathLabels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    }

    _annotateTimeNowMethod (node, name) {
        const timeLabels = {
            year: '今の年',
            month: '今の月',
            day: '今の日',
            hour: '今の時',
            min: '今の分',
            sec: '今の秒',
            wday: '今の曜日'
        };
        const label = timeLabels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    }

    _annotateSelfSetter (node, name) {
        // name ends with '=' for assignments like self.x = n
        const selfSetterLabels = {
            'x=': 'X座標を設定',
            'y=': 'Y座標を設定',
            'direction=': '向きを設定',
            'size=': '大きさを設定',
            'volume=': '音量を設定',
            'rotation_style=': '回転スタイルを設定',
            'instrument=': '楽器を設定',
            'tempo=': 'テンポを設定',
            'drag_mode=': 'ドラッグモードを設定'
        };
        const label = selfSetterLabels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    }

    _annotatePenMethod (node, name) {
        const penLabels = {
            'stamp': 'スタンプ',
            'down': 'ペンを下ろす',
            'up': 'ペンを上げる',
            'size=': 'ペンの太さを設定',
            'color=': 'ペンの色を設定',
            'saturation=': '彩度を設定',
            'brightness=': '明るさを設定',
            'transparency=': '透明度を設定'
        };
        const label = penLabels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    }

    _annotateGlide (node) {
        const secs = this._getKwargSourceText(node, 'secs');
        const firstArg = node.arguments_ && node.arguments_.arguments_ && node.arguments_.arguments_[0];
        let xText = null;
        let yText = null;
        if (firstArg) {
            const type = typeof firstArg.toJSON === 'function' ? firstArg.toJSON().type : null;
            if (type === 'ArrayNode' && firstArg.elements && firstArg.elements.length >= 2) {
                xText = this._getSourceText(firstArg.elements[0].location);
                yText = this._getSourceText(firstArg.elements[1].location);
            }
        }
        if (secs !== null && xText !== null && yText !== null) {
            this._addAnnotation(node.messageLoc, `${secs}秒でx座標を${xText}に、y座標を${yText}に変える`);
        } else {
            this._addAnnotation(node.messageLoc, 'なめらかに移動する');
        }
    }

    _annotateGoToLayer (node) {
        const layer = this._getArgStringValue(node, 0);
        if (layer === 'front') {
            this._addAnnotation(node.messageLoc, '最前面へ移動する');
        } else if (layer === 'back') {
            this._addAnnotation(node.messageLoc, '最背面へ移動する');
        } else {
            this._addAnnotation(node.messageLoc, 'レイヤーへ移動する');
        }
    }

    _annotateGoLayers (node) {
        const n = this._getArgSourceText(node, 0);
        const dir = this._getArgStringValue(node, 1);
        const nLabel = n === null ? 'n' : n;
        if (dir === 'forward') {
            this._addAnnotation(node.messageLoc, `${nLabel}層手前に出す`);
        } else if (dir === 'backward') {
            this._addAnnotation(node.messageLoc, `${nLabel}層奥に下げる`);
        } else {
            this._addAnnotation(node.messageLoc, 'レイヤーを移動する');
        }
    }

    _annotateWhenGreaterThan (node) {
        const kind = this._getArgStringValue(node, 0);
        const val = this._getArgSourceText(node, 1);
        const kindLabel = kind === 'LOUDNESS' ? '音量' : kind === 'TIMER' ? 'タイマー' : kind || '値';
        const valLabel = val === null ? '' : val;
        this._addAnnotation(node.messageLoc, `${kindLabel} > ${valLabel} のとき`);
    }

    _annotateRest (node) {
        const beats = this._getArgSourceText(node, 0);
        const beatsLabel = beats === null ? 'n' : beats;
        this._addAnnotation(node.messageLoc, `${beatsLabel}拍休む`);
    }

    // ---- self.attr += n (CallOperatorWriteNode) ----

    _handleCallOperatorWriteNode (node) {
        const receiverType = node.receiver && typeof node.receiver.toJSON === 'function' ?
            node.receiver.toJSON().type : null;
        const attrName = node.readName; // e.g. "x" for self.x += 10

        if (receiverType === 'SelfNode') {
            const selfOpLabels = {
                x: 'X座標を変える',
                y: 'Y座標を変える',
                size: '大きさを変える',
                volume: '音量を変える',
                tempo: 'テンポを変える'
            };
            const label = selfOpLabels[attrName];
            if (label) this._addAnnotation(node.messageLoc, label);
        } else if (receiverType === 'LocalVariableReadNode' && node.receiver.name === 'pen') {
            const penOpLabels = {
                size: 'ペンの太さを変える',
                color: 'ペンの色を変える'
            };
            const label = penOpLabels[attrName];
            if (label) this._addAnnotation(node.messageLoc, label);
        }
        if (node.receiver) this._walkNode(node.receiver);
        if (node.value) this._walkNode(node.value);
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
        if (node.nameLoc) {
            this._addAnnotation(node.nameLoc, `${node.name}という名前`);
        }
        if (node.endKeywordLoc) {
            this._addAnnotation(node.endKeywordLoc, '作成終了');
        }
        if (node.parameters) this._walkNode(node.parameters);
        if (node.body) this._walkNode(node.body);
    }

    _handleRequiredParameterNode (node) {
        this._addAnnotation(node.location, `引数${node.name}`);
    }

    _handleOptionalParameterNode (node) {
        this._addAnnotation(node.nameLoc || node.location, `引数${node.name}`);
        this._walkNode(node.value);
    }

    // ---- return ----

    _handleReturnNode (node) {
        this._addAnnotation(node.keywordLoc, '呼び出し元に返す');
        this._walkChildren(node);
    }

    // ---- class definition ----

    _handleClassNode (node) {
        this._addAnnotation(node.classKeywordLoc, 'クラス作成');
        if (node.endKeywordLoc) {
            this._addAnnotation(node.endKeywordLoc, '作成終了');
        }
        this._walkChildren(node);
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

/**
 * Special string values used in smalruby that represent UI menu options.
 * These are displayed with descriptive Japanese labels instead of raw 文字列「...」.
 */
FuriganaAnnotator._SPECIAL_STRING_LABELS = {
    /* eslint-disable quote-props */
    '_mouse_': 'マウスのポインター',
    '_edge_': '端',
    '_random_': 'ランダムな場所',
    '_myself_': '自分自身'
    /* eslint-enable quote-props */
};

export default FuriganaAnnotator;
