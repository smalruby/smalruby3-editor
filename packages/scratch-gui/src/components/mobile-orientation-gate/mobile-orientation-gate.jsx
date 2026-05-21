import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, FormattedMessage } from 'react-intl';
import styles from './mobile-orientation-gate.css';

const PORTRAIT_QUERY = '(orientation: portrait)';

/**
 * sessionStorage key — true なら現在のブラウザセッション中は警告を表示しない。
 *
 * sessionStorage を使う理由: PC でウィンドウを縦長にリサイズしただけで警告が
 * 出るユースケースで dismiss できるようにしつつ、実機スマホで誤タップしても
 * リロード or 次回起動で復活させたい。永続化 (localStorage) は意図せず警告が
 * 消えたままになるのを避けるため採用しない。
 */
const DISMISS_STORAGE_KEY = 'smalruby:mobileOrientationGateDismissed';

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
    dismiss: {
        defaultMessage: 'Use as is',
        description: 'Mobile orientation gate button to dismiss the warning for the current session',
        id: 'gui.mobile.orientation.dismiss',
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
        const handler = (event) => setIsPortrait(event.matches);
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
 * sessionStorage に保持された dismiss 状態を読む。SSR / sessionStorage が
 * 使えない環境では false を返す。
 * @returns {boolean} dismiss 済みなら true
 */
const readDismissedFromStorage = () => {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    try {
        return window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
    } catch (e) {
        // sessionStorage が disable な環境 (Safari private mode 等) では throw する
        return false;
    }
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
 * - PC ブラウザでウィンドウを縦長にリサイズした場合も発火するので、ユーザーが
 *   「このまま使う」で当該セッション中は閉じられるようにしている
 *
 * 動作:
 * - `(orientation: portrait)` メディアクエリで横向き / 縦向きをリアルタイム検出
 * - 縦向き → オーバーレイ表示、横向き → オーバーレイ消失
 * - 「このまま使う」ボタン押下で sessionStorage に dismiss フラグを書き、
 *   同一セッション中は再表示しない (リロードで復活)
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
    const [dismissed, setDismissed] = useState(readDismissedFromStorage);
    const handleDismiss = useCallback(() => {
        setDismissed(true);
        if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
                window.sessionStorage.setItem(DISMISS_STORAGE_KEY, 'true');
            } catch (e) {
                // sessionStorage に書けなくても dismiss 自体は state で機能する
            }
        }
        // Blockly に再レイアウトを促す。gate に覆われた状態で初期化された
        // toolbox / flyout の幅計測は不正で、そのままだと Blocks コンポーネントの
        // shouldComponentUpdate が dismiss を検知せず PaletteToggle が描画されない。
        // 実機の portrait → landscape 回転時はブラウザが自動で resize を撃つため
        // 発生しないが、dismiss は viewport が変わらないので明示的に発火させる。
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('resize'));
        }
    }, []);
    if (typeof document === 'undefined') return null;
    if (!isPortrait) return null;
    if (dismissed) return null;
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
            <button
                type="button"
                className={styles.dismissButton}
                onClick={handleDismiss}
                data-testid="mobile-orientation-gate-dismiss"
            >
                <FormattedMessage {...messages.dismiss} />
            </button>
        </div>,
        document.body,
    );
};

export default MobileOrientationGate;
export { DISMISS_STORAGE_KEY, usePortraitOrientation };
