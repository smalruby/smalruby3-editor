import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, FormattedMessage } from 'react-intl';
import styles from './mobile-orientation-gate.css';

const PORTRAIT_QUERY = '(orientation: portrait)';

const messages = defineMessages({
    title: {
        defaultMessage: 'Please rotate your device',
        description: 'Mobile orientation gate title shown when user holds the device in portrait',
        id: 'gui.mobile.orientation.title',
    },
    body: {
        defaultMessage: 'Smalruby works best in landscape mode on phones.',
        description: 'Mobile orientation gate body explaining landscape requirement',
        id: 'gui.mobile.orientation.body',
    },
    iosNote: {
        defaultMessage: 'On iOS, make sure orientation lock is OFF (Control Center).',
        description: 'Mobile orientation gate note for iOS users about orientation lock',
        id: 'gui.mobile.orientation.iosNote',
    },
});

/**
 * `(orientation: portrait)` メディアクエリを購読する hook。
 *
 * SSR / matchMedia 非対応環境では false を返す。
 * @returns {boolean} 縦向き (portrait) の時 true
 */
const usePortraitOrientation = () => {
    const [isPortrait, setIsPortrait] = useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        return window.matchMedia(PORTRAIT_QUERY).matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
        const mql = window.matchMedia(PORTRAIT_QUERY);
        const handler = event => setIsPortrait(event.matches);
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        }
        // Safari < 14 fallback
        mql.addListener(handler);
        return () => mql.removeListener(handler);
    }, []);
    return isPortrait;
};

/**
 * 縦向き (portrait) の時だけフルスクリーンオーバーレイを表示して、
 * 横向きにするよう案内するゲート。
 *
 * 背景:
 * - upstream の <PaintEditor> や <SoundEditor> は密度が高く、390px 縦持ちでは
 *   どうしてもボタンが画面外にはみ出してしまう (524px / 600px+ の min-width
 *   群が編集機能の核なので削れない)
 * - スマホは横向き運用に割り切ることで開発コストを抑える
 *
 * 動作:
 * - `(orientation: portrait)` メディアクエリで横向き / 縦向きをリアルタイム検出
 * - 縦向き → オーバーレイ表示、横向き → オーバーレイ消失
 * - 自動回転: PWA (manifest `orientation: landscape-primary`) ホーム画面起動時のみ
 *   有効 (Android Chrome / iOS の home screen)。通常の Safari タブでは
 *   ユーザーが手動で回転する必要がある。
 *
 * iOS Safari では JS の `screen.orientation.lock()` が無効化されているため
 * 自動回転は不可能。ユーザーには「コントロールセンターで画面の向きロックを
 * 解除してから横にしてね」と案内する。
 *
 * 子要素は描画しつづけて、Blockly 等の重い state を回転で失わないようにする
 * (オーバーレイは上に重ねるだけ)。
 * @returns {JSX.Element|null} portal でレンダリングされる縦向き案内オーバーレイ
 */
const MobileOrientationGate = () => {
    const isPortrait = usePortraitOrientation();
    if (typeof document === 'undefined') return null;
    if (!isPortrait) return null;
    return createPortal(
        <div className={styles.overlay} role="alert" data-testid="mobile-orientation-gate">
            <div className={styles.iconRow} aria-hidden="true">
                📱
            </div>
            <div className={styles.title}>
                <FormattedMessage {...messages.title} />
            </div>
            <div className={styles.message}>
                <FormattedMessage {...messages.body} />
            </div>
            <div className={styles.note}>
                <FormattedMessage {...messages.iosNote} />
            </div>
        </div>,
        document.body,
    );
};

export default MobileOrientationGate;
export { usePortraitOrientation };
