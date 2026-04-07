import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const TeacherDashboardPhase = ({
    classrooms,
    error,
    errorTitle,
    isLoading,
    onGoogleClassroomImport,
    onSelectClassroom,
    onShowCreateForm,
    onTeacherLogout,
}) => {
    const handleSelectClassroom = useCallback(
        (e) => {
            onSelectClassroom(e.currentTarget.dataset.classroomId);
        },
        [onSelectClassroom],
    );

    return (
        <div
            className={styles.dashboardLayout}
            data-testid="classroom-phase-teacher-dashboard"
        >
            <div className={styles.dashboardHeader}>
                <div
                    className={styles.phaseTitle}
                    style={{ marginBottom: 0 }}
                >
                    <FormattedMessage
                        defaultMessage="Your Classrooms"
                        description="Teacher dashboard title"
                        id="gui.classroom.teacherDashboard.title"
                    />
                </div>
            </div>
            <div className={styles.dashboardBody}>
                {isLoading && (
                    <div
                        className={styles.loading}
                        data-testid="classroom-loading"
                    >
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
                    <ul
                        className={styles.classList}
                        data-testid="classroom-list"
                    >
                        {classrooms.map((c) => (
                            <li
                                className={styles.classItem}
                                data-testid={`classroom-item-${c.classroomId}`}
                                key={c.classroomId}
                            >
                                <div className={styles.classItemMain}>
                                    <span
                                        className={
                                            styles.classItemName
                                        }
                                        data-testid={`classroom-item-name-${c.classroomId}`}
                                    >
                                        {c.className}
                                    </span>
                                    <span
                                        className={
                                            styles.classItemCode
                                        }
                                        data-testid={`classroom-item-code-${c.classroomId}`}
                                    >
                                        {c.joinCode.toLowerCase()}
                                    </span>
                                </div>
                                <div className={styles.classItemMeta}>
                                    <span
                                        className={
                                            styles.classItemMetaText
                                        }
                                    >
                                        {c.studentCount}
                                        <FormattedMessage
                                            defaultMessage=" students"
                                            description="Student count suffix in class list"
                                            id="gui.classroom.teacherDashboard.studentCountSuffix"
                                        />
                                    </span>
                                    {c.createdAt && (
                                        <span
                                            className={
                                                styles.classItemMetaText
                                            }
                                        >
                                            {new Date(
                                                c.createdAt,
                                            ).toLocaleDateString()}
                                        </span>
                                    )}
                                    {c.expiresAt && (
                                        <span
                                            className={
                                                styles.classItemMetaText
                                            }
                                        >
                                            <FormattedMessage
                                                defaultMessage="Expires: {date}"
                                                description="Expiry date in class list"
                                                id="gui.classroom.teacherDashboard.expiresAt"
                                                values={{
                                                    date: new Date(
                                                        c.expiresAt,
                                                    ).toLocaleDateString(),
                                                }}
                                            />
                                        </span>
                                    )}
                                    <span style={{ flex: 1 }} />
                                    <button
                                        className={
                                            styles.secondaryButton
                                        }
                                        data-classroom-id={
                                            c.classroomId
                                        }
                                        data-testid={`classroom-item-details-${c.classroomId}`}
                                        onClick={
                                            handleSelectClassroom
                                        }
                                    >
                                        <FormattedMessage
                                            defaultMessage="Details"
                                            description="View classroom details button"
                                            id="gui.classroom.teacherDashboard.details"
                                        />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className={styles.dashboardFooter}>
                <ErrorDisplay error={error} errorTitle={errorTitle} />
                <div className={styles.buttonRow}>
                    <button
                        className={styles.secondaryButton}
                        data-testid="classroom-teacher-logout"
                        onClick={onTeacherLogout}
                    >
                        <FormattedMessage
                            defaultMessage="Logout"
                            description="Teacher logout button"
                            id="gui.classroom.teacherDashboard.logout"
                        />
                    </button>
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
                    <button
                        className={styles.secondaryButton}
                        data-testid="classroom-google-import"
                        onClick={onGoogleClassroomImport}
                    >
                        <FormattedMessage
                            defaultMessage="Import from Google Classroom"
                            description="Import classroom from Google Classroom"
                            id="gui.classroom.googleImport"
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};

TeacherDashboardPhase.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object).isRequired,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    onGoogleClassroomImport: PropTypes.func.isRequired,
    onSelectClassroom: PropTypes.func.isRequired,
    onShowCreateForm: PropTypes.func.isRequired,
    onTeacherLogout: PropTypes.func.isRequired,
};

export default TeacherDashboardPhase;
