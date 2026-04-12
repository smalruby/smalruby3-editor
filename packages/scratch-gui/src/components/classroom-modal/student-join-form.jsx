import { FormattedMessage, useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

/**
 * Normalize input for join code: full-width to half-width, then keep only [a-z0-9].
 * @param {string} raw - Raw input string
 * @returns {string} Normalized lowercase alphanumeric string
 */
const normalizeJoinCodeInput = (raw) => {
    let result = '';
    for (let i = 0; i < raw.length; i++) {
        const cp = raw.charCodeAt(i);
        let ch;
        if (cp >= 0xff10 && cp <= 0xff19) {
            // Full-width digits -> half-width
            ch = String.fromCharCode(cp - 0xff10 + 0x30);
        } else if (cp >= 0xff21 && cp <= 0xff3a) {
            // Full-width uppercase -> half-width lowercase
            ch = String.fromCharCode(cp - 0xff21 + 0x61);
        } else if (cp >= 0xff41 && cp <= 0xff5a) {
            // Full-width lowercase -> half-width lowercase
            ch = String.fromCharCode(cp - 0xff41 + 0x61);
        } else {
            ch = raw[i].toLowerCase();
        }
        if (/[a-z0-9]/.test(ch)) {
            result += ch;
        }
    }
    return result;
};

const StudentJoinForm = ({
    error,
    errorActionLabel,
    errorActionHandler,
    errorTitle,
    isLoading,
    joinCodeHistory,
    noBackButton,
    onBack,
    onJoin,
    onTeacherLink,
}) => {
    const intl = useIntl();
    const [code, setCode] = React.useState('');

    const handleCodeChange = useCallback((e) => {
        setCode(normalizeJoinCodeInput(e.target.value));
    }, []);

    const handleSubmit = useCallback(() => {
        if (code.trim().length === 6) {
            onJoin(code.trim());
        }
    }, [code, onJoin]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter' && code.trim().length === 6) {
                onJoin(code.trim());
            }
        },
        [code, onJoin],
    );

    const handleHistorySelect = useCallback(
        (e) => {
            const selectedCode = e.target.value;
            if (selectedCode) {
                setCode(selectedCode);
            }
        },
        [],
    );

    const hasHistory =
        Array.isArray(joinCodeHistory) && joinCodeHistory.length > 0;

    return (
        <div data-testid="classroom-phase-student-join">
            {!noBackButton && (
                <button
                    className={styles.backLink}
                    data-testid="classroom-back"
                    onClick={onBack}
                >
                    {'<'}{' '}
                    <FormattedMessage
                        defaultMessage="Back"
                        description="Back button"
                        id="gui.classroom.back"
                    />
                </button>
            )}
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Enter Join Code"
                    description="Student join form title"
                    id="gui.classroom.studentJoin.title"
                />
            </div>
            <div className={styles.formGroup}>
                <input
                    className={styles.input}
                    data-testid="classroom-join-code-input"
                    maxLength={6}
                    placeholder="○○○○○○"
                    style={{
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        letterSpacing: '0.2em',
                    }}
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className={styles.buttonRow}>
                {hasHistory && (
                    <select
                        className={styles.historySelect}
                        data-testid="classroom-join-history"
                        value=""
                        onChange={handleHistorySelect}
                    >
                        <option value="">
                            {intl.formatMessage({
                                defaultMessage: 'Previously joined classes',
                                description: 'Placeholder for join code history dropdown',
                                id: 'gui.classroom.studentJoin.historyPlaceholder',
                            })}
                        </option>
                        {joinCodeHistory.map((entry) => (
                            <option
                                key={entry.joinCode}
                                value={entry.joinCode}
                            >
                                {`${entry.className}${entry.assignmentName ? `/${entry.assignmentName}` : ''} ${entry.joinCode}`}
                            </option>
                        ))}
                    </select>
                )}
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-join-submit"
                    disabled={code.trim().length !== 6 || isLoading}
                    onClick={handleSubmit}
                >
                    {isLoading ? (
                        <FormattedMessage
                            defaultMessage="Loading..."
                            description="Loading indicator"
                            id="gui.classroom.loading"
                        />
                    ) : (
                        <FormattedMessage
                            defaultMessage="Next"
                            description="Submit join code button"
                            id="gui.classroom.studentJoin.next"
                        />
                    )}
                </button>
            </div>
            <ErrorDisplay
                actionLabel={errorActionLabel}
                error={error}
                errorTitle={errorTitle}
                onAction={errorActionHandler}
            />
            <div className={styles.joinHintBox}>
                <div className={styles.joinHintTitle}>
                    <FormattedMessage
                        defaultMessage="Hint"
                        description="Hint box title on student join form"
                        id="gui.classroom.studentJoin.hintTitle"
                    />
                </div>
                <div className={styles.joinHintText}>
                    <FormattedMessage
                        defaultMessage="Ask your teacher for the join code."
                        description="Hint text telling students to ask teacher for join code"
                        id="gui.classroom.studentJoin.hintAskTeacher"
                    />
                </div>
                <div className={styles.joinHintText}>
                    <FormattedMessage
                        defaultMessage="Teachers can find the join code in {settingsIcon} Settings → Class Management."
                        description="Hint text explaining where teachers find join code"
                        id="gui.classroom.studentJoin.hintTeacherPath"
                        values={{
                            settingsIcon: '\u2699',
                        }}
                    />
                </div>
                {onTeacherLink && (
                    <button
                        className={styles.teacherLink}
                        data-testid="classroom-teacher-link"
                        onClick={onTeacherLink}
                    >
                        <FormattedMessage
                            defaultMessage="For teachers: Go to Class Management"
                            description="Link for teachers to access class management from student join form"
                            id="gui.classroom.studentJoin.teacherLink"
                        />
                    </button>
                )}
            </div>
        </div>
    );
};

StudentJoinForm.propTypes = {
    error: PropTypes.string,
    errorActionHandler: PropTypes.func,
    errorActionLabel: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    joinCodeHistory: PropTypes.arrayOf(
        PropTypes.shape({
            joinCode: PropTypes.string.isRequired,
            className: PropTypes.string,
            assignmentName: PropTypes.string,
            expiresAt: PropTypes.string,
            joinedAt: PropTypes.string,
        }),
    ),
    noBackButton: PropTypes.bool,
    onBack: PropTypes.func,
    onJoin: PropTypes.func.isRequired,
    onTeacherLink: PropTypes.func,
};

export default StudentJoinForm;
