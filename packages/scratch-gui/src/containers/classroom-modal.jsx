import JSZip from 'jszip';
import PropTypes from 'prop-types';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomModalComponent from '../components/classroom-modal/classroom-modal.jsx';
import ClassroomTeacherModalComponent from '../components/classroom-teacher-modal/classroom-teacher-modal.jsx';
import { renderBlocksToCanvas } from '../lib/blocks-screenshot.js';
import classroomAPI from '../lib/classroom-api.js';
import { requestClassroomAccessToken, clearClassroomAccessToken } from '../lib/google-classroom-auth.js';
import { loadGoogleIdentity } from '../lib/google-script-loader.js';
import { getProjectThumbnail } from '../lib/store-project-thumbnail.js';
import { getUrlParams, clearClasscode } from '../lib/url-params.js';
import {
    closeClassroomModal,
    closeTeacherModal,
    setClassroomSession,
    clearClassroomSession,
    setSubmissionStatus,
} from '../reducers/classroom.js';
import { setProjectTitle } from '../reducers/project-title.js';
import translateError from './classroom-error-utils.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REFRESH_INTERVAL_MS = parseInt(process.env.CLASSROOM_REFRESH_INTERVAL_MS || '30000', 10);

// Persists teacher login across modal close/open within same page session
let _cachedTeacherIdToken = null;

// Dev bypass token for stg/local automated testing
const DEV_BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN;

const ClassroomModal = ({ mode = 'student' }) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const classroomState = useSelector(state => state.scratchGui.classroom);
    const vm = useSelector(state => state.scratchGui.vm);
    const projectTitle = useSelector(state => state.scratchGui.projectTitle);
    const scratchBlocks = useSelector(state => state.scratchGui.blockDisplay?.scratchBlocks);

    // Auto-login with dev bypass token when devlogin=1
    const urlParams = getUrlParams();
    if (mode === 'teacher' && urlParams.devlogin && DEV_BYPASS_TOKEN && !_cachedTeacherIdToken) {
        _cachedTeacherIdToken = DEV_BYPASS_TOKEN;
    }

    // Determine initial phase based on mode and persisted session
    const getInitialPhase = () => {
        if (mode === 'teacher') {
            if (_cachedTeacherIdToken) return 'teacher-dashboard';
            return 'teacher-login';
        }
        // Student mode
        if (classroomState.role === 'student' && classroomState.sessionToken) {
            return 'student-status';
        }
        return 'student-join';
    };

    // UI state
    const [phase, setPhase] = useState(getInitialPhase);
    const [error, setError] = useState(null);
    const [errorTitle, setErrorTitle] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Teacher state
    const [idToken, setIdToken] = useState(_cachedTeacherIdToken);
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
    const [submitProgress, setSubmitProgress] = useState(null); // { current, total, label }

    // Code display state
    const [codeDisplayClassroom, setCodeDisplayClassroom] = useState(null);
    const [codeDisplayFullscreen, setCodeDisplayFullscreen] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(null); // { current, total }

    // Google Classroom state
    const [googleAccessToken, setGoogleAccessToken] = useState(null);
    const [googleCourses, setGoogleCourses] = useState([]);
    const [selectedGoogleCourse, setSelectedGoogleCourse] = useState(null);

    // Refresh timer for teacher detail
    const refreshTimerRef = useRef(null);

    // Sync teacher token to module-level cache + debug global
    useEffect(() => {
        _cachedTeacherIdToken = idToken;
        if (typeof window !== 'undefined') {
            window._classroomIdToken = idToken;
        }
    }, [idToken]);

    const handleClose = useCallback(() => {
        dispatch(mode === 'teacher' ? closeTeacherModal() : closeClassroomModal());
    }, [dispatch, mode]);

    // Error action state (link shown alongside the error message)
    const [errorActionLabel, setErrorActionLabel] = useState(null);
    const [errorActionHandler, setErrorActionHandler] = useState(null);

    // Helper to set error with optional title
    const showError = useCallback((message, title = null) => {
        setError(message);
        setErrorTitle(title);
        setErrorActionLabel(null);
        setErrorActionHandler(null);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
        setErrorTitle(null);
        setErrorActionLabel(null);
        setErrorActionHandler(null);
    }, []);

    // Go back to login/join screen (used as error action for session expiry)
    const handleGoToLogin = useCallback(() => {
        if (mode === 'teacher') {
            _cachedTeacherIdToken = null;
            setIdToken(null);
            setClassrooms([]);
            setSelectedClassroom(null);
            setMembers([]);
        } else {
            dispatch(clearClassroomSession());
        }
        clearError();
        setPhase(mode === 'teacher' ? 'teacher-login' : 'student-join');
    }, [mode, clearError, dispatch]);

    // Show error with session-expired action link
    const showSessionExpiredError = useCallback(
        (message, title = null) => {
            setError(message);
            setErrorTitle(title);
            const label =
                mode === 'teacher'
                    ? intl.formatMessage({
                          defaultMessage: 'Go to login screen',
                          description: 'Link to go back to the login screen after session expiry',
                          id: 'gui.classroom.error.goToLogin',
                      })
                    : intl.formatMessage({
                          defaultMessage: 'Go to join screen',
                          description: 'Link to go back to the join screen after session expiry',
                          id: 'gui.classroom.error.goToJoin',
                      });
            setErrorActionLabel(label);
            // useState setter with function form to store the callback
            setErrorActionHandler(() => handleGoToLogin);
        },
        [mode, intl, handleGoToLogin],
    );

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

    // --- Teacher: Google Sign-In ---

    const handleTeacherLogin = useCallback(async () => {
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
                        signInObserver.observe(document.body, { childList: true, subtree: true });
                    }
                });
            });

            setIdToken(token);
            setPhase('teacher-dashboard');
        } catch (err) {
            cleanupSignIn();
            showError(err.message || 'Sign-in failed');
        }
    }, [clearError, showError]);

    // --- Teacher: Logout ---

    const handleTeacherLogout = useCallback(() => {
        _cachedTeacherIdToken = null;
        setIdToken(null);
        setClassrooms([]);
        setSelectedClassroom(null);
        setMembers([]);
        clearError();
        setPhase(mode === 'teacher' ? 'teacher-login' : 'student-join');
    }, [mode, clearError]);

    // --- Google Classroom: Import flow ---

    const handleGoogleClassroomImport = useCallback(async () => {
        clearError();
        setIsLoading(true);
        try {
            const accessToken = await requestClassroomAccessToken();
            setGoogleAccessToken(accessToken);
            const data = await classroomAPI.listGoogleCourses(idToken, accessToken);
            setGoogleCourses(data.courses || []);
            setSelectedGoogleCourse(null);
            setPhase('teacher-google-courses');
        } catch (err) {
            if (err.status === 401) {
                clearClassroomAccessToken();
            }
            showError(translateError(intl, err));
        } finally {
            setIsLoading(false);
        }
    }, [idToken, clearError, showError, intl]);

    const handleSelectGoogleCourse = useCallback(course => {
        setSelectedGoogleCourse(course);
    }, []);

    const handleConfirmGoogleImport = useCallback(() => {
        if (!selectedGoogleCourse) return;
        // Transition to create form with pre-filled data from Google Classroom
        setPhase('teacher-create');
    }, [selectedGoogleCourse]);

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
                const link = `${window.location.origin}${window.location.pathname}?features=classroom&classcode=${selectedClassroom.joinCode}`;
                const result = await classroomAPI.postGoogleAssignment(
                    idToken,
                    accessToken,
                    selectedClassroom.classroomId,
                    title,
                    link,
                    description,
                );
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
        [idToken, googleAccessToken, selectedClassroom, clearError, showError, intl],
    );

    const handleShowPostAssignment = useCallback(() => {
        setPhase('teacher-post-assignment');
    }, []);

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
        setSelectedGoogleCourse(null);
        setPhase('teacher-create');
    }, []);

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
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, selectedGoogleCourse, clearError, showError, intl],
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
                const memberIds = new Set();
                const enrichedMembers = (membersData.members || []).map(m => {
                    memberIds.add(m.memberId);
                    const sub = subMap[m.memberId];
                    if (sub) {
                        return {
                            ...m,
                            submissionId: sub.submissionId,
                            submissionStatus: sub.status || 'submitted',
                            thumbnailUrl: sub.thumbnailUrl || null,
                            projectUrl: sub.projectUrl || null,
                            projectName: sub.projectName || null,
                            screenshotUrls: sub.screenshotUrls || [],
                            teacherComment: sub.teacherComment || '',
                        };
                    }
                    return m;
                });
                // Add submissions from members who have left
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
                return true;
            } catch (err) {
                if (err.status === 401) {
                    showSessionExpiredError(translateError(intl, err, 'session'));
                } else {
                    showError(translateError(intl, err));
                }
                return false;
            }
        },
        [idToken, showError, showSessionExpiredError, intl],
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
        setCodeDisplayClassroom(null);
        setCodeDisplayFullscreen(false);
        if (idToken) {
            setPhase('teacher-dashboard');
        } else {
            setPhase(mode === 'teacher' ? 'teacher-login' : 'student-join');
        }
    }, [mode, idToken, clearError]);

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
        // Ensure features=classroom is included
        const features = url.searchParams.get('features') || '';
        if (
            !features
                .split(',')
                .map(f => f.trim())
                .includes('classroom')
        ) {
            url.searchParams.set('features', features ? `${features},classroom` : 'classroom');
        }
        navigator.clipboard.writeText(url.toString()).catch(() => {
            // Clipboard API failed, ignore silently
        });
    }, []);

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
                    assignmentName: data.assignmentName || null,
                    joinCode: pendingJoinCode,
                    seatNumber: data.seatNumber,
                    memberId: data.memberId,
                    sessionToken: data.sessionToken,
                    joinedAt: new Date().toISOString(),
                }),
            );
            // Set project title to assignment name
            if (data.assignmentName) {
                dispatch(setProjectTitle(data.assignmentName));
            }
            setJoinedInfo({
                className: data.className,
                assignmentName: data.assignmentName || null,
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

    // --- Student: Verify session + fetch submission status ---

    const [studentTeacherComment, setStudentTeacherComment] = useState(null);

    const refreshStudentStatus = useCallback(async () => {
        if (!classroomState.sessionToken) return;
        setIsLoading(true);
        try {
            const result = await classroomAPI.verifySession(classroomState.sessionToken);
            if (result.submission) {
                dispatch(setSubmissionStatus(result.submission.status, result.submission.submittedAt));
                setStudentTeacherComment(result.submission.teacherComment || null);
            }
        } catch {
            dispatch(clearClassroomSession());
            showSessionExpiredError(translateError(intl, { status: 401 }, 'session'));
        } finally {
            setIsLoading(false);
        }
    }, [classroomState.sessionToken, dispatch, showSessionExpiredError, intl]);

    // Fetch on student-status phase display
    useEffect(() => {
        if (phase === 'student-status' && classroomState.sessionToken) {
            refreshStudentStatus();
        }
    }, [phase]); // Only on phase change, not on every render

    // --- Student: Leave classroom ---

    const handleLeaveClassroom = useCallback(async () => {
        // Notify server to remove member record (best-effort)
        if (classroomState.sessionToken && classroomState.classroomId) {
            try {
                await classroomAPI.leaveClassroom(classroomState.sessionToken, classroomState.classroomId);
            } catch {
                // Proceed even if server call fails
            }
        }
        dispatch(clearClassroomSession());
        setPhase('student-join');
    }, [classroomState.sessionToken, classroomState.classroomId, dispatch]);

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

    /**
     * Capture block screenshots for all targets that have blocks.
     * Switches editing target for each, takes screenshot, overlays sprite icon.
     * @returns {Promise<Blob[]>} Array of PNG blobs
     */
    const captureBlockScreenshots = useCallback(async () => {
        if (!vm || !scratchBlocks) return [];

        const workspace = scratchBlocks.getMainWorkspace();
        if (!workspace) return [];

        const originalTargetId = vm.editingTarget?.id;
        const allTargets = vm.runtime.targets.filter(t => !t.isOriginal === false || t.isOriginal);
        // Filter targets that have blocks (including stage)
        const targetsWithBlocks = allTargets.filter(t => {
            const blocks = t.blocks._blocks;
            return blocks && Object.keys(blocks).length > 0;
        });

        const blobs = [];
        for (let i = 0; i < targetsWithBlocks.length; i++) {
            const target = targetsWithBlocks[i];
            setSubmitProgress({
                current: i + 1,
                total: targetsWithBlocks.length,
                label: target.sprite.name,
            });

            // Switch editing target and wait for workspace update
            vm.setEditingTarget(target.id);
            await new Promise(resolve => {
                // Wait for workspace to fully update after target switch
                setTimeout(() => requestAnimationFrame(resolve), 100);
            });

            try {
                const costumeDataUri = target.sprite.costumes[target.currentCostume]?.asset?.encodeDataURI();
                const canvas = await renderBlocksToCanvas(workspace, costumeDataUri);
                if (!canvas) continue;

                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png');
                });
                if (blob) blobs.push(blob);
            } catch {
                // Skip sprites that fail to capture
            }
        }

        // Restore original editing target
        if (originalTargetId) {
            vm.setEditingTarget(originalTargetId);
        }
        setSubmitProgress(null);
        return blobs;
    }, [vm, scratchBlocks]);

    const handleConfirmSubmit = useCallback(async () => {
        if (!classroomState.sessionToken || !classroomState.classroomId) return;
        clearError();
        setIsLoading(true);
        try {
            const submitProjectTitle = projectTitle || 'Untitled';

            // 1. Capture block screenshots
            const screenshotBlobs = await captureBlockScreenshots();

            // 2. Get presigned URLs (including screenshot URLs)
            const submissionData = await classroomAPI.createSubmission(
                classroomState.sessionToken,
                classroomState.classroomId,
                submitProjectTitle,
                screenshotBlobs.length,
            );

            // 3. Upload .sb3 (with size check)
            setSubmitProgress({ current: 0, total: 1, label: 'project' });
            const sb3Data = await vm.saveProjectSb3();
            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
            if (sb3Data.byteLength > MAX_FILE_SIZE) {
                const sizeMB = (sb3Data.byteLength / (1024 * 1024)).toFixed(1);
                throw new Error(
                    intl.formatMessage(
                        {
                            defaultMessage: 'Project is too large ({size}MB). Maximum size is 10MB.',
                            description: 'File too large error',
                            id: 'gui.classroom.error.fileTooLarge',
                        },
                        { size: sizeMB },
                    ),
                );
            }
            await classroomAPI.uploadToPresignedUrl(submissionData.uploadUrl, sb3Data, 'application/octet-stream');

            // 4. Upload thumbnail
            if (thumbnailDataUrl) {
                const thumbnailBlob = await fetch(thumbnailDataUrl).then(r => r.blob());
                await classroomAPI.uploadToPresignedUrl(
                    submissionData.thumbnailUploadUrl,
                    thumbnailBlob,
                    'image/png',
                );
            }

            // 5. Upload screenshots (parallel)
            if (screenshotBlobs.length > 0 && submissionData.screenshotUploadUrls) {
                await Promise.all(
                    screenshotBlobs.map((blob, i) =>
                        classroomAPI.uploadToPresignedUrl(submissionData.screenshotUploadUrls[i], blob, 'image/png'),
                    ),
                );
            }

            setSubmitProgress(null);

            // 6. Update Redux state
            dispatch(setSubmissionStatus('submitted', submissionData.submittedAt));
            setPhase('student-status');
        } catch (err) {
            setSubmitProgress(null);
            if (err.status === 401) {
                dispatch(clearClassroomSession());
                showSessionExpiredError(translateError(intl, err, 'session'));
            } else {
                showError(translateError(intl, err));
            }
        } finally {
            setIsLoading(false);
        }
    }, [
        classroomState,
        vm,
        projectTitle,
        thumbnailDataUrl,
        captureBlockScreenshots,
        dispatch,
        clearError,
        showError,
        showSessionExpiredError,
        intl,
    ]);

    const handleCancelSubmit = useCallback(() => {
        setPhase('student-status');
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
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [idToken, selectedClassroom, clearError, showError, intl, loadClassroomDetail],
    );

    // --- Teacher: Download all submissions as ZIP ---

    const handleDownloadAll = useCallback(async () => {
        if (!selectedClassroom || !members || members.length === 0) return;
        clearError();

        const submittedMembers = members.filter(m => m.hasSubmission && m.projectUrl);
        if (submittedMembers.length === 0) return;

        setDownloadProgress({ current: 0, total: submittedMembers.length });

        try {
            const zip = new JSZip();
            const className = selectedClassroom.className || 'class';

            for (let i = 0; i < submittedMembers.length; i++) {
                const m = submittedMembers[i];
                setDownloadProgress({ current: i + 1, total: submittedMembers.length });

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

    // --- Classcode URL parameter auto-join ---
    useEffect(() => {
        const classcodeParams = getUrlParams();
        if (!classcodeParams.classcode) return;

        const code = classcodeParams.classcode; // already uppercased by url-params.js

        // Clear classcode from URL and cache to prevent re-trigger on modal reopen
        const url = new URL(window.location.href);
        url.searchParams.delete('classcode');
        window.history.replaceState({}, '', url.toString());
        clearClasscode();

        // If already joined to the same class
        if (classroomState.sessionToken && classroomState.joinCode === code) {
            setPhase('student-status');
            return;
        }

        // If joined to a different class, leave first
        if (classroomState.sessionToken) {
            dispatch(clearClassroomSession());
        }

        // Start the join flow
        handleJoinWithCode(code);
    }, []); // Run once on mount — intentionally omit deps

    // --- Teacher: Update assignment name ---

    const handleUpdateAssignmentName = useCallback(
        async assignmentName => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            try {
                await classroomAPI.updateClassroom(idToken, selectedClassroom.classroomId, { assignmentName });
                setSelectedClassroom(prev => ({ ...prev, assignmentName }));
            } catch (err) {
                showError(translateError(intl, err));
            }
        },
        [idToken, selectedClassroom, clearError, showError, intl],
    );

    const teacherContainerProps = {
        phase,
        classrooms,
        selectedClassroom,
        members,
        error,
        errorTitle,
        errorActionLabel,
        errorActionHandler,
        isLoading,
        selectedMember,
        codeDisplayClassroom,
        codeDisplayFullscreen,
        downloadProgress,
        googleCourses,
        selectedGoogleCourse,
        onTeacherLogin: handleTeacherLogin,
        onTeacherLogout: handleTeacherLogout,
        onShowCreateForm: handleShowCreateForm,
        onCreateClassroom: handleCreateClassroom,
        onSelectClassroom: handleSelectClassroom,
        onBackToDashboard: handleBackToDashboard,
        onDeleteClassroom: handleDeleteClassroom,
        onDeleteMember: handleDeleteMember,
        onRefreshDetail: handleRefreshDetail,
        onSelectMember: handleSelectMember,
        onOpenSubmission: handleOpenSubmission,
        onReturnSubmission: handleReturnSubmission,
        onDownloadAll: handleDownloadAll,
        onShowCodeDisplay: handleShowCodeDisplay,
        onCloseCodeDisplay: handleCloseCodeDisplay,
        onCopyInviteLink: handleCopyInviteLink,
        onToggleCodeFullscreen: handleToggleCodeFullscreen,
        onShowPostAssignment: handleShowPostAssignment,
        onPostAssignment: handlePostAssignment,
        onGoogleClassroomImport: handleGoogleClassroomImport,
        onSelectGoogleCourse: handleSelectGoogleCourse,
        onConfirmGoogleImport: handleConfirmGoogleImport,
        onUpdateAssignmentName: handleUpdateAssignmentName,
    };

    if (mode === 'teacher') {
        return <ClassroomTeacherModalComponent containerProps={teacherContainerProps} onClose={handleClose} />;
    }

    return (
        <ClassroomModalComponent
            classrooms={classrooms}
            classroomState={classroomState}
            error={error}
            errorActionHandler={errorActionHandler}
            errorActionLabel={errorActionLabel}
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
            codeDisplayClassroom={codeDisplayClassroom}
            codeDisplayFullscreen={codeDisplayFullscreen}
            onBackToDashboard={handleBackToDashboard}
            onCloseCodeDisplay={handleCloseCodeDisplay}
            onClose={handleClose}
            onConfirmJoin={handleConfirmJoin}
            onCopyInviteLink={handleCopyInviteLink}
            onCreateClassroom={handleCreateClassroom}
            onDeleteClassroom={handleDeleteClassroom}
            onDeleteMember={handleDeleteMember}
            onDownloadAll={handleDownloadAll}
            downloadProgress={downloadProgress}
            onJoinWithCode={handleJoinWithCode}
            onLeaveClassroom={handleLeaveClassroom}
            submitProgress={submitProgress}
            onOpenSubmission={handleOpenSubmission}
            onRefreshDetail={handleRefreshDetail}
            onReturnSubmission={handleReturnSubmission}
            teacherComment={studentTeacherComment}
            onRefreshStudentStatus={refreshStudentStatus}
            onStartSubmit={handleStartSubmit}
            onConfirmSubmit={handleConfirmSubmit}
            onCancelSubmit={handleCancelSubmit}
            onShowCodeDisplay={handleShowCodeDisplay}
            onSelectClassroom={handleSelectClassroom}
            onSelectMember={handleSelectMember}
            onSelectSeat={handleSelectSeat}
            onSelectStudent={handleSelectStudent}
            onSelectTeacher={handleSelectTeacher}
            onShowCreateForm={handleShowCreateForm}
            onTeacherLogin={handleTeacherLogin}
            onTeacherLogout={handleTeacherLogout}
            onToggleCodeFullscreen={handleToggleCodeFullscreen}
            googleCourses={googleCourses}
            selectedGoogleCourse={selectedGoogleCourse}
            onGoogleClassroomImport={handleGoogleClassroomImport}
            onSelectGoogleCourse={handleSelectGoogleCourse}
            onConfirmGoogleImport={handleConfirmGoogleImport}
            onPostAssignment={handlePostAssignment}
            onShowPostAssignment={handleShowPostAssignment}
        />
    );
};

ClassroomModal.propTypes = {
    mode: PropTypes.oneOf(['student', 'teacher']),
};

export default ClassroomModal;
