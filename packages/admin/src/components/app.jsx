/**
 * Admin SPA root (EPIC #1073 S2): Google Sign-In → /admin/me authorization
 * probe → dashboard skeleton. The management domains fill in via S3-S5.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchMe, setIdToken} from '../lib/admin-api.js';
import {getDevLoginToken, initGoogleSignIn} from '../lib/google-auth.js';
import BugReportsView from './bug-reports-view.jsx';
import ClassroomsView from './classrooms-view.jsx';
import SharedAssignmentsView from './shared-assignments-view.jsx';
import './app.css';

const SECTIONS = [
    {key: 'shared', label: 'みんなの課題'},
    {key: 'classrooms', label: 'クラス・課題'},
    {key: 'bug-reports', label: 'バグ報告'}
];

// The current section lives in the URL hash (#/classrooms) so a full reload
// — including the one we prompt for on session expiry — lands the operator
// back on the same section after re-login. Deliberately not localStorage.
const sectionFromHash = () => {
    const key = window.location.hash.replace(/^#\/?/, '');
    return SECTIONS.some(s => s.key === key) ? key : 'shared';
};

// signed-out → checking → authorized | forbidden | error
const App = () => {
    const [phase, setPhase] = useState('signed-out');
    const [me, setMe] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [section, setSection] = useState(sectionFromHash);
    const [sessionExpired, setSessionExpired] = useState(false);
    const buttonRef = useRef(null);

    const handleSection = useCallback(e => {
        const key = e.currentTarget.dataset.section;
        setSection(key);
        window.history.replaceState(null, '', `#/${key}`);
    }, []);

    const handleReload = useCallback(() => window.location.reload(), []);

    // Google ID tokens live ~1 hour and the SPA keeps them in memory only, so
    // an expired session surfaces as API 401s. The clients broadcast those;
    // show one clear prompt instead of per-view raw errors.
    useEffect(() => {
        if (phase !== 'authorized') return () => {};
        const handleUnauthorized = () => setSessionExpired(true);
        window.addEventListener('smalruby-admin:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('smalruby-admin:unauthorized', handleUnauthorized);
    }, [phase]);

    const handleCredential = useCallback(async token => {
        setIdToken(token);
        setPhase('checking');
        try {
            setMe(await fetchMe());
            setPhase('authorized');
        } catch (err) {
            setIdToken(null);
            if (err.status === 403) {
                setPhase('forbidden');
            } else {
                setErrorMessage(err.message);
                setPhase('error');
            }
        }
    }, []);

    useEffect(() => {
        const devToken = getDevLoginToken();
        if (devToken) {
            handleCredential(devToken);
            return;
        }
        if (buttonRef.current) {
            initGoogleSignIn(buttonRef.current, handleCredential).catch(err => {
                setErrorMessage(err.message);
                setPhase('error');
            });
        }
    }, [handleCredential]);

    if (phase === 'authorized' && me) {
        return (
            <div
                className="admin-layout"
                data-testid="admin-dashboard"
            >
                <header className="admin-header">
                    <h1>{'Smalruby Admin'}</h1>
                    <span className="admin-header-stage">{me.stage}</span>
                    <span
                        className="admin-header-email"
                        data-testid="admin-me-email"
                    >{me.email}</span>
                </header>
                <nav className="admin-nav">
                    {SECTIONS.map(s => (
                        <button
                            className={section === s.key ? 'admin-tab-active' : 'admin-tab'}
                            data-section={s.key}
                            data-testid={`admin-nav-${s.key}`}
                            key={s.key}
                            type="button"
                            onClick={handleSection}
                        >{s.label}</button>
                    ))}
                </nav>
                <main className="admin-main">
                    <h2>{SECTIONS.find(s => s.key === section).label}</h2>
                    {section === 'shared' && <SharedAssignmentsView />}
                    {section === 'classrooms' && <ClassroomsView />}
                    {section === 'bug-reports' && <BugReportsView stage={me.stage} />}
                </main>
                {sessionExpired && (
                    <div
                        className="admin-session-expired"
                        data-testid="admin-session-expired"
                    >
                        <div className="admin-session-expired-card">
                            <p>
                                {'セッションの有効期限が切れました（ログインから約 1 時間）。'}
                                {'再読み込みして、もう一度ログインしてください。いまのページに戻ります。'}
                            </p>
                            <button
                                data-testid="admin-session-reload"
                                type="button"
                                onClick={handleReload}
                            >{'再読み込みしてログイン'}</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className="admin-login"
            data-testid="admin-login"
        >
            <h1>{'Smalruby Admin'}</h1>
            {phase === 'signed-out' && (
                <div
                    data-testid="admin-signin-button"
                    ref={buttonRef}
                />
            )}
            {phase === 'checking' && (
                <p data-testid="admin-checking">{'確認中…'}</p>
            )}
            {phase === 'forbidden' && (
                <p
                    className="admin-forbidden"
                    data-testid="admin-forbidden"
                >
                    {'このアカウントにはアクセス権がありません。管理者の登録は AWS 上で行われます。'}
                </p>
            )}
            {phase === 'error' && (
                <p
                    className="admin-forbidden"
                    data-testid="admin-error"
                >{errorMessage}</p>
            )}
        </div>
    );
};

export default App;
