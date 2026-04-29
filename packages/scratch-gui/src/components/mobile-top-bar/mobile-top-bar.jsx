import PropTypes from 'prop-types';
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { connect } from 'react-redux';

import { setFullScreen } from '../../reducers/mode.js';
import greenFlagIcon from '../green-flag/icon--green-flag.svg';
import styles from './mobile-top-bar.css';

/**
 * `position: fixed` 要素を visual viewport の上端に追従させる layout effect。
 * `MobileBottomTabs` の下端追従と対をなす。
 * @param {object} ref - 配置対象 React ref
 */
const usePositionAtVisualViewportTop = ref => {
    useLayoutEffect(() => {
        if (!ref.current || typeof window === 'undefined') return () => {};
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
    }, [ref]);
};

/**
 * Mobile 用上部バー。
 *
 * Phase 2-C: 右側に「▶ 実行 = ステージ全画面プレビュー起動」ボタンを置く。
 * Phase 2-E でハンバーガーメニュー / プロジェクトタイトルを左側に追加する予定。
 *
 * 全画面 (isFullScreen=true) のときは upstream の StageHeader が表示され、
 * 自前の上部バーは隠す (ボトムタブと同様)。
 * @param {object} props - props
 * @param {object} props.vm - scratch-vm インスタンス
 * @param {boolean} props.isFullScreen - 既に全画面モードか
 * @param {boolean} props.isStarted - VM がすでに start 済みか
 * @param {Function} props.onSetFullScreen - setFullScreen ディスパッチャ
 * @returns {JSX.Element|null} Portal でレンダリングされる上部バー
 */
const MobileTopBarComponent = ({ vm, isFullScreen, isStarted, onSetFullScreen }) => {
    const ref = useRef(null);
    usePositionAtVisualViewportTop(ref);

    const handlePlayClick = useCallback(() => {
        onSetFullScreen(true);
        if (!isStarted) vm.start();
        vm.greenFlag();
    }, [vm, isStarted, onSetFullScreen]);

    if (isFullScreen) {
        return null;
    }
    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div ref={ref} className={styles.topBar} data-testid="mobile-top-bar">
            <div className={styles.spacer} />
            <button
                type="button"
                className={styles.playButton}
                onClick={handlePlayClick}
                data-testid="mobile-top-bar-play"
                aria-label="run"
            >
                <img alt="" aria-hidden="true" className={styles.playIcon} draggable={false} src={greenFlagIcon} />
            </button>
        </div>,
        document.body,
    );
};

MobileTopBarComponent.propTypes = {
    vm: PropTypes.shape({
        start: PropTypes.func.isRequired,
        greenFlag: PropTypes.func.isRequired,
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
