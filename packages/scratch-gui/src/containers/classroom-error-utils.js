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
