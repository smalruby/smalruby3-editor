/**
 * Teacher groups (組) hook.
 *
 * Manages the year-long organizing concept: listing/creating/renaming/
 * archiving groups, assigning classrooms to a group, and duplicating a
 * lesson (classroom) with its assignment content.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import log from '../lib/log.js';
import translateError from './classroom-error-utils.js';

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {Function} params.handleTeacher401 - 401 handler (session expiry)
 * @param {Function} params.setClassrooms - classrooms list setter
 * @param {Function} params.setSelectedClassroom - selected classroom setter
 * @param {Function} params.loadClassrooms - reload the assignments list (post-migration counts)
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setIsLoading - loading state setter
 * @param {Function} params.setPhase - phase setter
 * @returns {object} groups state and handlers
 */
const useTeacherGroups = ({
    idToken,
    handleTeacher401,
    setClassrooms,
    setSelectedClassroom,
    loadClassrooms,
    clearError,
    showError,
    intl,
    setIsLoading,
    setPhase,
}) => {
    const [groups, setGroups] = useState([]);
    // The class the teacher opened from the class list. Scopes the sidebar
    // (and the assignment views) to a single class, Google Classroom style.
    const [selectedGroup, setSelectedGroup] = useState(null);
    const migratedForToken = useRef(null);

    const loadGroups = useCallback(async () => {
        if (!idToken) return;
        try {
            const data = await classroomAPI.listGroups(idToken);
            setGroups(data.groups || []);
        } catch (err) {
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            // Groups are auxiliary — a failed load must not break the
            // dashboard, so log and keep the previous list.
            log.error('Failed to load groups:', err);
        }
    }, [idToken, handleTeacher401]);

    // Once per login: run the idempotent v1→v2 migration, then load classes.
    // A migration failure must not block the class list — the server keeps
    // serving pre-v2 data, so log and continue.
    useEffect(() => {
        if (!idToken) return;
        (async () => {
            if (migratedForToken.current !== idToken) {
                migratedForToken.current = idToken;
                try {
                    await classroomAPI.migrateGroups(idToken);
                    // Migration may have assigned groupIds — refresh the
                    // assignments so the class cards count correctly.
                    if (loadClassrooms) {
                        await loadClassrooms();
                    }
                } catch (err) {
                    log.error('Group migration failed (continuing):', err);
                }
            }
            await loadGroups();
        })();
    }, [idToken, loadGroups]);

    const handleShowGroupManage = useCallback(() => {
        clearError();
        setPhase('teacher-group-manage');
    }, [clearError, setPhase]);

    const handleBackFromGroupManage = useCallback(() => {
        clearError();
        setPhase('teacher-dashboard');
    }, [clearError, setPhase]);

    const handleCreateGroup = useCallback(
        async (name, year) => {
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.createGroup(idToken, name, year);
                await loadGroups();
            } catch (err) {
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, loadGroups, clearError, showError, intl, setIsLoading, handleTeacher401],
    );

    const handleUpdateGroup = useCallback(
        async (groupId, updates) => {
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.updateGroup(idToken, groupId, updates);
                await loadGroups();
            } catch (err) {
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, loadGroups, clearError, showError, intl, setIsLoading, handleTeacher401],
    );

    /** Assign the classroom to a group (or clear with null). */
    const handleAssignClassToGroup = useCallback(
        async (classroomId, groupId) => {
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.updateClassroom(idToken, classroomId, { groupId });
                // Patch local state instead of a full reload — the response
                // shape of updateClassroom does not include every summary
                // field, so mutate just groupId.
                const patch = (c) => (c.classroomId === classroomId ? { ...c, groupId: groupId || null } : c);
                setClassrooms((prev) => prev.map(patch));
                setSelectedClassroom((prev) =>
                    prev && prev.classroomId === classroomId ? { ...prev, groupId: groupId || null } : prev,
                );
            } catch (err) {
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, setClassrooms, setSelectedClassroom, clearError, showError, intl, setIsLoading, handleTeacher401],
    );

    /**
     * Duplicate a lesson into its current group (assignment content
     * included, members/submissions not) and add it to the local list.
     */
    const handleDuplicateClassroom = useCallback(
        async (classroom) => {
            clearError();
            setIsLoading(true);
            try {
                const copySuffix = intl.formatMessage({
                    defaultMessage: ' (copy)',
                    description: 'Suffix appended to the assignment name of a duplicated lesson',
                    id: 'gui.classroom.groups.duplicateSuffix',
                });
                const created = await classroomAPI.duplicateClassroom(idToken, classroom.classroomId, {
                    groupId: classroom.groupId || null,
                    assignmentName: `${classroom.assignmentName || ''}${copySuffix}`.trim().slice(0, 50),
                });
                setClassrooms((prev) => [...prev, { ...created, role: 'owner', coTeacherEmails: [] }]);
            } catch (err) {
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, setClassrooms, clearError, showError, intl, setIsLoading, handleTeacher401],
    );

    /**
     * Manage the class's topics. The server cascades rename/remove to the
     * assignments; mirror that deterministically in local state instead of
     * refetching the whole list.
     */
    const handleUpdateGroupTopics = useCallback(
        async (groupId, payload) => {
            clearError();
            setIsLoading(true);
            try {
                const updated = await classroomAPI.updateGroupTopics(idToken, groupId, payload);
                setGroups((prev) => prev.map((g) => (g.groupId === groupId ? { ...g, ...updated } : g)));
                setSelectedGroup((prev) => (prev && prev.groupId === groupId ? { ...prev, ...updated } : prev));
                if (payload.action === 'rename' || payload.action === 'remove') {
                    const to = payload.action === 'rename' ? payload.to : null;
                    setClassrooms((prev) =>
                        prev.map((c) =>
                            c.groupId === groupId && c.topic === payload.name ? { ...c, topic: to } : c,
                        ),
                    );
                }
            } catch (err) {
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, setClassrooms, clearError, showError, intl, setIsLoading, handleTeacher401],
    );

    /** Open a class from the class list — scope the workspace to it. */
    const handleSelectGroup = useCallback(
        (group) => {
            clearError();
            setSelectedGroup(group);
            setSelectedClassroom(null);
            setPhase('teacher-dashboard');
        },
        [clearError, setSelectedClassroom, setPhase],
    );

    /** Back to the class list (the post-login landing view). */
    const handleShowClassList = useCallback(() => {
        clearError();
        setSelectedGroup(null);
        setSelectedClassroom(null);
        setPhase('teacher-class-list');
    }, [clearError, setSelectedClassroom, setPhase]);

    /**
     * v2 GC integration: importing a Google Classroom course creates a
     * class (not an assignment) — the course name, student count and the
     * course link land on the class, so every assignment inside it can post
     * coursework without its own link.
     */
    const handleCreateClassFromCourse = useCallback(
        async (course) => {
            if (!course) return;
            clearError();
            setIsLoading(true);
            try {
                const now = new Date();
                const year = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
                const options = { googleClassroomCourseId: course.courseId };
                if (typeof course.studentCount === 'number' && course.studentCount > 0) {
                    options.studentCount = Math.min(course.studentCount, 50);
                }
                const group = await classroomAPI.createGroup(
                    idToken,
                    String(course.name || '').slice(0, 50),
                    year,
                    options,
                );
                await loadGroups();
                setSelectedGroup(group);
                setSelectedClassroom(null);
                setPhase('teacher-dashboard');
            } catch (err) {
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [
            idToken,
            loadGroups,
            setSelectedClassroom,
            setPhase,
            clearError,
            showError,
            intl,
            setIsLoading,
            handleTeacher401,
        ],
    );

    /**
     * Combined creation (teacher interview Q2): one form creates the class
     * and its first assignment, then lands inside the new class.
     */
    const handleCreateClassWithAssignment = useCallback(
        async ({ name, year, studentCount, section, assignmentName }) => {
            clearError();
            setIsLoading(true);
            try {
                const group = await classroomAPI.createGroup(idToken, name, year, {
                    studentCount,
                    ...(section ? { section } : {}),
                });
                // The first assignment is optional — a teacher may create
                // just the class and add assignments later.
                if (assignmentName) {
                    const created = await classroomAPI.createClassroom(
                        idToken,
                        name,
                        assignmentName,
                        null, // inherit studentCount from the class
                        null,
                        group.groupId,
                    );
                    setClassrooms((prev) => [...prev, { ...created, role: 'owner', coTeacherEmails: [] }]);
                }
                await loadGroups();
                setSelectedGroup(group);
                setSelectedClassroom(null);
                setPhase('teacher-dashboard');
            } catch (err) {
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [
            idToken,
            loadGroups,
            setClassrooms,
            setSelectedClassroom,
            setPhase,
            clearError,
            showError,
            intl,
            setIsLoading,
            handleTeacher401,
        ],
    );

    return {
        groups,
        loadGroups,
        selectedGroup,
        handleSelectGroup,
        handleShowClassList,
        handleCreateClassWithAssignment,
        handleUpdateGroupTopics,
        handleCreateClassFromCourse,
        handleShowGroupManage,
        handleBackFromGroupManage,
        handleCreateGroup,
        handleUpdateGroup,
        handleAssignClassToGroup,
        handleDuplicateClassroom,
    };
};

export default useTeacherGroups;
