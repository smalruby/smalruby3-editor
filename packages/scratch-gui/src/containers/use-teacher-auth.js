/**
 * Teacher authentication hook.
 *
 * Manages ID token / auth provider state and provides login, logout,
 * silent re-authentication, and 401-handling callbacks.
 * Delegates to {@link ../lib/teacher-auth.js} for provider-specific logic.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    cancelGoogleLogin,
    isGoogleLoginInFlight,
    revealGoogleSignInButton,
    loginWithGoogle,
    requestMicrosoftIdToken,
    isMicrosoftAuthAvailable as checkMicrosoftAuth,
    attemptSilentReauth,
    clearAuthSession,
    cleanupOnReload,
} from '../lib/teacher-auth.js';

// Persists teacher login across modal close/open within same page session
let _cachedTeacherIdToken = null;
let _cachedAuthProvider = null;

// Clear stale MSAL sessions on page reload
cleanupOnReload();

/**
 * Return the cached teacher ID token (for initial phase calculation).
 * @returns {string|null} cached token
 */
export const getCachedTeacherIdToken = () => _cachedTeacherIdToken;

/**
 * Set the cached teacher ID token from outside (e.g. dev auto-login).
 * @param {string|null} token - the token to cache
 */
export const setCachedTeacherIdToken = (token) => {
    _cachedTeacherIdToken = token;
};

/**
 * @param {object} params - hook dependencies
 * @param {string} params.mode - 'student' | 'teacher'
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.setPhase - phase setter
 * @param {Function} params.showSessionExpiredError - session-expired error helper
 * @returns {object} auth state and handler functions
 */
const useTeacherAuth = ({ mode, clearError, setPhase, showSessionExpiredError }) => {
    const [idToken, setIdToken] = useState(_cachedTeacherIdToken);
    const [authProvider, setAuthProvider] = useState(_cachedAuthProvider);

    // Sync to module-level cache
    useEffect(() => {
        _cachedTeacherIdToken = idToken;
    }, [idToken]);
    useEffect(() => {
        _cachedAuthProvider = authProvider;
    }, [authProvider]);

    // Host node for the GIS sign-in button. Keeping it inside the modal means
    // the button disappears with the modal instead of sticking to the screen
    // as a body-level overlay (#1149).
    const googleSignInRef = useRef(null);

    // Abandoning the login (closing the modal, choosing Microsoft, unmounting)
    // must tear the GIS UI down and settle the pending promise.
    useEffect(() => () => cancelGoogleLogin(), []);

    // Why Google's own button took over from our login button, or null while
    // our button is still the entry point (#1149). 'dismissed' means the
    // browser prompt was closed without signing in — worth explaining;
    // 'unsupported' means this browser never had a prompt to show.
    const [googleFallbackReason, setGoogleFallbackReason] = useState(null);

    const handleGoogleLogin = useCallback(async () => {
        // A second press while a login is already running means the browser
        // prompt did not help, whether or not GIS reported it dismissed (#1149).
        if (isGoogleLoginInFlight()) {
            revealGoogleSignInButton();
            return;
        }
        clearError();
        setGoogleFallbackReason(null);
        try {
            const token = await loginWithGoogle({
                container: googleSignInRef.current,
                onFallbackVisible: (reason) => setGoogleFallbackReason(reason),
            });
            setIdToken(token);
            setAuthProvider('google');
            setPhase('teacher-class-list');
        } catch {
            clearError();
        } finally {
            setGoogleFallbackReason(null);
        }
    }, [clearError, setPhase]);

    const handleMicrosoftLogin = useCallback(async () => {
        clearError();
        // Switching providers abandons the Google attempt (#1149).
        cancelGoogleLogin();
        setGoogleFallbackReason(null);
        try {
            const token = await requestMicrosoftIdToken();
            setIdToken(token);
            setAuthProvider('microsoft');
            setPhase('teacher-class-list');
        } catch {
            clearError();
        }
    }, [clearError, setPhase]);

    /** Clear auth state only (caller should also reset other state). */
    const logoutAuth = useCallback(() => {
        clearAuthSession(authProvider);
        _cachedTeacherIdToken = null;
        _cachedAuthProvider = null;
        setIdToken(null);
        setAuthProvider(null);
    }, [authProvider]);

    const handleSilentReauth = useCallback(async () => {
        if (mode !== 'teacher') return null;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('devlogin')) return null;
        const newToken = await attemptSilentReauth(authProvider);
        if (newToken) {
            setIdToken(newToken);
        }
        return newToken;
    }, [mode, authProvider]);

    /**
     * Handle a 401 from a teacher API call.
     * Tries silent re-auth once; falls back to session expired alert.
     * Uses a ref guard to prevent infinite reauth loops.
     */
    const reauthInProgressRef = useRef(false);
    const handleTeacher401 = useCallback(async () => {
        if (reauthInProgressRef.current) return null;
        reauthInProgressRef.current = true;
        try {
            const newToken = await handleSilentReauth();
            if (newToken) return newToken;
        } finally {
            setTimeout(() => {
                reauthInProgressRef.current = false;
            }, 5000);
        }
        setIdToken(null);
        _cachedTeacherIdToken = null;
        showSessionExpiredError();
        return null;
    }, [handleSilentReauth, showSessionExpiredError]);

    // Debug: expose forceTeacher401 for manual testing
    useEffect(() => {
        if (typeof window !== 'undefined' && idToken) {
            window.smalruby = window.smalruby || {};
            window.smalruby.forceTeacher401 = () => {
                _cachedTeacherIdToken = 'expired.token.stub';
                setIdToken('expired.token.stub');
            };
        }
        return () => {
            if (typeof window !== 'undefined' && window.smalruby) {
                delete window.smalruby.forceTeacher401;
            }
        };
    }, [idToken]);

    return {
        idToken,
        setIdToken,
        authProvider,
        setAuthProvider,
        isMicrosoftAuthAvailable: checkMicrosoftAuth(),
        googleSignInRef,
        googleFallbackReason,
        handleGoogleLogin,
        handleMicrosoftLogin,
        logoutAuth,
        handleTeacher401,
    };
};

export default useTeacherAuth;
