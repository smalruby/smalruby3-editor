import {
    HISTORY_COLLAPSED_COUNT,
    assignPeerNumbers,
    describeNode,
    formatClock,
    visibleHistory,
} from '../../../src/lib/mesh-v2-status';

describe('mesh-v2-status (#1844)', () => {
    test('assignPeerNumbers keeps numbers and gives new peers the next number', () => {
        let map = assignPeerNumbers({}, ['self', 'a', 'b'], 'self');
        expect(map).toEqual({ a: 1, b: 2 });
        map = assignPeerNumbers(map, ['self', 'c', 'b'], 'self');
        expect(map).toEqual({ a: 1, b: 2, c: 3 });
        // the same object is returned when nothing changes (React can skip a render)
        expect(assignPeerNumbers(map, ['b', 'a'], 'self')).toBe(map);
    });

    test('assignPeerNumbers skips seat ids in a class', () => {
        const map = assignPeerNumbers({}, ['xs03', 'teacher', 'ys12'], 'xs03', true);
        expect(map).toEqual({ teacher: 1 });
    });

    test('describeNode outside a class', () => {
        const peers = { a: 1, b: 2 };
        expect(describeNode('self', { selfId: 'self', inClassroom: false, peers })).toEqual({ kind: 'self' });
        expect(describeNode('b', { selfId: 'self', inClassroom: false, peers })).toEqual({ kind: 'peer', number: 2 });
        // a seat suffix is not shown outside a class (Q2: no names, no seats)
        expect(describeNode('as07', { selfId: 'self', inClassroom: false, peers: { as07: 3 } })).toEqual({
            kind: 'peer',
            number: 3,
        });
        // unknown sender: no number yet
        expect(describeNode('zzz', { selfId: 'self', inClassroom: false, peers })).toEqual({
            kind: 'peer',
            number: null,
        });
    });

    test('describeNode in a class uses the seat', () => {
        const ctx = { selfId: 'aas03', inClassroom: true, peers: { t: 1 } };
        expect(describeNode('aas03', ctx)).toEqual({ kind: 'seat', seat: '03', self: true });
        expect(describeNode('bbs12', ctx)).toEqual({ kind: 'seat', seat: '12', self: false });
        expect(describeNode('t', ctx)).toEqual({ kind: 'peer', number: 1 });
        // the teacher (no seat) is "あなた"
        expect(describeNode('t', { ...ctx, selfId: 't' })).toEqual({ kind: 'self' });
    });

    test('visibleHistory shows 3 items collapsed and up to 50 expanded', () => {
        const history = Array.from({ length: 60 }, (_v, i) => ({ name: `m${i}` }));
        expect(HISTORY_COLLAPSED_COUNT).toBe(3);
        expect(visibleHistory(history, false).map((h) => h.name)).toEqual(['m0', 'm1', 'm2']);
        expect(visibleHistory(history, true)).toHaveLength(50);
        expect(visibleHistory([], true)).toEqual([]);
        expect(visibleHistory(null, false)).toEqual([]);
    });

    test('formatClock shows HH:MM:SS in local time', () => {
        const d = new Date(2026, 10, 14, 9, 5, 7).getTime();
        expect(formatClock(d)).toBe('09:05:07');
        expect(formatClock(null)).toBe('');
        expect(formatClock(NaN)).toBe('');
    });
});
