import React from 'react';
import MobileGui from '../components/mobile-gui/mobile-gui.jsx';
import GUI from '../containers/gui.jsx';
import useIsNarrowScreen from './use-is-narrow-screen.js';

/**
 * 狭幅 viewport で MobileGui を、それ以外で <GUI> を出し分けるラッパー
 * (issue #572 Phase 2)。
 *
 * 切替条件: viewport 幅 ≤ 743px または高さ ≤ 500px のとき MobileGui。
 * 判定は `useIsNarrowScreen` (matchMedia) でリアルタイムに反映するため、
 * resize / 端末回転に追従する。
 *
 * 旧実装は `?mobile_gui=1` URL パラメータでオプトインする方式だったが、
 * Phase 3 シリーズで MobileGui の完成度が上がったため、フラグなしで
 * viewport だけを根拠に自動判定する形へ移行した。
 * @param {object} props - <GUI> に渡される全 props
 * @returns {JSX.Element} viewport が狭ければ <MobileGui>、そうでなければ <GUI>
 */
const ResponsiveGui = props => {
    const isNarrow = useIsNarrowScreen();
    if (isNarrow) {
        return <MobileGui {...props} />;
    }
    return <GUI {...props} />;
};

export default ResponsiveGui;
