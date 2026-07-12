/**
 * Teacher classroom CRUD hook.
 *
 * Manages classroom list, detail view, members, and auto-refresh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import translateError from './classroom-error-utils.js';

const REFRESH_INTERVAL_MS = parseInt(process.env.CLASSROOM_REFRESH_INTERVAL_MS || '30000', 10);

/**
 * Build enriched member list by joining members with their latest submission.
 * @param {object} membersData - API response from listMembers
 * @param {object} submissionsData - API response from listSubmissions
 * @returns {Array} enriched member list
 */
const enrichMembers = (membersData, submissionsData) => {
    const subMap = {};
    for (const sub of submissionsData.submissions || []) {
        const existing = subMap[sub.memberId];
        if (!existing || sub.submittedAt > existing.submittedAt) {
            subMap[sub.memberId] = sub;
        }
    }
    const memberIds = new Set();
    const enriched = (membersData.members || []).map((m) => {
        memberIds.add(m.memberId);
        const sub = subMap[m.memberId];
        return sub
            ? {
                  ...m,
                  hasSubmission: true,
                  submissionId: sub.submissionId,
                  submissionStatus: sub.status || 'submitted',
                  thumbnailUrl: sub.thumbnailUrl || null,
                  projectUrl: sub.projectUrl || null,
                  projectName: sub.projectName || null,
                  screenshotUrls: sub.screenshotUrls || [],
                  teacherComment: sub.teacherComment || '',
              }
            : m;
    });
    for (const [memberId, sub] of Object.entries(subMap)) {
        if (!memberIds.has(memberId)) {
            enriched.push({
                memberId,
                hasSubmission: true,
                submissionId: sub.submissionId,
                submissionStatus: sub.status || 'submitted',
                submittedAt: sub.submittedAt || null,
                thumbnailUrl: sub.thumbnailUrl || null,
                projectUrl: sub.projectUrl || null,
                projectName: sub.projectName || null,
                screenshotUrls: sub.screenshotUrls || [],
                teacherComment: sub.teacherComment || '',
                left: true,
            });
        }
    }
    return enriched;
};

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {Function} params.handleTeacher401 - 401 handler from auth hook
 * @param {string} params.mode - 'student' | 'teacher'
 * @param {string} params.phase - current UI phase
 * @param {Function} params.setPhase - phase setter
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setIsLoading - loading state setter
 * @returns {object} classroom state and handler functions
 */
const useTeacherClassrooms = ({
    idToken,
    handleTeacher401,
    mode,
    phase,
    setPhase,
    clearError,
    showError,
    intl,
    setIsLoading,
}) => {
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClassroom, setSelectedClassroom] = useState(null);
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    // Pending kick requests for the currently selected classroom, indexed by
    // seatNumber. We keep an array per seat because the backend lets several
    // students send overlapping requests for the same seat (no abuse cap),
    // and the teacher should see them all. Cleared on classroom switch.
    const [kickRequestsBySeat, setKickRequestsBySeat] = useState({});

    const refreshTimerRef = useRef(null);

    // --- Load classrooms (assignments) ---

    const loadClassrooms = useCallback(async () => {
        if (!idToken) return;
        setIsLoading(true);
        try {
            const data = await classroomAPI.listClassrooms(idToken);
            setClassrooms(data.classrooms || []);
        } catch (err) {
            if (err.status === 401) {
                const newToken = await handleTeacher401();
                if (newToken) {
                    try {
                        const retryData = await classroomAPI.listClassrooms(newToken);
                        setClassrooms(retryData.classrooms || []);
                    } catch {
                        // Retry also failed
                    }
                }
            } else {
                showError(translateError(intl, err));
            }
        } finally {
            setIsLoading(false);
        }
    }, [idToken, showError, handleTeacher401, intl, setIsLoading]);

    // The class list needs assignment counts, so load on both entry phases
    // (the landing view and inside a class).
    const onListingPhase = phase === 'teacher-dashboard' || phase === 'teacher-class-list';
    useEffect(() => {
        if (onListingPhase && idToken) {
            clearError();
            loadClassrooms();
        }
    }, [onListingPhase, idToken, clearError, loadClassrooms]);

    // --- Fetch classroom detail ---

    const groupKickRequestsBySeat = (kickRequestsData) => {
        const bySeat = {};
        for (const req of kickRequestsData?.requests || []) {
            const seat = req.seatNumber;
            if (!bySeat[seat]) bySeat[seat] = [];
            bySeat[seat].push(req);
        }
        return bySeat;
    };

    const fetchClassroomDetail = useCallback(async (token, classroomId) => {
        const [classroomData, membersData, submissionsData, kickRequestsData] = await Promise.all([
            classroomAPI.getClassroom(token, classroomId),
            classroomAPI.listMembers(token, classroomId),
            classroomAPI.listSubmissions(token, classroomId),
            classroomAPI.listKickRequests(token, classroomId).catch(() => ({ requests: [] })),
        ]);
        setSelectedClassroom(classroomData);
        setMembers(enrichMembers(membersData, submissionsData));
        setKickRequestsBySeat(groupKickRequestsBySeat(kickRequestsData));
    }, []);

    const loadClassroomDetail = useCallback(
        async (classroomId) => {
            try {
                await fetchClassroomDetail(idToken, classroomId);
                return true;
            } catch (err) {
                if (err.status === 401) {
                    const newToken = await handleTeacher401();
                    if (newToken) {
                        try {
                            await fetchClassroomDetail(newToken, classroomId);
                            return true;
                        } catch {
                            // Retry also failed
                        }
                    }
                    return false;
                }
                showError(translateError(intl, err));
                return false;
            }
        },
        [idToken, fetchClassroomDetail, showError, handleTeacher401, intl],
    );

    // --- CRUD handlers ---

    const handleCreateClassroom = useCallback(
        async (formData, googleCourseId) => {
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.createClassroom(
                    idToken,
                    formData.className,
                    formData.assignmentName,
                    formData.studentCount,
                    googleCourseId,
                );
                setPhase('teacher-dashboard');
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, clearError, showError, handleTeacher401, intl, setIsLoading, setPhase],
    );

    const handleDeleteClassroom = useCallback(
        async (classroomId) => {
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.deleteClassroom(idToken, classroomId);
                setSelectedClassroom(null);
                setMembers([]);
                setPhase('teacher-dashboard');
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, clearError, showError, handleTeacher401, intl, setIsLoading, setPhase],
    );

    const handleSelectClassroom = useCallback(
        async (classroomId) => {
            clearError();
            setIsLoading(true);
            const success = await loadClassroomDetail(classroomId);
            if (success) {
                setPhase('teacher-class-detail');
            }
            setIsLoading(false);
        },
        [clearError, loadClassroomDetail, setIsLoading, setPhase],
    );

    const handleRefreshDetail = useCallback(async () => {
        if (!selectedClassroom) return;
        clearError();
        setIsLoading(true);
        await loadClassroomDetail(selectedClassroom.classroomId);
        setIsLoading(false);
    }, [selectedClassroom, clearError, loadClassroomDetail, setIsLoading]);

    // --- Lightweight refresh (members only, preserves detail pane state) ---

    const refreshMembersOnly = useCallback(
        async (classroomId) => {
            try {
                const [membersData, submissionsData, kickRequestsData] = await Promise.all([
                    classroomAPI.listMembers(idToken, classroomId),
                    classroomAPI.listSubmissions(idToken, classroomId),
                    classroomAPI.listKickRequests(idToken, classroomId).catch(() => ({ requests: [] })),
                ]);
                setMembers(enrichMembers(membersData, submissionsData));
                setKickRequestsBySeat(groupKickRequestsBySeat(kickRequestsData));
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                }
                // Silently ignore other refresh errors
            }
        },
        [idToken, handleTeacher401],
    );

    useEffect(() => {
        if (phase === 'teacher-class-detail' && selectedClassroom && idToken) {
            refreshTimerRef.current = setInterval(() => {
                refreshMembersOnly(selectedClassroom.classroomId);
            }, REFRESH_INTERVAL_MS);
            return () => clearInterval(refreshTimerRef.current);
        }
        return () => {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
            }
        };
    }, [phase, selectedClassroom, idToken, refreshMembersOnly]);

    // --- Navigation ---

    const handleBackToDashboard = useCallback(() => {
        clearError();
        setSelectedClassroom(null);
        setMembers([]);
        setKickRequestsBySeat({});
        if (idToken) {
            setPhase('teacher-dashboard');
        } else {
            setPhase(mode === 'teacher' ? 'teacher-login' : 'student-join');
        }
    }, [mode, idToken, clearError, setPhase]);

    // --- Member management ---

    const handleDeleteMember = useCallback(
        async (memberId) => {
            if (!selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.deleteMember(idToken, selectedClassroom.classroomId, memberId);
                setMembers((prev) => prev.filter((m) => m.memberId !== memberId));
                setSelectedMember(null);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            }
        },
        [idToken, selectedClassroom, clearError, showError, handleTeacher401, intl],
    );

    const handleSelectMember = useCallback((memberId) => {
        setSelectedMember(memberId);
    }, []);

    // --- Update classroom settings ---

    /**
     * Update board-editable assignment metadata (topic / sortDate) for any
     * assignment in the class — the board edits rows in place, so this
     * patches both the list and the selection instead of refetching.
     */
    const handleUpdateAssignmentMeta = useCallback(
        async (classroomId, updates) => {
            if (!idToken) return;
            clearError();
            try {
                await classroomAPI.updateClassroom(idToken, classroomId, updates);
                setClassrooms((prev) => prev.map((c) => (c.classroomId === classroomId ? { ...c, ...updates } : c)));
                setSelectedClassroom((prev) =>
                    prev && prev.classroomId === classroomId ? { ...prev, ...updates } : prev,
                );
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            }
        },
        [idToken, clearError, showError, handleTeacher401, intl],
    );

    const handleUpdateAssignmentName = useCallback(
        async (assignmentName) => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.updateClassroom(idToken, selectedClassroom.classroomId, { assignmentName });
                setSelectedClassroom((prev) => ({ ...prev, assignmentName }));
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            }
        },
        [idToken, selectedClassroom, clearError, showError, handleTeacher401, intl],
    );

    const handleUpdateStudentCount = useCallback(
        async (studentCount) => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.updateClassroom(idToken, selectedClassroom.classroomId, { studentCount });
                setSelectedClassroom((prev) => ({ ...prev, studentCount }));
                // Refresh to reflect new seat grid
                const detail = await classroomAPI.getClassroom(idToken, selectedClassroom.classroomId);
                const memberList = await classroomAPI.listMembers(idToken, selectedClassroom.classroomId);
                setSelectedClassroom(detail);
                setMembers(memberList.members || []);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            }
        },
        [idToken, selectedClassroom, clearError, showError, handleTeacher401, intl],
    );

    // --- Co-teacher management ---

    const handleAddCoTeacher = useCallback(
        async (email) => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            try {
                const data = await classroomAPI.addCoTeacher(idToken, selectedClassroom.classroomId, email);
                setSelectedClassroom((prev) => ({ ...prev, coTeacherEmails: data.coTeacherEmails || [] }));
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            }
        },
        [idToken, selectedClassroom, clearError, showError, handleTeacher401, intl],
    );

    const handleRemoveCoTeacher = useCallback(
        async (email) => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            try {
                const data = await classroomAPI.removeCoTeacher(idToken, selectedClassroom.classroomId, email);
                setSelectedClassroom((prev) => ({ ...prev, coTeacherEmails: data.coTeacherEmails || [] }));
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            }
        },
        [idToken, selectedClassroom, clearError, showError, handleTeacher401, intl],
    );

    // --- Kick request actions ---

    const handleApproveKickRequest = useCallback(
        async (requestId) => {
            if (!selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.approveKickRequest(idToken, selectedClassroom.classroomId, requestId);
                // Backend approval also runs the kick → refresh both members
                // and kick-requests in one shot.
                await refreshMembersOnly(selectedClassroom.classroomId);
                setSelectedMember(null);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            }
        },
        [idToken, selectedClassroom, clearError, showError, handleTeacher401, intl, refreshMembersOnly],
    );

    const handleRejectKickRequest = useCallback(
        async (requestId) => {
            if (!selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.rejectKickRequest(idToken, selectedClassroom.classroomId, requestId);
                await refreshMembersOnly(selectedClassroom.classroomId);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            }
        },
        [idToken, selectedClassroom, clearError, showError, handleTeacher401, intl, refreshMembersOnly],
    );

    /** Reset all classroom state (used by logout). */
    const resetClassrooms = useCallback(() => {
        setClassrooms([]);
        setSelectedClassroom(null);
        setMembers([]);
        setKickRequestsBySeat({});
    }, []);

    return {
        classrooms,
        setClassrooms,
        selectedClassroom,
        setSelectedClassroom,
        members,
        setMembers,
        selectedMember,
        kickRequestsBySeat,
        loadClassroomDetail,
        handleCreateClassroom,
        handleDeleteClassroom,
        handleSelectClassroom,
        handleBackToDashboard,
        handleRefreshDetail,
        handleDeleteMember,
        handleSelectMember,
        loadClassrooms,
        handleUpdateAssignmentMeta,
        handleUpdateAssignmentName,
        handleUpdateStudentCount,
        handleApproveKickRequest,
        handleRejectKickRequest,
        handleAddCoTeacher,
        handleRemoveCoTeacher,
        resetClassrooms,
    };
};

export default useTeacherClassrooms;
