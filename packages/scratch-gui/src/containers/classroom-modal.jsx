import React, { useCallback, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import ClassroomModalComponent from '../components/classroom-modal/classroom-modal.jsx';
import classroomAPI from '../lib/classroom-api.js';
import { loadGoogleIdentity } from '../lib/google-script-loader.js';
import { closeClassroomModal, setClassroomSession } from '../reducers/classroom.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const ClassroomModal = () => {
    const dispatch = useDispatch();

    // UI state
    const [phase, setPhase] = useState('role-select');
    const [error, setError] = useState(null);
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
    const [pendingClassroomId, setPendingClassroomId] = useState(null);
    const [pendingClassName, setPendingClassName] = useState(null);
    const [joinedInfo, setJoinedInfo] = useState(null);

    const handleClose = useCallback(() => {
        dispatch(closeClassroomModal());
    }, [dispatch]);

    const handleSelectTeacher = useCallback(() => {
        setError(null);
        if (idToken) {
            setPhase('teacher-dashboard');
        } else {
            setPhase('teacher-login');
        }
    }, [idToken]);

    const handleSelectStudent = useCallback(() => {
        setError(null);
        setPhase('student-join');
    }, []);

    const handleBackToRoleSelect = useCallback(() => {
        setError(null);
        setPhase('role-select');
    }, []);

    // --- Teacher: Google Sign-In ---

    const handleTeacherLogin = useCallback(async () => {
        setError(null);
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
                        // One Tap not available; fall back to button-based flow
                        // Render a temporary button and auto-click it
                        const container = document.createElement('div');
                        container.style.cssText =
                            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;';
                        document.body.appendChild(container);
                        google.accounts.id.renderButton(container, {
                            theme: 'outline',
                            size: 'large',
                        });
                        // Clean up after sign-in completes or user closes
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
            setError(err.message || 'Sign-in failed');
        }
    }, []);

    // --- Teacher: Load classrooms when entering dashboard ---

    useEffect(() => {
        if (phase === 'teacher-dashboard' && idToken) {
            setIsLoading(true);
            setError(null);
            classroomAPI
                .listClassrooms(idToken)
                .then(data => {
                    setClassrooms(data.classrooms || []);
                })
                .catch(err => {
                    setError(err.message);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [phase, idToken]);

    // --- Teacher: Create classroom ---

    const handleShowCreateForm = useCallback(() => {
        setPhase('teacher-create');
    }, []);

    const handleCreateClassroom = useCallback(
        async formData => {
            setError(null);
            setIsLoading(true);
            try {
                await classroomAPI.createClassroom(idToken, formData.className, formData.studentCount);
                setPhase('teacher-dashboard');
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        },
        [idToken],
    );

    // --- Teacher: Select classroom to view details ---

    const handleSelectClassroom = useCallback(
        async classroomId => {
            setError(null);
            setIsLoading(true);
            try {
                const [classroomData, membersData] = await Promise.all([
                    classroomAPI.getClassroom(classroomId),
                    classroomAPI.listMembers(idToken, classroomId),
                ]);
                setSelectedClassroom(classroomData);
                setMembers(membersData.members || []);
                setPhase('teacher-class-detail');
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        },
        [idToken],
    );

    const handleBackToDashboard = useCallback(() => {
        setError(null);
        setSelectedClassroom(null);
        setMembers([]);
        if (idToken) {
            setPhase('teacher-dashboard');
        } else {
            setPhase('role-select');
        }
    }, [idToken]);

    // --- Teacher: Delete member ---

    const handleDeleteMember = useCallback(
        async memberId => {
            if (!selectedClassroom) return;
            setError(null);
            try {
                await classroomAPI.deleteMember(idToken, selectedClassroom.classroomId, memberId);
                setMembers(prev => prev.filter(m => m.memberId !== memberId));
            } catch (err) {
                setError(err.message);
            }
        },
        [idToken, selectedClassroom],
    );

    // --- Student: Join with code ---

    const handleJoinWithCode = useCallback(joinCode => {
        setError(null);
        // Proceed to seat selection; server validates seat number on join
        setPendingJoinCode(joinCode);
        setSeatCount(40); // Default max; server validates against actual class size
        setTakenSeats([]);
        setSelectedSeat(null);
        setPhase('student-seat');
    }, []);

    // --- Student: Select seat ---

    const handleSelectSeat = useCallback(seatNumber => {
        setSelectedSeat(seatNumber);
    }, []);

    // --- Student: Confirm join ---

    const handleConfirmJoin = useCallback(async () => {
        if (!pendingJoinCode || !selectedSeat) return;
        setError(null);
        setIsLoading(true);
        try {
            const data = await classroomAPI.joinClassroom(pendingJoinCode, selectedSeat);
            // Save session to Redux + localStorage
            dispatch(
                setClassroomSession({
                    role: 'student',
                    classroomId: data.classroomId,
                    className: data.className,
                    joinCode: pendingJoinCode,
                    seatNumber: data.seatNumber,
                    memberId: data.memberId,
                    sessionToken: data.sessionToken,
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
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, pendingJoinCode, selectedSeat]);

    return (
        <ClassroomModalComponent
            classrooms={classrooms}
            error={error}
            isLoading={isLoading}
            joinedInfo={joinedInfo}
            members={members}
            phase={phase}
            seatCount={seatCount}
            selectedClassroom={selectedClassroom}
            selectedSeat={selectedSeat}
            takenSeats={takenSeats}
            onBackToDashboard={handleBackToDashboard}
            onBackToRoleSelect={handleBackToRoleSelect}
            onClose={handleClose}
            onConfirmJoin={handleConfirmJoin}
            onCreateClassroom={handleCreateClassroom}
            onDeleteMember={handleDeleteMember}
            onJoinWithCode={handleJoinWithCode}
            onSelectClassroom={handleSelectClassroom}
            onSelectSeat={handleSelectSeat}
            onSelectStudent={handleSelectStudent}
            onSelectTeacher={handleSelectTeacher}
            onShowCreateForm={handleShowCreateForm}
            onTeacherLogin={handleTeacherLogin}
        />
    );
};

export default ClassroomModal;
