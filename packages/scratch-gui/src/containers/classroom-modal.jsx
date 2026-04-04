import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomModalComponent from '../components/classroom-modal/classroom-modal.jsx';
import classroomAPI from '../lib/classroom-api.js';
import { loadGoogleIdentity } from '../lib/google-script-loader.js';
import { getProjectThumbnail } from '../lib/store-project-thumbnail.js';
import {
    closeClassroomModal,
    setClassroomSession,
    clearClassroomSession,
    setSubmissionStatus,
} from '../reducers/classroom.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REFRESH_INTERVAL_MS = parseInt(process.env.CLASSROOM_REFRESH_INTERVAL_MS || '30000', 10);

/**
 * Translate known API error messages to localized user-friendly messages.
 * @param {object} intl - react-intl intl object
 * @param {Error} err - Error from API call
 * @param {string} context - Error context ('join', 'seat', 'session', 'general')
 * @returns {string} Localized error message
 */
const translateError = (intl, err, context = 'general') => {
    const msg = err.message || '';
    const status = err.status;

    if (context === 'join' && (status === 404 || msg.includes('Invalid join code'))) {
        return intl.formatMessage({
            defaultMessage: 'Could not join the classroom. Please check the join code and try again.',
            description: 'Error when join code is invalid',
            id: 'gui.classroom.error.invalidJoinCode',
        });
    }
    if (context === 'seat' && (status === 409 || msg.includes('already taken'))) {
        return intl.formatMessage({
            defaultMessage: 'This seat is already taken. Please choose a different seat.',
            description: 'Error when seat is already taken',
            id: 'gui.classroom.error.seatTaken',
        });
    }
    if (context === 'session' || msg.includes('Invalid or expired session') || status === 401) {
        return intl.formatMessage({
            defaultMessage: 'Your session has expired. Please rejoin the classroom.',
            description: 'Error when session token is invalid',
            id: 'gui.classroom.error.sessionExpired',
        });
    }
    if (msg.includes('no longer active')) {
        return intl.formatMessage({
            defaultMessage: 'This classroom is no longer active.',
            description: 'Error when classroom is archived',
            id: 'gui.classroom.error.classroomInactive',
        });
    }
    return (
        msg ||
        intl.formatMessage({
            defaultMessage: 'An unexpected error occurred. Please try again.',
            description: 'Generic error message',
            id: 'gui.classroom.error.generic',
        })
    );
};

const ClassroomModal = () => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const classroomState = useSelector(state => state.scratchGui.classroom);
    const vm = useSelector(state => state.scratchGui.vm);

    // Determine initial phase based on persisted session
    const getInitialPhase = () => {
        if (classroomState.role === 'student' && classroomState.sessionToken) {
            return 'student-status';
        }
        return 'role-select';
    };

    // UI state
    const [phase, setPhase] = useState(getInitialPhase);
    const [error, setError] = useState(null);
    const [errorTitle, setErrorTitle] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Teacher state
    const [idToken, setIdToken] = useState(null);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClassroom, setSelectedClassroom] = useState(null);
    const [members, setMembers] = useState([]);

    // Student state
    const [pendingJoinCode, setPendingJoinCode] = useState(null);
    const [seatCount, setSeatCount] = useState(0);
    const [takenSeats, setTakenSeats] = useState([]);
    const [selectedSeat, setSelectedSeat] = useState(null);
    const [joinedInfo, setJoinedInfo] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null);

    // Submission state
    const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null);

    // Refresh timer for teacher detail
    const refreshTimerRef = useRef(null);

    const handleClose = useCallback(() => {
        dispatch(closeClassroomModal());
    }, [dispatch]);

    // Helper to set error with optional title
    const showError = useCallback((message, title = null) => {
        setError(message);
        setErrorTitle(title);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
        setErrorTitle(null);
    }, []);

    // --- Role selection ---

    const handleSelectTeacher = useCallback(() => {
        clearError();
        if (idToken) {
            setPhase('teacher-dashboard');
        } else {
            setPhase('teacher-login');
        }
    }, [idToken, clearError]);

    const handleSelectStudent = useCallback(() => {
        clearError();
        setPhase('student-join');
    }, [clearError]);

    const handleBackToRoleSelect = useCallback(() => {
        clearError();
        setPhase('role-select');
    }, [clearError]);

    // --- Teacher: Google Sign-In ---

    const handleTeacherLogin = useCallback(async () => {
        clearError();
        try {
            await loadGoogleIdentity();

            const token = await new Promise((resolve, reject) => {
                /* global google */
                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: response => {
                        if (response.credential) {
                            resolve(response.credential);
                        } else {
                            reject(new Error('Google Sign-In failed'));
                        }
                    },
                });
                google.accounts.id.prompt(notification => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        const container = document.createElement('div');
                        container.style.cssText =
                            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;';
                        document.body.appendChild(container);
                        google.accounts.id.renderButton(container, {
                            theme: 'outline',
                            size: 'large',
                        });
                        const observer = new MutationObserver(() => {
                            if (!document.body.contains(container)) {
                                observer.disconnect();
                            }
                        });
                        observer.observe(document.body, { childList: true, subtree: true });
                    }
                });
            });

            setIdToken(token);
            setPhase('teacher-dashboard');
        } catch (err) {
            showError(err.message || 'Sign-in failed');
        }
    }, [clearError, showError]);

    // --- Teacher: Logout ---

    const handleTeacherLogout = useCallback(() => {
        setIdToken(null);
        setClassrooms([]);
        setSelectedClassroom(null);
        setMembers([]);
        clearError();
        setPhase('role-select');
    }, [clearError]);

    // --- Teacher: Load classrooms when entering dashboard ---

    useEffect(() => {
        if (phase === 'teacher-dashboard' && idToken) {
            setIsLoading(true);
            clearError();
            classroomAPI
                .listClassrooms(idToken)
                .then(data => {
                    setClassrooms(data.classrooms || []);
                })
                .catch(err => {
                    showError(translateError(intl, err));
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [phase, idToken, clearError, showError, intl]);

    // --- Teacher: Create classroom ---

    const handleShowCreateForm = useCallback(() => {
        setPhase('teacher-create');
    }, []);

    const handleCreateClassroom = useCallback(
        async formData => {
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.createClassroom(idToken, formData.className, formData.studentCount);
                setPhase('teacher-dashboard');
            } catch (err) {
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, clearError, showError, intl],
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
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, clearError, showError, intl],
    );

    // --- Teacher: Select classroom to view details ---

    const loadClassroomDetail = useCallback(
        async classroomId => {
            try {
                const [classroomData, membersData, submissionsData] = await Promise.all([
                    classroomAPI.getClassroom(idToken, classroomId),
                    classroomAPI.listMembers(idToken, classroomId),
                    classroomAPI.listSubmissions(idToken, classroomId),
                ]);
                // Merge submission thumbnailUrl/projectUrl into members
                const subMap = {};
                for (const sub of submissionsData.submissions || []) {
                    const existing = subMap[sub.memberId];
                    if (!existing || sub.submittedAt > existing.submittedAt) {
                        subMap[sub.memberId] = sub;
                    }
                }
                const enrichedMembers = (membersData.members || []).map(m => {
                    const sub = subMap[m.memberId];
                    if (sub) {
                        return {
                            ...m,
                            thumbnailUrl: sub.thumbnailUrl || null,
                            projectUrl: sub.projectUrl || null,
                            projectName: sub.projectName || null,
                        };
                    }
                    return m;
                });
                setSelectedClassroom(classroomData);
                setMembers(enrichedMembers);
                return true;
            } catch (err) {
                showError(translateError(intl, err));
                return false;
            }
        },
        [idToken, showError, intl],
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
        [clearError, loadClassroomDetail],
    );

    const handleRefreshDetail = useCallback(async () => {
        if (!selectedClassroom) return;
        clearError();
        setIsLoading(true);
        await loadClassroomDetail(selectedClassroom.classroomId);
        setIsLoading(false);
    }, [selectedClassroom, clearError, loadClassroomDetail]);

    // Auto-refresh teacher detail
    useEffect(() => {
        if (phase === 'teacher-class-detail' && selectedClassroom && idToken) {
            refreshTimerRef.current = setInterval(() => {
                loadClassroomDetail(selectedClassroom.classroomId);
            }, REFRESH_INTERVAL_MS);
            return () => clearInterval(refreshTimerRef.current);
        }
        return () => {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
            }
        };
    }, [phase, selectedClassroom, idToken, loadClassroomDetail]);

    const handleBackToDashboard = useCallback(() => {
        clearError();
        setSelectedClassroom(null);
        setMembers([]);
        if (idToken) {
            setPhase('teacher-dashboard');
        } else {
            setPhase('role-select');
        }
    }, [idToken, clearError]);

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
                showError(translateError(intl, err));
            }
        },
        [idToken, selectedClassroom, clearError, showError, intl],
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
        [vm, dispatch, clearError, showError, intl],
    );

    // --- Student: Join with code (validate first) ---

    const handleJoinWithCode = useCallback(
        async joinCode => {
            clearError();
            setIsLoading(true);
            try {
                const data = await classroomAPI.lookupClassroom(joinCode);
                setPendingJoinCode(joinCode);
                setSeatCount(data.studentCount);
                setTakenSeats(data.takenSeats || []);
                setSelectedSeat(null);
                setPhase('student-seat');
            } catch (err) {
                const title = intl.formatMessage({
                    defaultMessage: 'An error occurred',
                    description: 'Error dialog title',
                    id: 'gui.classroom.error.title',
                });
                showError(translateError(intl, err, 'join'), title);
            } finally {
                setIsLoading(false);
            }
        },
        [clearError, showError, intl],
    );

    // --- Student: Select seat / member ---

    const handleSelectMember = useCallback(memberId => {
        setSelectedMember(memberId);
    }, []);

    const handleSelectSeat = useCallback(seatNumber => {
        setSelectedSeat(seatNumber);
    }, []);

    // --- Student: Confirm join ---

    const handleConfirmJoin = useCallback(async () => {
        if (!pendingJoinCode || !selectedSeat) return;
        clearError();
        setIsLoading(true);
        try {
            const data = await classroomAPI.joinClassroom(pendingJoinCode, selectedSeat);
            dispatch(
                setClassroomSession({
                    role: 'student',
                    classroomId: data.classroomId,
                    className: data.className,
                    joinCode: pendingJoinCode,
                    seatNumber: data.seatNumber,
                    memberId: data.memberId,
                    sessionToken: data.sessionToken,
                    joinedAt: new Date().toISOString(),
                }),
            );
            setJoinedInfo({
                className: data.className,
                seatNumber: data.seatNumber,
            });
            setPhase('student-joined');
        } catch (err) {
            if (err.status === 409) {
                setTakenSeats(prev => [...prev, selectedSeat]);
                setSelectedSeat(null);
            }
            showError(translateError(intl, err, 'seat'));
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, pendingJoinCode, selectedSeat, clearError, showError, intl]);

    // --- Student: Verify session on status screen ---

    useEffect(() => {
        if (phase === 'student-status' && classroomState.sessionToken) {
            classroomAPI.verifySession(classroomState.sessionToken).catch(() => {
                // Session is invalid — clear and redirect
                dispatch(clearClassroomSession());
                const title = intl.formatMessage({
                    defaultMessage: 'An error occurred',
                    description: 'Error dialog title',
                    id: 'gui.classroom.error.title',
                });
                showError(translateError(intl, { status: 401 }, 'session'), title);
                setPhase('role-select');
            });
        }
    }, [phase, classroomState.sessionToken, dispatch, showError, intl]);

    // --- Student: Leave classroom ---

    const handleLeaveClassroom = useCallback(() => {
        dispatch(clearClassroomSession());
        setPhase('role-select');
    }, [dispatch]);

    // --- Student: Start submit flow ---

    const handleStartSubmit = useCallback(() => {
        clearError();
        setThumbnailDataUrl(null);
        // Capture thumbnail
        if (vm && vm.renderer) {
            getProjectThumbnail(vm, dataUrl => {
                setThumbnailDataUrl(dataUrl);
            });
        }
        setPhase('student-submit-confirm');
    }, [vm, clearError]);

    // --- Student: Confirm submit ---

    const handleConfirmSubmit = useCallback(async () => {
        if (!classroomState.sessionToken || !classroomState.classroomId) return;
        clearError();
        setIsLoading(true);
        try {
            const projectTitle = vm.runtime.projectName || 'Untitled';

            // 1. Get presigned URLs
            const submissionData = await classroomAPI.createSubmission(
                classroomState.sessionToken,
                classroomState.classroomId,
                projectTitle,
            );

            // 2. Upload .sb3
            const sb3Data = await vm.saveProjectSb3();
            await classroomAPI.uploadToPresignedUrl(submissionData.uploadUrl, sb3Data, 'application/octet-stream');

            // 3. Upload thumbnail
            if (thumbnailDataUrl) {
                const thumbnailBlob = await fetch(thumbnailDataUrl).then(r => r.blob());
                await classroomAPI.uploadToPresignedUrl(
                    submissionData.thumbnailUploadUrl,
                    thumbnailBlob,
                    'image/png',
                );
            }

            // 4. Update Redux state
            dispatch(setSubmissionStatus('submitted', submissionData.submittedAt));
            setPhase('student-status');
        } catch (err) {
            if (err.status === 401) {
                // Session expired during submit
                dispatch(clearClassroomSession());
                const title = intl.formatMessage({
                    defaultMessage: 'An error occurred',
                    description: 'Error dialog title',
                    id: 'gui.classroom.error.title',
                });
                showError(translateError(intl, err, 'session'), title);
                setPhase('role-select');
            } else {
                showError(translateError(intl, err));
            }
        } finally {
            setIsLoading(false);
        }
    }, [classroomState, vm, thumbnailDataUrl, dispatch, clearError, showError, intl]);

    const handleCancelSubmit = useCallback(() => {
        setPhase('student-status');
    }, []);

    return (
        <ClassroomModalComponent
            classrooms={classrooms}
            classroomState={classroomState}
            error={error}
            errorTitle={errorTitle}
            isLoading={isLoading}
            joinedInfo={joinedInfo}
            members={members}
            phase={phase}
            seatCount={seatCount}
            selectedClassroom={selectedClassroom}
            selectedMember={selectedMember}
            selectedSeat={selectedSeat}
            takenSeats={takenSeats}
            thumbnailDataUrl={thumbnailDataUrl}
            onBackToDashboard={handleBackToDashboard}
            onBackToRoleSelect={handleBackToRoleSelect}
            onClose={handleClose}
            onConfirmJoin={handleConfirmJoin}
            onCreateClassroom={handleCreateClassroom}
            onDeleteClassroom={handleDeleteClassroom}
            onDeleteMember={handleDeleteMember}
            onJoinWithCode={handleJoinWithCode}
            onLeaveClassroom={handleLeaveClassroom}
            onOpenSubmission={handleOpenSubmission}
            onRefreshDetail={handleRefreshDetail}
            onStartSubmit={handleStartSubmit}
            onConfirmSubmit={handleConfirmSubmit}
            onCancelSubmit={handleCancelSubmit}
            onSelectClassroom={handleSelectClassroom}
            onSelectMember={handleSelectMember}
            onSelectSeat={handleSelectSeat}
            onSelectStudent={handleSelectStudent}
            onSelectTeacher={handleSelectTeacher}
            onShowCreateForm={handleShowCreateForm}
            onTeacherLogin={handleTeacherLogin}
            onTeacherLogout={handleTeacherLogout}
        />
    );
};

export default ClassroomModal;
