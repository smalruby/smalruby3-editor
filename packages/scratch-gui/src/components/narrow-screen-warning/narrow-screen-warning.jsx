import React, { useCallback, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './narrow-screen-warning.css';

const STORAGE_KEY = 'smalruby:narrowScreenWarningDismissed';
const NARROW_SCREEN_QUERY = '(max-width: 767px)';

const isDismissed = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

const persistDismissed = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
        /* ignore quota or privacy mode failures */
    }
};

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

const NarrowScreenWarning = () => {
    const isNarrow = useIsNarrowScreen();
    const [dismissed, setDismissed] = useState(isDismissed);

    const handleClose = useCallback(() => {
        persistDismissed();
        setDismissed(true);
    }, []);

    if (!isNarrow || dismissed) {
        return null;
    }

    return (
        <div
            className={styles.banner}
            role="status"
            data-testid="narrow-screen-warning"
        >
            <p className={styles.message}>
                <FormattedMessage
                    defaultMessage="📱 Some operations may be hard to use on narrow screens. We recommend using a PC or tablet for full editing."
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
        </div>
    );
};

export default NarrowScreenWarning;
