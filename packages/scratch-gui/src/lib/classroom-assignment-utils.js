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

/**
 * Build the PUT /classrooms/{id}/assignment payload from editor state.
 * @param {Array<object>} editorPages - Editor page objects
 * @param {string} starterMode - 'none' | 'keep' | 'new'
 * @returns {object} Request payload {pages, newStarter?, keepStarter?}
 */
const buildAssignmentPayload = (editorPages, starterMode) => {
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
    buildAssignmentPayload,
    validateEditorPages,
    isEmptyAssignment,
    moveItem,
};
