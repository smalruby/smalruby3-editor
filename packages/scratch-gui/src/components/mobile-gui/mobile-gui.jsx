import React from 'react';

import GUI from '../../containers/gui.jsx';
import ConnectedIntlProvider from '../../lib/connected-intl-provider.jsx';
import MobileBottomTabs from '../mobile-bottom-tabs/mobile-bottom-tabs.jsx';
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
 *   - PR-2D: ブロックパレットドロワー (本 PR、<MobilePaletteAutoCloser /> で
 *     初回エントリー時とブロックドラッグ開始時にパレットを自動クローズ。
 *     パレット表示・非表示の手動切替は upstream の <PaletteToggle> を
 *     共有 — モバイル時のみ CSS でハンドルを大きくする)
 *   - PR-2E: ハンバーガーメニュー (予定)
 *
 * 受け取る props は <GUI> と同一 (AppStateHOC / HashParserHOC からの全 props)。
 * @param {object} props - <GUI> と同じ props
 * @returns {JSX.Element} <GUI> + <MobileTopBar /> + <MobileBottomTabs /> +
 *   <MobilePaletteAutoCloser />
 */
const MobileGui = props => (
    <>
        <GUI {...props} />
        {/*
         * MobileTopBar / MobileBottomTabs は body 直下に Portal で出すため、
         * <GUI> 内側の IntlProvider context を使えない。
         * 別途 ConnectedIntlProvider で包んで FormattedMessage を有効化する。
         * MobilePaletteAutoCloser は描画しないが、connect でディスパッチを
         * 受け取るため同じ Provider 配下に置く。
         */}
        <ConnectedIntlProvider>
            <>
                <MobileTopBar />
                <MobileBottomTabs />
                <MobilePaletteAutoCloser />
            </>
        </ConnectedIntlProvider>
    </>
);

export default MobileGui;
