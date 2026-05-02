import { useEffect, useState } from 'react';

/**
 * スマホ相当の狭い viewport を検知する hook。MobileGui と desktop GUI の
 * 出し分けに使う共通ブレークポイント。
 *
 * 閾値の根拠:
 * - 幅 743px は iPad mini portrait (744) を除外する境界値
 * - 高さ 500px はスマホ横持ち (844×390 等) を拾う保険
 *   (デスクトップで 500 以下に縮めても他の min-height 制約に引っかかる範囲)
 * @returns {boolean} スマホ相当のサイズなら true
 */
const NARROW_SCREEN_QUERY = '(max-width: 743px), (max-height: 500px)';

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
