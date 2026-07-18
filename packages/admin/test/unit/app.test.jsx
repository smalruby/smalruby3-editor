import '@testing-library/jest-dom';
import {render, screen, waitFor} from '@testing-library/react';

const mockFetchMe = jest.fn();
const mockSetIdToken = jest.fn();
jest.mock('../../src/lib/admin-api.js', () => ({
    fetchMe: (...args) => mockFetchMe(...args),
    setIdToken: (...args) => mockSetIdToken(...args)
}));

const mockGetDevLoginToken = jest.fn();
const mockInitGoogleSignIn = jest.fn();
jest.mock('../../src/lib/google-auth.js', () => ({
    getDevLoginToken: (...args) => mockGetDevLoginToken(...args),
    initGoogleSignIn: (...args) => mockInitGoogleSignIn(...args)
}));

import App from '../../src/components/app.jsx';

describe('App auth flow', () => {
    beforeEach(() => {
        mockFetchMe.mockReset();
        mockSetIdToken.mockReset();
        mockGetDevLoginToken.mockReset().mockReturnValue(null);
        mockInitGoogleSignIn.mockReset().mockResolvedValue();
    });

    test('renders the sign-in button container when signed out', () => {
        render(<App />);
        expect(screen.getByTestId('admin-signin-button')).toBeInTheDocument();
        expect(mockInitGoogleSignIn).toHaveBeenCalled();
    });

    test('an allowlisted admin reaches the dashboard', async () => {
        mockGetDevLoginToken.mockReturnValue('dev-token');
        mockFetchMe.mockResolvedValue({email: 'admin@example.com', name: null, stage: 'stg'});

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument());
        expect(screen.getByTestId('admin-me-email')).toHaveTextContent('admin@example.com');
        expect(mockSetIdToken).toHaveBeenCalledWith('dev-token');
    });

    test('an authenticated non-admin sees the forbidden screen and the token is dropped', async () => {
        mockGetDevLoginToken.mockReturnValue('dev-token');
        mockFetchMe.mockRejectedValue(Object.assign(new Error('Not an administrator'), {status: 403}));

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('admin-forbidden')).toBeInTheDocument());
        expect(mockSetIdToken).toHaveBeenLastCalledWith(null);
    });

    test('other API failures surface as an error message', async () => {
        mockGetDevLoginToken.mockReturnValue('dev-token');
        mockFetchMe.mockRejectedValue(Object.assign(new Error('boom'), {status: 500}));

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('admin-error')).toHaveTextContent('boom'));
    });
});
