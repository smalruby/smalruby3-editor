import { useEffect, useRef } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import { setRubyteeEnabled, setStudentGenai } from '../reducers/classroom.js';

/**
 * Read the class's AI settings (generative AI #1279, Rubytee #1278) again once
 * when the page opens. They are kept with the session in localStorage, so
 * without this a teacher turning them off reached the student only when the
 * classroom modal ran verify-session, and reloading the page kept the old value.
 *
 * A session the server rejects (401 / 410) hides both; the modal tells the
 * student about the session when it is opened. Network errors keep what was saved.
 * @param {object} args - arguments.
 * @param {?string} args.role - classroom role.
 * @param {?string} args.sessionToken - the student's session at page load.
 * @param {Function} args.dispatch - redux dispatch.
 */
const useStudentClassSettingsRefresh = ({ role, sessionToken, dispatch }) => {
    // The session as of now: an answer for a session the student already left
    // or replaced (join tells the new class's settings) is dropped.
    const tokenRef = useRef(sessionToken);
    tokenRef.current = sessionToken;
    const atLoad = useRef({ role, sessionToken });

    useEffect(() => {
        const { role: loadRole, sessionToken: token } = atLoad.current;
        if (loadRole !== 'student' || !token) return;
        classroomAPI
            .verifySession(token)
            .then((result) => {
                if (token !== tokenRef.current) return;
                dispatch(setStudentGenai(result.genai));
                dispatch(setRubyteeEnabled(!!(result.rubytee && result.rubytee.enabled === true)));
            })
            .catch((err) => {
                if (token !== tokenRef.current) return;
                if (err && (err.status === 401 || err.status === 410)) {
                    dispatch(setStudentGenai(null));
                    dispatch(setRubyteeEnabled(false));
                }
            });
    }, [dispatch]);
};

export default useStudentClassSettingsRefresh;
