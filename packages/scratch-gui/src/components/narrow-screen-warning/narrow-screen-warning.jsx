import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage } from 'react-intl';

import styles from './narrow-screen-warning.css';

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

/**
 * バナーを visual viewport の下端に追従させる。
 * `position: fixed` を使うと scratch-gui のレイアウトの都合で
 * containing block が viewport ではなく body / html になってしまい、
 * 「body より下」に飛ぶ事象がある (issue #572 で観測)。
 * `position: absolute` + `window.visualViewport` で page 座標を直接指定して回避する。
 * @param {object} ref - バナー root への React ref
 * @param {boolean} enabled - 位置追従を有効化するか
 */
const useVisualViewportPosition = (ref, enabled) => {
    useLayoutEffect(() => {
        if (!enabled || !ref.current) return () => {};
        if (typeof window === 'undefined') return () => {};
        const el = ref.current;
        const vv = window.visualViewport;

        const update = () => {
            const height = el.offsetHeight;
            if (vv) {
                el.style.top = `${vv.pageTop + vv.height - height}px`;
                el.style.left = `${vv.pageLeft}px`;
                el.style.width = `${vv.width}px`;
            } else {
                // 古い環境向けフォールバック
                el.style.top = `${window.scrollY + window.innerHeight - height}px`;
                el.style.left = `${window.scrollX}px`;
                el.style.width = `${window.innerWidth}px`;
            }
        };

        update();
        const targets = vv ? [vv, window] : [window];
        const events = ['resize', 'scroll'];
        for (const t of targets) {
            for (const ev of events) {
                t.addEventListener(ev, update, { passive: true });
            }
        }
        return () => {
            for (const t of targets) {
                for (const ev of events) {
                    t.removeEventListener(ev, update);
                }
            }
        };
    }, [enabled, ref]);
};

const NarrowScreenWarning = () => {
    const isNarrow = useIsNarrowScreen();
    // 永続化はしない (issue #572 Phase 1 では狭幅利用は鑑賞用途として
    // 案内し続ける)。dismiss は現在の画面表示のみで、リロードや再訪では再表示。
    const [dismissed, setDismissed] = useState(false);
    const ref = useRef(null);
    const visible = isNarrow && !dismissed;
    useVisualViewportPosition(ref, visible);

    const handleClose = useCallback(() => {
        setDismissed(true);
    }, []);

    if (!visible) {
        return null;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    // body 直下に Portal で飛ばし、JS で visualViewport 座標へ位置決め。
    return createPortal(
        <div ref={ref} className={styles.banner} role="status" data-testid="narrow-screen-warning">
            <p className={styles.message}>
                <FormattedMessage
                    defaultMessage="📱 For full editing, a PC or tablet is recommended."
                    description="Banner shown on narrow screens (e.g. iPhone) suggesting PC/tablet for editing"
                    id="gui.narrowScreenWarning.message"
                />
            </p>
            <button
                className={styles.closeButton}
                type="button"
                onClick={handleClose}
                data-testid="narrow-screen-warning-close"
            >
                <FormattedMessage
                    defaultMessage="Close"
                    description="Button to dismiss the narrow-screen warning banner"
                    id="gui.narrowScreenWarning.close"
                />
            </button>
        </div>,
        document.body,
    );
};

export default NarrowScreenWarning;
