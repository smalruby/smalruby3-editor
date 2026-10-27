/**
 * Pure helpers for the student's "みんなの作品を見る" panel (#1210): the
 * classmates' submissions of the same assignment, shown as images only
 * (stage thumbnail + each sprite's block image). The .sb3 is never offered
 * (the API does not return it, #1239), so a student can look for good ideas
 * but cannot copy the work.
 *
 * The panel fetches only when it opens and on the manual refresh button —
 * no polling, since up to 40 students may open it (cost policy, #1197).
 */

// The presigned image URLs live one hour (PRESIGNED_URL_DOWNLOAD_EXPIRY of
// the Lambda). The list is read again before opening a seat once it is this
// old, so an expired image recovers without the student doing anything.
const PEER_LIST_MAX_AGE_MS = 50 * 60 * 1000;

/**
 * @param {?number} fetchedAt - when the list was read (ms epoch), null when never
 * @param {number} now - current time in ms epoch
 * @returns {boolean} whether the image URLs should be read again
 */
const isPeerListStale = (fetchedAt, now) => !fetchedAt || now - fetchedAt >= PEER_LIST_MAX_AGE_MS;

/**
 * Whether the classroom screen offers the entry, and how.
 * @param {?string} peerView - the assignment's setting ('none' | 'always' |
 *     'afterSubmit'), or null/undefined while not known yet
 * @param {boolean} hasSubmitted - the student has submitted this assignment
 * @returns {'hidden'|'locked'|'open'} hidden: not offered, locked: shown with
 *     "提出すると見られます", open: the panel can be opened
 */
const peerViewEntryState = (peerView, hasSubmitted) => {
    if (peerView === 'none') return 'hidden';
    if (peerView === 'afterSubmit' && !hasSubmitted) return 'locked';
    // 'always', or not known yet: the server answers with the reason (403)
    // when the panel opens, so an unknown setting never shows anything wrong.
    return 'open';
};

/**
 * Classify a failed peer-submissions request.
 * @param {?object} err - error thrown by classroomAPI (status / body)
 * @returns {'off'|'notSubmitted'|'ended'|'failed'} what the panel should say
 */
const peerViewErrorState = (err) => {
    const status = err && err.status;
    const reason = err && err.body && err.body.reason;
    if (status === 403 && reason === 'peer-view-off') return 'off';
    if (status === 403 && reason === 'not-submitted') return 'notSubmitted';
    if (status === 401 || status === 404) return 'ended';
    return 'failed';
};

/**
 * One cell per seat for the mini grid. Students do not know the seat count of
 * the assignment, so the grid runs up to the largest seat known (submitted
 * seats and the own seat) unless a count is given.
 * @param {object} params - inputs
 * @param {Array<object>} params.submissions - classmates' submissions ({seatNumber, ...})
 * @param {?number} params.ownSeatNumber - the student's own seat
 * @param {number} [params.seatCount] - seats of the assignment, when known
 * @returns {Array<{seatNumber: number, submitted: boolean, own: boolean, submission: ?object}>} cells
 */
const buildPeerSeats = ({ submissions, ownSeatNumber, seatCount }) => {
    const bySeat = {};
    for (const s of submissions || []) {
        if (s && s.seatNumber > 0) bySeat[s.seatNumber] = s;
    }
    const known = Object.keys(bySeat).map(Number);
    if (ownSeatNumber > 0) known.push(ownSeatNumber);
    const count = Math.max(seatCount || 0, ...known, 0);
    return Array.from({ length: count }, (_, i) => {
        const seatNumber = i + 1;
        const own = seatNumber === ownSeatNumber;
        const submission = own ? null : bySeat[seatNumber] || null;
        return { seatNumber, submitted: !!submission, own, submission };
    });
};

/**
 * Only classmates' submitted seats can be opened (not the own seat).
 * @param {?object} seat - a cell of buildPeerSeats
 * @returns {boolean} whether the seat button is enabled
 */
const isPeerSeatSelectable = (seat) => !!seat && !!seat.submitted && !seat.own;

/**
 * Images for the image viewer: the stage thumbnail first, then each sprite's
 * block image named by the sprite. Old submissions have no sprite names
 * (screenshotLabels, #1208), so those fall back to "スプライト N".
 * @param {?object} submission - a peer submission
 * @param {{stage: string, sprite: function(number): string}} labels - localized names
 * @returns {Array<{name: string, src: string}>} viewer images
 */
const peerViewerImages = (submission, labels) => {
    if (!submission) return [];
    const images = [];
    if (submission.thumbnailUrl) {
        images.push({ name: labels.stage, src: submission.thumbnailUrl });
    }
    const names = submission.screenshotLabels || [];
    (submission.screenshotUrls || []).forEach((src, i) => {
        if (!src) return;
        images.push({ name: names[i] || labels.sprite(i + 1), src });
    });
    return images;
};

export {
    PEER_LIST_MAX_AGE_MS,
    isPeerListStale,
    peerViewEntryState,
    peerViewErrorState,
    buildPeerSeats,
    isPeerSeatSelectable,
    peerViewerImages,
};
