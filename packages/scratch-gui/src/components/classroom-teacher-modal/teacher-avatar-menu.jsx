/**
 * アバターメニュー（クラス管理タイトルバー右上・#1111 レビュー）。
 *
 * 他アプリ（Facebook / Zenn / Google 等）に倣い、右上はユーザーを表す
 * アバター（メール頭文字）に固定し、クリックでポップアップメニュー
 * （現状はログアウトのみ。将来の設定項目もここに足す）。▼ でメニューが
 * あることを示す。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { initialsFromEmail } from '../../lib/avatar-initials.js';
import styles from './classroom-teacher-modal.css';

const messages = defineMessages({
    buttonLabel: {
        defaultMessage: 'Account menu',
        description: 'Aria label for the avatar/account menu button',
        id: 'gui.classroom.avatar.buttonLabel',
    },
});

const TeacherAvatarMenu = ({ email, onLogout }) => {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    const toggle = useCallback(() => setOpen(o => !o), []);
    const handleLogout = useCallback(() => {
        setOpen(false);
        onLogout();
    }, [onLogout]);

    // 外側クリック / Esc で閉じる。
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
        <div className={styles.avatarMenu} ref={wrapperRef}>
            <button
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={intl.formatMessage(messages.buttonLabel)}
                className={styles.avatarButton}
                data-testid="classroom-avatar-button"
                title={email || ''}
                type="button"
                onClick={toggle}
            >
                <span className={styles.avatarInitials} data-testid="classroom-avatar-initials">
                    {initialsFromEmail(email)}
                </span>
                <span aria-hidden="true" className={styles.avatarCaret}>{'▼'}</span>
            </button>
            {open && (
                <div className={styles.avatarPopup} data-testid="classroom-avatar-popup" role="menu">
                    {email ? (
                        <div className={styles.avatarPopupEmail} data-testid="classroom-avatar-email">{email}</div>
                    ) : null}
                    <button
                        className={styles.avatarPopupItem}
                        data-testid="classroom-teacher-logout"
                        role="menuitem"
                        type="button"
                        onClick={handleLogout}
                    >
                        <FormattedMessage
                            defaultMessage="Logout"
                            description="Logout item in the account menu"
                            id="gui.classroom.management.titleBarLogout"
                        />
                    </button>
                </div>
            )}
        </div>
    );
};

TeacherAvatarMenu.propTypes = {
    email: PropTypes.string,
    onLogout: PropTypes.func.isRequired,
};

export default TeacherAvatarMenu;
