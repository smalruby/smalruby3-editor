/**
 * Teacher authentication hook.
 *
 * Manages ID token / auth provider state and provides login, logout,
 * silent re-authentication, and 401-handling callbacks.
 * Delegates to {@link ../lib/teacher-auth.js} for provider-specific logic.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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

    const handleGoogleLogin = useCallback(async () => {
        clearError();
        try {
            const token = await loginWithGoogle();
            setIdToken(token);
            setAuthProvider('google');
            setPhase('teacher-dashboard');
        } catch {
            clearError();
        }
    }, [clearError, setPhase]);

    const handleMicrosoftLogin = useCallback(async () => {
        clearError();
        try {
            const token = await requestMicrosoftIdToken();
            setIdToken(token);
            setAuthProvider('microsoft');
            setPhase('teacher-dashboard');
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
        handleGoogleLogin,
        handleMicrosoftLogin,
        logoutAuth,
        handleTeacher401,
    };
};

export default useTeacherAuth;
