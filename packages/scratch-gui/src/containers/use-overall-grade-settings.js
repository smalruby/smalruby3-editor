/**
 * The teacher's settings of the overall grade (EPIC #2421 / #2426): which assignments
 * are in, their weights, the points of S/A/B/C/未提出 and the cuts.
 *
 * Kept in this browser's localStorage per class (`smalruby:classroomOverallGrade:<groupId>`)
 * so the teacher does not set them again each time. They are not saved on the server
 * yet: the grades they are computed from are, and the settings are cheap to redo.
 * A storage that cannot be read or written is ignored (the screen works without it).
 */
import { useCallback, useEffect, useState } from 'react';
import { defaultOverallSettings } from '../lib/classroom-evaluation/overall-view.js';

const STORAGE_PREFIX = 'smalruby:classroomOverallGrade:';

const storage = () => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (e) {
        return null;
    }
};

/**
 * Read the saved settings of a class.
 * @param {?string} groupId - the class
 * @returns {object} the settings (defaults when nothing is saved)
 */
const loadOverallSettings = (groupId) => {
    const base = defaultOverallSettings();
    const store = groupId ? storage() : null;
    if (!store) return base;
    try {
        const saved = JSON.parse(store.getItem(STORAGE_PREFIX + groupId) || 'null');
        if (!saved || typeof saved !== 'object') return base;
        return {
            included: { ...(saved.included || {}) },
            weights: { ...(saved.weights || {}) },
            points: { ...base.points, ...(saved.points || {}) },
            cuts: { ...base.cuts, ...(saved.cuts || {}) },
        };
    } catch (e) {
        return base;
    }
};

const saveOverallSettings = (groupId, settings) => {
    const store = groupId ? storage() : null;
    if (!store) return;
    try {
        store.setItem(STORAGE_PREFIX + groupId, JSON.stringify(settings));
    } catch (e) {
        // A full or blocked storage only loses the convenience.
    }
};

/**
 * The settings of a class and the setters of the screen.
 * @param {?string} groupId - the class
 * @returns {{settings: object, setIncluded: Function, setWeight: Function, setPoint: Function,
 *   setCut: Function, reset: Function}} the settings and setters (values are kept as typed)
 */
const useOverallGradeSettings = (groupId) => {
    const [settings, setSettings] = useState(() => loadOverallSettings(groupId));
    useEffect(() => {
        setSettings(loadOverallSettings(groupId));
    }, [groupId]);

    const update = useCallback(
        (field, key, value) => {
            setSettings((prev) => {
                const next = { ...prev, [field]: { ...prev[field], [key]: value } };
                saveOverallSettings(groupId, next);
                return next;
            });
        },
        [groupId],
    );
    const setIncluded = useCallback((id, on) => update('included', id, !!on), [update]);
    const setWeight = useCallback((id, value) => update('weights', id, value), [update]);
    const setPoint = useCallback((grade, value) => update('points', grade, value), [update]);
    const setCut = useCallback((grade, value) => update('cuts', grade, value), [update]);
    const reset = useCallback(() => {
        const next = defaultOverallSettings();
        saveOverallSettings(groupId, next);
        setSettings(next);
    }, [groupId]);
    return { settings, setIncluded, setWeight, setPoint, setCut, reset };
};

export { STORAGE_PREFIX, loadOverallSettings };
export default useOverallGradeSettings;
