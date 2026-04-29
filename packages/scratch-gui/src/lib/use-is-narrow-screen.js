import { useEffect, useState } from 'react';

/**
 * 「狭幅画面 (= スマホ縦持ち相当、< 768px)」を検知する React hook。
 *
 * issue #572 のレスポンシブ対応で、PC レイアウトと別 UI を出し分ける際の
 * 共通ブレークポイントとして使用する。
 *
 * 同じ matchMedia インスタンスを各コンポーネントが個別に購読すると、
 * リスナー数 = コンポーネント数になるが、それぞれ独立に最新値を持つので
 * 整合性は保たれる。
 * @returns {boolean} viewport が 767px 以下なら true
 */
const NARROW_SCREEN_QUERY = '(max-width: 767px)';

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
