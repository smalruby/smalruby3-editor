import PropTypes from 'prop-types';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';

import codeIcon from '../gui/icon--code.svg';
import costumesIcon from '../gui/icon--costumes.svg';
import rubyIcon from '../gui/icon--ruby.svg';
import soundsIcon from '../gui/icon--sounds.svg';
import spriteIcon from './icon--sprite-cat.svg';
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
 *   コード / コスチューム / 音 / ルビー / スプライト
 *
 * - コード / コスチューム / 音 / ルビー は upstream の `editorTab` Redux に
 *   ディスパッチして既存タブを切り替える。アイコン・ラベルは upstream の
 *   <Tab> と同じ SVG / 翻訳キーを再利用 (`gui.gui.codeTab` 等)
 * - スプライトタブは mobile 固有の placeholder。`gui.mobileBottomTabs.sprite`
 *   の翻訳のみ Smalruby 側で持つ
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
            key: SPRITE_KEY,
            tabIndex: null,
            iconSrc: spriteIcon,
            label: (
                <FormattedMessage
                    defaultMessage="Sprite"
                    description="Sprite info label"
                    id="gui.SpriteInfo.sprite"
                />
            ),
        },
        {
            key: 'code',
            tabIndex: BLOCKS_TAB_INDEX,
            iconSrc: codeIcon,
            label: (
                <FormattedMessage
                    defaultMessage="Code"
                    description="Button to get to the code panel"
                    id="gui.gui.codeTab"
                />
            ),
        },
        {
            key: 'costume',
            tabIndex: COSTUMES_TAB_INDEX,
            iconSrc: costumesIcon,
            label: (
                <FormattedMessage
                    defaultMessage="Costumes"
                    description="Button to get to the costumes panel"
                    id="gui.gui.costumesTab"
                />
            ),
        },
        {
            key: 'sound',
            tabIndex: SOUNDS_TAB_INDEX,
            iconSrc: soundsIcon,
            label: (
                <FormattedMessage
                    defaultMessage="Sounds"
                    description="Button to get to the sounds panel"
                    id="gui.gui.soundsTab"
                />
            ),
        },
        {
            key: 'ruby',
            tabIndex: RUBY_TAB_INDEX,
            iconSrc: rubyIcon,
            label: (
                <FormattedMessage
                    defaultMessage="Ruby"
                    description="Button to get to the Ruby panel"
                    id="gui.smalruby3.gui.rubyTab"
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
                    <img alt="" aria-hidden="true" className={styles.icon} draggable={false} src={tab.iconSrc} />
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
