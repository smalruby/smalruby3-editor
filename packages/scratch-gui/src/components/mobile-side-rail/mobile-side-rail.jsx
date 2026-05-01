import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';

import codeIcon from '../gui/icon--code.svg';
import costumesIcon from '../gui/icon--costumes.svg';
import rubyIcon from '../gui/icon--ruby.svg';
import soundsIcon from '../gui/icon--sounds.svg';
import spriteIcon from '../mobile-bottom-tabs/icon--sprite-cat.svg';
import hamburgerIcon from '../mobile-drawer/icon--hamburger.svg';
import playIcon from '../mobile-top-bar/icon--play.svg';
import stopIcon from '../mobile-top-bar/icon--stop.svg';
import {
    activateTab,
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    RUBY_TAB_INDEX,
    SOUNDS_TAB_INDEX,
} from '../../reducers/editor-tab.js';
import { setFullScreen } from '../../reducers/mode.js';
import styles from './mobile-side-rail.css';

const SPRITE_KEY = 'sprite';

/**
 * 横向き専用 Mobile UI の左 48px サイドレール (issue #572 Phase 2-J)。
 *
 * 上下のメニューバーを廃止し、本コンポーネントに ☰ + ▶/⏹ + 5 タブ
 * (sprite/code/costume/sound/ruby) を集約することで、編集エリアが viewport
 * 縦 100% を使えるようになる (上流の paint editor / sound editor の縦最低
 * サイズを満たすため)。
 *
 * 配置:
 * - top: ☰ (drawer 開閉) + ▶/⏹ (全画面ステージ切替)
 * - middle: 5 タブ
 * - bottom: 余白 (将来的にプロジェクト保存ステータス等を入れる枠)
 *
 * 構成は MobileTopBar (PR-2C/2E) + MobileBottomTabs (PR-2B/2F) を縦に並べた
 * 等価物。スプライトタブの active state は親 (MobileGui) 管理を継続。
 * @param {object} props - props
 * @param {object} props.vm - scratch-vm
 * @param {boolean} props.isFullScreen - 全画面ステージ中か
 * @param {boolean} props.isStarted - VM が start 済みか
 * @param {number} props.activeTabIndex - editorTab Redux 値
 * @param {boolean} props.spriteTabActive - スプライトタブが active か
 * @param {Function} props.onSetFullScreen - setFullScreen ディスパッチャ
 * @param {Function} props.onActivateTab - activateTab ディスパッチャ
 * @param {Function} props.onOpenDrawer - drawer を開くコールバック (親管理)
 * @param {Function} props.onSpriteTabActiveChange - スプライトタブ active 切替
 * @returns {JSX.Element|null} portal で document.body 直下にレンダリング
 */
const MobileSideRailComponent = ({
    vm,
    isFullScreen,
    isStarted,
    activeTabIndex,
    spriteTabActive,
    onSetFullScreen,
    onActivateTab,
    onOpenDrawer,
    onSpriteTabActiveChange,
}) => {
    const handlePlayClick = useCallback(
        e => {
            if (isFullScreen) {
                vm.stopAll();
                onSetFullScreen(false);
            } else {
                onSetFullScreen(true);
                if (!isStarted) vm.start();
                vm.greenFlag();
            }
            const target = e?.currentTarget;
            if (target) target.blur();
        },
        [vm, isFullScreen, isStarted, onSetFullScreen],
    );

    const handleMenuClick = useCallback(
        e => {
            onOpenDrawer();
            const target = e?.currentTarget;
            if (target) target.blur();
        },
        [onOpenDrawer],
    );

    const handleTabClick = useCallback(
        event => {
            const key = event.currentTarget.dataset.tabKey;
            if (key === SPRITE_KEY) {
                onSpriteTabActiveChange(true);
                return;
            }
            onSpriteTabActiveChange(false);
            const tabIndex = parseInt(event.currentTarget.dataset.tabIndex, 10);
            if (!Number.isNaN(tabIndex)) onActivateTab(tabIndex);
        },
        [onActivateTab, onSpriteTabActiveChange],
    );

    if (typeof document === 'undefined') return null;

    // 順序: コード / コスチューム / 音 / ルビー / スプライト
    // (PC 版とほぼ同じ並びにする)
    const tabs = [
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
    ];

    const isTabActive = tab => {
        if (tab.key === SPRITE_KEY) return spriteTabActive;
        if (spriteTabActive) return false;
        return activeTabIndex === tab.tabIndex;
    };

    return createPortal(
        <nav
            className={styles.rail}
            data-testid="mobile-side-rail"
            aria-label="mobile side navigation"
        >
            <button
                type="button"
                className={styles.button}
                onClick={handleMenuClick}
                data-testid="mobile-side-rail-menu"
                aria-label="menu"
            >
                <img alt="" aria-hidden="true" className={styles.icon} draggable={false} src={hamburgerIcon} />
            </button>
            <button
                type="button"
                className={styles.playButton}
                onClick={handlePlayClick}
                data-testid="mobile-side-rail-play"
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
            <div className={styles.divider} />
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    type="button"
                    className={styles.button}
                    data-testid={`mobile-side-rail-${tab.key}`}
                    data-tab-key={tab.key}
                    data-tab-index={tab.tabIndex ?? ''}
                    data-active={isTabActive(tab) ? 'true' : 'false'}
                    onClick={handleTabClick}
                >
                    <img alt="" aria-hidden="true" className={styles.icon} draggable={false} src={tab.iconSrc} />
                    <span className={styles.label}>{tab.label}</span>
                </button>
            ))}
            <div className={styles.spacer} />
        </nav>,
        document.body,
    );
};

MobileSideRailComponent.propTypes = {
    vm: PropTypes.shape({
        start: PropTypes.func.isRequired,
        greenFlag: PropTypes.func.isRequired,
        stopAll: PropTypes.func.isRequired,
    }).isRequired,
    isFullScreen: PropTypes.bool.isRequired,
    isStarted: PropTypes.bool.isRequired,
    activeTabIndex: PropTypes.number.isRequired,
    spriteTabActive: PropTypes.bool.isRequired,
    onSetFullScreen: PropTypes.func.isRequired,
    onActivateTab: PropTypes.func.isRequired,
    onOpenDrawer: PropTypes.func.isRequired,
    onSpriteTabActiveChange: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm,
    isFullScreen: state.scratchGui.mode.isFullScreen,
    isStarted: state.scratchGui.vmStatus.started,
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
});

const mapDispatchToProps = dispatch => ({
    onSetFullScreen: isFull => dispatch(setFullScreen(isFull)),
    onActivateTab: tabIndex => dispatch(activateTab(tabIndex)),
});

const MobileSideRail = connect(mapStateToProps, mapDispatchToProps)(MobileSideRailComponent);

export default MobileSideRail;
export { MobileSideRailComponent, SPRITE_KEY };
