import {
    RECEIVER_METHOD_LABELS,
    TOPLEVEL_METHOD_LABELS,
    TOPLEVEL_PROPERTY_LABELS
} from './furigana-label-map';

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
     * @param source
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

    /**
     * Create a location spanning from the receiver's start to messageLoc's end.
     * Used for self.xxx so furigana starts above "self." instead of just "xxx".
     * @param node
     */
    _receiverSpanLoc (node) {
        if (!node.receiver || !node.receiver.location || !node.messageLoc) return node.messageLoc;
        const recLoc = node.receiver.location;
        return {
            startOffset: recLoc.startOffset,
            length: (node.messageLoc.startOffset + node.messageLoc.length) - recLoc.startOffset
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
        if (this._argUnit) {
            this._addAnnotation(node.location, `${text}${this._argUnit}`);
        } else {
            this._addAnnotation(node.location, `数値${text}`);
        }
    }

    _handleFloatNode (node) {
        const text = this._getSourceText(node.location);
        if (this._argUnit) {
            this._addAnnotation(node.location, `${text}${this._argUnit}`);
        } else {
            this._addAnnotation(node.location, `数値${text}`);
        }
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
        // Check context-specific string label map first (e.g., face_sensing PART/DIRECTION)
        if (this._stringLabelMap && this._stringLabelMap[content]) {
            this._addAnnotation(node.location, this._stringLabelMap[content]);
            return;
        }
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
                const innerName = node.receiver.name;
                const innerRec = node.receiver.receiver;

                if (!innerRec && innerName === 'pen') {
                    // ---- pen.xxx (predefined extension receiver) ----
                    this._annotatePenMethod(node, name);
                } else if (!innerRec && innerName === 'face_sensing') {
                    // ---- face_sensing.xxx (predefined extension receiver) ----
                    this._annotateFaceSensingMethod(node, name);
                } else if (innerName === 'now') {
                    // ---- Chained calls: Time.now.xxx ----
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
            } else if (receiverType === 'LocalVariableReadNode' && node.receiver.name === 'face_sensing') {
                // ---- face_sensing.xxx ----
                this._annotateFaceSensingMethod(node, name);
            }

            // ---- Operators and conversions (any receiver) ----
            if (name === '+') {
                this._addAnnotation(
                    node.messageLoc,
                    this._isStringType(node.receiver) ? '連結' : '足す'
                );
            } else if (RECEIVER_METHOD_LABELS[name]) {
                this._addAnnotation(node.messageLoc, RECEIVER_METHOD_LABELS[name]);
            }
        } else if (TOPLEVEL_METHOD_LABELS[name]) {
            // Top-level method calls (no receiver)
            this._addAnnotation(node.messageLoc, TOPLEVEL_METHOD_LABELS[name]);
        } else if (!node.arguments_ && TOPLEVEL_PROPERTY_LABELS[name]) {
            this._addAnnotation(node.messageLoc, TOPLEVEL_PROPERTY_LABELS[name]);
        } else if (name === 'glide') {
            this._annotateGlide(node);
        } else if (name === 'go_to_layer') {
            this._annotateGoToLayer(node);
        } else if (name === 'go_layers') {
            this._annotateGoLayers(node);
        } else if (name === 'when_greater_than') {
            this._annotateWhenGreaterThan(node);
        } else if (name === 'rest') {
            this._annotateRest(node);
        } else if (name === 'pen') {
            this._addAnnotation(node.messageLoc || node.location, 'ペン');
        } else if (name === 'face_sensing') {
            this._addAnnotation(node.messageLoc || node.location, '顔認識');
        }

        // Set unit context for literal arguments of specific methods
        const methodUnit = FuriganaAnnotator._METHOD_ARG_UNITS[name];

        // Annotate do...end block keywords
        if (node.block) {
            const block = node.block;
            const blockType = typeof block.toJSON === 'function' ? block.toJSON().type : null;
            if (blockType === 'BlockNode') {
                if (block.openingLoc) {
                    this._addAnnotation(block.openingLoc, '以下の処理');
                }
                // loop / times → 繰り返し終了, others → ブロック終了
                const isRepeat = name === 'loop' || name === 'times';
                if (block.closingLoc) {
                    this._addAnnotation(block.closingLoc, isRepeat ? '繰り返し終了' : 'ブロック終了');
                }
            }
        }

        // Explicit child traversal
        if (node.receiver) this._walkNode(node.receiver);

        // Set context-specific string label map for face_sensing PART/DIRECTION args
        const fsStringMap = FuriganaAnnotator._FACE_SENSING_STRING_MAP[name];
        if (fsStringMap && this._isPredefinedReceiver(node, 'face_sensing')) {
            this._stringLabelMap = fsStringMap;
        }

        if (node.arguments_) {
            if (methodUnit) this._argUnit = methodUnit;
            node.arguments_.arguments_.forEach(arg => this._walkNode(arg));
            if (methodUnit) this._argUnit = null;
        }
        if (this._stringLabelMap) this._stringLabelMap = null;
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
        if (label) this._addAnnotation(this._receiverSpanLoc(node), label);
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

    /**
     * Check if a node's receiver is a predefined extension name (e.g. 'pen', 'face_sensing').
     * Handles both LocalVariableReadNode (variable defined) and CallNode (no definition).
     */
    _isPredefinedReceiver (node, extensionName) {
        if (!node.receiver) return false;
        const recType = typeof node.receiver.toJSON === 'function' ?
            node.receiver.toJSON().type : null;
        if (recType === 'LocalVariableReadNode' && node.receiver.name === extensionName) return true;
        if (recType === 'CallNode' && !node.receiver.receiver && node.receiver.name === extensionName) {
            return true;
        }
        return false;
    }

    _annotateFaceSensingMethod (node, name) {
        const faceSensingLabels = {
            'go_to': '行く',
            'point_in_direction_of_face_tilt': '顔の傾きの方向を向く',
            'set_size_to_face_size': '大きさを顔の大きさにする',
            'when_face_tilted': '顔が傾いたとき',
            'when_this_sprite_touch': '触れたとき',
            'when_face_detected': '顔が見つかったとき',
            'face_detected?': '顔が見つかった',
            'face_tilt': '顔の傾き',
            'face_size': '顔の大きさ'
        };
        const fsLabel = faceSensingLabels[name];
        if (fsLabel) this._addAnnotation(node.messageLoc, fsLabel);

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
            if (attrName === 'direction') {
                const dirLabel = node.binaryOperator === '-' ?
                    '反時計回りに回す' : '時計回りに回す';
                this._addAnnotation(this._receiverSpanLoc(node), dirLabel);
            }
            const selfOpLabels = {
                x: 'X座標を変える',
                y: 'Y座標を変える',
                size: '大きさを変える',
                volume: '音量を変える',
                tempo: 'テンポを変える'
            };
            const label = selfOpLabels[attrName];
            if (label) this._addAnnotation(this._receiverSpanLoc(node), label);
        } else if (this._isPredefinedReceiver(node, 'pen')) {
            const penOpLabels = {
                size: 'ペンの太さを変える',
                color: 'ペンの色を変える'
            };
            const label = penOpLabels[attrName];
            if (label) this._addAnnotation(node.messageLoc, label);
        }
        if (node.receiver) this._walkNode(node.receiver);
        // Set unit context for self.direction +=/-= value
        if (receiverType === 'SelfNode' && attrName === 'direction') {
            this._argUnit = '度';
        }
        if (node.value) this._walkNode(node.value);
        this._argUnit = null;
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
            this._addAnnotation(node.closingLoc, '繰り返し終了');
        }
        this._walkNode(node.predicate);
        this._walkNode(node.statements);
    }

    // ---- Control flow: while ----

    _handleWhileNode (node) {
        this._addAnnotation(node.keywordLoc, '真である限り繰り返す');
        if (node.closingLoc) {
            this._addAnnotation(node.closingLoc, '繰り返し終了');
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
 * Labels are sourced from scratch-l10n editor/blocks/ja.json.
 */
/**
 * Methods whose literal arguments should use a unit suffix instead of 数値/文字列.
 * e.g. move(10) → 「10歩」 instead of 「数値10」
 */
FuriganaAnnotator._METHOD_ARG_UNITS = {
    move: '歩',
    turn_right: '度',
    turn_left: '度',
    sleep: '秒'
};

FuriganaAnnotator._SPECIAL_STRING_LABELS = {
    // Special sprite/location targets
    '_mouse_': 'マウスのポインター',
    '_edge_': '端',
    '_random_': 'ランダムな場所',
    '_myself_': '自分自身',
    // Key names (EVENT_WHENKEYPRESSED_*)
    'space': 'スペース',
    'left arrow': '左向き矢印',
    'right arrow': '右向き矢印',
    'down arrow': '下向き矢印',
    'up arrow': '上向き矢印',
    'any': 'どれかのキー',
    // Stop options (CONTROL_STOP_*)
    'all': 'すべて',
    'this script': 'このスクリプト',
    'other scripts in sprite': 'スプライトの他のスクリプト',
    // Rotation styles (MOTION_SETROTATIONSTYLE_*)
    'all around': '自由に回転',
    'left-right': '左右のみ',
    "don't rotate": '回転しない',
    // Drag modes (SENSING_SETDRAGMODE_*)
    'draggable': 'できる',
    'not draggable': 'できない',
    // Sound effects (SOUND_EFFECTS_*)
    'PITCH': 'ピッチ',
    'PAN': '左右にパン',
    // Graphic effects (LOOKS_EFFECT_*)
    'color': '色',
    'fisheye': '魚眼レンズ',
    'whirl': '渦巻き',
    'pixelate': 'ピクセル化',
    'mosaic': 'モザイク',
    'brightness': '明るさ',
    'ghost': '幽霊'
};

/**
 * Maps face_sensing method names to their context-specific string label maps.
 * Only methods with PART or DIRECTION arguments are listed.
 */
FuriganaAnnotator._FACE_SENSING_STRING_MAP = {
    go_to: null, // set below after PART_LABELS defined
    when_this_sprite_touch: null,
    when_face_tilted: null
};

/**
 * Context-specific string labels for face_sensing PART menu arguments.
 * Used via _stringLabelMap to avoid polluting global _SPECIAL_STRING_LABELS.
 */
FuriganaAnnotator._FACE_SENSING_PART_LABELS = {
    nose: '鼻',
    mouth: '口',
    left_eye: '左目',
    right_eye: '右目',
    between_eyes: '両目の間',
    left_ear: '左耳',
    right_ear: '右耳',
    top_of_head: '頭のてっぺん'
};

/**
 * Context-specific string labels for face_sensing DIRECTION menu arguments.
 */
FuriganaAnnotator._FACE_SENSING_DIRECTION_LABELS = {
    left: '左',
    right: '右'
};

// Wire up the string map references after definitions
FuriganaAnnotator._FACE_SENSING_STRING_MAP.go_to = FuriganaAnnotator._FACE_SENSING_PART_LABELS;
FuriganaAnnotator._FACE_SENSING_STRING_MAP.when_this_sprite_touch = FuriganaAnnotator._FACE_SENSING_PART_LABELS;
FuriganaAnnotator._FACE_SENSING_STRING_MAP.when_face_tilted = FuriganaAnnotator._FACE_SENSING_DIRECTION_LABELS;

export default FuriganaAnnotator;
