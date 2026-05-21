import React, { useEffect, useRef } from 'react';
import MobileGui from '../components/mobile-gui/mobile-gui.jsx';
import GUI from '../containers/gui.jsx';
import useIsNarrowScreen from './use-is-narrow-screen.js';

/**
 * 狭い viewport で <MobileGui>、そうでなければ <GUI> を出し分けるラッパー。
 * matchMedia でリアルタイムに切り替わるので resize / 端末回転に追従する。
 *
 * `isNarrow` が変化した直後 (= MobileGui ↔ GUI を swap した直後) に明示的な
 * `resize` イベントを撃つ。これは、新しい React サブツリーで初期化される
 * Blockly workspace が初期描画時の getBBox / getBoundingClientRect 結果を
 * もとに toolbox / flyout サイズを確定するためで、サブツリー mount 後に
 * resize を流さないと PaletteToggle (◀/▶) の親要素が null 扱いになって描画
 * されない不具合が出る。ブラウザ自体の resize イベントは swap 前に発火する
 * ため、新しい workspace には届かない。
 * @param {object} props - <GUI> / <MobileGui> に渡す props
 * @returns {JSX.Element} 選択された GUI コンポーネント
 */
const ResponsiveGui = (props) => {
    const isNarrow = useIsNarrowScreen();
    const isFirstRenderRef = useRef(true);
    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return;
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('resize'));
        }
    }, [isNarrow]);
    if (isNarrow) {
        return <MobileGui {...props} />;
    }
    return <GUI {...props} />;
};

export default ResponsiveGui;
