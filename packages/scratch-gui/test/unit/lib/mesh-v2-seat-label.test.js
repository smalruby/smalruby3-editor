import { describeSeatGroup, needsSeatJoinConfirm } from '../../../src/lib/mesh-v2-seat-label.js';

describe('mesh-v2 seat label', () => {
    describe('describeSeatGroup', () => {
        test('returns null for a group without seat info', () => {
            expect(describeSeatGroup(null)).toBeNull();
            expect(describeSeatGroup(undefined)).toBeNull();
            expect(describeSeatGroup({ baseName: 'abc', seats: [], host: null })).toBeNull();
        });

        test('seat groups list the seats', () => {
            expect(describeSeatGroup({ baseName: 'abc', seats: [3, 7, 12], host: 3 })).toEqual({
                kind: 'seats',
                seats: '3・7・12',
            });
        });

        test('a teacher host', () => {
            expect(describeSeatGroup({ baseName: 'abc', seats: [], host: 'teacher' })).toEqual({ kind: 'teacher' });
        });

        test('a student host', () => {
            expect(describeSeatGroup({ baseName: 'abc', seats: [], host: 7 })).toEqual({ kind: 'host', host: 7 });
        });
    });

    describe('needsSeatJoinConfirm', () => {
        const seatGroup = { baseName: 'abc', seats: [3, 7, 12], host: 3 };

        test('no confirm outside a classroom', () => {
            expect(needsSeatJoinConfirm(seatGroup, null)).toBe(false);
        });

        test('no confirm for the teacher', () => {
            expect(needsSeatJoinConfirm(seatGroup, { seat: null, teacher: true })).toBe(false);
        });

        test('no confirm for a chosen seat', () => {
            expect(needsSeatJoinConfirm(seatGroup, { seat: 7, teacher: false })).toBe(false);
        });

        test('confirm for a seat that was not chosen', () => {
            expect(needsSeatJoinConfirm(seatGroup, { seat: 20, teacher: false })).toBe(true);
        });

        test('no confirm for groups without a seat list', () => {
            expect(needsSeatJoinConfirm(null, { seat: 20 })).toBe(false);
            expect(needsSeatJoinConfirm({ baseName: 'abc', seats: [], host: 7 }, { seat: 20 })).toBe(false);
            expect(needsSeatJoinConfirm({ baseName: 'abc', seats: [], host: 'teacher' }, { seat: 20 })).toBe(false);
        });
    });
});
