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

// signed-out → checking → authorized | forbidden | error
const App = () => {
    const [phase, setPhase] = useState('signed-out');
    const [me, setMe] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [section, setSection] = useState('shared');
    const buttonRef = useRef(null);

    const handleSection = useCallback(e => setSection(e.currentTarget.dataset.section), []);

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
                    {section === 'bug-reports' && <BugReportsView />}
                </main>
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
