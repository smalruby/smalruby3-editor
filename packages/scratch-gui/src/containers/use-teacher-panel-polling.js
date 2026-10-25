import { useCallback, useEffect, useRef } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import { TEACHER_PANEL_POLL_INTERVAL_MS, shouldPollTeacherPanel } from '../lib/classroom-teacher-panel.js';
import { useDocumentVisible } from './use-kick-request-polling.js';
import { getCachedTeacherIdToken } from './use-teacher-auth.js';
import { enrichMembers } from './use-teacher-classrooms.js';

/**
 * Poll the members / submissions of the assignment shown in the teacher's
 * floating status panel (#1203). Runs only while the panel is open and the
 * tab is visible (same cost policy as the members tab of class management);
 * it asks right away when the panel opens, the assignment changes or the
 * teacher comes back to the tab. Kick requests are not fetched here — they
 * come from the GUI-wide teacher poller (#1200).
 * @param {object} args - arguments.
 * @param {boolean} args.open - the panel is shown.
 * @param {boolean} args.loggedIn - a teacher is logged in.
 * @param {?string} args.classroomId - the assignment shown.
 * @param {Function} args.onMembers - called with (classroomId, enriched members).
 * @param {Function} [args.onError] - called with the error of a failed poll.
 * @param {number} [args.intervalMs] - interval (tests).
 * @returns {{refresh: Function}} `refresh()` fetches now (manual refresh button).
 */
const useTeacherPanelPolling = ({
    open,
    loggedIn,
    classroomId,
    onMembers,
    onError,
    intervalMs = TEACHER_PANEL_POLL_INTERVAL_MS,
}) => {
    const visible = useDocumentVisible();
    const onMembersRef = useRef(onMembers);
    onMembersRef.current = onMembers;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const fetchNow = useCallback(async (id) => {
        const token = getCachedTeacherIdToken();
        if (!token || !id) return;
        try {
            const [membersData, submissionsData] = await Promise.all([
                classroomAPI.listMembers(token, id),
                classroomAPI.listSubmissions(token, id),
            ]);
            onMembersRef.current(id, enrichMembers(membersData, submissionsData));
        } catch (err) {
            if (onErrorRef.current) onErrorRef.current(err);
        }
    }, []);

    const active = shouldPollTeacherPanel({ open, loggedIn, visible, classroomId });

    useEffect(() => {
        if (!active) return () => {};
        let cancelled = false;
        let timer = null;
        const tick = async () => {
            await fetchNow(classroomId);
            if (!cancelled) timer = setTimeout(tick, intervalMs);
        };
        tick();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [active, classroomId, intervalMs, fetchNow]);

    const refresh = useCallback(() => fetchNow(classroomId), [fetchNow, classroomId]);
    return { refresh };
};

export default useTeacherPanelPolling;
