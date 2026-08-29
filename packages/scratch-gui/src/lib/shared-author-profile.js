/**
 * Author profile persistence for みんなの課題 — EPIC #1066 D6.
 *
 * The public profile is deliberately minimal (display name + optional
 * affiliation; no email, no real-name requirement) and is remembered in
 * localStorage so a teacher types it once.
 */

const STORAGE_KEY = 'smalruby:sharedAuthorProfile';

/**
 * Load the remembered author profile.
 * @returns {{authorName: string, authorAffiliation: string}} the profile
 *     (empty strings when nothing is stored)
 */
export const detectSharedAuthorProfile = () => {
    const empty = { authorName: '', authorAffiliation: '' };
    if (typeof window === 'undefined' || !window.localStorage) return empty;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw);
        return {
            authorName: typeof parsed.authorName === 'string' ? parsed.authorName : '',
            authorAffiliation: typeof parsed.authorAffiliation === 'string' ? parsed.authorAffiliation : '',
        };
    } catch {
        return empty;
    }
};

/**
 * Remember the author profile for the next share.
 * @param {{authorName: string, authorAffiliation?: string}} profile - profile to store
 */
export const persistSharedAuthorProfile = (profile) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                authorName: profile.authorName || '',
                authorAffiliation: profile.authorAffiliation || '',
            }),
        );
    } catch {
        // Storage may be unavailable (private mode) — sharing still works.
    }
};
