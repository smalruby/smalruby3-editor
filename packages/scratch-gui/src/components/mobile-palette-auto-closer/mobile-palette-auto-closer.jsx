import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { connect } from 'react-redux';

import { hidePalette } from '../../reducers/palette-visibility.js';

/**
 * MobileGui 配下で動くロジック専用コンポーネント (描画なし)。
 *
 * 役割:
 * 1. mobile_gui モードに入った直後にパレットを自動的に閉じる (狭幅では
 *    ブロックパレット + ワークスペース両方を画面に出すと幅が足りない)。
 * 2. Blockly のブロックドラッグ開始時にパレットを自動クローズ
 *    (issue #572 Phase 2-D の主要要件)。
 *
 * Blockly workspace は scratch-blocks の `getMainWorkspace()` で取得する。
 * blocks.js の Smalruby マーカー経由で installPaletteAutoCloseHookProvider
 * という形で workspace 取得方法を上から渡してもよいが、ここでは ScratchBlocks
 * を `require` で直接持ってくる方式にする (blocks-gesture-recovery.js と同じ
 * 流儀)。
 * @param {object} props - props
 * @param {Function} props.onHide - hidePalette ディスパッチャ
 * @returns {null} 描画しない
 */
const MobilePaletteAutoCloserComponent = ({ onHide }) => {
    // 1) Auto-hide on mount (mobile_gui first entry)
    const autoHidden = useRef(false);
    useEffect(() => {
        if (autoHidden.current) return;
        autoHidden.current = true;
        onHide();
    }, [onHide]);

    // 2) Drag-start auto-close: scratch-blocks には明確な BLOCK_DRAG_START
    //    イベントが無い (DRAG_OUTSIDE / END_DRAG しか expose されていない)
    //    ため、DOM レベルのポインタ追跡で drag-start を検出する。
    //
    //    Blockly のフライアウトを示す SVG 要素 (class="blocklyFlyout") への
    //    pointerdown を捕捉し、続く pointermove で 5px 以上動いたら drag
    //    開始とみなして hidePalette() を呼ぶ。タップだけでは閉じない。
    useEffect(() => {
        if (typeof document === 'undefined') return () => {};
        const DRAG_THRESHOLD_PX = 5;
        let activeMove = null;
        const onPointerDown = e => {
            // フライアウト内の要素か判定 (SVG なので closest はキャッチしないこともあり、
            // クリック対象から祖先を辿って blocklyFlyout クラスを探す)
            let node = e.target;
            let inFlyout = false;
            while (node && node !== document.documentElement) {
                const cls = node.getAttribute && node.getAttribute('class');
                if (cls && /\bblocklyFlyout\b/.test(cls)) {
                    inFlyout = true;
                    break;
                }
                node = node.parentNode;
            }
            if (!inFlyout) return;
            const startX = e.clientX;
            const startY = e.clientY;
            const onMove = me => {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
                    cleanup();
                    onHide();
                }
            };
            const cleanup = () => {
                if (activeMove !== onMove) return;
                document.removeEventListener('pointermove', onMove, true);
                document.removeEventListener('pointerup', cleanup, true);
                document.removeEventListener('pointercancel', cleanup, true);
                activeMove = null;
            };
            activeMove = onMove;
            document.addEventListener('pointermove', onMove, true);
            document.addEventListener('pointerup', cleanup, true);
            document.addEventListener('pointercancel', cleanup, true);
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
        };
    }, [onHide]);

    return null;
};

MobilePaletteAutoCloserComponent.propTypes = {
    onHide: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
    onHide: () => dispatch(hidePalette()),
});

const MobilePaletteAutoCloser = connect(null, mapDispatchToProps)(MobilePaletteAutoCloserComponent);

export default MobilePaletteAutoCloser;
export { MobilePaletteAutoCloserComponent };
