import PropTypes from 'prop-types';
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { connect } from 'react-redux';

import { setFullScreen } from '../../reducers/mode.js';
import playIcon from './icon--play.svg';
import stopIcon from './icon--stop.svg';
import styles from './mobile-top-bar.css';

/**
 * `position: fixed` 要素を visual viewport の上端に追従させる layout effect。
 * 表示状態 (enabled) が変わるたびに再計算するために enabled を依存配列に入れる。
 * @param {object} ref - 配置対象 React ref
 * @param {boolean} enabled - 描画されているか (false のときは ref.current が null)
 */
const usePositionAtVisualViewportTop = (ref, enabled) => {
    useLayoutEffect(() => {
        if (!enabled || !ref.current || typeof window === 'undefined') return () => {};
        const el = ref.current;
        const vv = window.visualViewport;
        const update = () => {
            if (vv) {
                el.style.top = `${vv.offsetTop}px`;
                el.style.left = `${vv.offsetLeft}px`;
                el.style.width = `${vv.width}px`;
            } else {
                el.style.top = '0px';
                el.style.left = '0px';
                el.style.width = `${window.innerWidth}px`;
            }
            // upstream の stage-header overlay / stage-wrapper full-screen が
            // この MobileTopBar の高さ分だけ下にずれるよう、CSS 変数を更新。
            // global CSS (mobile-top-bar.css 内 :global ブロック) で参照する。
            const h = el.offsetHeight || 0;
            document.documentElement.style.setProperty('--smalruby-mobile-top-bar-height', `${h}px`);
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
 * Mobile 用上部バー。
 *
 * Phase 2-C: 右端に「▶ / ⏹ ボタン」を置く。
 * - 編集中 (isFullScreen=false): ▶ → setFullScreen(true) + vm.start() + vm.greenFlag()
 * - プレビュー中 (isFullScreen=true): ⏹ → setFullScreen(false) + vm.stopAll()
 *
 * Phase 2-E でハンバーガーメニュー / プロジェクトタイトルを左側に追加する予定。
 *
 * 全画面でも上部バーは表示し続ける (要望)。
 * @param {object} props - props
 * @param {object} props.vm - scratch-vm インスタンス
 * @param {boolean} props.isFullScreen - 既に全画面モードか
 * @param {boolean} props.isStarted - VM がすでに start 済みか
 * @param {Function} props.onSetFullScreen - setFullScreen ディスパッチャ
 * @returns {JSX.Element|null} Portal でレンダリングされる上部バー
 */
const MobileTopBarComponent = ({ vm, isFullScreen, isStarted, onSetFullScreen }) => {
    const ref = useRef(null);
    usePositionAtVisualViewportTop(ref, true);

    const handleToggleClick = useCallback(
        e => {
            if (isFullScreen) {
                vm.stopAll();
                onSetFullScreen(false);
            } else {
                onSetFullScreen(true);
                if (!isStarted) vm.start();
                vm.greenFlag();
            }
            // upstream の <GreenFlag> と同様、ステージにキーボードイベントを
            // 渡すためボタンからフォーカスを外す。
            const target = e?.currentTarget;
            if (target) target.blur();
        },
        [vm, isFullScreen, isStarted, onSetFullScreen],
    );

    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div ref={ref} className={styles.topBar} data-testid="mobile-top-bar">
            <div className={styles.spacer} />
            <button
                type="button"
                className={styles.playButton}
                onClick={handleToggleClick}
                data-testid="mobile-top-bar-play"
                aria-label={isFullScreen ? 'stop' : 'play'}
            >
                <img
                    alt=""
                    aria-hidden="true"
                    className={styles.playIcon}
                    draggable={false}
                    src={isFullScreen ? stopIcon : playIcon}
                />
            </button>
        </div>,
        document.body,
    );
};

MobileTopBarComponent.propTypes = {
    vm: PropTypes.shape({
        start: PropTypes.func.isRequired,
        greenFlag: PropTypes.func.isRequired,
        stopAll: PropTypes.func.isRequired,
    }).isRequired,
    isFullScreen: PropTypes.bool.isRequired,
    isStarted: PropTypes.bool.isRequired,
    onSetFullScreen: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm,
    isFullScreen: state.scratchGui.mode.isFullScreen,
    isStarted: state.scratchGui.vmStatus.started,
});

const mapDispatchToProps = dispatch => ({
    onSetFullScreen: isFull => dispatch(setFullScreen(isFull)),
});

const MobileTopBar = connect(mapStateToProps, mapDispatchToProps)(MobileTopBarComponent);

export default MobileTopBar;
export { MobileTopBarComponent };
