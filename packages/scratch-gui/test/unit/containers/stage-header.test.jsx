import { isStudentJoined } from '../../../src/containers/stage-header.jsx';

describe('stage-header classroom gating (isStudentJoined)', () => {
    test('returns false when classroom state is missing', () => {
        expect(isStudentJoined(undefined)).toBe(false);
        expect(isStudentJoined(null)).toBe(false);
    });

    test('returns false when no student session', () => {
        expect(isStudentJoined({ role: null, classroomId: null, sessionToken: null })).toBe(false);
    });

    test('returns false for a teacher session', () => {
        expect(isStudentJoined({ role: 'teacher', classroomId: 'class-1', sessionToken: 'tok' })).toBe(false);
    });

    test('returns false when the student session is incomplete', () => {
        // joinCode entered but not yet joined (no classroomId / sessionToken)
        expect(isStudentJoined({ role: 'student', classroomId: null, sessionToken: null })).toBe(false);
        expect(isStudentJoined({ role: 'student', classroomId: 'class-1', sessionToken: null })).toBe(false);
    });

    test('returns true only when a student is fully joined', () => {
        expect(isStudentJoined({ role: 'student', classroomId: 'class-1', sessionToken: 'tok' })).toBe(true);
    });
});
