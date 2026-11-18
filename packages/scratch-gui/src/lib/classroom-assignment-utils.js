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
// Mesh group size limit (#1257): 6 = "up to 6", 0 = "no limit". Mirrors
// validateMeshGroupLimit in the Lambda (#1255). New assignments get 6.
const MESH_GROUP_LIMIT_VALUES = [6, 0];
const DEFAULT_MESH_GROUP_LIMIT = 6;

/**
 * Normalize a peerView value from the server (old assignments have none).
 * @param {*} value - Raw value
 * @returns {string} One of PEER_VIEW_VALUES ('none' when unknown)
 */
const normalizePeerView = (value) => (PEER_VIEW_VALUES.includes(value) ? value : 'none');

/**
 * Normalize a meshGroupLimit value (from the server or a <select>).
 * Assignments made before #1255 have none — the server reports them as 0
 * ("no limit"), and so does this.
 * @param {*} value - Raw value (number or numeric string)
 * @returns {number} One of MESH_GROUP_LIMIT_VALUES (0 when unknown)
 */
const normalizeMeshGroupLimit = (value) => {
    const n = Number(value);
    return value !== null && MESH_GROUP_LIMIT_VALUES.includes(n) ? n : 0;
};

/**
 * Build the PUT /classrooms/{id}/assignment payload from editor state.
 * @param {Array<object>} editorPages - Editor page objects
 * @param {string} starterMode - 'none' | 'keep' | 'new'
 * @param {string} [peerView] - "peer view" setting (one of PEER_VIEW_VALUES)
 * @returns {object} Request payload {pages, newStarter?, keepStarter?, peerView?}
 */
const buildAssignmentPayload = (editorPages, starterMode, peerView) => {
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
    // The old "start from the previous submission" setting (#1202) is no
    // longer sent: the server keeps the stored value when it is omitted, and
    // the GUI does not read it any more (#1825).
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

/**
 * What an opened row of the assignment board shows (#1301): the counts and the
 * first line of the description. Built from the existing teacher APIs
 * (listMembers + listSubmissions joined by enrichMembers, and getAssignment).
 * @param {object} params - inputs
 * @param {Array<object>} [params.members] - enriched members
 * @param {number} [params.studentCount] - seats of the assignment
 * @param {?object} [params.assignment] - `assignment` of getAssignment (pages)
 * @returns {{submitted: number, joined: number, capacity: number, descriptionLine: string}} summary
 */
const summarizeAssignmentRow = ({ members, studentCount, assignment } = {}) => {
    const joined = (members || []).filter((m) => !m.left);
    const firstPage = assignment && Array.isArray(assignment.pages) ? assignment.pages[0] : null;
    const lines = String((firstPage && firstPage.text) || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    return {
        submitted: joined.filter((m) => m.hasSubmission).length,
        joined: joined.length,
        capacity: studentCount || 0,
        descriptionLine: lines[0] || '',
    };
};

/**
 * The fields of a page that saving would change: its text and its image (the
 * stored one, or a newly attached one that is not uploaded yet).
 * @param {object} page - editor page ({text, imageKey, newImageBlob})
 * @returns {string} a key that is equal for pages that save the same
 */
const pageSaveKey = (page) =>
    JSON.stringify([(page && page.text) || '', (page && page.imageKey) || null, Boolean(page && page.newImageBlob)]);

/**
 * Whether the assignment detail holds changes that are not saved (#2089 N3).
 * The ✕ of the detail asks「変更を破棄しますか？」only then: the description
 * pages, the starter, the advanced settings or the lesson differ from what
 * was loaded (or last saved). The assignment name is not counted: it is saved
 * when its field loses the focus, which pressing ✕ does first.
 * @param {object} state - the editor's current and stored values
 * @param {Array<object>} state.pages - the pages in the editor
 * @param {Array<object>} state.savedPages - the pages as loaded / last saved
 * @param {string} state.starterMode - 'none' | 'keep' | 'new'
 * @param {string} state.savedStarterMode - the starter mode as loaded
 * @param {string} state.peerView - the chosen peer view
 * @param {string} state.savedPeerView - the stored peer view
 * @param {number} state.meshGroupLimit - the chosen mesh group size
 * @param {number} state.savedMeshGroupLimit - the stored mesh group size
 * @param {boolean} [state.lessonChanged] - the lesson draft differs from the stored lesson
 * @returns {boolean} true when leaving would lose a change
 */
const hasUnsavedAssignmentChanges = ({
    pages,
    savedPages,
    starterMode,
    savedStarterMode,
    peerView,
    savedPeerView,
    meshGroupLimit,
    savedMeshGroupLimit,
    lessonChanged = false,
}) => {
    if (lessonChanged) return true;
    if (starterMode !== savedStarterMode) return true;
    if (normalizePeerView(peerView) !== normalizePeerView(savedPeerView)) return true;
    if (normalizeMeshGroupLimit(meshGroupLimit) !== normalizeMeshGroupLimit(savedMeshGroupLimit)) return true;
    const current = (pages || []).map(pageSaveKey);
    const saved = (savedPages || []).map(pageSaveKey);
    return current.length !== saved.length || current.some((key, i) => key !== saved[i]);
};

export {
    MAX_ASSIGNMENT_PAGES,
    MAX_ASSIGNMENT_PAGE_TEXT_LENGTH,
    ASSIGNMENT_IMAGE_CONTENT_TYPES,
    DEFAULT_MESH_GROUP_LIMIT,
    MESH_GROUP_LIMIT_VALUES,
    PEER_VIEW_VALUES,
    buildAssignmentPayload,
    hasUnsavedAssignmentChanges,
    normalizeMeshGroupLimit,
    normalizePeerView,
    validateEditorPages,
    isEmptyAssignment,
    moveItem,
    summarizeAssignmentRow,
};
