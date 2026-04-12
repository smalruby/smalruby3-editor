import JSZip from 'jszip';
import { useCallback, useEffect, useRef, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import { requestClassroomAccessToken, clearClassroomAccessToken } from '../lib/google-classroom-auth.js';
import { loadGoogleIdentity } from '../lib/google-script-loader.js';
import { requestMicrosoftIdToken, isMicrosoftAuthAvailable } from '../lib/microsoft-auth.js';
import { closeClassroomModal } from '../reducers/classroom.js';
import translateError from './classroom-error-utils.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REFRESH_INTERVAL_MS = parseInt(process.env.CLASSROOM_REFRESH_INTERVAL_MS || '30000', 10);

// Persists teacher login across modal close/open within same page session
let _cachedTeacherIdToken = null;
let _cachedAuthProvider = null; // 'google' | 'microsoft' | null

/**
 * Return the cached teacher ID token (for initial phase calculation).
 * @returns {string|null} cached token
 */
export const getCachedTeacherIdToken = () => _cachedTeacherIdToken;

/**
 * Set the cached teacher ID token from outside (e.g. dev auto-login).
 * @param {string|null} token - the token to cache
 */
export const setCachedTeacherIdToken = token => {
    _cachedTeacherIdToken = token;
};

/**
 * Custom hook encapsulating all teacher-side classroom state and handlers.
 * @param {object} params - hook dependencies
 * @param {string} params.mode - 'student' | 'teacher'
 * @param {Function} params.dispatch - Redux dispatch
 * @param {object} params.intl - react-intl intl object
 * @param {string} params.phase - current UI phase
 * @param {Function} params.setPhase - phase setter
 * @param {Function} params.showError - error display helper
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showSessionExpiredError - session-expired error helper
 * @param {boolean} params.isLoading - loading state
 * @param {Function} params.setIsLoading - loading state setter
 * @param {object} params.vm - Scratch VM instance
 * @returns {object} teacher state and handler functions
 */
const useTeacherClassroom = ({
    mode,
    dispatch,
    intl,
    phase,
    setPhase,
    showError,
    clearError,
    showSessionExpiredError,
    isLoading,
    setIsLoading,
    vm,
}) => {
    // Teacher state
    const [idToken, setIdToken] = useState(_cachedTeacherIdToken);
    const [authProvider, setAuthProvider] = useState(_cachedAuthProvider);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClassroom, setSelectedClassroom] = useState(null);
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [codeDisplayClassroom, setCodeDisplayClassroom] = useState(null);
    const [codeDisplayFullscreen, setCodeDisplayFullscreen] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(null);

    // Google Classroom state
    const [googleAccessToken, setGoogleAccessToken] = useState(null);
    const [googleCourses, setGoogleCourses] = useState([]);
    const [selectedGoogleCourse, setSelectedGoogleCourse] = useState(null);

    // Refresh timer for teacher detail
    const refreshTimerRef = useRef(null);

    // Sync teacher token and provider to module-level cache
    useEffect(() => {
        _cachedTeacherIdToken = idToken;
    }, [idToken]);
    useEffect(() => {
        _cachedAuthProvider = authProvider;
    }, [authProvider]);

    // --- Teacher: Google Sign-In ---

    const handleGoogleLogin = useCallback(async () => {
        clearError();
        let signInContainer = null;
        let signInObserver = null;
        const cleanupSignIn = () => {
            if (signInObserver) {
                signInObserver.disconnect();
                signInObserver = null;
            }
            if (signInContainer && signInContainer.parentNode) {
                signInContainer.parentNode.removeChild(signInContainer);
            }
            signInContainer = null;
        };
        try {
            await loadGoogleIdentity();

            const token = await new Promise((resolve, reject) => {
                /* global google */
                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: response => {
                        cleanupSignIn();
                        if (response.credential) {
                            resolve(response.credential);
                        } else {
                            reject(new Error('Google Sign-In failed'));
                        }
                    },
                });
                google.accounts.id.prompt(notification => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        signInContainer = document.createElement('div');
                        signInContainer.style.cssText =
                            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;';
                        document.body.appendChild(signInContainer);
                        google.accounts.id.renderButton(signInContainer, {
                            theme: 'outline',
                            size: 'large',
                        });
                        signInObserver = new MutationObserver(() => {
                            if (!document.body.contains(signInContainer)) {
                                signInObserver.disconnect();
                                signInObserver = null;
                            }
                        });
                        signInObserver.observe(document.body, {
                            childList: true,
                            subtree: true,
                        });
                    }
                });
            });

            setIdToken(token);
            setAuthProvider('google');
            setPhase('teacher-dashboard');
        } catch (err) {
            cleanupSignIn();
            showError(err.message || 'Sign-in failed');
        }
    }, [clearError, showError, setPhase]);

    // --- Teacher: Microsoft Sign-In ---

    const handleMicrosoftLogin = useCallback(async () => {
        clearError();
        try {
            const token = await requestMicrosoftIdToken();
            setIdToken(token);
            setAuthProvider('microsoft');
            setPhase('teacher-dashboard');
        } catch (err) {
            showError(err.message || 'Microsoft Sign-In failed');
        }
    }, [clearError, showError, setPhase]);

    // --- Teacher: Logout ---

    const handleTeacherLogout = useCallback(() => {
        _cachedTeacherIdToken = null;
        _cachedAuthProvider = null;
        setIdToken(null);
        setAuthProvider(null);
        setClassrooms([]);
        setSelectedClassroom(null);
        setMembers([]);
        clearError();
        setPhase(mode === 'teacher' ? 'teacher-login' : 'student-join');
    }, [mode, clearError, setPhase]);

    // --- Teacher: Silent re-authentication on 401 ---

    const attemptSilentReauth = useCallback(async () => {
        // Skip silent reauth in non-teacher mode or when using devlogin token
        if (mode !== 'teacher') return null;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('devlogin')) return null;

        try {
            await loadGoogleIdentity();
            const REAUTH_TIMEOUT_MS = 5000;
            const newToken = await Promise.race([
                new Promise((resolve, reject) => {
                    google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        auto_select: true,
                        callback: response => {
                            if (response.credential) {
                                resolve(response.credential);
                            } else {
                                reject(new Error('Silent reauth failed'));
                            }
                        },
                    });
                    google.accounts.id.prompt(notification => {
                        // Only accept truly automatic sign-in (no UI shown)
                        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                            reject(new Error('Silent reauth not available'));
                        }
                        if (notification.isDismissedMoment()) {
                            reject(new Error('User dismissed reauth'));
                        }
                        // If One Tap UI is displayed, cancel it — we only want silent
                        if (notification.isDisplayMoment() && !notification.isNotDisplayed()) {
                            google.accounts.id.cancel();
                            reject(new Error('One Tap displayed, not silent'));
                        }
                    });
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Silent reauth timeout')), REAUTH_TIMEOUT_MS),
                ),
            ]);
            setIdToken(newToken);
            return newToken;
        } catch {
            // Ensure One Tap UI is closed on any failure
            try {
                google.accounts.id.cancel();
            } catch {
                // google may not be loaded
            }
            return null;
        }
    }, [mode]);

    /**
     * Handle a 401 error from a teacher API call.
     * Tries silent re-authentication first; falls back to alert if that fails.
     * @returns {string|null} new ID token if reauth succeeded, null otherwise
     */
    const handleTeacher401 = useCallback(async () => {
        const newToken = await attemptSilentReauth();
        if (newToken) {
            return newToken;
        }
        // Clear expired token to stop auto-refresh timer
        setIdToken(null);
        _cachedTeacherIdToken = null;
        showSessionExpiredError();
        return null;
    }, [attemptSilentReauth, showSessionExpiredError]);

    // --- Google Classroom: Import flow ---

    const handleShowGoogleCourses = useCallback(() => {
        clearError();
        setGoogleCourses([]);
        setSelectedGoogleCourse(null);
        setPhase('teacher-google-courses');
    }, [clearError, setPhase]);

    const handleLoadGoogleCourses = useCallback(async () => {
        clearError();
        setIsLoading(true);
        try {
            const accessToken = await requestClassroomAccessToken();
            setGoogleAccessToken(accessToken);
            const data = await classroomAPI.listGoogleCourses(idToken, accessToken);
            setGoogleCourses(data.courses || []);
            setSelectedGoogleCourse(null);
        } catch (err) {
            if (err.status === 401) {
                clearClassroomAccessToken();
            }
            showError(translateError(intl, err));
        } finally {
            setIsLoading(false);
        }
    }, [idToken, clearError, showError, intl, setIsLoading]);

    const handleSelectGoogleCourse = useCallback(course => {
        setSelectedGoogleCourse(course);
    }, []);

    const handleConfirmGoogleImport = useCallback(() => {
        if (!selectedGoogleCourse) return;
        setPhase('teacher-create');
    }, [selectedGoogleCourse, setPhase]);

    const handlePostAssignment = useCallback(
        async (title, description) => {
            if (!selectedClassroom) return;
            clearError();
            setIsLoading(true);
            try {
                let accessToken = googleAccessToken;
                if (!accessToken) {
                    accessToken = await requestClassroomAccessToken();
                    setGoogleAccessToken(accessToken);
                }
                const link = `${window.location.origin}${window.location.pathname}?classcode=${selectedClassroom.joinCode.toLowerCase()}`;
                const result = await classroomAPI.postGoogleAssignment(
                    idToken,
                    accessToken,
                    selectedClassroom.classroomId,
                    title,
                    link,
                    description,
                );
                // Update selectedClassroom with the alternateLink to prevent double posting
                if (result.alternateLink) {
                    setSelectedClassroom(prev => ({
                        ...prev,
                        googleClassroomAlternateLink: result.alternateLink,
                    }));
                    // Also update classrooms list
                    setClassrooms(prev =>
                        prev.map(c =>
                            c.classroomId === selectedClassroom.classroomId
                                ? {
                                      ...c,
                                      googleClassroomAlternateLink: result.alternateLink,
                                  }
                                : c,
                        ),
                    );
                }
                return result;
            } catch (err) {
                if (err.status === 401) {
                    clearClassroomAccessToken();
                    setGoogleAccessToken(null);
                }
                showError(translateError(intl, err));
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, googleAccessToken, selectedClassroom, clearError, showError, intl, setIsLoading],
    );

    const handleShowPostAssignment = useCallback(() => {
        setPhase('teacher-post-assignment');
    }, [setPhase]);

    const handleBackToDetail = useCallback(() => {
        clearError();
        setPhase('teacher-class-detail');
    }, [clearError, setPhase]);

    // --- Teacher: Load classrooms when entering dashboard ---

    useEffect(() => {
        if (phase === 'teacher-dashboard' && idToken) {
            setIsLoading(true);
            clearError();
            (async () => {
                try {
                    const data = await classroomAPI.listClassrooms(idToken);
                    setClassrooms(data.classrooms || []);
                } catch (err) {
                    if (err.status === 401) {
                        const newToken = await handleTeacher401();
                        if (newToken) {
                            try {
                                const data = await classroomAPI.listClassrooms(newToken);
                                setClassrooms(data.classrooms || []);
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
            })();
        }
    }, [phase, idToken, clearError, showError, handleTeacher401, intl, setIsLoading]);

    // --- Teacher: Create classroom ---

    const handleShowCreateForm = useCallback(() => {
        setSelectedGoogleCourse(null);
        setPhase('teacher-create');
    }, [setPhase]);

    const handleCreateClassroom = useCallback(
        async formData => {
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.createClassroom(
                    idToken,
                    formData.className,
                    formData.assignmentName,
                    formData.studentCount,
                    selectedGoogleCourse?.courseId,
                );
                setSelectedGoogleCourse(null);
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
        [idToken, selectedGoogleCourse, clearError, showError, handleTeacher401, intl, setIsLoading, setPhase],
    );

    // --- Teacher: Delete classroom ---

    const handleDeleteClassroom = useCallback(
        async classroomId => {
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

    // --- Teacher: Select classroom to view details ---

    const fetchClassroomDetail = useCallback(async (token, classroomId) => {
        const [classroomData, membersData, submissionsData] = await Promise.all([
            classroomAPI.getClassroom(token, classroomId),
            classroomAPI.listMembers(token, classroomId),
            classroomAPI.listSubmissions(token, classroomId),
        ]);
        const subMap = {};
        for (const sub of submissionsData.submissions || []) {
            const existing = subMap[sub.memberId];
            if (!existing || sub.submittedAt > existing.submittedAt) {
                subMap[sub.memberId] = sub;
            }
        }
        const memberIds = new Set();
        const enrichedMembers = (membersData.members || []).map(m => {
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
                enrichedMembers.push({
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
        setSelectedClassroom(classroomData);
        setMembers(enrichedMembers);
    }, []);

    const loadClassroomDetail = useCallback(
        async classroomId => {
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

    const handleSelectClassroom = useCallback(
        async classroomId => {
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

    // Lightweight refresh: only update members list without touching
    // selectedClassroom or triggering re-render of detail pane
    const refreshMembersOnly = useCallback(
        async classroomId => {
            try {
                const [membersData, submissionsData] = await Promise.all([
                    classroomAPI.listMembers(idToken, classroomId),
                    classroomAPI.listSubmissions(idToken, classroomId),
                ]);
                const subMap = {};
                for (const sub of submissionsData.submissions || []) {
                    const existing = subMap[sub.memberId];
                    if (!existing || sub.submittedAt > existing.submittedAt) {
                        subMap[sub.memberId] = sub;
                    }
                }
                const memberIds = new Set();
                const enriched = (membersData.members || []).map(m => {
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
                setMembers(enriched);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                }
                // Silently ignore other refresh errors
            }
        },
        [idToken, handleTeacher401],
    );

    // Auto-refresh teacher detail (members only — preserves detail pane state)
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

    const handleBackToDashboard = useCallback(() => {
        clearError();
        setSelectedClassroom(null);
        setMembers([]);
        setCodeDisplayClassroom(null);
        setCodeDisplayFullscreen(false);
        if (idToken) {
            setPhase('teacher-dashboard');
        } else {
            setPhase(mode === 'teacher' ? 'teacher-login' : 'student-join');
        }
    }, [mode, idToken, clearError, setPhase]);

    // --- Teacher: Delete member ---

    const handleDeleteMember = useCallback(
        async memberId => {
            if (!selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.deleteMember(idToken, selectedClassroom.classroomId, memberId);
                setMembers(prev => prev.filter(m => m.memberId !== memberId));
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

    // --- Teacher: Open student submission ---

    const handleOpenSubmission = useCallback(
        async projectUrl => {
            if (!projectUrl || !vm) return;
            clearError();
            setIsLoading(true);
            try {
                const response = await fetch(projectUrl);
                if (!response.ok) {
                    throw new Error(`Download failed: ${response.status}`);
                }
                const projectData = await response.arrayBuffer();
                await vm.loadProject(projectData);
                dispatch(closeClassroomModal());
            } catch (err) {
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [vm, dispatch, clearError, showError, intl, setIsLoading],
    );

    // --- Teacher: Show code display ---

    const handleShowCodeDisplay = useCallback(() => {
        if (selectedClassroom) {
            setCodeDisplayClassroom(selectedClassroom);
            setCodeDisplayFullscreen(mode === 'teacher');
        }
    }, [selectedClassroom, mode]);

    const handleCloseCodeDisplay = useCallback(() => {
        setCodeDisplayClassroom(null);
        setCodeDisplayFullscreen(false);
    }, []);

    const handleToggleCodeFullscreen = useCallback(() => {
        setCodeDisplayFullscreen(prev => !prev);
    }, []);

    const handleCopyInviteLink = useCallback(classroom => {
        const url = new URL(window.location.href);
        url.searchParams.set('classcode', classroom.joinCode.toLowerCase());
        // Remove feature flags from invite link (classroom is always enabled)
        url.searchParams.delete('features');
        navigator.clipboard.writeText(url.toString()).catch(() => {
            // Clipboard API failed, ignore silently
        });
    }, []);

    // --- Teacher: Return submission ---

    const handleReturnSubmission = useCallback(
        async (submissionId, teacherComment) => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.updateSubmission(idToken, selectedClassroom.classroomId, submissionId, {
                    status: 'returned',
                    teacherComment,
                });
                // Refresh to show updated status
                await loadClassroomDetail(selectedClassroom.classroomId);
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
        [
            idToken,
            selectedClassroom,
            clearError,
            showError,
            handleTeacher401,
            intl,
            loadClassroomDetail,
            setIsLoading,
        ],
    );

    // --- Teacher: Download all submissions as ZIP ---

    const handleDownloadAll = useCallback(async () => {
        if (!selectedClassroom || !members || members.length === 0) return;
        clearError();

        const submittedMembers = members.filter(m => m.hasSubmission && m.projectUrl);
        if (submittedMembers.length === 0) return;

        setDownloadProgress({
            current: 0,
            total: submittedMembers.length,
        });

        try {
            const zip = new JSZip();
            const className = selectedClassroom.className || 'class';

            for (let i = 0; i < submittedMembers.length; i++) {
                const m = submittedMembers[i];
                setDownloadProgress({
                    current: i + 1,
                    total: submittedMembers.length,
                });

                const seatLabel = m.memberId.replace('seat-', '');
                const name = m.displayName || '';
                const folderName = name ? `${seatLabel}_${name}` : seatLabel;
                const folder = zip.folder(folderName);

                // Download project .sb3
                try {
                    const res = await fetch(m.projectUrl);
                    if (res.ok) folder.file(`${m.projectName || 'project'}.sb3`, await res.blob());
                } catch {
                    // Skip failed downloads
                }

                // Download thumbnail
                if (m.thumbnailUrl) {
                    try {
                        const res = await fetch(m.thumbnailUrl);
                        if (res.ok) folder.file('thumbnail.png', await res.blob());
                    } catch {
                        // Skip
                    }
                }

                // Download screenshots
                for (let si = 0; si < (m.screenshotUrls || []).length; si++) {
                    try {
                        const res = await fetch(m.screenshotUrls[si]);
                        if (res.ok) folder.file(`screenshot-${si}.png`, await res.blob());
                    } catch {
                        // Skip
                    }
                }
            }

            // Generate and download ZIP
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${className}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            showError(translateError(intl, err));
        } finally {
            setDownloadProgress(null);
        }
    }, [selectedClassroom, members, clearError, showError, intl]);

    // --- Teacher: Update assignment name ---

    const handleUpdateAssignmentName = useCallback(
        async assignmentName => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.updateClassroom(idToken, selectedClassroom.classroomId, { assignmentName });
                setSelectedClassroom(prev => ({
                    ...prev,
                    assignmentName,
                }));
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
        async studentCount => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.updateClassroom(idToken, selectedClassroom.classroomId, { studentCount });
                setSelectedClassroom(prev => ({ ...prev, studentCount }));
                // Refresh members to reflect new seat grid
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

    // --- Teacher: Select member ---

    const handleSelectMember = useCallback(memberId => {
        setSelectedMember(memberId);
    }, []);

    return {
        // State
        idToken,
        authProvider,
        classrooms,
        selectedClassroom,
        members,
        selectedMember,
        codeDisplayClassroom,
        codeDisplayFullscreen,
        downloadProgress,
        googleCourses,
        selectedGoogleCourse,

        // Setters (needed by container for go-to-login reset)
        setIdToken,
        setClassrooms,
        setSelectedClassroom,
        setMembers,

        // Handlers
        handleGoogleLogin,
        handleMicrosoftLogin,
        isMicrosoftAuthAvailable: isMicrosoftAuthAvailable(),
        handleTeacherLogout,
        handleShowCreateForm,
        handleCreateClassroom,
        handleDeleteClassroom,
        handleDeleteMember,
        handleSelectClassroom,
        handleBackToDashboard,
        handleRefreshDetail,
        loadClassroomDetail,
        handleShowCodeDisplay,
        handleCloseCodeDisplay,
        handleToggleCodeFullscreen,
        handleCopyInviteLink,
        handleDownloadAll,
        handleOpenSubmission,
        handleReturnSubmission,
        handleShowGoogleCourses,
        handleLoadGoogleCourses,
        handleSelectGoogleCourse,
        handleConfirmGoogleImport,
        handleShowPostAssignment,
        handleBackToDetail,
        handlePostAssignment,
        handleUpdateAssignmentName,
        handleUpdateStudentCount,
        handleSelectMember,
    };
};

export default useTeacherClassroom;
