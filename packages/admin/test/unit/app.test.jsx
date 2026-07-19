import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

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

// The dashboard embeds the management views; they get their own tests.
jest.mock('../../src/components/shared-assignments-view.jsx', () => () => null);
jest.mock('../../src/components/classrooms-view.jsx', () => () => null);
jest.mock('../../src/components/bug-reports-view.jsx', () => () => null);

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

    test('the initial section is restored from the URL hash (session-expiry reload)', async () => {
        window.location.hash = '#/classrooms';
        mockGetDevLoginToken.mockReturnValue('dev-token');
        mockFetchMe.mockResolvedValue({email: 'admin@example.com', name: null, stage: 'stg'});

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument());
        expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('クラス・課題');
        window.location.hash = '';
    });

    test('an expired session (API 401) shows the reload prompt instead of raw errors', async () => {
        mockGetDevLoginToken.mockReturnValue('dev-token');
        mockFetchMe.mockResolvedValue({email: 'admin@example.com', name: null, stage: 'stg'});

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument());
        expect(screen.queryByTestId('admin-session-expired')).not.toBeInTheDocument();

        // Any API client broadcasts this on 401 (token lifetime ~1 hour).
        fireEvent(window, new Event('smalruby-admin:unauthorized'));
        expect(screen.getByTestId('admin-session-expired')).toBeInTheDocument();
        expect(screen.getByTestId('admin-session-expired').textContent).toContain('有効期限');

        const reloadMock = jest.fn();
        const original = window.location;
        delete window.location;
        window.location = {...original, reload: reloadMock};
        fireEvent.click(screen.getByTestId('admin-session-reload'));
        expect(reloadMock).toHaveBeenCalled();
        window.location = original;
    });

    test('a 401 before authorization does NOT trigger the session overlay', async () => {
        mockGetDevLoginToken.mockReturnValue('dev-token');
        mockFetchMe.mockRejectedValue(Object.assign(new Error('Invalid ID token'), {status: 401}));

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('admin-error')).toBeInTheDocument());
        fireEvent(window, new Event('smalruby-admin:unauthorized'));
        expect(screen.queryByTestId('admin-session-expired')).not.toBeInTheDocument();
    });

    test('the section nav switches between management views (issue #1084)', async () => {
        mockGetDevLoginToken.mockReturnValue('dev-token');
        mockFetchMe.mockResolvedValue({email: 'admin@example.com', name: null, stage: 'stg'});

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument());
        expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('みんなの課題');

        fireEvent.click(screen.getByTestId('admin-nav-classrooms'));
        expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('クラス・課題');

        fireEvent.click(screen.getByTestId('admin-nav-shared'));
        expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('みんなの課題');
    });
});
