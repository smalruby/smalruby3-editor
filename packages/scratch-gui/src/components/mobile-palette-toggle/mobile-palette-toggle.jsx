import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { connect } from 'react-redux';

import { hidePalette, togglePalette } from '../../reducers/palette-visibility.js';
import styles from './mobile-palette-toggle.css';

/**
 * 表示位置を viewport 左端に追従させる layout effect。
 * top は MobileTopBar の高さ + 少しのオフセットで動的に設定。
 * @param {object} ref - 配置対象 React ref
 * @param {boolean} enabled - 描画されているか (false のときは ref.current が null)
 */
const usePositionAtViewportLeftEdge = (ref, enabled) => {
    useLayoutEffect(() => {
        if (!enabled || !ref.current || typeof window === 'undefined') return () => {};
        const el = ref.current;
        const vv = window.visualViewport;
        const update = () => {
            const cs = getComputedStyle(document.documentElement);
            const topBarH = parseFloat(cs.getPropertyValue('--smalruby-mobile-top-bar-height')) || 0;
            const offset = topBarH + 8; // 8px gap below MobileTopBar
            if (vv) {
                el.style.top = `${vv.offsetTop + offset}px`;
                el.style.left = `${vv.offsetLeft}px`;
            } else {
                el.style.top = `${offset}px`;
                el.style.left = '0px';
            }
        };
        update();
        const targets = vv ? [vv, window] : [window];
        const events = ['resize', 'scroll'];
        for (const t of targets) {
            for (const ev of events) t.addEventListener(ev, update, { passive: true });
        }
        return () => {
            for (const t of targets) {
                for (const ev of events) t.removeEventListener(ev, update);
            }
        };
    }, [enabled, ref]);
};

/**
 * ブロックタブで使うパレット表示・非表示の切替ボタン (Mobile 用ドロワーハンドル)。
 *
 * Phase 2-D の最小実装:
 * - Code タブのときだけ表示 (Ruby/コスチューム/音タブでは隠す)
 * - 全画面プレビュー中は隠す
 * - mobile_gui モードに入った直後はパレットを自動的に隠す (画面が狭いため)
 * - クリックでパレット表示・非表示をトグル
 *
 * 表示中/非表示中のラベルは ◀ / ▶ で示す (existing PaletteToggle と同じ流儀)。
 *
 * 後続作業 (PR-2D 後の polish):
 * - Blockly のブロックドラッグ開始時に自動でパレットを隠す
 * @param {object} props - props
 * @param {boolean} props.paletteVisible - 現在のパレット表示状態
 * @param {number} props.activeTabIndex - 現在の editorTab Redux 値
 * @param {boolean} props.isFullScreen - 全画面 mode フラグ
 * @param {Function} props.onToggle - palette toggle ディスパッチャ
 * @param {Function} props.onAutoHide - mobile 初回エントリーでパレットを隠す
 * @returns {JSX.Element|null} Portal でレンダリングされる左端ハンドル
 */
const MobilePaletteToggleComponent = ({
    paletteVisible,
    activeTabIndex,
    isFullScreen,
    onToggle,
    onAutoHide,
}) => {
    const ref = useRef(null);
    const onCodeTab = activeTabIndex === 0;
    const visible = !isFullScreen && onCodeTab;
    usePositionAtViewportLeftEdge(ref, visible);

    // 初回マウント時に palette を自動的に非表示にする (狭幅で広い palette は邪魔)。
    // useRef で初回フラグを保持して、依存配列が変わっても 1 回だけ走るようにする。
    const autoHidden = useRef(false);
    useEffect(() => {
        if (autoHidden.current) return;
        autoHidden.current = true;
        if (visible) onAutoHide();
    }, [visible, onAutoHide]);

    const handleClick = useCallback(
        e => {
            onToggle();
            const target = e?.currentTarget;
            if (target) target.blur();
        },
        [onToggle],
    );

    if (!visible) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
        <button
            ref={ref}
            type="button"
            className={styles.handle}
            data-testid="mobile-palette-toggle"
            data-palette-visible={paletteVisible ? 'true' : 'false'}
            onClick={handleClick}
            aria-label={paletteVisible ? 'hide block palette' : 'show block palette'}
        >
            {paletteVisible ? '◀' : '▶'}
        </button>,
        document.body,
    );
};

MobilePaletteToggleComponent.propTypes = {
    paletteVisible: PropTypes.bool.isRequired,
    activeTabIndex: PropTypes.number.isRequired,
    isFullScreen: PropTypes.bool.isRequired,
    onToggle: PropTypes.func.isRequired,
    onAutoHide: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
    paletteVisible: state.scratchGui.paletteVisibility.paletteVisible,
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
    isFullScreen: state.scratchGui.mode.isFullScreen,
});

const mapDispatchToProps = dispatch => ({
    onToggle: () => dispatch(togglePalette()),
    onAutoHide: () => dispatch(hidePalette()),
});

const MobilePaletteToggle = connect(mapStateToProps, mapDispatchToProps)(MobilePaletteToggleComponent);

export default MobilePaletteToggle;
export { MobilePaletteToggleComponent };
