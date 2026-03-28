// === Smalruby: This file is Smalruby-specific (furigana annotator) ===
import { callHelpers } from './furigana-call-helpers';
import {
    EXTENSION_HANDLER_MAP,
    EXTENSION_RECEIVER_LABELS,
    EXTENSION_STRING_MAPS,
    extensionHandlers,
} from './furigana-extension-handlers';
import {
    RECEIVER_METHOD_LABELS,
    TOPLEVEL_METHOD_LABELS,
    TOPLEVEL_PROPERTY_LABELS,
    METHOD_ARG_UNITS,
} from './furigana-label-map';
import { nodeHandlers } from './furigana-node-handlers';

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
    annotate(sourceCode, parseResult) {
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
     * @param {string} source - The Ruby source code.
     */
    _buildMappings(source) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(source);

        this._byteToChar = new Uint32Array(bytes.length + 1);
        let byteIdx = 0;
        let charIdx = 0;
        for (const codePoint of source) {
            const cpByteLen = encoder.encode(codePoint).length;
            for (let b = 0; b < cpByteLen; b++) {
                this._byteToChar[byteIdx + b] = charIdx;
            }
            byteIdx += cpByteLen;
            charIdx++;
        }
        this._byteToChar[byteIdx] = charIdx;

        this._lineOffsets = [0];
        for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] === 0x0a) {
                this._lineOffsets.push(i + 1);
            }
        }
    }

    _locToLineCol(byteOffset) {
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
        const column = this._byteToChar[byteOffset] - this._byteToChar[lineStartByte];
        return {
            line: lo + 1,
            column,
        };
    }

    /**
     * Location spanning from receiver start to messageLoc end (for self.xxx).
     * @param {object} node - A Prism CallNode.
     */
    _receiverSpanLoc(node) {
        if (!node.receiver || !node.receiver.location || !node.messageLoc) return node.messageLoc;
        const recLoc = node.receiver.location;
        return {
            startOffset: recLoc.startOffset,
            length: node.messageLoc.startOffset + node.messageLoc.length - recLoc.startOffset,
        };
    }

    _addAnnotation(loc, label) {
        if (!loc) return;
        const { line, column } = this._locToLineCol(loc.startOffset);
        const endByteOffset = loc.startOffset + loc.length;
        const lineStartByte = this._lineOffsets[line - 1];
        const endColumn =
            this._byteToChar[Math.min(endByteOffset, this._byteToChar.length - 1)] - this._byteToChar[lineStartByte];
        if (!this._annotations.has(line)) {
            this._annotations.set(line, []);
        }
        this._annotations.get(line).push({
            startColumn: column,
            endColumn,
            label,
        });
    }

    _getSourceText(loc) {
        if (!loc) return '';
        const startChar = this._byteToChar[loc.startOffset];
        const endByte = Math.min(loc.startOffset + loc.length, this._byteToChar.length - 1);
        const endChar = this._byteToChar[endByte];
        return this._sourceCode.slice(startChar, endChar);
    }

    _isStringType(node) {
        if (!node) return false;
        const t = typeof node.toJSON === 'function' ? node.toJSON().type : null;
        return t === 'StringNode' || t === 'InterpolatedStringNode' || t === 'ConcatStringNode';
    }

    /**
     * Dispatch to _handleXxxNode or fall back to walking children.
     * @param {object} node - A Prism AST node.
     */
    _walkNode(node) {
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

    _walkChildren(node) {
        if (typeof node.childNodes === 'function') {
            node.childNodes().forEach(child => {
                if (child) this._walkNode(child);
            });
        }
    }

    // ---- Method calls ----

    _handleCallNode(node) {
        const name = node.name;

        if (node.receiver) {
            const receiverType = typeof node.receiver.toJSON === 'function' ? node.receiver.toJSON().type : null;
            const receiverName = receiverType === 'ConstantReadNode' ? node.receiver.name : null;

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
            } else if (receiverType === 'CallNode' || receiverType === 'LocalVariableReadNode') {
                const innerName = node.receiver.name;
                const innerRec = node.receiver.receiver;

                // Predefined extension receiver dispatch (pen.xxx, face_sensing.xxx, etc.)
                if (!innerRec && EXTENSION_HANDLER_MAP[innerName]) {
                    this[EXTENSION_HANDLER_MAP[innerName]](node, name);
                } else if (receiverType === 'CallNode' && innerName === 'now') {
                    // Time.now.xxx chained call
                    const innerRecType =
                        innerRec && typeof innerRec.toJSON === 'function' ? innerRec.toJSON().type : null;
                    if (innerRecType === 'ConstantReadNode' && innerRec.name === 'Time') {
                        this._annotateTimeNowMethod(node, name);
                    }
                }
            } else if (receiverType === 'SelfNode') {
                this._annotateSelfSetter(node, name);
            }

            // ---- Operators and conversions (any receiver) ----
            if (name === '+') {
                this._addAnnotation(node.messageLoc, this._isStringType(node.receiver) ? '連結' : '足す');
            } else if (RECEIVER_METHOD_LABELS[name]) {
                this._addAnnotation(node.messageLoc, RECEIVER_METHOD_LABELS[name]);
            }
        } else if (TOPLEVEL_METHOD_LABELS[name]) {
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
        } else if (EXTENSION_RECEIVER_LABELS[name]) {
            this._addAnnotation(node.messageLoc || node.location, EXTENSION_RECEIVER_LABELS[name]);
        }

        // Set unit context for literal arguments
        const methodUnit = METHOD_ARG_UNITS[name];

        // Annotate do...end block keywords
        if (node.block) {
            const block = node.block;
            const blockType = typeof block.toJSON === 'function' ? block.toJSON().type : null;
            if (blockType === 'BlockNode') {
                if (block.openingLoc) {
                    this._addAnnotation(block.openingLoc, '以下の処理');
                }
                const isRepeat = name === 'loop' || name === 'times';
                if (block.closingLoc) {
                    this._addAnnotation(block.closingLoc, isRepeat ? '繰り返し終了' : 'ブロック終了');
                }
            }
        }

        // Explicit child traversal
        if (node.receiver) this._walkNode(node.receiver);

        // Set context-specific string label map for extension args
        this._setExtensionStringMap(node, name);

        if (node.arguments_) {
            if (methodUnit) this._argUnit = methodUnit;
            node.arguments_.arguments_.forEach(arg => this._walkNode(arg));
            if (methodUnit) this._argUnit = null;
        }
        if (this._stringLabelMap) this._stringLabelMap = null;
        if (node.block) this._walkNode(node.block);
    }
}

// Mix in handler methods from separate modules
Object.assign(FuriganaAnnotator.prototype, nodeHandlers, callHelpers, extensionHandlers);

export default FuriganaAnnotator;
