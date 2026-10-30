import { computeBoundDomain, computeBoundSeat } from '../../../src/lib/mesh-v2-classroom-binding.jsx';

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

describe('computeBoundSeat', () => {
    test('null outside a classroom', () => {
        expect(computeBoundSeat(null)).toBeNull();
        expect(computeBoundSeat({})).toBeNull();
    });

    test('a student in a class gets the seat', () => {
        expect(computeBoundSeat({ role: 'student', joinCode: 'XUZK93', seatNumber: 7 })).toEqual({
            seat: 7,
            teacher: false,
        });
    });

    test('a student without a seat is treated as outside a class', () => {
        expect(computeBoundSeat({ role: 'student', joinCode: 'XUZK93', seatNumber: null })).toBeNull();
    });

    test('a teacher with a selected class', () => {
        expect(computeBoundSeat({ role: null, teacherSelection: { joinCode: 'ABC234' } })).toEqual({
            seat: null,
            teacher: true,
        });
    });

    test('a student wins over a teacher selection', () => {
        expect(
            computeBoundSeat({
                role: 'student',
                joinCode: 'STU111',
                seatNumber: 3,
                teacherSelection: { joinCode: 'TCH222' },
            }),
        ).toEqual({ seat: 3, teacher: false });
    });

    test('returns the same object while the seat is unchanged', () => {
        const a = computeBoundSeat({ role: 'student', joinCode: 'XUZK93', seatNumber: 7 });
        const b = computeBoundSeat({ role: 'student', joinCode: 'XUZK93', seatNumber: 7 });
        expect(b).toBe(a);
        expect(computeBoundSeat({ role: 'student', joinCode: 'XUZK93', seatNumber: 8 })).not.toBe(a);
    });
});
