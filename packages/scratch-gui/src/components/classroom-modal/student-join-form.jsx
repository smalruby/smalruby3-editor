import PropTypes from 'prop-types';
import React, { useCallback, useId } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import partStyles from './student-screen-parts.css';

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
    const inputId = useId();

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
            // The Enter that commits an IME conversion must not join the class.
            // React's SyntheticKeyboardEvent omits isComposing, so read the
            // native event; keyCode 229 covers browsers that omit isComposing.
            if ((e.nativeEvent && e.nativeEvent.isComposing) || e.keyCode === 229) return;
            if (e.key === 'Enter' && code.trim().length === 6) {
                onJoin(code.trim());
            }
        },
        [code, onJoin],
    );

    const handleHistorySelect = useCallback((e) => {
        const selectedCode = e.target.value;
        if (selectedCode) {
            setCode(selectedCode);
        }
    }, []);

    const hasHistory = Array.isArray(joinCodeHistory) && joinCodeHistory.length > 0;

    // Show selected state if current code matches a history entry
    const historySelectValue = hasHistory && joinCodeHistory.some((e) => e.joinCode === code) ? code : '';

    return (
        <div data-testid="classroom-phase-student-join">
            {!noBackButton && (
                <button className={styles.backLink} data-testid="classroom-back" onClick={onBack}>
                    {'<'} <FormattedMessage defaultMessage="Back" description="Back button" id="gui.classroom.back" />
                </button>
            )}
            <h2 className={partStyles.studentTitle}>
                <FormattedMessage
                    defaultMessage="Enter Join Code"
                    description="Student join form title"
                    id="gui.classroom.studentJoin.title"
                />
            </h2>
            {/* A label that stays visible (R1): the placeholder alone disappears once typed. */}
            <label className={partStyles.joinCodeLabel} htmlFor={inputId}>
                <FormattedMessage
                    defaultMessage="Join code (the 6 letters your teacher shows)"
                    description="Visible label of the join code input on the student join form"
                    id="gui.classroom.studentJoin.codeLabel"
                />
            </label>
            <div className={partStyles.joinCodeRow}>
                <input
                    autoComplete="off"
                    className={partStyles.joinCodeInput}
                    data-testid="classroom-join-code-input"
                    id={inputId}
                    maxLength={6}
                    placeholder="○○○○○○"
                    spellCheck={false}
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    onKeyDown={handleKeyDown}
                />
                <ClassroomButton
                    className={partStyles.joinCodeSubmit}
                    dataTestId="classroom-join-submit"
                    disabled={code.trim().length !== 6 || isLoading}
                    variant="primary"
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
                </ClassroomButton>
            </div>
            {hasHistory && (
                <select
                    className={partStyles.joinHistorySelect}
                    data-testid="classroom-join-history"
                    value={historySelectValue}
                    onChange={handleHistorySelect}
                >
                    <option value="">
                        {intl.formatMessage({
                            defaultMessage: 'Join codes from previously joined classes',
                            description: 'Placeholder for join code history dropdown',
                            id: 'gui.classroom.studentJoin.historyPlaceholder',
                        })}
                    </option>
                    {joinCodeHistory.map((entry) => (
                        <option key={entry.joinCode} value={entry.joinCode}>
                            {`${entry.className}${entry.assignmentName ? `/${entry.assignmentName}` : ''} ${entry.joinCode}`}
                        </option>
                    ))}
                </select>
            )}
            <ErrorDisplay
                actionLabel={errorActionLabel}
                error={error}
                errorTitle={errorTitle}
                onAction={errorActionHandler}
            />
            {/* For the student first (#1963): where the code is. A teacher who pressed
                「クラス」 without knowing class management finds the way there below,
                kept small so students do not take it. */}
            <div className={partStyles.joinHint} data-testid="classroom-join-hint">
                <div className={partStyles.joinHintTitle}>
                    <FormattedMessage
                        defaultMessage="Hint"
                        description="Hint box title on student join form"
                        id="gui.classroom.studentJoin.hintTitle"
                    />
                </div>
                <div className={partStyles.joinHintText}>
                    <FormattedMessage
                        defaultMessage="Your teacher shows the join code on the board or on the screen. If you cannot find it, ask your teacher."
                        description="Hint telling students where the join code is shown"
                        id="gui.classroom.studentJoin.hintAskTeacher"
                    />
                </div>
                {onTeacherLink && (
                    <div className={partStyles.joinHintTeacher} data-testid="classroom-join-teacher-hint">
                        <span>
                            <FormattedMessage
                                defaultMessage="Are you a teacher? Create a class to get a join code for your students."
                                description="Small note on the student join form for a teacher who opened the student screen"
                                id="gui.classroom.studentJoin.teacherQuestion"
                            />
                        </span>
                        <button
                            className={partStyles.joinTeacherLink}
                            data-testid="classroom-teacher-link"
                            type="button"
                            onClick={onTeacherLink}
                        >
                            <FormattedMessage
                                defaultMessage="Open class management"
                                description="Link for teachers to open class management from the student join form"
                                id="gui.classroom.studentJoin.teacherLink"
                            />
                        </button>
                    </div>
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
