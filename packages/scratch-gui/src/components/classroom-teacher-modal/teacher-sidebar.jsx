/**
 * Teacher sidebar showing class groups and management buttons.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useMemo } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { buildSidebarSections } from '../../lib/classroom-group-utils.js';
import googleClassroomIcon from './google-classroom-icon.png';
import styles from './classroom-teacher-modal.css';

const TeacherSidebar = ({
    classrooms,
    groups,
    isLoading,
    selectedClassroom,
    onSelectClassroom,
    onShowClassList,
    onShowCreateForm,
    onShowGroupManage,
}) => {
    const intl = useIntl();
    const handleSelectClassroom = useCallback(
        (e) => {
            onSelectClassroom(e.currentTarget.dataset.classroomId);
        },
        [onSelectClassroom],
    );

    // Sections: real groups (組) first, then the legacy className grouping
    // for classrooms without a group (hide expired classrooms).
    const sections = useMemo(() => {
        const now = new Date();
        const activeClassrooms = classrooms.filter((c) => {
            if (!c.expiresAt) return true;
            return new Date(c.expiresAt) > now;
        });
        return buildSidebarSections(activeClassrooms, groups);
    }, [classrooms, groups]);

    return (
        <aside className={styles.sidebar}>
            {onShowClassList && (
                <button
                    className={styles.sidebarBackToClassList}
                    data-testid="classroom-sidebar-back-to-class-list"
                    type="button"
                    onClick={onShowClassList}
                >
                    <FormattedMessage
                        defaultMessage="&lsaquo; Class list"
                        description="Sidebar button back to the class list"
                        id="gui.classroom.classList.back"
                    />
                </button>
            )}
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
                {sections.map((group) => (
                    <React.Fragment key={group.kind === 'group' ? group.groupId : `cn-${group.className}`}>
                        <li
                            className={styles.sidebarGroupHeader}
                            data-testid={
                                group.kind === 'group'
                                    ? `classroom-sidebar-teachergroup-${group.groupId}`
                                    : `classroom-sidebar-group-${group.className}`
                            }
                        >
                            {group.kind !== 'group' &&
                                group.classrooms.some((c) => c.googleClassroomCourseId) && (
                                    <img
                                        alt=""
                                        className={styles.sidebarGroupIcon}
                                        src={googleClassroomIcon}
                                    />
                                )}
                            <span>
                                {group.kind === 'group'
                                    ? intl.formatMessage(
                                          {
                                              defaultMessage: '{name} ({year})',
                                              description: 'Sidebar group header: group name + school year',
                                              id: 'gui.classroom.groups.sidebarHeader',
                                          },
                                          { name: group.name, year: group.year },
                                      )
                                    : group.className}
                            </span>
                        </li>
                        {group.kind === 'group' && group.classrooms.length === 0 && (
                            <li className={classNames(styles.sidebarItem, styles.sidebarItemIndented)}>
                                <span className={styles.sidebarItemMeta}>
                                    <FormattedMessage
                                        defaultMessage="No lessons yet"
                                        description="Empty group section in the sidebar"
                                        id="gui.classroom.groups.sidebarEmpty"
                                    />
                                </span>
                            </li>
                        )}
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
                                    {c.role === 'co-teacher' && (
                                        <span
                                            className={styles.sidebarItemCoManagedBadge}
                                            data-testid={`classroom-item-co-managed-badge-${c.classroomId}`}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Co-managed"
                                                description="Badge on classes the teacher co-manages (is not the owner of)"
                                                id="gui.classroom.management.coManagedBadge"
                                            />
                                        </span>
                                    )}
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
                {onShowGroupManage && (
                    <button
                        className={styles.sidebarButton}
                        data-testid="classroom-group-manage"
                        onClick={onShowGroupManage}
                    >
                        <FormattedMessage
                            defaultMessage="Manage Groups"
                            description="Open group (school class) management from the sidebar"
                            id="gui.classroom.groups.manageButton"
                        />
                    </button>
                )}
            </div>
        </aside>
    );
};

TeacherSidebar.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object).isRequired,
    groups: PropTypes.arrayOf(PropTypes.object),
    isLoading: PropTypes.bool,
    onSelectClassroom: PropTypes.func.isRequired,
    onShowCreateForm: PropTypes.func.isRequired,
    onShowClassList: PropTypes.func,
    onShowGroupManage: PropTypes.func,
    selectedClassroom: PropTypes.object,
};

export default TeacherSidebar;
