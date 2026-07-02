import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, FormattedMessage, injectIntl } from 'react-intl';

import intlShape from '../../lib/intlShape';
import { DISPLAY_MODE_DESKTOP } from '../../lib/settings/display-mode/index.js';
import { persistDisplayMode } from '../../lib/settings/display-mode/persistence.js';
import closeIcon from '../mobile-drawer/icon--close.svg';
import styles from './mobile-mode-notice.css';

/**
 * localStorage key — 一度閉じたら、そのマシンでは以後この案内を出さない。
 *
 * 「スマホモードであること + PC モードへ切り替えられること」を一度知れば十分
 * なので、繰り返し出して邪魔しないよう永続的に dismiss を記録する。
 */
const DISMISS_STORAGE_KEY = 'smalruby:mobileModeNoticeDismissed';

const messages = defineMessages({
    body: {
        defaultMessage: 'This is the smartphone screen. It differs from the PC layout.',
        description: 'Notice shown in mobile mode explaining the current layout differs from PC',
        id: 'gui.mobile.modeNotice.body',
    },
    switchToDesktop: {
        defaultMessage: 'Switch to PC mode',
        description: 'Button in the mobile-mode notice that switches to the PC (desktop) layout',
        id: 'gui.mobile.drawer.switchToDesktop',
    },
    dismiss: {
        defaultMessage: 'Got it',
        description: 'Button in the mobile-mode notice that dismisses it (stays in smartphone mode)',
        id: 'gui.mobile.modeNotice.dismiss',
    },
    closeAriaLabel: {
        defaultMessage: 'Close notice',
        description: 'Aria label for the mobile-mode notice close button',
        id: 'gui.mobile.modeNotice.close',
    },
});

const wasDismissed = () => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
};

/**
 * スマホモードで表示する一度きりの案内 (Issue #865)。
 *
 * 「いまはスマホ用の画面であり PC とは違うこと」「PC モードへ切り替えられること
 * (メニューからいつでも変更可)」をユーザーに伝えるための、閉じられる通知バー。
 * Chromebook のズーム等で意図せずスマホモードに入ったユーザーが、状況を理解して
 * 自力で PC モードへ抜け出せるようにする。
 *
 * MobileGui からのみマウントされる (= スマホモード時のみ)。PC (広幅) では
 * MobileGui 自体がマウントされないので表示されない。閉じると localStorage に
 * 記録し、そのマシンでは以後出さない。
 * @param {object} props - props
 * @param {object} props.intl - react-intl
 * @returns {JSX.Element|null} portal 経由で body 直下にレンダリング (dismiss 済みなら null)
 */
const MobileModeNoticeComponent = ({ intl }) => {
    const [visible, setVisible] = useState(() => !wasDismissed());

    const dismiss = useCallback(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
        }
        setVisible(false);
    }, []);

    const handleSwitchToDesktop = useCallback(() => {
        // PC モードへ固定 (localStorage 保存)。ResponsiveGui がイベントを受けて
        // desktop GUI に切り替える。以後この案内も不要なので dismiss も記録する。
        persistDisplayMode(DISPLAY_MODE_DESKTOP);
        dismiss();
    }, [dismiss]);

    if (typeof document === 'undefined' || !visible) {
        return null;
    }

    return createPortal(
        <div
            className={styles.notice}
            role="status"
            data-testid="mobile-mode-notice"
        >
            <span className={styles.body}>
                <FormattedMessage {...messages.body} />
            </span>
            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.switchButton}
                    onClick={handleSwitchToDesktop}
                    data-testid="mobile-mode-notice-switch"
                >
                    <FormattedMessage {...messages.switchToDesktop} />
                </button>
                <button
                    type="button"
                    className={styles.dismissButton}
                    onClick={dismiss}
                    data-testid="mobile-mode-notice-dismiss"
                >
                    <FormattedMessage {...messages.dismiss} />
                </button>
            </div>
            <button
                type="button"
                className={styles.closeButton}
                onClick={dismiss}
                aria-label={intl.formatMessage(messages.closeAriaLabel)}
                data-testid="mobile-mode-notice-close"
            >
                <img className={styles.closeIcon} src={closeIcon} alt="" aria-hidden="true" />
            </button>
        </div>,
        document.body,
    );
};

MobileModeNoticeComponent.propTypes = {
    intl: intlShape.isRequired,
};

const MobileModeNotice = injectIntl(MobileModeNoticeComponent);

export default MobileModeNotice;
export { MobileModeNoticeComponent, DISMISS_STORAGE_KEY };
