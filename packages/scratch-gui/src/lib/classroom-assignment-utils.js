/**
 * Pure helpers for the classroom assignment editor (teacher side).
 *
 * The editor keeps pages as plain objects:
 *   {text, imageKey?, imageUrl?, newImageBlob?, newImageType?, previewUrl?}
 * and the starter as a mode string: 'none' | 'keep' | 'new'.
 * These helpers turn that editor state into the PUT payload the backend
 * expects and validate client-side limits (mirrors the Lambda validation).
 */

const MAX_ASSIGNMENT_PAGES = 10;
const MAX_ASSIGNMENT_PAGE_TEXT_LENGTH = 500;
const ASSIGNMENT_IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg'];
// "Peer view" (#1208): whether students may see classmates' submission images.
// Mirrors PEER_VIEW_VALUES in the Lambda (#1239).
const PEER_VIEW_VALUES = ['none', 'always', 'afterSubmit'];

/**
 * Normalize a peerView value from the server (old assignments have none).
 * @param {*} value - Raw value
 * @returns {string} One of PEER_VIEW_VALUES ('none' when unknown)
 */
const normalizePeerView = (value) => (PEER_VIEW_VALUES.includes(value) ? value : 'none');

/**
 * Build the PUT /classrooms/{id}/assignment payload from editor state.
 * @param {Array<object>} editorPages - Editor page objects
 * @param {string} starterMode - 'none' | 'keep' | 'new'
 * @param {boolean} [startFromPrevious] - "start from the previous submission" setting
 * @param {string} [peerView] - "peer view" setting (one of PEER_VIEW_VALUES)
 * @returns {object} Request payload {pages, newStarter?, keepStarter?, startFromPrevious?, peerView?}
 */
const buildAssignmentPayload = (editorPages, starterMode, startFromPrevious, peerView) => {
    const pages = (editorPages || []).map((page) => {
        if (page.newImageType) {
            return { text: page.text, newImage: page.newImageType };
        }
        if (page.imageKey) {
            return { text: page.text, imageKey: page.imageKey };
        }
        return { text: page.text };
    });
    const payload = { pages };
    if (starterMode === 'new') {
        payload.newStarter = true;
    } else if (starterMode === 'keep') {
        payload.keepStarter = true;
    }
    // Omitted unless given so the server keeps the stored value (#1202).
    if (typeof startFromPrevious === 'boolean') {
        payload.startFromPrevious = startFromPrevious;
    }
    if (PEER_VIEW_VALUES.includes(peerView)) {
        payload.peerView = peerView;
    }
    return payload;
};

/**
 * Validate editor pages against client-side limits.
 * @param {Array<object>} editorPages - Editor page objects
 * @returns {?object} null when valid, otherwise {error, pageIndex?}
 *   where error is 'tooManyPages' | 'textTooLong' | 'badImageType'
 */
const validateEditorPages = (editorPages) => {
    const pages = editorPages || [];
    if (pages.length > MAX_ASSIGNMENT_PAGES) {
        return { error: 'tooManyPages' };
    }
    for (let i = 0; i < pages.length; i++) {
        if ((pages[i].text || '').length > MAX_ASSIGNMENT_PAGE_TEXT_LENGTH) {
            return { error: 'textTooLong', pageIndex: i };
        }
        if (pages[i].newImageType && !ASSIGNMENT_IMAGE_CONTENT_TYPES.includes(pages[i].newImageType)) {
            return { error: 'badImageType', pageIndex: i };
        }
    }
    return null;
};

/**
 * Whether the editor state represents an empty assignment (clears it on save).
 * @param {Array<object>} editorPages - Editor page objects
 * @param {string} starterMode - 'none' | 'keep' | 'new'
 * @returns {boolean} true when saving would clear the assignment
 */
const isEmptyAssignment = (editorPages, starterMode) => (editorPages || []).length === 0 && starterMode === 'none';

/**
 * Move an element within an array, returning a new array.
 * @param {Array} items - Source array
 * @param {number} from - Source index
 * @param {number} to - Destination index
 * @returns {Array} New array (same array reference if the move is a no-op)
 */
const moveItem = (items, from, to) => {
    if (to < 0 || to >= items.length || from === to) return items;
    const next = items.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
};

export {
    MAX_ASSIGNMENT_PAGES,
    MAX_ASSIGNMENT_PAGE_TEXT_LENGTH,
    ASSIGNMENT_IMAGE_CONTENT_TYPES,
    PEER_VIEW_VALUES,
    buildAssignmentPayload,
    normalizePeerView,
    validateEditorPages,
    isEmptyAssignment,
    moveItem,
};
