import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import styles from './welcome-tooltip.css';

const STORAGE_KEY_FIRST_SHOWN_AT = 'smalruby:welcomeTooltipFirstShownAt';
const STORAGE_KEY_DISMISSED = 'smalruby:welcomeTooltipDismissed';
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

const safeGet = (key) => {
    try {
        return window.localStorage.getItem(key);
    } catch (_) {
        return null;
    }
};

const safeSet = (key, value) => {
    try {
        window.localStorage.setItem(key, value);
    } catch (_) {
        // Ignore quota / privacy mode failures
    }
};

// Decide whether to render and update first-shown timestamp on first render.
// Exported for unit tests.
export const computeInitialVisibility = (now = Date.now()) => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    if (safeGet(STORAGE_KEY_DISMISSED) === 'true') return false;
    const firstShownAt = Number(safeGet(STORAGE_KEY_FIRST_SHOWN_AT));
    if (!firstShownAt) {
        safeSet(STORAGE_KEY_FIRST_SHOWN_AT, String(now));
        return true;
    }
    if (now - firstShownAt > FIVE_DAYS_MS) {
        safeSet(STORAGE_KEY_DISMISSED, 'true');
        return false;
    }
    return true;
};

const WelcomeTooltip = ({ onClick }) => {
    const [visible, setVisible] = useState(() => computeInitialVisibility());

    const dismiss = useCallback(() => {
        safeSet(STORAGE_KEY_DISMISSED, 'true');
        setVisible(false);
    }, []);

    const handleClick = useCallback(() => {
        dismiss();
        onClick();
    }, [dismiss, onClick]);

    const handleClose = useCallback(
        (e) => {
            e.stopPropagation();
            dismiss();
        },
        [dismiss],
    );

    if (!visible) return null;

    return (
        <div className={styles.tooltipContainer} data-testid="welcome-tooltip">
            <div
                className={styles.tooltip}
                onClick={handleClick}
                role="button"
                tabIndex={0}
            >
                <div className={styles.arrow} />
                <FormattedMessage
                    defaultMessage="Welcome to Smalruby"
                    description="Balloon hint near the help button inviting users to open the welcome modal"
                    id="gui.welcomeTooltip.label"
                />
                <button
                    aria-label="Close"
                    className={styles.close}
                    data-testid="welcome-tooltip-close"
                    onClick={handleClose}
                    type="button"
                >
                    {'×'}
                </button>
            </div>
        </div>
    );
};

WelcomeTooltip.propTypes = {
    onClick: PropTypes.func.isRequired,
};

export default WelcomeTooltip;
export { STORAGE_KEY_FIRST_SHOWN_AT, STORAGE_KEY_DISMISSED, FIVE_DAYS_MS };
