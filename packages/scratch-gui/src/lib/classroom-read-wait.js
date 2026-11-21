/**
 * How long the start buttons wait right after joining (「よく読もう… 3」).
 *
 * Children pressed the blue start button without reading the assignment. Right after joining,
 * the start buttons on the last page become pressable only after a short wait that grows with
 * the page's text: 2 s for a short page, one more second for every 50 characters, at most 5 s.
 * When the assignment has earlier pages, the student has already paged through them, so the
 * last page waits about half as long (1–3 s). Reopening the panel from 「課題を見る」 never
 * waits (the caller does not ask). Pure: the timer itself is use-read-countdown.js.
 */

export const READ_WAIT_MIN_SECONDS = 2;
export const READ_WAIT_MAX_SECONDS = 5;
// One more second for every this many characters.
export const READ_WAIT_CHARS_PER_SECOND = 50;
// The goal card of a lesson assignment counts as this many characters (one more second).
export const READ_WAIT_GOAL_CHARS = 50;

/**
 * @param {object} params - inputs
 * @param {number} [params.textLength] - the characters on the last page (text + goal card)
 * @param {boolean} [params.readEarlierPages] - the assignment has earlier pages the student paged through
 * @returns {number} whole seconds to wait (1–5)
 */
export const readWaitSeconds = ({ textLength = 0, readEarlierPages = false } = {}) => {
    const length = Number.isFinite(textLength) && textLength > 0 ? textLength : 0;
    const base = Math.min(
        READ_WAIT_MAX_SECONDS,
        READ_WAIT_MIN_SECONDS + Math.floor(length / READ_WAIT_CHARS_PER_SECOND),
    );
    return readEarlierPages ? Math.max(1, Math.ceil(base / 2)) : base;
};
