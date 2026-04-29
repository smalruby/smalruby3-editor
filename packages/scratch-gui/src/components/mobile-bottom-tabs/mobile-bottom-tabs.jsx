import PropTypes from 'prop-types';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';

import {
    activateTab,
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    RUBY_TAB_INDEX,
    SOUNDS_TAB_INDEX,
} from '../../reducers/editor-tab.js';
import styles from './mobile-bottom-tabs.css';

/**
 * `position: fixed` 要素を visual viewport の下端に追従させる layout effect。
 * Phase 1 の警告バナーと同じ仕組み。
 * @param {object} ref - 配置対象 React ref
 */
const usePositionAtVisualViewportBottom = ref => {
    useLayoutEffect(() => {
        if (!ref.current || typeof window === 'undefined') return () => {};
        const el = ref.current;
        const vv = window.visualViewport;
        const update = () => {
            const height = el.offsetHeight;
            if (vv) {
                el.style.top = `${vv.offsetTop + vv.height - height}px`;
                el.style.left = `${vv.offsetLeft}px`;
                el.style.width = `${vv.width}px`;
            } else {
                el.style.top = `${window.innerHeight - height}px`;
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

const SPRITE_KEY = 'sprite';

/**
 * 5 つのモバイル用ボトムタブ:
 *   ブロック / Ruby / スプライト / コスチューム / 音
 *
 * - ブロック / Ruby / コスチューム / 音 は upstream の `editorTab` Redux に
 *   ディスパッチして既存タブを切り替える
 * - スプライトタブは mobile 固有の状態 (PR-2B では placeholder。実際の
 *   全画面スプライト UI は後続 PR で実装する。今は active 表示のみ)
 *
 * 表示位置は `position: fixed` + `visualViewport` API で viewport 下端に追従。
 * @param {object} props - props
 * @param {number} props.activeTabIndex - 現在の editorTab Redux 値
 * @param {Function} props.onActivateTab - editorTab を切替えるディスパッチャ
 * @returns {JSX.Element|null} Portal でレンダリングされる固定ボトムバー
 */
const MobileBottomTabsComponent = ({ activeTabIndex, onActivateTab }) => {
    const ref = useRef(null);
    usePositionAtVisualViewportBottom(ref);
    const [spriteActive, setSpriteActive] = useState(false);

    const tabs = [
        {
            key: 'block',
            tabIndex: BLOCKS_TAB_INDEX,
            icon: '🧱',
            label: (
                <FormattedMessage
                    defaultMessage="Block"
                    description="Mobile bottom tab label for the Block (Code) tab"
                    id="gui.mobileBottomTabs.block"
                />
            ),
        },
        {
            key: 'ruby',
            tabIndex: RUBY_TAB_INDEX,
            icon: '💻',
            label: (
                <FormattedMessage
                    defaultMessage="Ruby"
                    description="Mobile bottom tab label for the Ruby tab"
                    id="gui.mobileBottomTabs.ruby"
                />
            ),
        },
        {
            key: SPRITE_KEY,
            tabIndex: null,
            icon: '🐱',
            label: (
                <FormattedMessage
                    defaultMessage="Sprite"
                    description="Mobile bottom tab label for the Sprite list"
                    id="gui.mobileBottomTabs.sprite"
                />
            ),
        },
        {
            key: 'costume',
            tabIndex: COSTUMES_TAB_INDEX,
            icon: '🎨',
            label: (
                <FormattedMessage
                    defaultMessage="Costume"
                    description="Mobile bottom tab label for the Costume tab"
                    id="gui.mobileBottomTabs.costume"
                />
            ),
        },
        {
            key: 'sound',
            tabIndex: SOUNDS_TAB_INDEX,
            icon: '🔊',
            label: (
                <FormattedMessage
                    defaultMessage="Sound"
                    description="Mobile bottom tab label for the Sound tab"
                    id="gui.mobileBottomTabs.sound"
                />
            ),
        },
    ];

    const handleClick = useCallback(
        event => {
            const key = event.currentTarget.dataset.tabKey;
            if (key === SPRITE_KEY) {
                setSpriteActive(true);
                return;
            }
            setSpriteActive(false);
            const tab = tabs.find(t => t.key === key);
            if (tab && typeof tab.tabIndex === 'number') {
                onActivateTab(tab.tabIndex);
            }
        },
        // tabs is recreated each render (new FormattedMessage children) but the
        // `tabIndex` lookup by key is stable, so we don't depend on `tabs` here.
        [onActivateTab],
    );

    const isActive = tab => {
        if (tab.key === SPRITE_KEY) return spriteActive;
        if (spriteActive) return false;
        return activeTabIndex === tab.tabIndex;
    };

    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <nav
            ref={ref}
            className={styles.bottomTabs}
            data-testid="mobile-bottom-tabs"
            aria-label="mobile bottom navigation"
        >
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    type="button"
                    className={styles.tab}
                    data-testid={`mobile-bottom-tabs-${tab.key}`}
                    data-tab-key={tab.key}
                    data-active={isActive(tab) ? 'true' : 'false'}
                    onClick={handleClick}
                >
                    <span aria-hidden="true" className={styles.icon}>
                        {tab.icon}
                    </span>
                    <span className={styles.label}>{tab.label}</span>
                </button>
            ))}
        </nav>,
        document.body,
    );
};

MobileBottomTabsComponent.propTypes = {
    activeTabIndex: PropTypes.number.isRequired,
    onActivateTab: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
});

const mapDispatchToProps = dispatch => ({
    onActivateTab: tabIndex => dispatch(activateTab(tabIndex)),
});

const MobileBottomTabs = connect(mapStateToProps, mapDispatchToProps)(MobileBottomTabsComponent);

export default MobileBottomTabs;
export { MobileBottomTabsComponent, SPRITE_KEY };
