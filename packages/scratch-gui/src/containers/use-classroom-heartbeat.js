import { useEffect } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import { HEARTBEAT_INTERVAL_MS } from '../lib/classroom-presence.js';

/**
 * Responses that mean the session is over: 410 = kicked by the teacher,
 * 401 = unknown/expired token or the classroom was archived. Retrying cannot
 * succeed, so the heartbeat stops. The session itself is left alone — the
 * classroom modal's verify-session flow already shows the kicked banner /
 * "session expired" message the next time the student opens it.
 * @param {?Error} err - rejection from classroomAPI.heartbeat
 * @returns {boolean} true when the session can no longer be refreshed
 */
const isSessionEnded = (err) => !!err && (err.status === 410 || err.status === 401);

/**
 * Keep a joined student's `lastActiveAt` fresh so the teacher's "seated"
 * indicator reflects who is actually working (issue #1197). Pings once on
 * start and then every `intervalMs`; pauses while the tab is hidden and pings
 * again as soon as it is shown. Transient failures (network, 5xx) are ignored.
 * @param {object} options - hook options
 * @param {?string} options.sessionToken - student session token (null when not joined)
 * @param {number} [options.intervalMs] - ping interval in ms
 */
const useClassroomHeartbeat = ({ sessionToken, intervalMs = HEARTBEAT_INTERVAL_MS }) => {
    useEffect(() => {
        if (!sessionToken) return;

        let timer = null;
        let ended = false;
        let disposed = false;

        const stop = () => {
            if (timer !== null) {
                clearInterval(timer);
                timer = null;
            }
        };

        const ping = () => {
            classroomAPI.heartbeat(sessionToken).catch((err) => {
                if (!disposed && isSessionEnded(err)) {
                    ended = true;
                    stop();
                }
            });
        };

        const start = () => {
            if (ended || timer !== null || document.hidden) return;
            ping();
            timer = setInterval(ping, intervalMs);
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stop();
            } else {
                start();
            }
        };

        start();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            disposed = true;
            stop();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [sessionToken, intervalMs]);
};

export default useClassroomHeartbeat;
