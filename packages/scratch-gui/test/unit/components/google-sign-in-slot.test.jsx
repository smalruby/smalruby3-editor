/* eslint-env jest */
/**
 * The sign-in slot must take the GIS button down with it (#1149): unmounting
 * the login UI is how "the user gave up on signing in" reaches the auth layer.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React, { createRef } from 'react';
import { IntlProvider } from 'react-intl';
import GoogleSignInSlot from '../../../src/components/google-sign-in-slot/google-sign-in-slot.jsx';
import { cancelGoogleLogin } from '../../../src/lib/teacher-auth.js';

jest.mock('../../../src/lib/teacher-auth.js', () => ({
    cancelGoogleLogin: jest.fn(),
}));

/** The slot renders a translated hint, so it needs an intl context. */
const renderSlot = (props = {}, ref) =>
    render(
        <IntlProvider locale="en">
            <GoogleSignInSlot ref={ref} {...props} />
        </IntlProvider>,
    );

describe('GoogleSignInSlot', () => {
    beforeEach(() => {
        cancelGoogleLogin.mockClear();
    });

    test('exposes the host node through the forwarded ref', () => {
        const ref = createRef();
        const { getByTestId } = renderSlot({}, ref);

        expect(ref.current).toBe(getByTestId('google-signin-slot'));
    });

    // The fallback button shows up only after the browser prompt failed, so
    // without a line explaining that, a second Google button is puzzling.
    test('says nothing while the fallback button is hidden', () => {
        const { queryByTestId } = renderSlot();

        expect(queryByTestId('google-signin-hint')).not.toBeInTheDocument();
    });

    test('explains the fallback button once it is shown', () => {
        const { getByTestId } = renderSlot({ showHint: true });

        expect(getByTestId('google-signin-hint')).toBeInTheDocument();
    });

    test('cancels the pending Google login when unmounted', () => {
        const { unmount } = renderSlot();
        expect(cancelGoogleLogin).not.toHaveBeenCalled();

        unmount();

        expect(cancelGoogleLogin).toHaveBeenCalledTimes(1);
    });
});
