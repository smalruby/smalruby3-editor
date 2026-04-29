import React, { useCallback, useState } from 'react';

import GUI from '../../containers/gui.jsx';
import ConnectedIntlProvider from '../../lib/connected-intl-provider.jsx';
import MobileBottomTabs from '../mobile-bottom-tabs/mobile-bottom-tabs.jsx';
import MobileDrawer from '../mobile-drawer/mobile-drawer.jsx';
import MobilePaletteAutoCloser from '../mobile-palette-auto-closer/mobile-palette-auto-closer.jsx';
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
 *     ブロックドラッグ開始時にパレットを自動クローズ。手動切替は
 *     upstream の <PaletteToggle> を共有 — モバイル時のみ CSS でハンドルを
 *     大きくする)
 *   - PR-2E: ハンバーガーメニュー (本 PR、<MobileDrawer /> + <MobileTopBar />
 *     左端の ☰ ボタン + プロジェクトタイトル表示。新しいプロジェクト /
 *     パソコンから開く / パソコンに保存 / 言語切替 (en/ja/ja-Hira) を提供)
 *
 * ドロワーの開閉状態は React の useState で MobileGui がローカルに保持する。
 * 外部 (URL や永続化) との連携が必要になったときに Redux 化する想定。
 *
 * 受け取る props は <GUI> と同一 (AppStateHOC / HashParserHOC からの全 props)。
 * @param {object} props - <GUI> と同じ props
 * @returns {JSX.Element} <GUI> + 各種 mobile-only コンポーネント
 */
const MobileGui = props => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const handleOpenDrawer = useCallback(() => setDrawerOpen(true), []);
    const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);
    return (
        <>
            <GUI {...props} />
            {/*
             * MobileTopBar / MobileBottomTabs / MobileDrawer は body 直下に
             * Portal で出すため、<GUI> 内側の IntlProvider context を使えない。
             * 別途 ConnectedIntlProvider で包んで FormattedMessage を有効化する。
             * MobilePaletteAutoCloser は描画しないが、connect でディスパッチを
             * 受け取るため同じ Provider 配下に置く。
             */}
            <ConnectedIntlProvider>
                <>
                    <MobileTopBar onOpenDrawer={handleOpenDrawer} />
                    <MobileBottomTabs />
                    <MobilePaletteAutoCloser />
                    <MobileDrawer open={drawerOpen} onClose={handleCloseDrawer} />
                </>
            </ConnectedIntlProvider>
        </>
    );
};

export default MobileGui;
