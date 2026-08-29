/**
 * アバターメニュー（管理 SPA ヘッダー右上・#1111 レビュー）。
 *
 * 右上はアカウント（メール頭文字）に固定し、クリックでポップアップ
 * （メール表示 + ログアウト。将来の設定項目もここに足す）。teacher 側の
 * TeacherAvatarMenu と同じ挙動を admin のスタイルで実装。
 */
import PropTypes from 'prop-types';
import {useCallback, useEffect, useRef, useState} from 'react';
import {initialsFromEmail} from '../lib/avatar-initials.js';

const AvatarMenu = ({email, onLogout}) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    const toggle = useCallback(() => setOpen(o => !o), []);
    const handleLogout = useCallback(() => {
        setOpen(false);
        onLogout();
    }, [onLogout]);

    useEffect(() => {
        if (!open) return () => {};
        const onDocDown = e => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = e => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div
            className="admin-avatar-menu"
            ref={wrapperRef}
        >
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label="アカウントメニュー"
                className="admin-avatar-button"
                data-testid="admin-avatar-button"
                title={email || ''}
                type="button"
                onClick={toggle}
            >
                <span
                    className="admin-avatar-initials"
                    data-testid="admin-avatar-initials"
                >{initialsFromEmail(email)}</span>
                <span
                    aria-hidden="true"
                    className="admin-avatar-caret"
                >{'▼'}</span>
            </button>
            {open && (
                <div
                    className="admin-avatar-popup"
                    data-testid="admin-avatar-popup"
                    role="menu"
                >
                    {email ? (
                        <div
                            className="admin-avatar-popup-email"
                            data-testid="admin-avatar-email"
                        >{email}</div>
                    ) : null}
                    <button
                        className="admin-avatar-popup-item"
                        data-testid="admin-logout"
                        role="menuitem"
                        type="button"
                        onClick={handleLogout}
                    >{'ログアウト'}</button>
                </div>
            )}
        </div>
    );
};

AvatarMenu.propTypes = {
    email: PropTypes.string,
    onLogout: PropTypes.func.isRequired
};

export default AvatarMenu;
