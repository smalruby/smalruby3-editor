import { useEffect, useRef, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import { loadPendingKickRequest } from '../lib/classroom-kick-request-storage.js';
import {
    KICK_REQUEST_POLL_INTERVAL_MS,
    evaluateKickRequestPoll,
    shouldPollKickRequest,
} from '../lib/classroom-seat-selection.js';

const isDocumentVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Track `document.visibilityState` so polling can pause while the tab is
 * hidden (#1198).
 * @returns {boolean} true while the page is visible.
 */
const useDocumentVisible = () => {
    const [visible, setVisible] = useState(isDocumentVisible);
    useEffect(() => {
        if (typeof document === 'undefined') return () => {};
        const handleChange = () => setVisible(isDocumentVisible());
        document.addEventListener('visibilitychange', handleChange);
        return () => document.removeEventListener('visibilitychange', handleChange);
    }, []);
    return visible;
};

/**
 * Poll the classroom lookup while a kick request is pending and report the
 * teacher's answer (#1198). Shared by the classroom modal and the
 * background watcher that runs while the modal is closed.
 *
 * Polling runs only while the request is alive (the 1h localStorage TTL),
 * the tab is visible and the student has not joined.
 * @param {object} args - arguments.
 * @param {?object} args.pending - the pending kick request.
 * @param {boolean} args.enabled - extra caller-side condition.
 * @param {boolean} args.hasSession - the student already joined a class.
 * @param {Function} args.onResult - called with (`approved`|`rejected`|`expired`, lookupData).
 */
const useKickRequestPolling = ({ pending, enabled, hasSession, onResult }) => {
    const visible = useDocumentVisible();
    const onResultRef = useRef(onResult);
    onResultRef.current = onResult;

    const active = enabled && shouldPollKickRequest({ pending, visible, hasSession });

    // Coming back to the tab checks right away instead of waiting a full
    // interval, so an approval given while the tab was hidden shows up.
    const wasHiddenRef = useRef(false);
    useEffect(() => {
        if (!visible) wasHiddenRef.current = true;
    }, [visible]);

    useEffect(() => {
        if (!active) return () => {};
        const firstDelay = wasHiddenRef.current ? 0 : KICK_REQUEST_POLL_INTERVAL_MS;
        wasHiddenRef.current = false;
        let cancelled = false;
        let timer = null;
        const tick = async () => {
            const stored = loadPendingKickRequest();
            if (!stored || stored.requestId !== pending.requestId) {
                // Expired (TTL) or cleared elsewhere — stop asking the server.
                onResultRef.current('expired', null);
                return;
            }
            try {
                const data = await classroomAPI.lookupClassroom(pending.joinCode);
                if (cancelled) return;
                const outcome = evaluateKickRequestPoll(pending, data);
                if (outcome === 'waiting') {
                    timer = setTimeout(tick, KICK_REQUEST_POLL_INTERVAL_MS);
                }
                onResultRef.current(outcome, data);
            } catch {
                // Network blip — try again on next tick.
                if (!cancelled) timer = setTimeout(tick, KICK_REQUEST_POLL_INTERVAL_MS);
            }
        };
        timer = setTimeout(tick, firstDelay);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [active, pending]);
};

export default useKickRequestPolling;
export { useDocumentVisible };
