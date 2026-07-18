/**
 * Admin SPA root (EPIC #1073 S2): Google Sign-In → /admin/me authorization
 * probe → dashboard skeleton. The management domains fill in via S3-S5.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchMe, setIdToken} from '../lib/admin-api.js';
import {getDevLoginToken, initGoogleSignIn} from '../lib/google-auth.js';
import './app.css';

// signed-out → checking → authorized | forbidden | error
const App = () => {
    const [phase, setPhase] = useState('signed-out');
    const [me, setMe] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const buttonRef = useRef(null);

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
                <main className="admin-main">
                    {/* Management domains land here: S3 みんなの課題 / S4 クラス / S5 バグ報告 */}
                    <p data-testid="admin-placeholder">
                        {'管理メニューは準備中です（S3: みんなの課題 / S4: クラス・課題 / S5: バグ報告）。'}
                    </p>
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
