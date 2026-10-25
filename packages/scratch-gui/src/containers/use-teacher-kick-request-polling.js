import { useEffect, useRef } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import {
    TEACHER_KICK_POLL_INTERVAL_MS,
    nextTeacherKickPollDelay,
    shouldPollTeacherKickRequests,
} from '../lib/classroom-teacher-kick-alerts.js';
import { useDocumentVisible } from './use-kick-request-polling.js';
import { getCachedTeacherIdToken } from './use-teacher-auth.js';

/**
 * Poll the teacher's pending kick requests while a teacher is logged in
 * (#1200), whether or not the class management modal is open. Mounted once
 * for the whole GUI (classroom-teacher-kick-alerts.jsx).
 *
 * Stops while the tab is hidden and asks right away when the teacher logs in
 * or comes back to the tab, so a request made while the teacher was on
 * another tab (slides, etc.) shows up immediately. Consecutive errors back
 * off (nextTeacherKickPollDelay).
 * @param {object} args - arguments.
 * @param {boolean} args.loggedIn - a teacher is logged in.
 * @param {Function} args.onRequests - called with the response
 *   ({requests, activeAssignmentCount}).
 * @param {number} [args.intervalMs] - base interval (tests).
 */
const useTeacherKickRequestPolling = ({ loggedIn, onRequests, intervalMs = TEACHER_KICK_POLL_INTERVAL_MS }) => {
    const visible = useDocumentVisible();
    const onRequestsRef = useRef(onRequests);
    onRequestsRef.current = onRequests;

    const active = shouldPollTeacherKickRequests({ loggedIn, visible });

    useEffect(() => {
        if (!active) return () => {};
        let cancelled = false;
        let timer = null;
        let failures = 0;
        let activeAssignmentCount = null;
        const schedule = () => {
            if (cancelled) return;
            timer = setTimeout(
                tick,
                nextTeacherKickPollDelay({ baseMs: intervalMs, failures, activeAssignmentCount }),
            );
        };
        const tick = async () => {
            const token = getCachedTeacherIdToken();
            if (!token) {
                schedule();
                return;
            }
            try {
                const data = await classroomAPI.listPendingKickRequests(token);
                if (cancelled) return;
                failures = 0;
                activeAssignmentCount =
                    typeof data.activeAssignmentCount === 'number' ? data.activeAssignmentCount : null;
                onRequestsRef.current(data);
            } catch {
                // Network blip or an expired login — keep trying, less often.
                failures += 1;
            }
            schedule();
        };
        tick();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [active, intervalMs]);
};

export default useTeacherKickRequestPolling;
