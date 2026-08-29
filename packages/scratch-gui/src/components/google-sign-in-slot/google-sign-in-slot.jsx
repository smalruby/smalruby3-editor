/**
 * Host node for the Google Identity Services sign-in button.
 *
 * The GIS button is rendered imperatively by `loginWithGoogle`, so it needs a
 * DOM node owned by the modal that started the login. Mounting it here (rather
 * than letting the auth library append a fixed overlay to `document.body`)
 * means the button disappears with the surrounding UI, and unmounting also
 * cancels the pending login so its promise never dangles (#1149).
 */
import PropTypes from 'prop-types';
import React, { forwardRef, useEffect } from 'react';
import { FormattedMessage } from 'react-intl';

import { cancelGoogleLogin } from '../../lib/teacher-auth.js';

import styles from './google-sign-in-slot.css';

const GoogleSignInSlot = forwardRef(({ className, showHint }, ref) => {
    useEffect(() => () => cancelGoogleLogin(), []);

    // The hint is a sibling, not a wrapper: the host node must stay the only
    // element carrying `className` so its `:empty` rule keeps collapsing the
    // slot while no button is rendered.
    return (
        <>
            {/* The button only shows up when the browser's own Google prompt
                did not sign the user in, so it needs a line saying what it is
                for — otherwise a second Google button is just puzzling. */}
            {showHint && (
                <p className={styles.hint} data-testid="google-signin-hint">
                    <FormattedMessage
                        defaultMessage="Could not sign in automatically. Please use the button below."
                        description="Hint shown above the fallback Google sign-in button"
                        id="gui.classroom.management.googleSignInHint"
                    />
                </p>
            )}
            <div className={className} data-testid="google-signin-slot" ref={ref} />
        </>
    );
});

GoogleSignInSlot.displayName = 'GoogleSignInSlot';

GoogleSignInSlot.propTypes = {
    className: PropTypes.string,
    showHint: PropTypes.bool,
};

export default GoogleSignInSlot;
