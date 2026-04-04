import reducer, {
    classroomInitialState,
    openClassroomModal,
    closeClassroomModal,
    setClassroomSession,
    clearClassroomSession,
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
});
