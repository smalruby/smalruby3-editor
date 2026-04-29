import PropTypes from 'prop-types';
import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { connect } from 'react-redux';

import TargetPane from '../../containers/target-pane.jsx';
import { ModalFocusProvider } from '../../contexts/modal-focus-context.jsx';
import { openBackdropLibrary } from '../../reducers/modals.js';
import styles from './mobile-sprite-panel.css';

/**
 * パネルを top-bar と bottom-tabs の間に正確に配置する layout effect。
 *
 * - top: visualViewport.offsetTop + MobileTopBar の高さ (CSS 変数 `--smalruby-mobile-top-bar-height`)
 * - bottom (= top + height): visualViewport.offsetTop + visualViewport.height - MobileBottomTabs の高さ (固定値)
 *
 * MobileTopBar の高さは JS で documentElement に CSS 変数として設定済み
 * (PR-2C / mobile-top-bar.jsx 参照)。MobileBottomTabs は環境変数化されて
 * いないので 64px 固定で計算する (mobile-bottom-tabs.css の min-height)。
 *
 * 表示されている (active=true) ときだけ計算し、隠れているときは何もしない。
 * @param {object} ref - パネル要素の React ref
 * @param {boolean} active - 描画中か
 */
const usePositionBetweenBars = (ref, active) => {
    useLayoutEffect(() => {
        if (!active || !ref.current || typeof window === 'undefined') return () => {};
        const el = ref.current;
        const vv = window.visualViewport;
        const update = () => {
            const cs = getComputedStyle(document.documentElement);
            const topBarHeight = parseFloat(cs.getPropertyValue('--smalruby-mobile-top-bar-height')) || 0;
            // MobileBottomTabs は 64px (mobile-bottom-tabs.css) 固定。CSS 変数化
            // した方が綺麗だが、現状は他の場所で参照していないのでハードコード。
            const bottomTabsHeight = 64;
            if (vv) {
                el.style.top = `${vv.offsetTop + topBarHeight}px`;
                el.style.left = `${vv.offsetLeft}px`;
                el.style.width = `${vv.width}px`;
                el.style.height = `${vv.height - topBarHeight - bottomTabsHeight}px`;
            } else {
                el.style.top = `${topBarHeight}px`;
                el.style.left = '0px';
                el.style.width = `${window.innerWidth}px`;
                el.style.height = `${window.innerHeight - topBarHeight - bottomTabsHeight}px`;
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
    }, [active, ref]);
};

/**
 * モバイル用スプライト管理パネル (issue #572 Phase 2-F)。
 *
 * MobileBottomTabs の「スプライト」タブが active のときだけ overlay として
 * 表示される。upstream の <TargetPane> をそのまま流用し、CSS で flex-direction
 * を column 方向に上書きすることで、狭幅でもスプライト一覧 + ステージ背景が
 * 縦に並ぶレイアウトに変える。
 *
 * <TargetPane> 自体はスプライト追加 (Choose / Paint / Surprise / Upload),
 * スプライト削除 / 複製 / 名前変更 / 位置変更などの全機能を内蔵しているため、
 * モバイルでも基本機能はすべて使える。スプライトライブラリモーダル
 * (Choose) は upstream の <SpriteLibrary> がそのまま開くので、モバイルで
 * 操作性が悪い場合は別 PR で改善する。
 *
 * 注意: upstream の <GUI> 内の右ペインにも <TargetPane> が描画されている。
 * 本コンポーネントが描画する <TargetPane> はそれとは別インスタンスだが、
 * Redux 状態を共有しているため操作の整合性は保たれる (両方のリストが
 * 同じスプライトを表示し、同じ editingTarget をハイライトする)。
 *
 * `onNewBackdropClick` (背景ライブラリを開く) は upstream gui.jsx と同じく
 * `openBackdropLibrary()` を dispatch する。
 *
 * `onNewSpriteClick` は <TargetPane> コンテナ内部で `openSpriteLibrary()` を
 * dispatch するため明示的に渡さない (mergeProps の defaults が効く)。
 * @param {object} props - props
 * @param {boolean} props.active - スプライトタブが active か
 * @param {object} props.vm - scratch-vm
 * @param {Function} props.onNewBackdropClick - 背景ライブラリを開く
 * @returns {JSX.Element|null} portal で body 直下にレンダリング
 */
const MobileSpritePanelComponent = ({ active, vm, onNewBackdropClick }) => {
    const ref = useRef(null);
    usePositionBetweenBars(ref, active);

    if (typeof document === 'undefined') return null;
    if (!active) return null;

    return createPortal(
        <div ref={ref} className={styles.panel} data-testid="mobile-sprite-panel">
            {/*
             * upstream <TargetPane> は ModalFocusContext を必須にしている
             * (Choose Sprite クリック時に context.captureFocus() を呼ぶ)。
             * upstream <GUI> 内の <ModalFocusProvider> 配下の TargetPane と
             * 別ツリーになるので、ここで独立した Provider を立てる。
             */}
            <ModalFocusProvider>
                {/*
                 * hideSpriteLibrary=true で <SpriteLibrary> モーダルの二重描画を
                 * 抑止する (詳細は target-pane.jsx の Smalruby マーカー参照)。
                 * 上流の右ペインの <TargetPane> がモーダルを担当する。
                 */}
                <TargetPane
                    vm={vm}
                    stageSize="small"
                    hideSpriteLibrary
                    onNewBackdropClick={onNewBackdropClick}
                />
            </ModalFocusProvider>
        </div>,
        document.body,
    );
};

MobileSpritePanelComponent.propTypes = {
    active: PropTypes.bool.isRequired,
    // upstream の <TargetPane> に丸ごと渡す。型は Scratch VM だが、ここでは
    // 単純に object として扱う (テストでモックしやすくするため)。
    vm: PropTypes.object.isRequired,
    onNewBackdropClick: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = dispatch => ({
    onNewBackdropClick: () => dispatch(openBackdropLibrary()),
});

const MobileSpritePanel = connect(mapStateToProps, mapDispatchToProps)(MobileSpritePanelComponent);

export default MobileSpritePanel;
export { MobileSpritePanelComponent };
