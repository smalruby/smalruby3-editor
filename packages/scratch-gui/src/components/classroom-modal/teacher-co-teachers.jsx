/**
 * Co-teacher (shared classroom management) section, shown in the teacher class
 * detail view below the seat grid. Lets the owner or an existing co-teacher
 * invite additional teachers by email and remove them. Co-teachers are fully
 * equal to the owner; the creator is identified separately (teacherSub) and so
 * never appears in, and cannot be removed from, this list.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import styles from './classroom-modal.css';

const messages = defineMessages({
    emailPlaceholder: {
        defaultMessage: 'teacher@example.com',
        description: 'Placeholder for the co-teacher invite email input',
        id: 'gui.classroom.coTeachers.emailPlaceholder',
    },
});

const TeacherCoTeachers = ({ classroom, isLoading, onAddCoTeacher, onRemoveCoTeacher }) => {
    const intl = useIntl();
    const [email, setEmail] = useState('');
    const coTeacherEmails = classroom.coTeacherEmails || [];

    const handleInvite = useCallback(() => {
        const trimmed = email.trim();
        if (!trimmed) return;
        onAddCoTeacher(trimmed);
        setEmail('');
    }, [email, onAddCoTeacher]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleInvite();
            }
        },
        [handleInvite],
    );

    const handleEmailChange = useCallback((e) => setEmail(e.target.value), []);

    const handleRemove = useCallback(
        (e) => onRemoveCoTeacher(e.currentTarget.dataset.email),
        [onRemoveCoTeacher],
    );

    return (
        <div className={styles.coTeachersSection} data-testid="classroom-co-teachers">
            <div className={styles.coTeachersHint}>
                <FormattedMessage
                    defaultMessage="Invite other teachers by email to co-manage this class. They have the same permissions as you."
                    description="Explanation of the co-teacher feature"
                    id="gui.classroom.coTeachers.hint"
                />
            </div>

            {coTeacherEmails.length === 0 ? (
                <div className={styles.coTeachersEmpty} data-testid="classroom-co-teachers-empty">
                    <FormattedMessage
                        defaultMessage="No co-teachers yet."
                        description="Shown when a class has no co-teachers"
                        id="gui.classroom.coTeachers.empty"
                    />
                </div>
            ) : (
                <ul className={styles.coTeachersList}>
                    {coTeacherEmails.map((coEmail) => (
                        <li
                            className={styles.coTeacherItem}
                            data-testid={`classroom-co-teacher-item-${coEmail}`}
                            key={coEmail}
                        >
                            <span className={styles.coTeacherEmail}>{coEmail}</span>
                            <button
                                className={styles.coTeacherRemove}
                                data-email={coEmail}
                                data-testid={`classroom-co-teacher-remove-${coEmail}`}
                                disabled={isLoading}
                                onClick={handleRemove}
                            >
                                <FormattedMessage
                                    defaultMessage="Remove"
                                    description="Remove a co-teacher button"
                                    id="gui.classroom.coTeachers.remove"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className={styles.coTeacherInviteRow}>
                <input
                    className={styles.coTeacherInviteInput}
                    data-testid="classroom-co-teacher-invite-input"
                    placeholder={intl.formatMessage(messages.emailPlaceholder)}
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    onKeyDown={handleKeyDown}
                />
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-co-teacher-invite-submit"
                    disabled={isLoading || email.trim().length === 0}
                    onClick={handleInvite}
                >
                    <FormattedMessage
                        defaultMessage="Invite"
                        description="Invite a co-teacher button"
                        id="gui.classroom.coTeachers.invite"
                    />
                </button>
            </div>
        </div>
    );
};

TeacherCoTeachers.propTypes = {
    classroom: PropTypes.shape({
        coTeacherEmails: PropTypes.arrayOf(PropTypes.string),
    }).isRequired,
    isLoading: PropTypes.bool,
    onAddCoTeacher: PropTypes.func.isRequired,
    onRemoveCoTeacher: PropTypes.func.isRequired,
};

export default TeacherCoTeachers;
