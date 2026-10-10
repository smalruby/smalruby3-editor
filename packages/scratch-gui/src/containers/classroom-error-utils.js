/**
 * Translate a Google Classroom proxy failure (`reason` starting with `google`)
 * into a localized, actionable message. Returns null when the error did not
 * come from the Google Classroom proxy so the caller can fall through to the
 * regular classroom branches.
 * @param {object} intl - react-intl intl object
 * @param {Error} err - Error from a classroom API call
 * @returns {?string} Localized message, or null when not a Google failure.
 */
const translateGoogleClassroomError = (intl, err) => {
    // `body.reason` comes from the API proxy; `googleReason` is set client-side
    // (e.g. the teacher unticked a scope on the Google consent screen).
    const body = (err && err.body) || {};
    const reason = body.reason || (err && err.googleReason);
    if (typeof reason !== 'string' || !reason.startsWith('google')) return null;

    if (reason === 'googleTokenExpired') {
        return intl.formatMessage({
            defaultMessage:
                'Your Google authorization has expired. Please try again and allow access to Google Classroom.',
            description: 'Error when the Google Classroom access token is no longer valid',
            id: 'gui.classroom.error.googleTokenExpired',
        });
    }
    if (reason === 'googlePermissionDenied') {
        return intl.formatMessage({
            defaultMessage:
                'Smalruby is not allowed to post to this Google Classroom class. Sign in again and allow ' +
                'every requested permission, and check that you are a teacher of the class.',
            description: 'Error when Google Classroom denies the post (missing scope or not a teacher)',
            id: 'gui.classroom.error.googlePermissionDenied',
        });
    }
    if (reason === 'googleNotCourseTeacher') {
        // Google answers 404 for a course the caller is not in, so this is the
        // co-teacher case from issue #1184 — not a missing class. Name the
        // cause and the way out (ask the teacher who linked it); the linking
        // teacher's address is not in the error, so stay generic here.
        return intl.formatMessage({
            defaultMessage:
                'You are not a teacher of the linked Google Classroom class, so it cannot be shared ' +
                'from your account. Please ask the teacher who linked it to share it.',
            description: 'Error when the signed-in teacher is not a teacher of the linked Google Classroom course',
            id: 'gui.classroom.error.googleNotCourseTeacher',
        });
    }
    if (reason === 'googleCourseNotFound') {
        return intl.formatMessage({
            defaultMessage:
                'The linked Google Classroom class could not be found. It may have been deleted, or the ' +
                'Google account you signed in with may not be a teacher of that class.',
            description: 'Error when the linked Google Classroom course is missing or inaccessible',
            id: 'gui.classroom.error.googleCourseNotFound',
        });
    }

    // googleInvalidRequest / googleApiError: Google rejected the request for a
    // reason we cannot map. Show its own status and message so the teacher can
    // report something actionable.
    const detail = [body.googleStatus, body.googleMessage].filter(Boolean).join(': ');
    if (detail) {
        return intl.formatMessage(
            {
                defaultMessage: 'Could not post to Google Classroom. (Google: {detail})',
                description: 'Error when Google Classroom rejects the post, with the Google-provided detail',
                id: 'gui.classroom.error.googleApiFailedDetail',
            },
            { detail },
        );
    }
    return intl.formatMessage({
        defaultMessage: 'Could not post to Google Classroom. Please wait a moment and try again.',
        description: 'Error when posting to Google Classroom fails for an unknown reason',
        id: 'gui.classroom.error.googleApiFailed',
    });
};

/**
 * Translate known API error messages to localized user-friendly messages.
 * @param {object} intl - react-intl intl object
 * @param {Error} err - Error from API call
 * @param {string} context - Error context ('join', 'seat', 'session', 'general')
 * @returns {string} Localized error message
 */
const translateError = (intl, err, context = 'general') => {
    const msg = err.message || '';
    const status = err.status;

    // Network reachability failure (fetch rejected with a TypeError). Take
    // precedence over every HTTP/context branch: there is no HTTP status here,
    // and the raw "Failed to fetch" is useless to the user. Show the host and
    // point at the network/firewall so the failure can be self-diagnosed.
    if (err.isNetworkError) {
        return intl.formatMessage(
            {
                defaultMessage:
                    'Could not connect to the server. Please check that your network or ' +
                    'firewall allows access to {host} (HTTPS / port 443).',
                description: 'Error when the classroom API host is unreachable (DNS/firewall/offline)',
                id: 'gui.classroom.error.networkUnreachable',
            },
            { host: err.endpointHost || '' },
        );
    }

    // Google Classroom proxy failures. Checked before the generic HTTP branches
    // because their statuses overlap (a 401 here is an expired *Google* token,
    // not an expired classroom session) and because the raw server message
    // ("Google Classroom API error") is useless to a teacher (issue #1175).
    const googleMessage = translateGoogleClassroomError(intl, err);
    if (googleMessage) return googleMessage;

    if (context === 'join' && (status === 404 || msg.includes('Invalid join code'))) {
        return intl.formatMessage({
            defaultMessage: 'Could not join the classroom. Please check the join code and try again.',
            description: 'Error when join code is invalid',
            id: 'gui.classroom.error.invalidJoinCode',
        });
    }
    if (context === 'seat' && (status === 409 || msg.includes('already taken'))) {
        return intl.formatMessage({
            defaultMessage: 'This seat is already taken. Please choose a different seat.',
            description: 'Error when seat is already taken',
            id: 'gui.classroom.error.seatTaken',
        });
    }
    if (context === 'session' || msg.includes('Invalid or expired session') || status === 401) {
        return intl.formatMessage({
            defaultMessage: 'Your session has expired. Please rejoin the classroom.',
            description: 'Error when session token is invalid',
            id: 'gui.classroom.error.sessionExpired',
        });
    }
    if (msg.includes('no longer active')) {
        return intl.formatMessage({
            defaultMessage: 'This classroom is no longer active.',
            description: 'Error when classroom is archived',
            id: 'gui.classroom.error.classroomInactive',
        });
    }
    return (
        msg ||
        intl.formatMessage({
            defaultMessage: 'An unexpected error occurred. Please try again.',
            description: 'Generic error message',
            id: 'gui.classroom.error.generic',
        })
    );
};

/**
 * If the error represents a kick (verify-session returned 410 with
 * reason='kicked'), return the kick context so the UI can navigate the
 * student back into seat selection for the same classroom. Returns null
 * otherwise.
 * @param {*} err - Value thrown from a classroom API call
 * @returns {?{joinCode: string, className: string, seatNumber: number}}
 *   Kick context, or null if the error is not a kick.
 */
const extractKickReason = (err) => {
    if (!err || typeof err !== 'object') return null;
    if (err.status !== 410) return null;
    const body = err.body;
    if (!body || body.reason !== 'kicked') return null;
    return {
        joinCode: body.joinCode || '',
        className: body.className || '',
        seatNumber: body.seatNumber || 0,
    };
};

export { translateError, extractKickReason };
export default translateError;
