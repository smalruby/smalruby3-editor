import reducer, {
    classroomInitialState,
    openClassroomModal,
    closeClassroomModal,
    setClassroomSession,
    clearClassroomSession,
    setSubmissionStatus,
    setSubmissionThumbnail,
    clearSubmissionThumbnail,
    setTeacherSelection,
    clearTeacherSelection,
} from '../../../src/reducers/classroom';

const STORAGE_KEY = 'smalruby:classroom';

describe('classroom reducer', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });

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

    describe('submission thumbnail', () => {
        const DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANS';

        test('initial state has null submissionThumbnail', () => {
            const state = reducer(undefined, { type: 'UNKNOWN' });
            expect(state.submissionThumbnail).toBeNull();
        });

        test('should set submission thumbnail', () => {
            const state = reducer(classroomInitialState, setSubmissionThumbnail(DATA_URI));
            expect(state.submissionThumbnail).toBe(DATA_URI);
        });

        test('should clear submission thumbnail', () => {
            const withThumbnail = { ...classroomInitialState, submissionThumbnail: DATA_URI };
            const state = reducer(withThumbnail, clearSubmissionThumbnail());
            expect(state.submissionThumbnail).toBeNull();
        });

        test('should clear submission thumbnail when clearing session', () => {
            const withThumbnail = {
                ...classroomInitialState,
                role: 'student',
                sessionToken: 'token',
                submissionThumbnail: DATA_URI,
            };
            const state = reducer(withThumbnail, clearClassroomSession());
            expect(state.submissionThumbnail).toBeNull();
        });

        test('does not persist submissionThumbnail to localStorage', () => {
            const stateWithSession = {
                ...classroomInitialState,
                role: 'student',
                sessionToken: 'token-abc',
                classroomId: 'class-123',
                submissionThumbnail: DATA_URI,
            };
            // SET_SUBMISSION_STATUS persists the whole session; the thumbnail must be stripped.
            reducer(stateWithSession, setSubmissionStatus('submitted', '2026-05-21T01:30:00.000Z'));
            const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
            expect(stored.submissionThumbnail).toBeUndefined();
        });
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

    describe('storage persistence (localStorage)', () => {
        const baseSession = {
            role: 'student',
            classroomId: 'class-123',
            className: '2年A組',
            assignmentName: '宿題1',
            joinCode: 'abc234',
            seatNumber: 5,
            memberId: 'seat-05',
            sessionToken: 'token-abc',
            joinedAt: '2026-05-21T01:00:00.000Z',
        };

        test('writes session to localStorage (not sessionStorage) on SET_SESSION', () => {
            reducer(classroomInitialState, setClassroomSession(baseSession));
            const stored = window.localStorage.getItem(STORAGE_KEY);
            expect(stored).not.toBeNull();
            expect(JSON.parse(stored)).toMatchObject({
                role: 'student',
                classroomId: 'class-123',
                seatNumber: 5,
                sessionToken: 'token-abc',
            });
            expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
        });

        test('removes session from localStorage on CLEAR_SESSION', () => {
            reducer(classroomInitialState, setClassroomSession(baseSession));
            expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

            reducer(
                {
                    ...classroomInitialState,
                    role: 'student',
                    sessionToken: 'token-abc',
                },
                clearClassroomSession(),
            );
            expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
        });

        test('clears any leftover sessionStorage on CLEAR_SESSION', () => {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(baseSession));
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(baseSession));

            reducer(
                {
                    ...classroomInitialState,
                    role: 'student',
                    sessionToken: 'token-abc',
                },
                clearClassroomSession(),
            );
            expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
        });

        test('persists submission status updates to localStorage', () => {
            reducer(classroomInitialState, setClassroomSession(baseSession));
            const stateWithSession = {
                ...classroomInitialState,
                role: 'student',
                sessionToken: 'token-abc',
                classroomId: 'class-123',
                seatNumber: 5,
                memberId: 'seat-05',
                joinCode: 'abc234',
                className: '2年A組',
                assignmentName: '宿題1',
                joinedAt: baseSession.joinedAt,
            };
            reducer(stateWithSession, setSubmissionStatus('submitted', '2026-05-21T01:30:00.000Z'));

            const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
            expect(stored.submissionStatus).toBe('submitted');
            expect(stored.lastSubmittedAt).toBe('2026-05-21T01:30:00.000Z');
        });
    });

    describe('module-load migration (sessionStorage → localStorage)', () => {
        const legacySession = {
            role: 'student',
            classroomId: 'class-legacy',
            className: '6年2組',
            assignmentName: '宿題X',
            joinCode: 'legacy',
            seatNumber: 7,
            memberId: 'seat-07',
            sessionToken: 'legacy-token',
            joinedAt: '2026-05-20T00:00:00.000Z',
        };

        beforeEach(() => {
            jest.resetModules();
            window.localStorage.clear();
            window.sessionStorage.clear();
        });

        test('migrates legacy sessionStorage session to localStorage and clears sessionStorage on load', () => {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(legacySession));

            // Re-import to trigger module-load migration logic.
            const { classroomInitialState: freshInitialState } = require('../../../src/reducers/classroom');

            expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
            const migrated = window.localStorage.getItem(STORAGE_KEY);
            expect(migrated).not.toBeNull();
            expect(JSON.parse(migrated)).toMatchObject({
                classroomId: 'class-legacy',
                seatNumber: 7,
                sessionToken: 'legacy-token',
            });

            // Initial state should reflect the restored session.
            expect(freshInitialState.role).toBe('student');
            expect(freshInitialState.classroomId).toBe('class-legacy');
            expect(freshInitialState.sessionToken).toBe('legacy-token');
        });

        test('does not overwrite an existing localStorage session with sessionStorage value', () => {
            const newSession = { ...legacySession, sessionToken: 'localstorage-token' };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(legacySession));

            const { classroomInitialState: freshInitialState } = require('../../../src/reducers/classroom');

            const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
            expect(stored.sessionToken).toBe('localstorage-token');
            // Stale sessionStorage value is cleared either way to avoid future confusion.
            expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(freshInitialState.sessionToken).toBe('localstorage-token');
        });

        test('initial state is null when neither storage has a session', () => {
            const { classroomInitialState: freshInitialState } = require('../../../src/reducers/classroom');
            expect(freshInitialState.role).toBeNull();
            expect(freshInitialState.classroomId).toBeNull();
            expect(freshInitialState.sessionToken).toBeNull();
        });

        test('ignores malformed sessionStorage payload without throwing', () => {
            window.sessionStorage.setItem(STORAGE_KEY, '{ not valid json');

            const { classroomInitialState: freshInitialState } = require('../../../src/reducers/classroom');

            expect(freshInitialState.role).toBeNull();
            expect(freshInitialState.sessionToken).toBeNull();
            // Malformed legacy data should still be cleared so it stops surfacing.
            expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
        });
    });
});
