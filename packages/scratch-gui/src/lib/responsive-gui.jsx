import React from 'react';
import MobileGui from '../components/mobile-gui/mobile-gui.jsx';
import GUI from '../containers/gui.jsx';
import useIsNarrowScreen from './use-is-narrow-screen.js';

/**
 * 狭い viewport で <MobileGui>、そうでなければ <GUI> を出し分けるラッパー。
 * matchMedia でリアルタイムに切り替わるので resize / 端末回転に追従する。
 * @param {object} props - <GUI> / <MobileGui> に渡す props
 * @returns {JSX.Element} 選択された GUI コンポーネント
 */
const ResponsiveGui = props => {
    const isNarrow = useIsNarrowScreen();
    if (isNarrow) {
        return <MobileGui {...props} />;
    }
    return <GUI {...props} />;
};

export default ResponsiveGui;
