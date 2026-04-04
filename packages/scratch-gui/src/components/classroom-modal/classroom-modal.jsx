import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';

import styles from './classroom-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Classroom',
        description: 'Title for the classroom modal',
        id: 'gui.classroom.title',
    },
});

const ClassroomModal = ({
    phase,
    classrooms,
    selectedClassroom,
    members,
    seatCount,
    takenSeats,
    selectedSeat,
    joinedInfo,
    error,
    isLoading,
    onSelectTeacher,
    onSelectStudent,
    onTeacherLogin,
    onShowCreateForm,
    onCreateClassroom,
    onSelectClassroom,
    onBackToDashboard,
    onBackToRoleSelect,
    onJoinWithCode,
    onSelectSeat,
    onConfirmJoin,
    onClose,
    onDeleteMember,
}) => {
    const intl = useIntl();

    const handleSelectClassroom = useCallback(
        (e) => {
            onSelectClassroom(e.currentTarget.dataset.classroomId);
        },
        [onSelectClassroom],
    );

    const handleDeleteMember = useCallback(
        (e) => {
            onDeleteMember(e.currentTarget.dataset.memberId);
        },
        [onDeleteMember],
    );

    const handleSelectSeat = useCallback(
        (e) => {
            onSelectSeat(parseInt(e.currentTarget.dataset.seat, 10));
        },
        [onSelectSeat],
    );

    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            id="classroomModal"
            onRequestClose={onClose}
        >
            <Box className={styles.body} data-testid="classroom-modal">
                {/* Phase: role-select */}
                {phase === 'role-select' && (
                    <div data-testid="classroom-phase-role-select">
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="How do you use the classroom?"
                                description="Prompt for selecting teacher or student role"
                                id="gui.classroom.roleSelect.prompt"
                            />
                        </div>
                        <div className={styles.roleButtons}>
                            <button
                                className={styles.roleButton}
                                data-testid="classroom-role-teacher"
                                onClick={onSelectTeacher}
                            >
                                <FormattedMessage
                                    defaultMessage="Teacher"
                                    description="Button for teacher role"
                                    id="gui.classroom.roleSelect.teacher"
                                />
                            </button>
                            <button
                                className={styles.roleButton}
                                data-testid="classroom-role-student"
                                onClick={onSelectStudent}
                            >
                                <FormattedMessage
                                    defaultMessage="Student"
                                    description="Button for student role"
                                    id="gui.classroom.roleSelect.student"
                                />
                            </button>
                        </div>
                    </div>
                )}

                {/* Phase: teacher-login */}
                {phase === 'teacher-login' && (
                    <div data-testid="classroom-phase-teacher-login">
                        <button
                            className={styles.backLink}
                            data-testid="classroom-back"
                            onClick={onBackToDashboard}
                        >
                            {'<'}{' '}
                            <FormattedMessage
                                defaultMessage="Back"
                                description="Back button"
                                id="gui.classroom.back"
                            />
                        </button>
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="Sign in with Google"
                                description="Prompt for teacher Google sign in"
                                id="gui.classroom.teacherLogin.prompt"
                            />
                        </div>
                        <div className={styles.description}>
                            <FormattedMessage
                                defaultMessage="Sign in with your Google account to manage classrooms."
                                description="Teacher login description"
                                id="gui.classroom.teacherLogin.description"
                            />
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-google-login"
                                onClick={onTeacherLogin}
                            >
                                <FormattedMessage
                                    defaultMessage="Sign in with Google"
                                    description="Google sign in button"
                                    id="gui.classroom.teacherLogin.button"
                                />
                            </button>
                        </div>
                        {error && (
                            <div className={styles.errorText} data-testid="classroom-error">
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* Phase: teacher-dashboard */}
                {phase === 'teacher-dashboard' && (
                    <div data-testid="classroom-phase-teacher-dashboard">
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="Your Classrooms"
                                description="Teacher dashboard title"
                                id="gui.classroom.teacherDashboard.title"
                            />
                        </div>
                        {isLoading && (
                            <div className={styles.loading} data-testid="classroom-loading">
                                <FormattedMessage
                                    defaultMessage="Loading..."
                                    description="Loading indicator"
                                    id="gui.classroom.loading"
                                />
                            </div>
                        )}
                        {!isLoading && classrooms.length === 0 && (
                            <div
                                className={styles.description}
                                data-testid="classroom-empty-message"
                            >
                                <FormattedMessage
                                    defaultMessage="No classrooms yet. Create one to get started!"
                                    description="Empty classrooms message"
                                    id="gui.classroom.teacherDashboard.empty"
                                />
                            </div>
                        )}
                        {!isLoading && classrooms.length > 0 && (
                            <ul className={styles.classList} data-testid="classroom-list">
                                {classrooms.map(c => (
                                    <li
                                        className={styles.classItem}
                                        data-testid={`classroom-item-${c.classroomId}`}
                                        key={c.classroomId}
                                    >
                                        <span
                                            className={styles.classItemName}
                                            data-testid={`classroom-item-name-${c.classroomId}`}
                                        >
                                            {c.className}
                                        </span>
                                        <span
                                            className={styles.classItemCode}
                                            data-testid={`classroom-item-code-${c.classroomId}`}
                                        >
                                            {c.joinCode}
                                        </span>
                                        <button
                                            className={styles.secondaryButton}
                                            data-classroom-id={c.classroomId}
                                            data-testid={`classroom-item-details-${c.classroomId}`}
                                            onClick={handleSelectClassroom}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Details"
                                                description="View classroom details button"
                                                id="gui.classroom.teacherDashboard.details"
                                            />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-create"
                                onClick={onShowCreateForm}
                            >
                                <FormattedMessage
                                    defaultMessage="Create Classroom"
                                    description="Create new classroom button"
                                    id="gui.classroom.teacherDashboard.create"
                                />
                            </button>
                        </div>
                        {error && (
                            <div className={styles.errorText} data-testid="classroom-error">
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* Phase: teacher-create */}
                {phase === 'teacher-create' && (
                    <TeacherCreateForm
                        error={error}
                        isLoading={isLoading}
                        onBack={onBackToDashboard}
                        onCreate={onCreateClassroom}
                    />
                )}

                {/* Phase: teacher-class-detail */}
                {phase === 'teacher-class-detail' && selectedClassroom && (
                    <div data-testid="classroom-phase-teacher-detail">
                        <button
                            className={styles.backLink}
                            data-testid="classroom-back"
                            onClick={onBackToDashboard}
                        >
                            {'<'}{' '}
                            <FormattedMessage
                                defaultMessage="Back"
                                description="Back button"
                                id="gui.classroom.back"
                            />
                        </button>
                        <div
                            className={styles.phaseTitle}
                            data-testid="classroom-detail-name"
                        >
                            {selectedClassroom.className}
                        </div>
                        <div className={styles.joinCodeDisplay}>
                            <div>
                                <FormattedMessage
                                    defaultMessage="Join Code"
                                    description="Join code label"
                                    id="gui.classroom.joinCode.label"
                                />
                            </div>
                            <div
                                className={styles.joinCodeValue}
                                data-testid="classroom-detail-join-code"
                            >
                                {selectedClassroom.joinCode}
                            </div>
                        </div>
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="Members"
                                description="Members list title"
                                id="gui.classroom.members.title"
                            />
                        </div>
                        {isLoading && (
                            <div className={styles.loading} data-testid="classroom-loading">
                                <FormattedMessage
                                    defaultMessage="Loading..."
                                    description="Loading indicator"
                                    id="gui.classroom.loading"
                                />
                            </div>
                        )}
                        {!isLoading && (
                            <ul className={styles.membersList} data-testid="classroom-members-list">
                                {members.map(m => (
                                    <li
                                        className={styles.memberItem}
                                        data-testid={`classroom-member-${m.memberId}`}
                                        key={m.memberId}
                                    >
                                        <span
                                            className={styles.memberSeat}
                                            data-testid={`classroom-member-seat-${m.memberId}`}
                                        >
                                            {m.memberId}
                                        </span>
                                        <span
                                            className={styles.memberName}
                                            data-testid={`classroom-member-name-${m.memberId}`}
                                        >
                                            {m.displayName || '-'}
                                        </span>
                                        <button
                                            className={styles.deleteButton}
                                            data-member-id={m.memberId}
                                            data-testid={`classroom-member-remove-${m.memberId}`}
                                            onClick={handleDeleteMember}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Remove"
                                                description="Remove member button"
                                                id="gui.classroom.members.remove"
                                            />
                                        </button>
                                    </li>
                                ))}
                                {members.length === 0 && (
                                    <li
                                        className={styles.memberItem}
                                        data-testid="classroom-members-empty"
                                    >
                                        <span className={styles.memberName}>
                                            <FormattedMessage
                                                defaultMessage="No members yet"
                                                description="Empty members message"
                                                id="gui.classroom.members.empty"
                                            />
                                        </span>
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>
                )}

                {/* Phase: student-join */}
                {phase === 'student-join' && (
                    <StudentJoinForm
                        error={error}
                        isLoading={isLoading}
                        onBack={onBackToRoleSelect}
                        onJoin={onJoinWithCode}
                    />
                )}

                {/* Phase: student-seat */}
                {phase === 'student-seat' && (
                    <div data-testid="classroom-phase-student-seat">
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="Select your seat number"
                                description="Seat selection prompt"
                                id="gui.classroom.studentSeat.prompt"
                            />
                        </div>
                        <div className={styles.seatGrid} data-testid="classroom-seat-grid">
                            {Array.from({ length: seatCount }, (_, i) => i + 1).map(n => {
                                const isTaken = takenSeats.includes(n);
                                const isSelected = selectedSeat === n;
                                return (
                                    <button
                                        className={`${styles.seatButton} ${isTaken ? styles.seatTaken : ''} ${isSelected ? styles.seatSelected : ''}`}
                                        data-seat={n}
                                        data-testid={`classroom-seat-${n}`}
                                        disabled={isTaken}
                                        key={n}
                                        onClick={handleSelectSeat}
                                    >
                                        {n}
                                    </button>
                                );
                            })}
                        </div>
                        <div
                            data-testid="classroom-selected-seat"
                            style={{ display: 'none' }}
                        >
                            {selectedSeat}
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-confirm-seat"
                                disabled={!selectedSeat || isLoading}
                                onClick={onConfirmJoin}
                            >
                                <FormattedMessage
                                    defaultMessage="Join"
                                    description="Confirm join button"
                                    id="gui.classroom.studentSeat.join"
                                />
                            </button>
                        </div>
                        {error && (
                            <div className={styles.errorText} data-testid="classroom-error">
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* Phase: student-joined */}
                {phase === 'student-joined' && joinedInfo && (
                    <div data-testid="classroom-phase-student-joined">
                        <div className={styles.successArea}>
                            <div
                                className={styles.successText}
                                data-testid="classroom-joined-success"
                            >
                                <FormattedMessage
                                    defaultMessage="Joined successfully!"
                                    description="Success message after joining classroom"
                                    id="gui.classroom.studentJoined.success"
                                />
                            </div>
                            <div
                                className={styles.successDetails}
                                data-testid="classroom-joined-details"
                            >
                                <span data-testid="classroom-joined-class-name">
                                    {joinedInfo.className}
                                </span>
                                {' / '}
                                <span data-testid="classroom-joined-seat-number">
                                    <FormattedMessage
                                        defaultMessage="Seat {seatNumber}"
                                        description="Seat number display"
                                        id="gui.classroom.studentJoined.seat"
                                        values={{ seatNumber: joinedInfo.seatNumber }}
                                    />
                                </span>
                            </div>
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-joined-close"
                                onClick={onClose}
                            >
                                <FormattedMessage
                                    defaultMessage="Start"
                                    description="Close button after joining"
                                    id="gui.classroom.studentJoined.start"
                                />
                            </button>
                        </div>
                    </div>
                )}
            </Box>
        </Modal>
    );
};

// Teacher create classroom form
const TeacherCreateForm = ({ error, isLoading, onBack, onCreate }) => {
    const [className, setClassName] = React.useState('');
    const [studentCount, setStudentCount] = React.useState('35');

    const handleClassNameChange = useCallback((e) => {
        setClassName(e.target.value);
    }, []);

    const handleStudentCountChange = useCallback((e) => {
        setStudentCount(e.target.value);
    }, []);

    const handleSubmit = useCallback(() => {
        const count = parseInt(studentCount, 10);
        if (className.trim() && count > 0 && count <= 50) {
            onCreate({ className: className.trim(), studentCount: count });
        }
    }, [className, studentCount, onCreate]);

    return (
        <div data-testid="classroom-phase-teacher-create">
            <button
                className={styles.backLink}
                data-testid="classroom-back"
                onClick={onBack}
            >
                {'<'}{' '}
                <FormattedMessage defaultMessage="Back" description="Back button" id="gui.classroom.back" />
            </button>
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Create Classroom"
                    description="Create classroom form title"
                    id="gui.classroom.teacherCreate.title"
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="classroom-name">
                    <FormattedMessage
                        defaultMessage="Classroom Name"
                        description="Classroom name input label"
                        id="gui.classroom.teacherCreate.name"
                    />
                </label>
                <input
                    className={styles.input}
                    data-testid="classroom-name-input"
                    id="classroom-name"
                    maxLength={50}
                    type="text"
                    value={className}
                    onChange={handleClassNameChange}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="classroom-count">
                    <FormattedMessage
                        defaultMessage="Number of Students"
                        description="Student count input label"
                        id="gui.classroom.teacherCreate.count"
                    />
                </label>
                <input
                    className={styles.input}
                    data-testid="classroom-count-input"
                    id="classroom-count"
                    max={50}
                    min={1}
                    type="number"
                    value={studentCount}
                    onChange={handleStudentCountChange}
                />
            </div>
            <div className={styles.buttonRow}>
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-create-submit"
                    disabled={!className.trim() || isLoading}
                    onClick={handleSubmit}
                >
                    <FormattedMessage
                        defaultMessage="Create"
                        description="Submit create classroom button"
                        id="gui.classroom.teacherCreate.submit"
                    />
                </button>
            </div>
            {error && (
                <div className={styles.errorText} data-testid="classroom-error">
                    {error}
                </div>
            )}
        </div>
    );
};

TeacherCreateForm.propTypes = {
    error: PropTypes.string,
    isLoading: PropTypes.bool,
    onBack: PropTypes.func.isRequired,
    onCreate: PropTypes.func.isRequired,
};

// Student join form
const StudentJoinForm = ({ error, isLoading, onBack, onJoin }) => {
    const [code, setCode] = React.useState('');

    const handleCodeChange = useCallback((e) => {
        setCode(e.target.value.toUpperCase());
    }, []);

    const handleSubmit = useCallback(() => {
        if (code.trim().length === 6) {
            onJoin(code.trim().toUpperCase());
        }
    }, [code, onJoin]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter' && code.trim().length === 6) {
                onJoin(code.trim().toUpperCase());
            }
        },
        [code, onJoin],
    );

    return (
        <div data-testid="classroom-phase-student-join">
            <button
                className={styles.backLink}
                data-testid="classroom-back"
                onClick={onBack}
            >
                {'<'}{' '}
                <FormattedMessage defaultMessage="Back" description="Back button" id="gui.classroom.back" />
            </button>
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
                    placeholder="ABC234"
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.2em' }}
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className={styles.buttonRow}>
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-join-submit"
                    disabled={code.trim().length !== 6 || isLoading}
                    onClick={handleSubmit}
                >
                    <FormattedMessage
                        defaultMessage="Next"
                        description="Submit join code button"
                        id="gui.classroom.studentJoin.next"
                    />
                </button>
            </div>
            {error && (
                <div className={styles.errorText} data-testid="classroom-error">
                    {error}
                </div>
            )}
        </div>
    );
};

StudentJoinForm.propTypes = {
    error: PropTypes.string,
    isLoading: PropTypes.bool,
    onBack: PropTypes.func.isRequired,
    onJoin: PropTypes.func.isRequired,
};

ClassroomModal.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object),
    error: PropTypes.string,
    isLoading: PropTypes.bool,
    joinedInfo: PropTypes.shape({
        className: PropTypes.string,
        seatNumber: PropTypes.number,
    }),
    members: PropTypes.arrayOf(PropTypes.object),
    onBackToDashboard: PropTypes.func.isRequired,
    onBackToRoleSelect: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirmJoin: PropTypes.func.isRequired,
    onCreateClassroom: PropTypes.func.isRequired,
    onDeleteMember: PropTypes.func.isRequired,
    onJoinWithCode: PropTypes.func.isRequired,
    onSelectClassroom: PropTypes.func.isRequired,
    onSelectSeat: PropTypes.func.isRequired,
    onSelectStudent: PropTypes.func.isRequired,
    onSelectTeacher: PropTypes.func.isRequired,
    onShowCreateForm: PropTypes.func.isRequired,
    onTeacherLogin: PropTypes.func.isRequired,
    phase: PropTypes.string.isRequired,
    seatCount: PropTypes.number,
    selectedClassroom: PropTypes.object,
    selectedSeat: PropTypes.number,
    takenSeats: PropTypes.arrayOf(PropTypes.number),
};

ClassroomModal.defaultProps = {
    classrooms: [],
    error: null,
    isLoading: false,
    joinedInfo: null,
    members: [],
    seatCount: 0,
    selectedClassroom: null,
    selectedSeat: null,
    takenSeats: [],
};

export default ClassroomModal;
