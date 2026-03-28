// === Smalruby: This file is Smalruby-specific (furigana call helpers) ===
import { EXTENSION_STRING_MAPS } from './furigana-extension-handlers';
import { FACE_SENSING_STRING_MAP } from './furigana-label-map';

/**
 * Call-related helper methods for FuriganaAnnotator.
 * Covers: argument extraction, method-specific annotations,
 * extension handler methods, and CallOperatorWriteNode.
 * These are mixed into FuriganaAnnotator.prototype via Object.assign.
 */
const callHelpers = {
    // ---- Argument extraction helpers ----

    /**
     * Returns the string value of the Nth positional argument, or null.
     * @param {object} callNode
     * @param {number} index - 0-based
     */
    _getArgStringValue(callNode, index) {
        const args = callNode.arguments_ && callNode.arguments_.arguments_;
        if (!args || !args[index]) return null;
        const arg = args[index];
        const type = typeof arg.toJSON === 'function' ? arg.toJSON().type : null;
        if (type === 'StringNode') {
            const u = arg.unescaped;
            return u && typeof u === 'object' ? u.value : u;
        }
        return null;
    },

    /**
     * Returns the source text of the Nth positional argument, or null.
     * @param {object} callNode
     * @param {number} index - 0-based
     */
    _getArgSourceText(callNode, index) {
        const args = callNode.arguments_ && callNode.arguments_.arguments_;
        if (!args || !args[index]) return null;
        return this._getSourceText(args[index].location);
    },

    /**
     * Returns the source text of a keyword argument value by key name, or null.
     * @param {object} callNode
     * @param {string} key - keyword argument name (e.g. 'secs')
     */
    _getKwargSourceText(callNode, key) {
        const args = callNode.arguments_ && callNode.arguments_.arguments_;
        if (!args) return null;
        for (const arg of args) {
            const type = typeof arg.toJSON === 'function' ? arg.toJSON().type : null;
            if (type === 'KeywordHashNode') {
                if (typeof arg.childNodes !== 'function') continue;
                for (const assocNode of arg.childNodes()) {
                    if (!assocNode) continue;
                    const assocType = typeof assocNode.toJSON === 'function' ? assocNode.toJSON().type : null;
                    if (assocType === 'AssocNode') {
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
    },

    // ---- Constant-receiver annotation helpers ----

    _annotateMathMethod(node, name) {
        const mathLabels = {
            sqrt: '平方根',
            sin: 'sin',
            cos: 'cos',
            tan: 'tan',
            asin: 'asin',
            acos: 'acos',
            atan: 'atan',
            log: 'ln',
            log10: 'log',
        };
        const label = mathLabels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateTimeNowMethod(node, name) {
        const timeLabels = {
            year: '今の年',
            month: '今の月',
            day: '今の日',
            hour: '今の時',
            min: '今の分',
            sec: '今の秒',
            wday: '今の曜日',
        };
        const label = timeLabels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateSelfSetter(node, name) {
        const selfSetterLabels = {
            'x=': 'X座標を設定',
            'y=': 'Y座標を設定',
            'direction=': '向きを設定',
            'size=': '大きさを設定',
            'volume=': '音量を設定',
            'rotation_style=': '回転スタイルを設定',
            'instrument=': '楽器を設定',
            'tempo=': 'テンポを設定',
            'drag_mode=': 'ドラッグモードを設定',
        };
        const label = selfSetterLabels[name];
        if (label) this._addAnnotation(this._receiverSpanLoc(node), label);
    },

    // ---- Extension handler helpers ----

    /**
     * Check if a node's receiver is a predefined extension name.
     * Handles both LocalVariableReadNode and CallNode patterns.
     * @param {object} node - A Prism CallNode.
     * @param {string} extensionName - The extension name to match.
     */
    _isPredefinedReceiver(node, extensionName) {
        if (!node.receiver) return false;
        const recType = typeof node.receiver.toJSON === 'function' ? node.receiver.toJSON().type : null;
        if (recType === 'LocalVariableReadNode' && node.receiver.name === extensionName) return true;
        if (recType === 'CallNode' && !node.receiver.receiver && node.receiver.name === extensionName) {
            return true;
        }
        return false;
    },

    _annotatePenMethod(node, name) {
        const penLabels = {
            clear: '全削除する',
            stamp: 'スタンプ',
            down: 'ペンを下ろす',
            up: 'ペンを上げる',
            'size=': 'ペンの太さを設定',
            'color=': 'ペンの色を設定',
            'saturation=': '彩度を設定',
            'brightness=': '明るさを設定',
            'transparency=': '透明度を設定',
        };
        const label = penLabels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateFaceSensingMethod(node, name) {
        const faceSensingLabels = {
            go_to: '行く',
            point_in_direction_of_face_tilt: '顔の傾きの方向を向く',
            set_size_to_face_size: '大きさを顔の大きさにする',
            when_face_tilted: '顔が傾いたとき',
            when_this_sprite_touch: '触れたとき',
            when_face_detected: '顔が見つかったとき',
            'face_detected?': '顔が見つかった',
            face_tilt: '顔の傾き',
            face_size: '顔の大きさ',
        };
        const fsLabel = faceSensingLabels[name];
        if (fsLabel) this._addAnnotation(node.messageLoc, fsLabel);
    },

    /**
     * Set context-specific string label map for extension arguments.
     * Checks face_sensing string maps and general extension string maps.
     * @param {object} node - CallNode
     * @param {string} name - method name
     */
    _setExtensionStringMap(node, name) {
        // face_sensing string maps (from furigana-label-map)
        const fsStringMap = FACE_SENSING_STRING_MAP[name];
        if (fsStringMap && this._isPredefinedReceiver(node, 'face_sensing')) {
            this._stringLabelMap = fsStringMap;
            return;
        }
        // General extension string maps
        for (const extName of Object.keys(EXTENSION_STRING_MAPS)) {
            const extMap = EXTENSION_STRING_MAPS[extName];
            if (extMap[name] && this._isPredefinedReceiver(node, extName)) {
                this._stringLabelMap = extMap[name];
                return;
            }
        }
    },

    // ---- Dynamic annotation helpers ----

    _annotateGlide(node) {
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
    },

    _annotateGoToLayer(node) {
        const layer = this._getArgStringValue(node, 0);
        if (layer === 'front') {
            this._addAnnotation(node.messageLoc, '最前面へ移動する');
        } else if (layer === 'back') {
            this._addAnnotation(node.messageLoc, '最背面へ移動する');
        } else {
            this._addAnnotation(node.messageLoc, 'レイヤーへ移動する');
        }
    },

    _annotateGoLayers(node) {
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
    },

    _annotateWhenGreaterThan(node) {
        const kind = this._getArgStringValue(node, 0);
        const val = this._getArgSourceText(node, 1);
        const kindLabel = kind === 'LOUDNESS' ? '音量' : kind === 'TIMER' ? 'タイマー' : kind || '値';
        const valLabel = val === null ? '' : val;
        this._addAnnotation(node.messageLoc, `${kindLabel} > ${valLabel} のとき`);
    },

    _annotateRest(node) {
        const beats = this._getArgSourceText(node, 0);
        const beatsLabel = beats === null ? 'n' : beats;
        this._addAnnotation(node.messageLoc, `${beatsLabel}拍休む`);
    },

    // ---- self.attr += n (CallOperatorWriteNode) ----

    _handleCallOperatorWriteNode(node) {
        const receiverType =
            node.receiver && typeof node.receiver.toJSON === 'function' ? node.receiver.toJSON().type : null;
        const attrName = node.readName;

        if (receiverType === 'SelfNode') {
            if (attrName === 'direction') {
                const dirLabel = node.binaryOperator === '-' ? '反時計回りに回す' : '時計回りに回す';
                this._addAnnotation(this._receiverSpanLoc(node), dirLabel);
            }
            const selfOpLabels = {
                x: 'X座標を変える',
                y: 'Y座標を変える',
                size: '大きさを変える',
                volume: '音量を変える',
                tempo: 'テンポを変える',
            };
            const label = selfOpLabels[attrName];
            if (label) this._addAnnotation(this._receiverSpanLoc(node), label);
        } else if (this._isPredefinedReceiver(node, 'pen')) {
            const penOpLabels = {
                size: 'ペンの太さを変える',
                color: 'ペンの色を変える',
            };
            const label = penOpLabels[attrName];
            if (label) this._addAnnotation(node.messageLoc, label);
        }
        if (node.receiver) this._walkNode(node.receiver);
        if (receiverType === 'SelfNode' && attrName === 'direction') {
            this._argUnit = '度';
        }
        if (node.value) this._walkNode(node.value);
        this._argUnit = null;
    },
};

export { callHelpers };
