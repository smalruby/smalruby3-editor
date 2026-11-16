import { buildGroupName, withSeatSuffix } from '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming';
import { findChallenge } from '../../../../src/lib/lessons/courses';
import {
    LESSON_ROLE_STORAGE_KEY,
    connectedGroupSeats,
    roleChangeRestarts,
    ROLE_SOURCES,
    loadRememberedRole,
    pairKeyOf,
    resolveChallengeRole,
    saveRememberedRole,
    seatRoleFor,
    seatsOfGroupName,
} from '../../../../src/lib/lessons/lesson-role';
import { ROLES } from '../../../../src/lib/lessons/role-swap';

const memoryStorage = () => {
    const map = new Map();
    return {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => map.set(key, String(value)),
    };
};

describe('pairs of seats', () => {
    test('pairKeyOf joins two seats in order, and is null otherwise', () => {
        expect(pairKeyOf([7, 3])).toBe('3-7');
        expect(pairKeyOf([3, 3])).toBeNull();
        expect(pairKeyOf([1, 2, 3])).toBeNull();
        expect(pairKeyOf([])).toBeNull();
    });

    test('seatsOfGroupName reads the host and the chosen seats of a seat group', () => {
        const name = buildGroupName(withSeatSuffix('abcdef12', 7), { seats: [3], host: 7 });
        expect(seatsOfGroupName(name)).toEqual([3, 7]);
        expect(seatsOfGroupName('just-a-name')).toEqual([]);
        expect(seatsOfGroupName(null)).toEqual([]);
    });

    test('the smaller seat of the pair is the Shimaraby role', () => {
        expect(seatRoleFor(3, [3, 7])).toBe(ROLES.SHIMARABY);
        expect(seatRoleFor(7, [3, 7])).toBe(ROLES.SHIMACAT);
        expect(seatRoleFor(5, [3, 7])).toBeNull();
        expect(seatRoleFor(3, [3, 7, 9])).toBeNull();
        expect(seatRoleFor(null, [3, 7])).toBeNull();
    });
});

describe('resolveChallengeRole', () => {
    test('nothing remembered and alone: the Shimaraby role', () => {
        expect(resolveChallengeRole()).toEqual({ role: ROLES.SHIMARABY, source: ROLE_SOURCES.DEFAULT, pair: null });
    });

    test('the role of the last challenge is preselected', () => {
        expect(resolveChallengeRole({ remembered: { role: ROLES.SHIMACAT, pair: null } })).toEqual({
            role: ROLES.SHIMACAT,
            source: ROLE_SOURCES.REMEMBERED,
            pair: null,
        });
    });

    test('in a seat pair, the seat decides unless the same pair chose before', () => {
        expect(resolveChallengeRole({ mySeat: 7, groupSeats: [3, 7] })).toEqual({
            role: ROLES.SHIMACAT,
            source: ROLE_SOURCES.SEAT,
            pair: '3-7',
        });
        // ほかのペアで選んだ役は、いまのペアには使わない
        expect(
            resolveChallengeRole({
                remembered: { role: ROLES.SHIMARABY, pair: '7-9' },
                mySeat: 7,
                groupSeats: [3, 7],
            }),
        ).toEqual({ role: ROLES.SHIMACAT, source: ROLE_SOURCES.SEAT, pair: '3-7' });
        // 同じペアで入れかえた役は、次のチャレンジでも使う
        expect(
            resolveChallengeRole({
                remembered: { role: ROLES.SHIMARABY, pair: '3-7' },
                mySeat: 7,
                groupSeats: [3, 7],
            }),
        ).toEqual({ role: ROLES.SHIMARABY, source: ROLE_SOURCES.REMEMBERED, pair: '3-7' });
    });

    test('ignores a broken memory', () => {
        expect(resolveChallengeRole({ remembered: { role: 'dog' } }).role).toBe(ROLES.SHIMARABY);
    });
});

describe('remembering the role', () => {
    test('saves and loads the role and the pair', () => {
        const storage = memoryStorage();
        expect(loadRememberedRole(storage)).toBeNull();
        saveRememberedRole({ role: ROLES.SHIMACAT, pair: '3-7' }, storage);
        expect(loadRememberedRole(storage)).toEqual({ role: ROLES.SHIMACAT, pair: '3-7' });
    });

    test('ignores broken values and missing storage', () => {
        const storage = memoryStorage();
        storage.setItem(LESSON_ROLE_STORAGE_KEY, '{not json');
        expect(loadRememberedRole(storage)).toBeNull();
        storage.setItem(LESSON_ROLE_STORAGE_KEY, JSON.stringify({ role: 'dog' }));
        expect(loadRememberedRole(storage)).toBeNull();
        expect(loadRememberedRole(null)).toBeNull();
        expect(() => saveRememberedRole({ role: ROLES.SHIMACAT }, null)).not.toThrow();
    });
});

describe('the mesh group and starting again', () => {
    const vmWith = (ext) => ({ runtime: { peripheralExtensions: { meshV2: ext } } });

    test('connectedGroupSeats reads the seats of the connected group only', () => {
        const groupName = buildGroupName(withSeatSuffix('abcdef12', 3), { seats: [7], host: 3 });
        expect(connectedGroupSeats(vmWith({ connectionState: 'connected', meshService: { groupName } }))).toEqual([
            3, 7,
        ]);
        expect(connectedGroupSeats(vmWith({ connectionState: 'disconnected', meshService: { groupName } }))).toEqual(
            [],
        );
        expect(connectedGroupSeats(null)).toEqual([]);
    });

    test('roleChangeRestarts for every challenge with roles', () => {
        expect(roleChangeRestarts(findChallenge('chat-l3-mesh-variable').challenge)).toBe(true);
        expect(roleChangeRestarts(findChallenge('chat-l4-send-once').challenge)).toBe(true);
        expect(roleChangeRestarts(findChallenge('chat-l5-ng-word').challenge)).toBe(true);
        expect(roleChangeRestarts(findChallenge('chat-l3-mesh-signal').challenge)).toBe(false);
    });
});
