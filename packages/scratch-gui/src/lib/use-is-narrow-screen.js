import { useEffect, useState } from 'react';

/**
 * 「スマホ相当の小さい画面」を検知する React hook。
 *
 * issue #572 のレスポンシブ対応で、PC レイアウトと別 UI を出し分ける際の
 * 共通ブレークポイントとして使用する。
 *
 * 検出条件: viewport の幅 ≤ 767px または高さ ≤ 500px。
 * これにより、スマホ縦持ち (例 390x844) も横持ち (例 844x390) も同じ
 * mobile UI が出る (Phase 2-I で横固定運用に切り替えたため)。
 *
 * - スマホ縦持ち (390x844): width 390 ≤ 767 → match
 * - スマホ横持ち (844x390): height 390 ≤ 500 → match
 * - タブレット (820x1180 / 1180x820): 両方 > 閾値 → no match (desktop UI)
 * - PC (1920x1080): 両方 > 閾値 → no match (desktop UI)
 *
 * 高さの閾値は 500 で iPhone 14 Pro Max (横 430) 等を含むが、デスクトップで
 * ウィンドウを縦に縮めても 500 を下回らない範囲としてバランスを取る。
 *
 * 同じ matchMedia インスタンスを各コンポーネントが個別に購読すると、
 * リスナー数 = コンポーネント数になるが、それぞれ独立に最新値を持つので
 * 整合性は保たれる。
 * @returns {boolean} スマホ相当のサイズなら true
 */
const NARROW_SCREEN_QUERY = '(max-width: 767px), (max-height: 500px)';

const useIsNarrowScreen = () => {
    const [isNarrow, setIsNarrow] = useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia(NARROW_SCREEN_QUERY).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return () => {};
        }
        const mql = window.matchMedia(NARROW_SCREEN_QUERY);
        const handler = event => setIsNarrow(event.matches);
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        }
        // Safari < 14 fallback
        mql.addListener(handler);
        return () => mql.removeListener(handler);
    }, []);

    return isNarrow;
};

export default useIsNarrowScreen;
export { NARROW_SCREEN_QUERY };
