import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage } from 'react-intl';

import getUrlParams from '../../lib/url-params.js';
import useIsNarrowScreen from '../../lib/use-is-narrow-screen.js';
import styles from './narrow-screen-warning.css';

/**
 * バナーを visual viewport の下端に追従させる (position: fixed 前提)。
 * fixed の containing block は layout viewport なので、visual viewport との
 * オフセット (visualViewport.offsetTop / offsetLeft) を加味して位置決めする。
 * 縦スクロール領域には影響しない (fixed なので body の overflow に乗らない)。
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
            // MobileGui (Phase 2-B) のボトムタブが viewport 下端を占有している
            // ときは、その上に積み上げる。タブが無いときは従来どおり下端に貼る。
            const tabsEl = document.querySelector('[data-testid="mobile-bottom-tabs"]');
            const tabsHeight = tabsEl ? tabsEl.offsetHeight : 0;
            if (vv) {
                // fixed コンテキストなので layout viewport 基準の座標で指定
                el.style.top = `${vv.offsetTop + vv.height - height - tabsHeight}px`;
                el.style.left = `${vv.offsetLeft}px`;
                el.style.width = `${vv.width}px`;
            } else {
                el.style.top = `${window.innerHeight - height - tabsHeight}px`;
                el.style.left = '0px';
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
    // ?mobile_gui=1 でモバイル専用 UI がアクティブなときは案内不要
    // (MobileGui 自体が狭幅向けに最適化されているため)。
    const { mobileGui: mobileGuiOptedIn } = getUrlParams();
    const visible = isNarrow && !dismissed && !mobileGuiOptedIn;
    useVisualViewportPosition(ref, visible);

    const handleClose = useCallback(() => {
        setDismissed(true);
    }, []);

    const handleTryMobileBeta = useCallback(() => {
        if (typeof window === 'undefined' || !window.location) return;
        // 既存の URL を尊重しつつ ?mobile_gui=1 を追加 (既に他のパラメータが
        // ある場合は & で連結)。クエリ重複を避けるため URLSearchParams で扱う。
        const url = new URL(window.location.href);
        url.searchParams.set('mobile_gui', '1');
        window.location.assign(url.toString());
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
                {' '}
                <button
                    className={styles.tryMobileLink}
                    type="button"
                    onClick={handleTryMobileBeta}
                    data-testid="narrow-screen-warning-try-mobile"
                >
                    <FormattedMessage
                        defaultMessage="Try mobile beta"
                        description="Inline link in the narrow-screen warning that adds ?mobile_gui=1 to URL and reloads to launch the mobile-optimized UI"
                        id="gui.narrowScreenWarning.tryMobileBeta"
                    />
                </button>
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
