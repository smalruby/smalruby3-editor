/**
 * Bug report modal container.
 *
 * Orchestrates the program bug report flow: first-use consent, Google/Microsoft
 * login (reusing teacher-auth), the report form (project attached via
 * use-bug-report-submit), and the reporter's own "my reports" list. All state
 * is self-sourced from Redux; gui.jsx only needs to render it when visible.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import BugReportConsent from '../components/bug-report-consent/bug-report-consent.jsx';
import BugReportModalComponent from '../components/bug-report-modal/bug-report-modal.jsx';
import bugReportAPI, { isBugReportConfigured } from '../lib/bug-report-api.js';
import { loginWithGoogle, requestMicrosoftIdToken, isMicrosoftAuthAvailable } from '../lib/teacher-auth.js';
import { closeBugReportModal, setBugReportView, VIEW_MY_REPORTS } from '../reducers/bug-report.js';
import useBugReportSubmit from './use-bug-report-submit.js';

const CONSENT_KEY = 'smalruby:bugReportConsent';

const messages = defineMessages({
    errorLogin: {
        id: 'gui.bugReportModal.errorLogin',
        defaultMessage: 'Sign-in failed. Please try again.',
        description: 'Login failure error',
    },
    errorReauth: {
        id: 'gui.bugReportModal.errorReauth',
        defaultMessage: 'Your sign-in expired. Please sign in again.',
        description: 'Re-authentication required error',
    },
    errorFileTooLarge: {
        id: 'gui.bugReportModal.errorFileTooLarge',
        defaultMessage: 'The project is too large to send (maximum 10MB).',
        description: 'Project too large error',
    },
    errorGeneric: {
        id: 'gui.bugReportModal.errorGeneric',
        defaultMessage: 'Something went wrong. Please try again later.',
        description: 'Generic error',
    },
});

const hasConsent = () => {
    try {
        return typeof window !== 'undefined' && window.localStorage.getItem(CONSENT_KEY) === 'true';
    } catch {
        return false;
    }
};

// Local/dev only: `?devlogin=<token>` uses the token directly as the ID token,
// skipping the Google/Microsoft OAuth flow (which requires the origin to be
// registered with the provider — impractical on localhost). Mirrors the
// classroom `?devlogin` affordance. The token only authenticates against
// non-prod backends that accept DEV_BYPASS_TOKEN, and is never baked into the
// bundle — it is supplied at runtime via the URL.
const getDevLoginToken = () => {
    try {
        return typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('devlogin');
    } catch {
        return null;
    }
};

const BugReportModal = () => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const modalVisible = useSelector((state) => state.scratchGui.bugReport?.modalVisible);
    const view = useSelector((state) => state.scratchGui.bugReport?.view);
    const vm = useSelector((state) => state.scratchGui.vm);
    const projectTitle = useSelector((state) => state.scratchGui.projectTitle);
    const scratchBlocks = useSelector((state) => state.scratchGui.blockDisplay?.scratchBlocks);
    const rubyVersion = useSelector((state) => state.scratchGui.settings?.rubyVersion);

    const { submitProgressLabel, submitReport } = useBugReportSubmit({ vm, scratchBlocks, projectTitle });

    const [phase, setPhase] = useState('login');
    const [idToken, setIdToken] = useState(null);
    const [description, setDescription] = useState('');
    const [error, setError] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [reports, setReports] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    // The report most recently hidden, kept so the Undo toast can restore it.
    const [hiddenReport, setHiddenReport] = useState(null);
    const hideTimerRef = useRef(null);

    const clearHideTimer = useCallback(() => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);

    // Clear the auto-dismiss timer on unmount.
    useEffect(() => clearHideTimer, [clearHideTimer]);

    const insertSortedByNewest = useCallback(
        (list, report) => [...list, report].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
        [],
    );

    const loadReports = useCallback(
        async (token) => {
            setReportsLoading(true);
            setError(null);
            try {
                const result = await bugReportAPI.listMyReports(token);
                setReports(result.reports || []);
            } catch (err) {
                if (err.status === 401) {
                    setIdToken(null);
                    setPhase('login');
                    setError(intl.formatMessage(messages.errorReauth));
                } else {
                    setError(intl.formatMessage(messages.errorGeneric));
                }
            } finally {
                setReportsLoading(false);
            }
        },
        [intl],
    );

    // Initialize the phase whenever the modal is (re)opened.
    useEffect(() => {
        if (!modalVisible) return;
        setError(null);
        const effectiveToken = idToken || getDevLoginToken();
        if (!hasConsent()) {
            setPhase('consent');
        } else if (!effectiveToken) {
            setPhase('login');
        } else if (view === VIEW_MY_REPORTS) {
            if (!idToken) setIdToken(effectiveToken);
            setPhase('myReports');
            loadReports(effectiveToken);
        } else {
            if (!idToken) setIdToken(effectiveToken);
            setPhase('form');
        }
        // Intentionally only react to open/close; in-modal navigation is handled
        // by the explicit view handlers below.
    }, [modalVisible]);

    const advanceAfterAuth = useCallback(
        (token) => {
            if (view === VIEW_MY_REPORTS) {
                setPhase('myReports');
                loadReports(token);
            } else {
                setPhase('form');
            }
        },
        [view, loadReports],
    );

    const handleLogin = useCallback(
        async (loginFn) => {
            setIsBusy(true);
            setError(null);
            try {
                const token = await loginFn();
                if (!token) throw new Error('no token');
                setIdToken(token);
                advanceAfterAuth(token);
            } catch {
                setError(intl.formatMessage(messages.errorLogin));
            } finally {
                setIsBusy(false);
            }
        },
        [advanceAfterAuth, intl],
    );

    const handleLoginGoogle = useCallback(() => handleLogin(loginWithGoogle), [handleLogin]);
    const handleLoginMicrosoft = useCallback(() => handleLogin(requestMicrosoftIdToken), [handleLogin]);

    const handleConsentAccept = useCallback(() => {
        try {
            window.localStorage.setItem(CONSENT_KEY, 'true');
        } catch {
            // Ignore storage failures; consent simply re-prompts next time.
        }
        const effectiveToken = idToken || getDevLoginToken();
        if (effectiveToken) {
            if (!idToken) setIdToken(effectiveToken);
            advanceAfterAuth(effectiveToken);
        } else {
            setPhase('login');
        }
    }, [idToken, advanceAfterAuth]);

    const handleClose = useCallback(() => {
        clearHideTimer();
        setHiddenReport(null);
        setDescription('');
        setError(null);
        dispatch(closeBugReportModal());
    }, [dispatch, clearHideTimer]);

    const handleDescriptionChange = useCallback((e) => setDescription(e.target.value), []);

    const handleSubmit = useCallback(async () => {
        if (!idToken || !description.trim()) return;
        setPhase('submitting');
        setError(null);
        try {
            await submitReport({
                idToken,
                description: description.trim(),
                appContext: {
                    url: typeof window === 'undefined' ? '' : window.location.href,
                    rubyVersion: rubyVersion || null,
                },
            });
            setDescription('');
            setPhase('success');
        } catch (err) {
            if (err.status === 401) {
                setIdToken(null);
                setPhase('login');
                setError(intl.formatMessage(messages.errorReauth));
            } else if (err.code === 'fileTooLarge') {
                setPhase('form');
                setError(intl.formatMessage(messages.errorFileTooLarge));
            } else {
                setPhase('form');
                setError(intl.formatMessage(messages.errorGeneric));
            }
        }
    }, [idToken, description, submitReport, rubyVersion, intl]);

    const handleShowMyReports = useCallback(() => {
        dispatch(setBugReportView(VIEW_MY_REPORTS));
        setPhase('myReports');
        if (idToken) loadReports(idToken);
    }, [dispatch, idToken, loadReports]);

    const handleShowForm = useCallback(() => {
        clearHideTimer();
        setHiddenReport(null);
        setPhase('form');
        setError(null);
    }, [clearHideTimer]);

    // ✗ on a row: optimistically remove it, show the Undo toast, persist hide.
    const handleHideReport = useCallback(
        async (reportId) => {
            if (!idToken) return;
            const target = reports.find((r) => r.reportId === reportId);
            if (!target) return;
            setError(null);
            setReports((prev) => prev.filter((r) => r.reportId !== reportId));
            clearHideTimer();
            setHiddenReport(target);
            hideTimerRef.current = setTimeout(() => setHiddenReport(null), 6000);
            try {
                await bugReportAPI.setReportHidden(idToken, reportId, true);
            } catch (err) {
                // Roll back the optimistic removal.
                clearHideTimer();
                setHiddenReport(null);
                setReports((prev) => insertSortedByNewest(prev, target));
                setError(intl.formatMessage(err.status === 401 ? messages.errorReauth : messages.errorGeneric));
            }
        },
        [idToken, reports, clearHideTimer, insertSortedByNewest, intl],
    );

    const handleUndoHide = useCallback(async () => {
        if (!hiddenReport || !idToken) return;
        const target = hiddenReport;
        clearHideTimer();
        setHiddenReport(null);
        setReports((prev) => insertSortedByNewest(prev, target));
        try {
            await bugReportAPI.setReportHidden(idToken, target.reportId, false);
        } catch (err) {
            // Undo failed: remove it again and surface the error.
            setReports((prev) => prev.filter((r) => r.reportId !== target.reportId));
            setError(intl.formatMessage(err.status === 401 ? messages.errorReauth : messages.errorGeneric));
        }
    }, [hiddenReport, idToken, clearHideTimer, insertSortedByNewest, intl]);

    if (!modalVisible || !isBugReportConfigured()) {
        return null;
    }

    if (phase === 'consent') {
        return <BugReportConsent onAccept={handleConsentAccept} onCancel={handleClose} />;
    }

    return (
        <BugReportModalComponent
            phase={phase}
            error={error}
            isBusy={isBusy}
            microsoftAvailable={isMicrosoftAuthAvailable()}
            description={description}
            reports={reports}
            reportsLoading={reportsLoading}
            submitProgressLabel={submitProgressLabel}
            onRequestClose={handleClose}
            onLoginGoogle={handleLoginGoogle}
            onLoginMicrosoft={handleLoginMicrosoft}
            onDescriptionChange={handleDescriptionChange}
            onSubmit={handleSubmit}
            onShowMyReports={handleShowMyReports}
            onShowForm={handleShowForm}
            onHideReport={handleHideReport}
            onUndoHide={handleUndoHide}
            hideToastVisible={!!hiddenReport}
        />
    );
};

export default BugReportModal;
