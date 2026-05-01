import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';

import { connect } from 'react-redux';

import GUI from '../../containers/gui.jsx';
import ConnectedIntlProvider from '../../lib/connected-intl-provider.jsx';
import { COSTUMES_TAB_INDEX } from '../../reducers/editor-tab.js';
import MobileDrawer from '../mobile-drawer/mobile-drawer.jsx';
import MobileOrientationGate from '../mobile-orientation-gate/mobile-orientation-gate.jsx';
import MobilePaintToolbarToggle from '../mobile-paint-toolbar-toggle/mobile-paint-toolbar-toggle.jsx';
import MobileSideRail from '../mobile-side-rail/mobile-side-rail.jsx';
import MobileSpritePanel from '../mobile-sprite-panel/mobile-sprite-panel.jsx';

// Side-effect import: グローバル CSS で upstream <GUI> の layout を上書きする。
// `body.smalruby-mobile-mode` を起点にしたセレクタなので、MobileGui が
// マウントされていない (= class が無い) 時はデスクトップに何も影響しない。
import './mobile-gui.css';

/**
 * 狭幅 viewport 用の独立 GUI シェル (issue #572 Phase 2)。
 *
 * 設計方針:
 * - upstream の <GUI> には手を入れず、別コンポーネントとして並走する
 * - 段階的に <MobileGui> 配下の独自 UI を増やし、徐々に <GUI> 内部の
 *   レイアウトと役割を分担していく。
 * - 各 PR は機能を一つずつ追加するインクリメンタルな構成にして、
 *   develop に小さくマージできるようにする。
 *
 * 進捗:
 *   - PR-2A: スケルトン (本コンポーネントの作成、<GUI> 素通し)
 *   - PR-2B: ボトムタブ × 5 (<MobileBottomTabs /> を追加)
 *   - PR-2C: ステージ全画面プレビュー (<MobileTopBar /> の ▶ で
 *     upstream の isFullScreen mode に入る)
 *   - PR-2D: ブロックパレットドロワーのドラッグ開始自動クローズ
 *     (Phase 2-J で横固定運用に切り替え、十分な横幅を確保できたため revert)
 *   - PR-2E: ハンバーガーメニュー (<MobileDrawer /> + <MobileTopBar /> 左の ☰)
 *   - PR-2F: スプライト管理 (本 PR、<MobileSpritePanel />)。スプライトタブを
 *     active にすると upstream <TargetPane> を全画面オーバーレイで表示し、
 *     スプライト追加 / 削除 / 選択 + ステージ背景管理ができるようにする。
 *     issue #572 の元症状「I can't add sprites nor costumes on safari on iOS」の解消。
 *
 * 状態管理:
 * - drawer (ハンバーガー) の open: useState
 * - sprite tab active: useState (Redux 化していないが、必要になったら検討)
 *
 * 受け取る props は <GUI> と同一 (AppStateHOC / HashParserHOC からの全 props)。
 * @param {object} props - <GUI> と同じ props
 * @returns {JSX.Element} <GUI> + 各種 mobile-only コンポーネント
 */
const MOBILE_MODE_CLASS = 'smalruby-mobile-mode';
const MOBILE_FULLSCREEN_CLASS = 'smalruby-mobile-fullscreen';
const MOBILE_BACKPACK_OPEN_CLASS = 'smalruby-mobile-backpack-open';

const MobileGui = ({ activeTabIndex, isFullScreen, ...props }) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [spriteTabActive, setSpriteTabActive] = useState(false);
    const [paintToolbarCollapsed, setPaintToolbarCollapsed] = useState(false);
    const [backpackOpen, setBackpackOpen] = useState(false);
    const handleOpenDrawer = useCallback(() => setDrawerOpen(true), []);
    const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);
    const handleSpriteTabActiveChange = useCallback(active => setSpriteTabActive(active), []);
    const handleTogglePaintToolbar = useCallback(() => setPaintToolbarCollapsed(v => !v), []);
    const handleToggleBackpack = useCallback(() => setBackpackOpen(v => !v), []);

    // 上部ツールバー出し入れトグルは「コスチュームタブ + スプライトタブ非active」の
    // ときだけ意味があるので、その時だけ active にする。
    const paintToolbarToggleActive = activeTabIndex === COSTUMES_TAB_INDEX && !spriteTabActive;

    // コスチュームタブに入る (active が立つ) たびに、ツールバーを「展開」状態に
    // リセットする。最初は全機能を見せておきたいため (要望)。
    useEffect(() => {
        if (paintToolbarToggleActive) {
            setPaintToolbarCollapsed(false);
        }
    }, [paintToolbarToggleActive]);

    // canvas をクリックしたら (= 描画 / 選択を始めたら) 自動的にツールバーを
    // 折りたたむ。少しでもユーザーの操作回数を減らすため (要望)。
    // 既に折りたたまれている / コスチュームタブ非アクティブのときは何もしない。
    useEffect(() => {
        if (!paintToolbarToggleActive || paintToolbarCollapsed) return () => {};
        if (typeof document === 'undefined') return () => {};
        const handler = event => {
            const canvas = document.querySelector('[class*="paper-canvas_paper-canvas"]');
            if (canvas && (event.target === canvas || canvas.contains(event.target))) {
                setPaintToolbarCollapsed(true);
            }
        };
        // capture フェーズで拾うことで、scratch-paint 側の handler が止めても
        // 確実に検知できる。
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    }, [paintToolbarToggleActive, paintToolbarCollapsed]);

    // ペイントツール (左の mode-selector) をタップしたらツールバーを自動展開
    // (要望)。すでに展開中なら何もしない (state 変化なしで no-op)。
    useEffect(() => {
        if (!paintToolbarToggleActive) return () => {};
        if (typeof document === 'undefined') return () => {};
        const handler = event => {
            const modeSelector = document.querySelector('[class*="paint-editor_mode-selector"]');
            if (modeSelector && (event.target === modeSelector || modeSelector.contains(event.target))) {
                setPaintToolbarCollapsed(false);
            }
        };
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    }, [paintToolbarToggleActive]);

    // マウント中だけ <html>/<body> に mobile-mode class を付ける (mobile-gui.css の
    // :global ルールがこの class を起点として upstream <GUI> の layout を
    // 上書きする)。MobileGui がアンマウントされたら class を取り除いて
    // デスクトップ挙動に戻す。
    //
    // また、Blockly のワークスペース SVG はマウント直後に injectionDiv の
    // サイズを基にレイアウトを決めるため、その時点でまだ desktop 幅 (~646px) で
    // 計算済みになっている。後から CSS 経由で 390px に縮めても再計算は走らず、
    // ズームコントロールが viewport 外に取り残される。class を付けた直後に
    // window の resize を発火して Blockly に再計測を促す。
    // Redux の isFullScreen を body class に反映。CSS 側で
    // `.smalruby-mobile-fullscreen` を起点に右ペイン (gui_stage-and-target-wrapper)
    // の表示を復活させる。以前は CSS `:has()` で同等のことをしていたが
    // 古い iOS Safari で動作しないことがあったので JS 制御に切り替え。
    // バックパック開閉を body class に反映。CSS 側で
    // `.smalruby-mobile-backpack-open` をトリガーに upstream の <Backpack>
    // を画面下部に表示する。デフォルトは hidden (mobile-gui.css の section 6)。
    useEffect(() => {
        if (typeof document === 'undefined') return () => {};
        if (backpackOpen) {
            document.body.classList.add(MOBILE_BACKPACK_OPEN_CLASS);
        } else {
            document.body.classList.remove(MOBILE_BACKPACK_OPEN_CLASS);
        }
        return () => document.body.classList.remove(MOBILE_BACKPACK_OPEN_CLASS);
    }, [backpackOpen]);

    useEffect(() => {
        if (typeof document === 'undefined') return () => {};
        if (isFullScreen) {
            document.body.classList.add(MOBILE_FULLSCREEN_CLASS);
        } else {
            document.body.classList.remove(MOBILE_FULLSCREEN_CLASS);
        }
        return () => document.body.classList.remove(MOBILE_FULLSCREEN_CLASS);
    }, [isFullScreen]);

    useEffect(() => {
        if (typeof document === 'undefined') return () => {};
        document.documentElement.classList.add(MOBILE_MODE_CLASS);
        document.body.classList.add(MOBILE_MODE_CLASS);
        if (typeof window !== 'undefined') {
            // CSS が適用された後の rAF で resize を投げる (同一フレーム内では
            // class 適用前の幅で測ってしまうため)。
            const raf = window.requestAnimationFrame(() => {
                window.dispatchEvent(new Event('resize'));
            });
            return () => {
                window.cancelAnimationFrame(raf);
                document.documentElement.classList.remove(MOBILE_MODE_CLASS);
                document.body.classList.remove(MOBILE_MODE_CLASS);
            };
        }
        return () => {
            document.documentElement.classList.remove(MOBILE_MODE_CLASS);
            document.body.classList.remove(MOBILE_MODE_CLASS);
        };
    }, []);
    return (
        <>
            <GUI {...props} />
            {/*
             * MobileSideRail / MobileDrawer / MobileSpritePanel /
             * MobilePaintToolbarToggle / MobileOrientationGate は body 直下に
             * Portal で出すため、<GUI> 内側の IntlProvider context を使えない。
             * 別途 ConnectedIntlProvider で包む。
             */}
            <ConnectedIntlProvider>
                <>
                    {/*
                     * Phase 2-J: 上下のメニュー (MobileTopBar / MobileBottomTabs) を
                     * 廃止し、左 48px サイドレールに ☰ + ▶ + 5 タブを集約。
                     * 編集エリアが viewport 縦 100% を使えるようになり、上流の
                     * paint editor / sound editor の縦最小サイズを満たせる。
                     */}
                    <MobileSideRail
                        onOpenDrawer={handleOpenDrawer}
                        spriteTabActive={spriteTabActive}
                        onSpriteTabActiveChange={handleSpriteTabActiveChange}
                        backpackOpen={backpackOpen}
                        onToggleBackpack={handleToggleBackpack}
                    />
                    <MobileDrawer open={drawerOpen} onClose={handleCloseDrawer} />
                    <MobileSpritePanel active={spriteTabActive} />
                    {/*
                     * Phase 2-J: コスチュームタブで上部ツールバーを出し入れする
                     * トグル。折りたたみ中は body class で paint-editor の上部
                     * ツールバーを display: none にし、canvas + ツールが viewport
                     * 縦 100% を使えるようにする。
                     */}
                    <MobilePaintToolbarToggle
                        active={paintToolbarToggleActive}
                        collapsed={paintToolbarCollapsed}
                        onToggle={handleTogglePaintToolbar}
                    />
                    {/*
                     * Phase 2-I: 縦向き時にオーバーレイを出して横にしてもらう。
                     * 上流の paint editor / sound editor の min-width 群が
                     * 390px に収まらないため、横固定運用に倒す。
                     */}
                    <MobileOrientationGate />
                </>
            </ConnectedIntlProvider>
        </>
    );
};

MobileGui.propTypes = {
    activeTabIndex: PropTypes.number.isRequired,
    isFullScreen: PropTypes.bool.isRequired,
};

const mapStateToProps = state => ({
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
    isFullScreen: state.scratchGui.mode.isFullScreen,
});

export default connect(mapStateToProps)(MobileGui);
