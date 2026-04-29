import React from 'react';

import GUI from '../../containers/gui.jsx';
import ConnectedIntlProvider from '../../lib/connected-intl-provider.jsx';
import MobileBottomTabs from '../mobile-bottom-tabs/mobile-bottom-tabs.jsx';
import MobilePaletteToggle from '../mobile-palette-toggle/mobile-palette-toggle.jsx';
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
 *   - PR-2D: ブロックパレットドロワー (本 PR、<MobilePaletteToggle /> で
 *     パレット表示・非表示をトグル、初回エントリーで自動非表示)
 *   - PR-2E: ハンバーガーメニュー (予定)
 *
 * 受け取る props は <GUI> と同一 (AppStateHOC / HashParserHOC からの全 props)。
 * @param {object} props - <GUI> と同じ props
 * @returns {JSX.Element} <GUI> + <MobileTopBar /> + <MobileBottomTabs />
 */
const MobileGui = props => (
    <>
        <GUI {...props} />
        {/*
         * MobileTopBar / MobileBottomTabs は body 直下に Portal で出すため、
         * <GUI> 内側の IntlProvider context を使えない。
         * 別途 ConnectedIntlProvider で包んで FormattedMessage を有効化する。
         */}
        <ConnectedIntlProvider>
            <>
                <MobileTopBar />
                <MobilePaletteToggle />
                <MobileBottomTabs />
            </>
        </ConnectedIntlProvider>
    </>
);

export default MobileGui;
