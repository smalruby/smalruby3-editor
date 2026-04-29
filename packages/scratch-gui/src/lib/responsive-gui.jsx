import React from 'react';
import MobileGui from '../components/mobile-gui/mobile-gui.jsx';
import GUI from '../containers/gui.jsx';
import getUrlParams from './url-params.js';
import useIsNarrowScreen from './use-is-narrow-screen.js';

/**
 * 狭幅 viewport で MobileGui を、それ以外で <GUI> を出し分けるラッパー
 * (issue #572 Phase 2)。
 *
 * MobileGui は **URL パラメーター `mobile_gui=1` が指定されたときのみ** 採用される。
 * オプトインなので Phase 2 が未完成でも develop にマージしても影響しない。
 *
 * 切替条件:
 * 1. URL に `?mobile_gui=1` が付いている
 * 2. かつ viewport 幅が 768px 未満 (matchMedia で実時間判定)
 *
 * 上記が両方 true → <MobileGui>
 * いずれか false → <GUI> (既存挙動)
 *
 * URL パラメーターは初回読み込み時に評価される (キャッシュされる)。
 * viewport 変化 (resize / 端末回転) はリアルタイムで反映される。
 * @param {object} props - <GUI> に渡される全 props
 * @returns {JSX.Element} <GUI> または <MobileGui>
 */
const ResponsiveGui = props => {
    const isNarrow = useIsNarrowScreen();
    const { mobileGui: optedIn } = getUrlParams();
    if (optedIn && isNarrow) {
        return <MobileGui {...props} />;
    }
    return <GUI {...props} />;
};

export default ResponsiveGui;
