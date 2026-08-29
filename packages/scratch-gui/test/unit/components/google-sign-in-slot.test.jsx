/* eslint-env jest */
/**
 * The sign-in slot must take the GIS button down with it (#1149): unmounting
 * the login UI is how "the user gave up on signing in" reaches the auth layer.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React, { createRef } from 'react';
import GoogleSignInSlot from '../../../src/components/google-sign-in-slot/google-sign-in-slot.jsx';
import { cancelGoogleLogin } from '../../../src/lib/teacher-auth.js';

jest.mock('../../../src/lib/teacher-auth.js', () => ({
    cancelGoogleLogin: jest.fn(),
}));

describe('GoogleSignInSlot', () => {
    beforeEach(() => {
        cancelGoogleLogin.mockClear();
    });

    test('exposes the host node through the forwarded ref', () => {
        const ref = createRef();
        const { getByTestId } = render(<GoogleSignInSlot ref={ref} />);

        expect(ref.current).toBe(getByTestId('google-signin-slot'));
    });

    test('cancels the pending Google login when unmounted', () => {
        const { unmount } = render(<GoogleSignInSlot />);
        expect(cancelGoogleLogin).not.toHaveBeenCalled();

        unmount();

        expect(cancelGoogleLogin).toHaveBeenCalledTimes(1);
    });
});
