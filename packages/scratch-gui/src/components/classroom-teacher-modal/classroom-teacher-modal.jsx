/**
 * Teacher fullscreen class management modal.
 *
 * Separate from the student ClassroomModal. Renders a fullscreen overlay
 * with a sidebar (class list) and a main area.
 *
 * Phase content in the main area is currently a placeholder.
 * TODO: Extract TeacherClassDetail, TeacherCreateForm, etc. into shared
 * sub-components and render them here.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import Modal from '../../containers/modal.jsx';

import styles from './classroom-teacher-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Class Management',
        description: 'Title for the teacher class management modal',
        id: 'gui.menuBar.classroomManagement',
    },
});

const ClassroomTeacherModal = ({ containerProps, onClose }) => {
    const intl = useIntl();
    const {
        phase,
        classrooms,
        selectedClassroom,
        isLoading,
        onTeacherLogin,
        onTeacherLogout,
        onShowCreateForm,
        onSelectClassroom,
        onGoogleClassroomImport,
    } = containerProps;

    const handleSelectClassroom = useCallback(
        (e) => {
            onSelectClassroom(e.currentTarget.dataset.classroomId);
        },
        [onSelectClassroom],
    );

    const renderMain = () => {
        if (phase === 'teacher-login') {
            return (
                <div data-testid="classroom-phase-teacher-login">
                    <h2>
                        <FormattedMessage
                            defaultMessage="Sign in with Google"
                            description="Prompt for teacher Google sign in"
                            id="gui.classroom.management.loginPrompt"
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            defaultMessage="Sign in with your Google account to manage classrooms."
                            description="Teacher login description"
                            id="gui.classroom.management.loginDescription"
                        />
                    </p>
                    <button
                        className={styles.loginButton}
                        data-testid="classroom-google-login"
                        onClick={onTeacherLogin}
                    >
                        <FormattedMessage
                            defaultMessage="Sign in with Google"
                            description="Google sign in button"
                            id="gui.classroom.management.loginButton"
                        />
                    </button>
                </div>
            );
        }
        return (
            <div className={styles.mainEmpty}>
                <FormattedMessage
                    defaultMessage="Select a classroom from the sidebar"
                    description="Prompt to select a classroom in teacher management"
                    id="gui.classroom.teacherDetail.selectClassroom"
                />
            </div>
        );
    };

    return (
        <Modal
            contentLabel={intl.formatMessage(messages.title)}
            fullScreen
            id="classroomTeacherModal"
            onRequestClose={onClose}
        >
            <div
                className={styles.layout}
                data-testid="classroom-teacher-modal"
            >
                {/* Sidebar: visible when logged in */}
                {phase !== 'teacher-login' && (
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            <FormattedMessage
                                defaultMessage="Your Classrooms"
                                description="Teacher sidebar title"
                                id="gui.classroom.management.sidebarTitle"
                            />
                        </div>
                        <ul className={styles.sidebarList}>
                            {isLoading && classrooms.length === 0 && (
                                <li className={styles.sidebarItem}>
                                    <FormattedMessage
                                        defaultMessage="Loading..."
                                        description="Loading indicator in sidebar"
                                        id="gui.classroom.management.loading"
                                    />
                                </li>
                            )}
                            {classrooms.map((c) => (
                                <li
                                    className={classNames(
                                        styles.sidebarItem,
                                        selectedClassroom &&
                                            selectedClassroom.classroomId ===
                                                c.classroomId &&
                                            styles.sidebarItemSelected,
                                    )}
                                    data-classroom-id={c.classroomId}
                                    data-testid={`classroom-sidebar-item-${c.classroomId}`}
                                    key={c.classroomId}
                                    onClick={handleSelectClassroom}
                                >
                                    <span className={styles.sidebarItemName}>
                                        {c.className}
                                    </span>
                                    <span className={styles.sidebarItemMeta}>
                                        {`${c.studentCount} · ${c.joinCode.toLowerCase()}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className={styles.sidebarFooter}>
                            <button
                                className={classNames(
                                    styles.sidebarButton,
                                    styles.sidebarButtonPrimary,
                                )}
                                data-testid="classroom-create"
                                onClick={onShowCreateForm}
                            >
                                <FormattedMessage
                                    defaultMessage="Create Classroom"
                                    description="Create new classroom button in sidebar"
                                    id="gui.classroom.management.create"
                                />
                            </button>
                            <button
                                className={styles.sidebarButton}
                                data-testid="classroom-google-import"
                                onClick={onGoogleClassroomImport}
                            >
                                <FormattedMessage
                                    defaultMessage="Import from Google Classroom"
                                    description="Import from Google Classroom button in sidebar"
                                    id="gui.classroom.management.googleImport"
                                />
                            </button>
                            <button
                                className={classNames(
                                    styles.sidebarButton,
                                    styles.sidebarButtonDanger,
                                )}
                                data-testid="classroom-teacher-logout"
                                onClick={onTeacherLogout}
                            >
                                <FormattedMessage
                                    defaultMessage="Logout"
                                    description="Teacher logout button in sidebar"
                                    id="gui.classroom.management.logout"
                                />
                            </button>
                        </div>
                    </aside>
                )}
                {/* Main area */}
                <main className={styles.main}>{renderMain()}</main>
            </div>
        </Modal>
    );
};

ClassroomTeacherModal.propTypes = {
    containerProps: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default ClassroomTeacherModal;
