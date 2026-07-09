import { useEffect, useState } from 'react';

/**
 * スマホ相当の狭い viewport を検知する hook。MobileGui と desktop GUI の
 * 出し分けに使う共通ブレークポイント。
 *
 * 閾値の根拠:
 * - 幅 743px は iPad mini portrait (744) を除外する境界値。iPhone 縦持ちの
 *   ように横が極端に狭い端末をスマホモードにする主条件。
 * - 高さ 500px はスマホ横持ち (844×390 等) を拾う保険。ただし **幅 950px 以下**
 *   に限定する。こうしないと Chromebook をズームして高さだけ縮んだ広い画面
 *   (例 1380×480) まで拾ってしまい、意図せずスマホモードに入る (Issue #865)。
 *   950px はスマホ横持ちの最大級 (iPhone Pro Max 系 ~932px) を含みつつ、
 *   Chromebook / ノート PC の一般的な幅 (>=1280px) を確実に除外する境界値。
 * @returns {boolean} スマホ相当のサイズなら true
 */
const NARROW_SCREEN_QUERY = '(max-width: 743px), (max-width: 950px) and (max-height: 500px)';

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
        const handler = (event) => setIsNarrow(event.matches);
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
