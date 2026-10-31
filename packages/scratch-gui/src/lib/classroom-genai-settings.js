/**
 * Class-level generative AI / Rubytee settings edited by the teacher
 * (issue #1277). The server (#1275) is the authority; these helpers mirror its
 * rules so the 3-step form can explain a problem before the teacher saves.
 */

/** Services a class can offer. Claude is not here: its terms are 18+. */
export const GENAI_SERVICES = ['gemini', 'chatgpt', 'other'];

/** Same defaults as the server, so "change nothing" keeps the stored URL. */
export const GENAI_DEFAULT_URLS = {
    gemini: 'https://gemini.google.com/app',
    chatgpt: 'https://chatgpt.com/',
    other: '',
};

// Adult-only services stay blocked even through the free-form "other" URL.
const ADULT_ONLY_HOSTS = ['claude.ai', 'claude.com', 'anthropic.com'];

const isService = (value) => GENAI_SERVICES.includes(value);

/** What "use it" starts from: nothing chosen and nothing confirmed. */
export const FRESH_GENAI = { service: null, url: '', confirmed: false };

/**
 * Editable copy of a class's AI settings. Classes without settings read as
 * "both disabled".
 * @param {object} group - the class as returned by the teacher API
 * @returns {object} {use, service, url, confirmed, rubytee}
 */
export const draftFromGroup = (group) => {
    const genai = (group && group.genai) || {};
    const service = isService(genai.service) ? genai.service : null;
    const use = genai.enabled === true && service !== null;
    const rubytee = Boolean(group && group.rubytee && group.rubytee.enabled === true);
    // A class that doesn't use generative AI starts the 3 steps from scratch,
    // instead of reviving the service and confirmation chosen before it was turned off.
    if (!use) return { use: false, ...FRESH_GENAI, rubytee };
    return {
        use,
        service,
        url: typeof genai.url === 'string' ? genai.url : '',
        confirmed: genai.confirmed === true,
        rubytee,
    };
};

/**
 * Check the URL the students will open.
 * @param {string} url - the URL typed by the teacher
 * @returns {?string} null when valid, otherwise 'required' / 'https' / 'adultOnly'
 */
export const validateGenaiUrl = (url) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return 'required';
    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch (e) {
        return 'https';
    }
    if (parsed.protocol !== 'https:') return 'https';
    const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
    if (ADULT_ONLY_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
        return 'adultOnly';
    }
    return null;
};

/**
 * Whether the server would accept the draft: enabling needs a service, the
 * teacher's confirmation of its terms and a valid URL.
 * @param {object} draft - see draftFromGroup
 * @returns {boolean} true when it can be saved
 */
export const isDraftSavable = (draft) => {
    if (!draft.use) return true;
    return isService(draft.service) && draft.confirmed && validateGenaiUrl(draft.url) === null;
};

/**
 * The PATCH body fields for the AI settings, only for what changed, so saving
 * a renamed class never touches (or re-validates) its AI settings.
 * @param {object} group - the stored class
 * @param {object} draft - the edited settings (see draftFromGroup)
 * @returns {object} `{genai?, rubytee?}`
 */
export const buildAiSettingsUpdate = (group, draft) => {
    const stored = draftFromGroup(group);
    const updates = {};
    const url = (draft.url || '').trim();
    if (draft.use) {
        if (
            !stored.use ||
            stored.service !== draft.service ||
            stored.url !== url ||
            stored.confirmed !== draft.confirmed
        ) {
            updates.genai = { enabled: true, service: draft.service, url, confirmed: draft.confirmed };
        }
    } else if (stored.use) {
        // The confirmation belonged to that period of use; turning it back on asks again.
        updates.genai = { enabled: false, confirmed: false };
    }
    if (stored.rubytee !== draft.rubytee) {
        updates.rubytee = { enabled: draft.rubytee };
    }
    return updates;
};

/**
 * Whether the teacher has changed the AI settings and not saved them yet.
 * @param {object} group - the stored class
 * @param {object} draft - the edited settings (see draftFromGroup)
 * @returns {boolean} true when saving would send something
 */
export const isAiDraftChanged = (group, draft) => Object.keys(buildAiSettingsUpdate(group, draft)).length > 0;
