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

import { cancelGoogleLogin } from '../../lib/teacher-auth.js';

const GoogleSignInSlot = forwardRef(({ className }, ref) => {
    useEffect(() => () => cancelGoogleLogin(), []);

    return (
        <div
            className={className}
            data-testid="google-signin-slot"
            ref={ref}
        />
    );
});

GoogleSignInSlot.displayName = 'GoogleSignInSlot';

GoogleSignInSlot.propTypes = {
    className: PropTypes.string,
};

export default GoogleSignInSlot;
