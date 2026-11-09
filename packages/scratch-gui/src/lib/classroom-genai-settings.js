/**
 * Class-level generative AI / Rubytee settings edited by the teacher
 * (issue #1277, redesigned in #1290). The server (#1275) is the authority; these
 * helpers mirror its rules so the form can explain a problem before the teacher saves.
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

const rubyteeOf = (group) => {
    const stored = (group && group.rubytee) || {};
    const rubytee = stored.enabled === true;
    // Like the generative AI, the confirmation belongs to a period of use.
    return { rubytee, rubyteeConfirmed: rubytee && stored.confirmed === true };
};

/**
 * Editable copy of a class's AI settings. Classes without settings read as
 * "both disabled".
 * @param {object} group - the class as returned by the teacher API
 * @returns {object} {use, service, url, confirmed, rubytee, rubyteeConfirmed}
 */
export const draftFromGroup = (group) => {
    const genai = (group && group.genai) || {};
    const service = isService(genai.service) ? genai.service : null;
    const use = genai.enabled === true && service !== null;
    const rubytee = rubyteeOf(group);
    // A class that doesn't use generative AI starts from scratch,
    // instead of reviving the service and confirmation chosen before it was turned off.
    if (!use) return { use: false, ...FRESH_GENAI, ...rubytee };
    return {
        use,
        service,
        url: typeof genai.url === 'string' ? genai.url : '',
        confirmed: genai.confirmed === true,
        ...rubytee,
    };
};

/**
 * Whether the class has Rubytee on without the teacher's confirmation: it was
 * turned on before the confirmation existed (#1413). It keeps working, and the
 * next save asks for the confirmation.
 * @param {object} group - the stored class
 * @returns {boolean} true when Rubytee is on and not confirmed
 */
export const isRubyteeUnconfirmed = (group) => {
    const { rubytee, rubyteeConfirmed } = rubyteeOf(group);
    return rubytee && !rubyteeConfirmed;
};

/**
 * Turn Rubytee on or off. Either way the confirmation starts over, as with
 * the generative AI: it is asked for each period of use.
 * @param {object} draft - see draftFromGroup
 * @param {boolean} on - whether Rubytee is used
 * @returns {object} the next draft (the same object when nothing changes)
 */
export const draftWithRubytee = (draft, on) =>
    draft.rubytee === on ? draft : { ...draft, rubytee: on, rubyteeConfirmed: false };

/**
 * Pick a generative AI (or none with `null`). Anything that depends on the
 * choice starts over: the confirmation was about the previous service's terms,
 * and its URL belonged to that service.
 * @param {object} draft - see draftFromGroup
 * @param {?string} service - one of GENAI_SERVICES, or null for "don't use"
 * @returns {object} the next draft (the same object when nothing changes)
 */
export const draftWithService = (draft, service) => {
    if (service === null) {
        return draft.use || draft.service ? { ...draft, use: false, ...FRESH_GENAI } : draft;
    }
    if (!isService(service) || (draft.use && draft.service === service)) return draft;
    return { ...draft, use: true, service, url: GENAI_DEFAULT_URLS[service], confirmed: false };
};

/**
 * Short form of a URL for "the page students open (now ...)".
 * @param {string} url - the URL
 * @returns {string} the URL without `https://` and a trailing slash
 */
export const displayGenaiUrl = (url) =>
    (url || '')
        .trim()
        .replace(/^https:\/\//i, '')
        .replace(/\/$/, '');

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
 * Whether the draft can be saved: enabling the generative AI needs a service,
 * the teacher's confirmation of its terms and a valid URL, and Rubytee needs
 * the teacher's confirmation too. The server doesn't require Rubytee's yet
 * (#1411), so the form is what asks for it.
 * @param {object} draft - see draftFromGroup
 * @returns {boolean} true when it can be saved
 */
export const isDraftSavable = (draft) => {
    if (draft.rubytee && !draft.rubyteeConfirmed) return false;
    if (!draft.use) return true;
    return isService(draft.service) && draft.confirmed && validateGenaiUrl(draft.url) === null;
};

/**
 * Which required confirmation the teacher has not checked yet, so the form can
 * say why [Save] is off and take them to it (#1427). A broken URL is not one:
 * its error already shows next to the input.
 * @param {object} draft - see draftFromGroup
 * @returns {?string} 'genai' / 'rubytee' (in the order they appear), or null
 */
export const missingAiConfirmation = (draft) => {
    if (draft.use && isService(draft.service) && !draft.confirmed) return 'genai';
    if (draft.rubytee && !draft.rubyteeConfirmed) return 'rubytee';
    return null;
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
    const rubyteeConfirmed = draft.rubytee && draft.rubyteeConfirmed;
    if (stored.rubytee !== draft.rubytee || stored.rubyteeConfirmed !== rubyteeConfirmed) {
        updates.rubytee = { enabled: draft.rubytee, confirmed: rubyteeConfirmed };
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

/**
 * Which of the two settings has unsaved changes, so each row can be marked on its own.
 * @param {object} group - the stored class
 * @param {object} draft - the edited settings (see draftFromGroup)
 * @returns {{genai: boolean, rubytee: boolean}} true for a setting that saving would send
 */
export const changedAiSettings = (group, draft) => {
    const updates = buildAiSettingsUpdate(group, draft);
    return { genai: 'genai' in updates, rubytee: 'rubytee' in updates };
};
