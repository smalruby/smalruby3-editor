import React, { useCallback, useState } from 'react';

import GUI from '../../containers/gui.jsx';
import ConnectedIntlProvider from '../../lib/connected-intl-provider.jsx';
import MobileBottomTabs from '../mobile-bottom-tabs/mobile-bottom-tabs.jsx';
import MobileDrawer from '../mobile-drawer/mobile-drawer.jsx';
import MobilePaletteAutoCloser from '../mobile-palette-auto-closer/mobile-palette-auto-closer.jsx';
import MobileSpritePanel from '../mobile-sprite-panel/mobile-sprite-panel.jsx';
import MobileTopBar from '../mobile-top-bar/mobile-top-bar.jsx';

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
 *   - PR-2D: ブロックパレットドロワー (<MobilePaletteAutoCloser /> で
 *     ブロックドラッグ開始時にパレットを自動クローズ)
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
const MobileGui = props => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [spriteTabActive, setSpriteTabActive] = useState(false);
    const handleOpenDrawer = useCallback(() => setDrawerOpen(true), []);
    const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);
    const handleSpriteTabActiveChange = useCallback(active => setSpriteTabActive(active), []);
    return (
        <>
            <GUI {...props} />
            {/*
             * MobileTopBar / MobileBottomTabs / MobileDrawer / MobileSpritePanel
             * は body 直下に Portal で出すため、<GUI> 内側の IntlProvider
             * context を使えない。別途 ConnectedIntlProvider で包む。
             * MobilePaletteAutoCloser は描画しないが、connect でディスパッチを
             * 受け取るため同じ Provider 配下に置く。
             */}
            <ConnectedIntlProvider>
                <>
                    <MobileTopBar onOpenDrawer={handleOpenDrawer} />
                    <MobileBottomTabs
                        spriteTabActive={spriteTabActive}
                        onSpriteTabActiveChange={handleSpriteTabActiveChange}
                    />
                    <MobilePaletteAutoCloser />
                    <MobileDrawer open={drawerOpen} onClose={handleCloseDrawer} />
                    <MobileSpritePanel active={spriteTabActive} />
                </>
            </ConnectedIntlProvider>
        </>
    );
};

export default MobileGui;
