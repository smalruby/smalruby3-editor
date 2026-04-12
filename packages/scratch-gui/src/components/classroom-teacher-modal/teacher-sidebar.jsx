/**
 * Teacher sidebar showing class groups and management buttons.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useMemo } from 'react';
import { FormattedMessage } from 'react-intl';

import googleClassroomIcon from './google-classroom-icon.png';
import styles from './classroom-teacher-modal.css';

const TeacherSidebar = ({
    classrooms,
    isLoading,
    selectedClassroom,
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

    // Group classrooms by className for sidebar display (hide expired)
    const groupedClassrooms = useMemo(() => {
        const now = new Date();
        const activeClassrooms = classrooms.filter((c) => {
            if (!c.expiresAt) return true;
            return new Date(c.expiresAt) > now;
        });
        const groups = {};
        for (const c of activeClassrooms) {
            const name = c.className || '';
            if (!groups[name]) {
                groups[name] = [];
            }
            groups[name].push(c);
        }
        const sortedGroupNames = Object.keys(groups).sort((a, b) =>
            a.localeCompare(b, 'ja'),
        );
        for (const name of sortedGroupNames) {
            groups[name].sort((a, b) => {
                const nameComp = (a.assignmentName || '').localeCompare(
                    b.assignmentName || '',
                    'ja',
                );
                if (nameComp !== 0) return nameComp;
                return (
                    new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                );
            });
        }
        return sortedGroupNames.map((name) => ({
            className: name,
            hasGoogleClassroom: groups[name].some(
                (c) => c.googleClassroomCourseId,
            ),
            classrooms: groups[name],
        }));
    }, [classrooms]);

    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
                <FormattedMessage
                    defaultMessage="Your Classes & Assignments"
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
                {groupedClassrooms.map((group) => (
                    <React.Fragment key={group.className}>
                        <li
                            className={styles.sidebarGroupHeader}
                            data-testid={`classroom-sidebar-group-${group.className}`}
                        >
                            {group.hasGoogleClassroom && (
                                <img
                                    alt=""
                                    className={styles.sidebarGroupIcon}
                                    src={googleClassroomIcon}
                                />
                            )}
                            <span>{group.className}</span>
                        </li>
                        {group.classrooms.map((c) => (
                            <li
                                className={classNames(
                                    styles.sidebarItem,
                                    styles.sidebarItemIndented,
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
                                    {c.assignmentName || '-'}
                                </span>
                                <span className={styles.sidebarItemMeta}>
                                    {`${c.studentCount} · ${c.joinCode.toLowerCase()}`}
                                </span>
                            </li>
                        ))}
                    </React.Fragment>
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
    );
};

TeacherSidebar.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object).isRequired,
    isLoading: PropTypes.bool,
    onSelectClassroom: PropTypes.func.isRequired,
    onShowCreateForm: PropTypes.func.isRequired,
    onTeacherLogout: PropTypes.func.isRequired,
    selectedClassroom: PropTypes.object,
};

export default TeacherSidebar;
