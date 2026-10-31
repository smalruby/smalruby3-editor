import {
    ACTION,
    HOST_WAIT_MS,
    SEAT_STATUS,
    decideSeatAction,
    describeSeatStatuses,
    findGroupToMergeInto,
    findTeacherGroup,
    isEveryoneHere,
    needsAloneConfirm,
    normalizeGroupLimit,
    pickHostSeat,
    seatPickerState,
    toggleSeat,
} from '../../../src/lib/mesh-v2-seat-connect.js';

// A=3, B=7, C=12 as in the design's scenario table.
const seatGroup = (id, host, seats, memberSeats = [host]) => ({
    id,
    seatInfo: { baseName: `abc${id}s${String(host).padStart(2, '0')}`, seats, host },
    memberSeats,
});
const hostOnlyGroup = (id, host, memberSeats = [host]) => ({
    id,
    seatInfo: { baseName: `abc${id}`, seats: [], host },
    memberSeats,
});
const legacyGroup = (id, memberSeats = []) => ({ id, seatInfo: null, memberSeats });
const statusOf = (statuses, seat) => statuses.find((entry) => entry.seat === seat);

describe('mesh-v2 seat connect', () => {
    describe('normalizeGroupLimit', () => {
        test('a missing limit means no limit', () => {
            expect(normalizeGroupLimit(undefined)).toBe(0);
            expect(normalizeGroupLimit(null)).toBe(0);
            expect(normalizeGroupLimit(0)).toBe(0);
            expect(normalizeGroupLimit('6')).toBe(0);
        });

        test('a positive limit is kept', () => {
            expect(normalizeGroupLimit(6)).toBe(6);
        });
    });

    describe('pickHostSeat', () => {
        test('the smallest present chosen seat hosts', () => {
            expect(pickHostSeat({ chosenSeats: [3, 7, 12], presentSeats: [3, 7, 12], mySeat: 7 })).toBe(3);
        });

        test('an absent smallest seat is skipped at once', () => {
            expect(pickHostSeat({ chosenSeats: [3, 7, 12], presentSeats: [7, 12], mySeat: 12 })).toBe(7);
        });

        test('a present host who has not opened mesh is replaced after 20 seconds', () => {
            const params = { chosenSeats: [3, 7, 12], presentSeats: [3, 7, 12], mySeat: 7 };
            expect(pickHostSeat({ ...params, elapsedMs: HOST_WAIT_MS - 1 })).toBe(3);
            expect(pickHostSeat({ ...params, elapsedMs: HOST_WAIT_MS })).toBe(7);
        });

        test('the turn never passes the own seat', () => {
            expect(
                pickHostSeat({
                    chosenSeats: [3, 7, 12],
                    presentSeats: [3, 7, 12],
                    mySeat: 7,
                    elapsedMs: 10 * HOST_WAIT_MS,
                }),
            ).toBe(7);
        });

        test('the own seat counts even if missing from the lists', () => {
            expect(pickHostSeat({ chosenSeats: [7], presentSeats: [], mySeat: 3 })).toBe(3);
        });
    });

    describe('decideSeatAction', () => {
        test('same choice: the host creates with the chosen seats', () => {
            expect(decideSeatAction({ groups: [], chosenSeats: [3, 7], presentSeats: [3, 7], mySeat: 3 })).toEqual({
                action: ACTION.CREATE,
                hostSeat: 3,
                seats: [3, 7],
            });
        });

        test('same choice: the other seat waits, then joins the host group', () => {
            const params = { chosenSeats: [3, 7], presentSeats: [3, 7], mySeat: 7 };
            expect(decideSeatAction({ ...params, groups: [] })).toEqual({ action: ACTION.WAIT, hostSeat: 3 });
            expect(decideSeatAction({ ...params, groups: [seatGroup('g3', 3, [3, 7])] })).toEqual({
                action: ACTION.JOIN,
                groupId: 'g3',
                hostSeat: 3,
            });
        });

        test('mixed: a legacy "host" group with a seat host is found by the seat member', () => {
            const groups = [hostOnlyGroup('g3', 3)];
            expect(decideSeatAction({ groups, chosenSeats: [3, 7], presentSeats: [3, 7], mySeat: 7 })).toEqual({
                action: ACTION.WAIT,
                hostSeat: 3,
            });
        });

        test('mixed: a group the student already joined the legacy way is joined', () => {
            const groups = [legacyGroup('old', [7])];
            expect(decideSeatAction({ groups, chosenSeats: [3, 7], presentSeats: [3, 7], mySeat: 7 }).action).toBe(
                ACTION.JOIN,
            );
        });

        test('absent host: the next seat creates at once', () => {
            expect(
                decideSeatAction({ groups: [], chosenSeats: [3, 7, 12], presentSeats: [7, 12], mySeat: 7 }),
            ).toEqual({ action: ACTION.CREATE, hostSeat: 7, seats: [3, 7, 12] });
        });

        test('host change: the next seat creates after 20 seconds', () => {
            const params = { groups: [], chosenSeats: [3, 7, 12], presentSeats: [3, 7, 12], mySeat: 7 };
            expect(decideSeatAction({ ...params, elapsedMs: 0 }).action).toBe(ACTION.WAIT);
            expect(decideSeatAction({ ...params, elapsedMs: HOST_WAIT_MS }).action).toBe(ACTION.CREATE);
        });

        test('late host: joins the group made in its place instead of creating', () => {
            const groups = [seatGroup('g7', 7, [3, 7, 12], [7, 12])];
            expect(
                decideSeatAction({ groups, chosenSeats: [3, 7, 12], presentSeats: [3, 7, 12], mySeat: 3 }),
            ).toEqual({ action: ACTION.JOIN, groupId: 'g7', hostSeat: 7 });
        });

        test('two groups with the own seat: the smaller host survives', () => {
            const groups = [seatGroup('g7', 7, [3, 7, 12]), seatGroup('g3', 3, [3, 7, 12])];
            expect(
                decideSeatAction({ groups, chosenSeats: [3, 7, 12], presentSeats: [3, 7, 12], mySeat: 12 }).groupId,
            ).toBe('g3');
        });

        test('a group for other seats is not joined', () => {
            const groups = [seatGroup('g3', 3, [3, 7])];
            expect(decideSeatAction({ groups, chosenSeats: [3, 12], presentSeats: [3, 12], mySeat: 12 })).toEqual({
                action: ACTION.WAIT,
                hostSeat: 3,
            });
        });
    });

    describe('findGroupToMergeInto', () => {
        test('simultaneous creation: the bigger host moves into the smaller host group', () => {
            const groups = [seatGroup('g3', 3, [3, 7]), seatGroup('g7', 7, [3, 7])];
            expect(findGroupToMergeInto({ groups, myGroupId: 'g7', mySeat: 7 })).toBe('g3');
        });

        test('the smaller host stays', () => {
            const groups = [seatGroup('g3', 3, [3, 7]), seatGroup('g7', 7, [3, 7])];
            expect(findGroupToMergeInto({ groups, myGroupId: 'g3', mySeat: 3 })).toBeNull();
        });

        test('a group without the own seat is ignored', () => {
            const groups = [seatGroup('g3', 3, [3, 12]), seatGroup('g7', 7, [7, 12])];
            expect(findGroupToMergeInto({ groups, myGroupId: 'g7', mySeat: 7 })).toBeNull();
        });

        test('legacy groups are not merge targets', () => {
            const groups = [legacyGroup('old', [7]), seatGroup('g7', 7, [7])];
            expect(findGroupToMergeInto({ groups, myGroupId: 'g7', mySeat: 7 })).toBeNull();
        });
    });

    describe('describeSeatStatuses', () => {
        test('joined, waiting and absent seats', () => {
            const groups = [seatGroup('g3', 3, [3, 7, 12, 20], [3, 7])];
            const statuses = describeSeatStatuses({
                groups,
                groupId: 'g3',
                chosenSeats: [3, 7, 12, 20],
                presentSeats: [3, 7, 12],
                mySeat: 3,
            });
            expect(statuses).toEqual([
                { seat: 3, status: SEAT_STATUS.ME, host: true },
                { seat: 7, status: SEAT_STATUS.JOINED, host: false },
                { seat: 12, status: SEAT_STATUS.WAITING, host: false },
                { seat: 20, status: SEAT_STATUS.ABSENT, host: false },
            ]);
            expect(isEveryoneHere(statuses)).toBe(false);
        });

        test('crossed choices: a seat that made another group is elsewhere', () => {
            const groups = [seatGroup('g3', 3, [3, 7]), seatGroup('g7', 7, [7, 12])];
            const statuses = describeSeatStatuses({
                groups,
                groupId: 'g3',
                chosenSeats: [3, 7],
                presentSeats: [3, 7, 12],
                mySeat: 3,
            });
            expect(statusOf(statuses, 7)).toEqual({
                seat: 7,
                status: SEAT_STATUS.ELSEWHERE,
                groupSeats: [7, 12],
                host: false,
            });
        });

        test('mixed: a seat that hosts a legacy-style group is elsewhere', () => {
            const groups = [seatGroup('g3', 3, [3, 7]), hostOnlyGroup('h7', 7)];
            const statuses = describeSeatStatuses({
                groups,
                groupId: 'g3',
                chosenSeats: [3, 7],
                presentSeats: [3, 7],
                mySeat: 3,
            });
            expect(statusOf(statuses, 7).status).toBe(SEAT_STATUS.ELSEWHERE);
        });

        test('everyone here when the rest are joined or absent', () => {
            const groups = [seatGroup('g3', 3, [3, 7, 20], [3, 7])];
            const statuses = describeSeatStatuses({
                groups,
                groupId: 'g3',
                chosenSeats: [3, 7, 20],
                presentSeats: [3, 7],
                mySeat: 3,
            });
            expect(isEveryoneHere(statuses)).toBe(true);
        });

        test('a non-host waiting for no group yet sees the others waiting', () => {
            const statuses = describeSeatStatuses({
                groups: [],
                groupId: null,
                chosenSeats: [3, 7],
                presentSeats: [3, 7],
                mySeat: 7,
            });
            expect(statusOf(statuses, 3).status).toBe(SEAT_STATUS.WAITING);
        });
    });

    describe('needsAloneConfirm', () => {
        test('asks when every other chosen seat is absent', () => {
            const statuses = describeSeatStatuses({
                groups: [],
                groupId: null,
                chosenSeats: [3, 7, 12],
                presentSeats: [3],
                mySeat: 3,
            });
            expect(needsAloneConfirm(statuses)).toBe(true);
        });

        test('does not ask when someone is present', () => {
            const statuses = describeSeatStatuses({
                groups: [],
                groupId: null,
                chosenSeats: [3, 7],
                presentSeats: [3, 7],
                mySeat: 3,
            });
            expect(needsAloneConfirm(statuses)).toBe(false);
        });

        test('does not ask for a student alone by choice', () => {
            expect(needsAloneConfirm([{ seat: 3, status: SEAT_STATUS.ME }])).toBe(false);
        });
    });

    describe('seatPickerState', () => {
        const base = { studentCount: 8, presentSeats: [1, 2, 3, 4, 5, 6, 7], groups: [], mySeat: 3 };

        test('one entry per seat in the class', () => {
            const state = seatPickerState({ ...base, chosenSeats: [3], groupLimit: 6 });
            expect(state.seats.map((entry) => entry.seat)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
            expect(state.seats[2]).toMatchObject({ me: true, chosen: true, disabled: true });
            expect(state.seats[7]).toMatchObject({ absent: true, disabled: false });
        });

        test('a seat in another group is busy', () => {
            const state = seatPickerState({
                ...base,
                groups: [seatGroup('g5', 5, [5, 6], [5, 6])],
                chosenSeats: [3],
            });
            expect(state.seats[4].busyGroupId).toBe('g5');
            expect(state.seats[5].busyGroupId).toBe('g5');
        });

        test('limit: the remaining seats are disabled once 6 are chosen', () => {
            const state = seatPickerState({ ...base, chosenSeats: [1, 2, 3, 4, 5, 6], groupLimit: 6 });
            expect(state.limitReached).toBe(true);
            expect(state.canSelectAll).toBe(false);
            expect(state.seats[6].disabled).toBe(true);
            expect(state.seats[0].disabled).toBe(false);
        });

        test('no limit offers "select all"', () => {
            const state = seatPickerState({ ...base, chosenSeats: [3], groupLimit: undefined });
            expect(state.limit).toBe(0);
            expect(state.canSelectAll).toBe(true);
            expect(state.limitReached).toBe(false);
        });
    });

    describe('toggleSeat', () => {
        test('adds and removes a seat', () => {
            expect(toggleSeat([3], 7, 3, 6)).toEqual([3, 7]);
            expect(toggleSeat([3, 7], 7, 3, 6)).toEqual([3]);
        });

        test('the own seat cannot be removed', () => {
            expect(toggleSeat([3, 7], 3, 3, 6)).toEqual([3, 7]);
        });

        test('a seventh seat is refused with a limit of 6', () => {
            expect(toggleSeat([1, 2, 3, 4, 5, 6], 7, 3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
            expect(toggleSeat([1, 2, 3, 4, 5, 6], 7, 3, 0)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        });
    });

    describe('findTeacherGroup', () => {
        const teacher = { id: 't', seatInfo: { baseName: 'abc', seats: [], host: 'teacher' }, memberSeats: [] };

        test('offered without a limit', () => {
            expect(findTeacherGroup([seatGroup('g3', 3, [3]), teacher], undefined)).toBe(teacher);
        });

        test('not offered with a limit', () => {
            expect(findTeacherGroup([teacher], 6)).toBeNull();
        });
    });
});
