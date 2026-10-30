// What "出席番号でつながる" reads from the outside world: the class (seat count,
// present seats and group limit from the classroom lookup) and the mesh
// groups of the class domain (with the seats connected to each).
// The decisions on top of this live in mesh-v2-seat-connect.js.
import { useCallback, useEffect, useRef, useState } from 'react';
import classroomAPI from './classroom-api.js';
import { normalizeGroupLimit } from './mesh-v2-seat-connect.js';

/**
 * @param {object} vm - the VM.
 * @returns {?object} the loaded meshV2 extension, or null.
 */
const getMeshV2Extension = (vm) =>
    (vm && vm.runtime && vm.runtime.peripheralExtensions && vm.runtime.peripheralExtensions.meshV2) || null;

/**
 * @param {string} joinCode - join code of the class.
 * @returns {Promise<{studentCount: number, presentSeats: Array<number>, groupLimit: number}>} the class.
 */
const fetchClassSeats = async (joinCode) => {
    const data = await classroomAPI.lookupClassroom(joinCode);
    return {
        studentCount: Number.isInteger(data.studentCount) ? data.studentCount : 0,
        presentSeats: Array.isArray(data.takenSeats) ? data.takenSeats : [],
        groupLimit: normalizeGroupLimit(data.meshGroupLimit),
    };
};

/**
 * @param {object} vm - the VM.
 * @returns {Promise<Array<object>>} the groups of the class domain (see listSeatGroups in the VM).
 */
const fetchSeatGroups = (vm) => {
    const ext = getMeshV2Extension(vm);
    if (!ext || typeof ext.listSeatGroups !== 'function') return Promise.resolve([]);
    return ext.listSeatGroups();
};

/**
 * Keep the class and its groups fresh while a screen is open.
 * The groups are read every `intervalMs`; the class lookup only every
 * `lookupEvery` reads, since who is in the class changes slowly.
 * @param {object} params - parameters.
 * @param {object} params.vm - the VM.
 * @param {?string} params.joinCode - join code of the class; nothing is read without it.
 * @param {number} [params.intervalMs] - read interval, or 0 to read once.
 * @param {number} [params.lookupEvery] - read the class lookup every N reads.
 * @returns {{classSeats: ?object, groups: ?Array<object>, error: ?Error, updatedAt: number, refresh: Function}}
 *   the latest snapshot (null until the first read) and a function to read now.
 */
const useSeatSnapshot = ({ vm, joinCode, intervalMs = 0, lookupEvery = 3 }) => {
    const [snapshot, setSnapshot] = useState({ classSeats: null, groups: null, error: null, updatedAt: 0 });
    const readsRef = useRef(0);
    const busyRef = useRef(false);
    const aliveRef = useRef(true);
    const classSeatsRef = useRef(null);

    const refresh = useCallback(() => {
        if (!joinCode || busyRef.current) return Promise.resolve();
        busyRef.current = true;
        const needLookup = !classSeatsRef.current || readsRef.current % lookupEvery === 0;
        readsRef.current++;
        return Promise.all([
            needLookup ? fetchClassSeats(joinCode) : Promise.resolve(classSeatsRef.current),
            fetchSeatGroups(vm),
        ])
            .then(([classSeats, groups]) => {
                classSeatsRef.current = classSeats;
                if (aliveRef.current) setSnapshot({ classSeats, groups, error: null, updatedAt: Date.now() });
            })
            .catch((error) => {
                if (aliveRef.current) setSnapshot((prev) => ({ ...prev, error }));
            })
            .finally(() => {
                busyRef.current = false;
            });
    }, [vm, joinCode, lookupEvery]);

    useEffect(() => {
        aliveRef.current = true;
        refresh();
        const timer = intervalMs > 0 ? setInterval(refresh, intervalMs) : null;
        return () => {
            aliveRef.current = false;
            if (timer) clearInterval(timer);
        };
    }, [refresh, intervalMs]);

    return { ...snapshot, refresh };
};

export { fetchClassSeats, fetchSeatGroups, getMeshV2Extension, useSeatSnapshot };
