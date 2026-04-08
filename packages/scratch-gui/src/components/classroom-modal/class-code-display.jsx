import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom';

import styles from './classroom-modal.css';

const ClassCodeDisplay = ({
    classroom,
    isFullscreen,
    onClose,
    onCopyInviteLink,
    onToggleFullscreen,
}) => {
    const code = classroom.joinCode.toLowerCase();
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(() => {
        onCopyInviteLink(classroom);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [classroom, onCopyInviteLink]);

    if (isFullscreen) {
        return ReactDOM.createPortal(
            <div className={styles.codeFullscreenOverlay}>
                <span className={styles.codeFullscreenTitle}>
                    <FormattedMessage
                        defaultMessage="Join Code"
                        description="Title for join code display"
                        id="gui.classroom.codeDisplay.title"
                    />
                </span>
                <button
                    className={styles.codeFullscreenClose}
                    data-testid="classroom-code-display-close"
                    onClick={onClose}
                >
                    {'✕'}
                </button>
                <div className={styles.codeFullscreenCode}>{code}</div>
                <div className={styles.codeFullscreenFooter}>
                    <div className={styles.codeDisplayInfo}>
                        <span>{classroom.className}</span>
                        <span>
                            {classroom.studentCount}
                            <FormattedMessage
                                defaultMessage=" students"
                                description="Student count suffix in class list"
                                id="gui.classroom.teacherDashboard.studentCountSuffix"
                            />
                        </span>
                        {classroom.assignmentName && (
                            <span>{classroom.assignmentName}</span>
                        )}
                        {classroom.createdAt && (
                            <span>
                                {new Date(
                                    classroom.createdAt,
                                ).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <div className={styles.codeDisplayActions}>
                        <button
                            className={styles.copyLinkButton}
                            data-testid="classroom-code-display-copy-link"
                            onClick={handleCopy}
                        >
                            <svg
                                fill="none"
                                height="16"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                width="16"
                            >
                                <rect
                                    height="13"
                                    rx="2"
                                    ry="2"
                                    width="13"
                                    x="9"
                                    y="9"
                                />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            {' '}
                            {copied ? (
                                <FormattedMessage
                                    defaultMessage="Copied"
                                    description="Confirmation after copying invite link"
                                    id="gui.classroom.codeDisplay.copied"
                                />
                            ) : (
                                <FormattedMessage
                                    defaultMessage="Copy invite link"
                                    description="Button to copy classroom invite link"
                                    id="gui.classroom.codeDisplay.copyLink"
                                />
                            )}
                        </button>
                    </div>
                </div>
            </div>,
            document.body,
        );
    }

    return (
        <div
            className={styles.codeDisplay}
            data-testid="classroom-phase-teacher-code-display"
        >
            <button className={styles.backLink} onClick={onClose}>
                {'<'}{' '}
                <FormattedMessage
                    defaultMessage="Back"
                    description="Back button"
                    id="gui.classroom.back"
                />
            </button>
            <div className={styles.codeDisplayTitle}>
                <FormattedMessage
                    defaultMessage="Class Code"
                    description="Title for class code display"
                    id="gui.classroom.codeDisplay.title"
                />
            </div>
            <div className={styles.codeDisplayCode}>{code}</div>
            <div className={styles.codeDisplayFooter}>
                <div className={styles.codeDisplayInfo}>
                    <span>{classroom.className}</span>
                    <span>
                        {classroom.studentCount}
                        <FormattedMessage
                            defaultMessage=" students"
                            description="Student count suffix in class list"
                            id="gui.classroom.teacherDashboard.studentCountSuffix"
                        />
                    </span>
                    {classroom.assignmentName && (
                        <span>{classroom.assignmentName}</span>
                    )}
                    {classroom.createdAt && (
                        <span>
                            {new Date(
                                classroom.createdAt,
                            ).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <div className={styles.codeDisplayActions}>
                    <button
                        className={styles.copyLinkButton}
                        data-testid="classroom-code-display-copy-link"
                        onClick={handleCopy}
                    >
                        <svg
                            fill="none"
                            height="16"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="16"
                        >
                            <rect
                                height="13"
                                rx="2"
                                ry="2"
                                width="13"
                                x="9"
                                y="9"
                            />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        {' '}
                        {copied ? (
                            <FormattedMessage
                                defaultMessage="Copied"
                                description="Confirmation after copying invite link"
                                id="gui.classroom.codeDisplay.copied"
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="Copy invite link"
                                description="Button to copy classroom invite link"
                                id="gui.classroom.codeDisplay.copyLink"
                            />
                        )}
                    </button>
                    <button
                        className={styles.expandIconButton}
                        data-testid="classroom-code-display-expand"
                        onClick={onToggleFullscreen}
                    >
                        {'⛶'}
                    </button>
                </div>
            </div>
        </div>
    );
};

ClassCodeDisplay.propTypes = {
    classroom: PropTypes.object.isRequired,
    isFullscreen: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onCopyInviteLink: PropTypes.func.isRequired,
    onToggleFullscreen: PropTypes.func.isRequired,
};

export default ClassCodeDisplay;
