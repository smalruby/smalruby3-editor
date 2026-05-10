import { computeBoundDomain } from '../../../src/lib/mesh-v2-classroom-binding.jsx';

describe('mesh-v2 classroom binding', () => {
    describe('computeBoundDomain', () => {
        test('returns null when classroom is empty', () => {
            expect(computeBoundDomain(null)).toBeNull();
            expect(computeBoundDomain({})).toBeNull();
        });

        test('returns student joinCode lowercased', () => {
            expect(computeBoundDomain({ role: 'student', joinCode: 'XUZK93' })).toBe('xuzk93');
        });

        test('returns teacher selection joinCode lowercased', () => {
            expect(
                computeBoundDomain({
                    role: null,
                    teacherSelection: { joinCode: 'ABC234' },
                }),
            ).toBe('abc234');
        });

        test('prefers student joinCode over teacher selection', () => {
            expect(
                computeBoundDomain({
                    role: 'student',
                    joinCode: 'STU111',
                    teacherSelection: { joinCode: 'TCH222' },
                }),
            ).toBe('stu111');
        });

        test('returns null when student role but no joinCode', () => {
            expect(computeBoundDomain({ role: 'student', joinCode: null })).toBeNull();
        });

        test('returns null when teacher selection has no joinCode', () => {
            expect(computeBoundDomain({ teacherSelection: { classroomId: 'c1' } })).toBeNull();
        });
    });
});
