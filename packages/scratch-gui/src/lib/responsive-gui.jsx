import React from 'react';
import MobileGui from '../components/mobile-gui/mobile-gui.jsx';
import GUI from '../containers/gui.jsx';
import { DISPLAY_MODE_DESKTOP, DISPLAY_MODE_MOBILE } from './settings/display-mode/index.js';
import useDisplayMode from './use-display-mode.js';
import useIsNarrowScreen from './use-is-narrow-screen.js';

/**
 * 狭い viewport で <MobileGui>、そうでなければ <GUI> を出し分けるラッパー。
 * matchMedia でリアルタイムに切り替わるので resize / 端末回転に追従する。
 *
 * ユーザーが表示モードを明示指定している場合 (Issue #865) はそれを優先する:
 * `desktop` は常に <GUI>、`mobile` は常に <MobileGui>、`auto` は viewport 判定。
 * これにより Chromebook 等で意図せずスマホモードに入ってしまっても、
 * 設定メニュー / モバイルドロワーから PC モードへ固定できる。
 * @param {object} props - <GUI> / <MobileGui> に渡す props
 * @returns {JSX.Element} 選択された GUI コンポーネント
 */
const ResponsiveGui = (props) => {
    const isNarrow = useIsNarrowScreen();
    const displayMode = useDisplayMode();

    let isMobile;
    if (displayMode === DISPLAY_MODE_DESKTOP) {
        isMobile = false;
    } else if (displayMode === DISPLAY_MODE_MOBILE) {
        isMobile = true;
    } else {
        isMobile = isNarrow;
    }

    if (isMobile) {
        return <MobileGui {...props} />;
    }
    return <GUI {...props} />;
};

export default ResponsiveGui;
