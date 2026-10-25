import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loadPendingKickRequest } from '../lib/classroom-kick-request-storage.js';
import { openClassroomModal } from '../reducers/classroom.js';
import useKickRequestPolling from './use-kick-request-polling.js';

/**
 * Keeps watching a pending kick request while the classroom modal is closed
 * (#1198). The pending banner tells the student they may use Smalruby while
 * waiting, so the answer must still reach them: when the teacher approves
 * (or rejects) the request, the modal is reopened and picks up from the
 * request saved in localStorage — joining the freed seat automatically.
 * @returns {null} renders nothing.
 */
const ClassroomKickRequestWatcher = () => {
    const dispatch = useDispatch();
    // Always mounted (unlike the modal), so it must survive embeds that omit
    // the classroom reducer.
    const hasSession = useSelector((state) => !!state.scratchGui.classroom?.sessionToken);
    const [pending, setPending] = useState(() => loadPendingKickRequest());

    const handleResult = useCallback(
        (outcome) => {
            if (outcome === 'waiting') return;
            setPending(null);
            if (outcome !== 'expired') dispatch(openClassroomModal());
        },
        [dispatch],
    );

    useKickRequestPolling({ pending, enabled: true, hasSession, onResult: handleResult });
    return null;
};

export default ClassroomKickRequestWatcher;
