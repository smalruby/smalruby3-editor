import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { connect } from 'react-redux';

import { hidePalette } from '../../reducers/palette-visibility.js';

/**
 * MobileGui 配下で動くロジック専用コンポーネント (描画なし)。
 *
 * 役割: Blockly のフライアウトからブロックを workspace へドラッグし出した
 * (= 確実に block drag が成立した) 瞬間にパレットを自動的に閉じる。
 * scratch-blocks の `Blockly.Events.DRAG_OUTSIDE` を購読する。
 *
 * 設計上の選択:
 * - DOM レベルの pointerdown / pointermove は flyout 内のリスト・スクロール
 *   など block drag 以外のジェスチャーも誤って拾ってしまい、Blockly の
 *   `WorkspaceDragger` が動作中の dispatch によって `contentLeft` が null
 *   になりクラッシュするケースがあったため採用しなかった。
 * - DRAG_OUTSIDE は「block が flyout を抜けて workspace に入った」時点なので、
 *   block drag が確実に成立してからの dispatch で安全。
 * - 初回マウント時の auto-hide は行わない (起動時はパレット表示のままが直感的、
 *   要望)。
 *
 * Blockly workspace は scratch-blocks の `getMainWorkspace()` で取得する
 * (blocks-gesture-recovery と同じ方式)。
 * @param {object} props - props
 * @param {Function} props.onHide - hidePalette ディスパッチャ
 * @returns {null} 描画しない
 */
const MobilePaletteAutoCloserComponent = ({ onHide }) => {
    useEffect(() => {
        if (typeof window === 'undefined') return () => {};
        let cancelled = false;
        let detach = () => {};
        const tryAttach = () => {
            if (cancelled) return;
            const ScratchBlocks = require('scratch-blocks');
            const workspace = ScratchBlocks.getMainWorkspace?.();
            if (!workspace || !workspace.addChangeListener) {
                if (typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(tryAttach);
                }
                return;
            }
            const Events = ScratchBlocks.Events || {};
            // 観察した結果 (issue #572 検証):
            // - フライアウトからブロックを drag → workspace に出した瞬間に
            //   `create` (Events.CREATE) が発火する
            // - プロジェクト読み込みや undo でも `create` は発火するので、
            //   ユーザーが currentGesture を持っている (= 手で drag 中) ときだけ
            //   反応する
            const createType = Events.CREATE || 'create';
            const listener = event => {
                if (event.type !== createType) return;
                if (!workspace.currentGesture_) return;
                onHide();
            };
            workspace.addChangeListener(listener);
            detach = () => {
                if (workspace.removeChangeListener) {
                    workspace.removeChangeListener(listener);
                }
            };
        };
        tryAttach();
        return () => {
            cancelled = true;
            detach();
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
