import reducer, {
    classroomInitialState,
    openClassroomModal,
    closeClassroomModal,
    setClassroomSession,
    clearClassroomSession,
    setSubmissionStatus,
    setTeacherSelection,
    clearTeacherSelection,
} from '../../../src/reducers/classroom';

describe('classroom reducer', () => {
    test('should return initial state', () => {
        const state = reducer(undefined, { type: 'UNKNOWN' });
        expect(state.modalVisible).toBe(false);
        expect(state.role).toBeNull();
        expect(state.classroomId).toBeNull();
    });

    test('should open modal', () => {
        const state = reducer(classroomInitialState, openClassroomModal());
        expect(state.modalVisible).toBe(true);
    });

    test('should close modal', () => {
        const openState = { ...classroomInitialState, modalVisible: true };
        const state = reducer(openState, closeClassroomModal());
        expect(state.modalVisible).toBe(false);
    });

    test('should set session', () => {
        const session = {
            role: 'student',
            classroomId: 'class-123',
            className: '2年A組',
            joinCode: 'ABC234',
            seatNumber: 5,
            memberId: 'seat-05',
            sessionToken: 'token-abc',
        };
        const state = reducer(classroomInitialState, setClassroomSession(session));
        expect(state.role).toBe('student');
        expect(state.classroomId).toBe('class-123');
        expect(state.className).toBe('2年A組');
        expect(state.seatNumber).toBe(5);
        expect(state.sessionToken).toBe('token-abc');
    });

    test('should clear session', () => {
        const withSession = {
            ...classroomInitialState,
            role: 'student',
            classroomId: 'class-123',
            sessionToken: 'token-abc',
        };
        const state = reducer(withSession, clearClassroomSession());
        expect(state.role).toBeNull();
        expect(state.classroomId).toBeNull();
        expect(state.sessionToken).toBeNull();
    });

    test('should preserve modal visibility when setting session', () => {
        const openState = { ...classroomInitialState, modalVisible: true };
        const state = reducer(
            openState,
            setClassroomSession({
                role: 'student',
                classroomId: 'class-123',
                className: '2年A組',
                seatNumber: 1,
                memberId: 'seat-01',
                sessionToken: 'token',
            }),
        );
        expect(state.modalVisible).toBe(true);
        expect(state.role).toBe('student');
    });

    test('should set submission status to submitted', () => {
        const state = reducer(classroomInitialState, setSubmissionStatus('submitted', '2026-04-04T10:00:00Z'));
        expect(state.submissionStatus).toBe('submitted');
        expect(state.lastSubmittedAt).toBe('2026-04-04T10:00:00Z');
    });

    test('should set submission status to returned while preserving lastSubmittedAt', () => {
        const withSubmission = {
            ...classroomInitialState,
            submissionStatus: 'submitted',
            lastSubmittedAt: '2026-04-04T10:00:00Z',
        };
        const state = reducer(withSubmission, setSubmissionStatus('returned'));
        expect(state.submissionStatus).toBe('returned');
        expect(state.lastSubmittedAt).toBe('2026-04-04T10:00:00Z');
    });

    test('should clear submission status when clearing session', () => {
        const withSubmission = {
            ...classroomInitialState,
            role: 'student',
            sessionToken: 'token',
            submissionStatus: 'submitted',
            lastSubmittedAt: '2026-04-04T10:00:00Z',
        };
        const state = reducer(withSubmission, clearClassroomSession());
        expect(state.submissionStatus).toBeNull();
        expect(state.lastSubmittedAt).toBeNull();
    });

    describe('teacher selection', () => {
        test('initial state has null teacherSelection (not persisted across reload)', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state.teacherSelection).toBeNull();
        });

        test('should set teacher selection', () => {
            const state = reducer(
                classroomInitialState,
                setTeacherSelection({
                    classroomId: 'class-9',
                    joinCode: 'XUZK93',
                    className: '6年1組',
                    assignmentName: '宿題1',
                }),
            );
            expect(state.teacherSelection).toEqual({
                classroomId: 'class-9',
                joinCode: 'XUZK93',
                className: '6年1組',
                assignmentName: '宿題1',
            });
        });

        test('should clear teacher selection', () => {
            const withSelection = {
                ...classroomInitialState,
                teacherSelection: {
                    classroomId: 'class-9',
                    joinCode: 'XUZK93',
                    className: null,
                    assignmentName: null,
                },
            };
            const state = reducer(withSelection, clearTeacherSelection());
            expect(state.teacherSelection).toBeNull();
        });

        test('should preserve teacher selection on student session clear', () => {
            const state = {
                ...classroomInitialState,
                role: 'student',
                sessionToken: 'token',
                teacherSelection: {
                    classroomId: 'class-9',
                    joinCode: 'XUZK93',
                    className: null,
                    assignmentName: null,
                },
            };
            const next = reducer(state, clearClassroomSession());
            expect(next.role).toBeNull();
            expect(next.teacherSelection).toEqual(state.teacherSelection);
        });
    });
});
