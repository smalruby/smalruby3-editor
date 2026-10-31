/**
 * Pure helpers for "生成AI に相談" (issue #1279): which generative AI the
 * class lets its students open, and when the face offers help by itself.
 */

/** Seconds of inactivity before the face offers help (2 min 30 s). */
export const NUDGE_IDLE_SECONDS = 150;

/** Once the face has offered help, it waits this long before offering again. */
export const NUDGE_GAP_MS = 10 * 60 * 1000;

const SERVICE_LABELS = {
    gemini: 'Gemini',
    chatgpt: 'ChatGPT',
};

/**
 * Development only (?features=genai outside a class): the services the
 * prototype let the student pick once and remembered in the browser.
 */
export const DEV_GENAI_SERVICES = [
    { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app' },
    { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
];

const isHttpsUrl = (url) => {
    if (typeof url !== 'string') return false;
    try {
        return new URL(url).protocol === 'https:';
    } catch (e) {
        return false;
    }
};

/**
 * The generative AI setting a student received from the join / verify-session
 * response (#1275). Anything that cannot be opened safely reads as disabled.
 * @param {object} genai - `genai` of the response ({enabled, service, url})
 * @returns {{enabled: boolean, service: ?string, url: ?string}} normalized setting
 */
export const normalizeStudentGenai = (genai) => {
    if (!genai || genai.enabled !== true || !isHttpsUrl(genai.url)) {
        return { enabled: false, service: null, url: null };
    }
    return {
        enabled: true,
        service: typeof genai.service === 'string' ? genai.service : 'other',
        url: genai.url,
    };
};

/**
 * Name of the generative AI to show the student: the product name for a
 * known service, otherwise the host of the URL the teacher entered.
 * @param {?string} service - 'gemini' / 'chatgpt' / 'other'
 * @param {?string} url - the URL to open
 * @returns {string} the name
 */
export const genaiServiceLabel = (service, url) => {
    if (SERVICE_LABELS[service]) return SERVICE_LABELS[service];
    try {
        return new URL(url).hostname;
    } catch (e) {
        return url || '';
    }
};

/**
 * The local date, used to keep 「今日は出さない」 only for today.
 * @param {number} now - ms epoch
 * @returns {string} YYYY-MM-DD in local time
 */
export const localDateKey = (now) => {
    const date = new Date(now);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Whether the student turned the nudge off today. The prototype stored
 * 'true' forever; that old value no longer counts.
 * @param {?string} stored - the stored date (see localDateKey)
 * @param {number} now - ms epoch
 * @returns {boolean} true while it is still that day
 */
export const isNudgeOffToday = (stored, now) => stored === localDateKey(now);

/**
 * Whether the face should offer help now. It stays quiet while the student
 * is looking at something else: an error alert, the running program, a
 * hidden tab, or the panel itself.
 * @param {object} params - parameters
 * @param {number} params.now - ms epoch
 * @param {number} params.lastActivity - ms epoch of the last input or project change
 * @param {number} params.lastNudge - ms epoch of the last offer (0 = never)
 * @param {number} params.idleMs - inactivity needed before offering
 * @param {boolean} params.busy - panel or bubble open, alert shown, program running, or tab hidden
 * @param {boolean} params.offToday - the student chose 「今日は出さない」
 * @param {number} [params.gapMs] - wait after an offer (shorter only for testing with ?genai_idle=)
 * @returns {boolean} true to show the bubble
 */
export const shouldNudge = ({ now, lastActivity, lastNudge, idleMs, busy, offToday, gapMs = NUDGE_GAP_MS }) => {
    if (busy || offToday) return false;
    if (now - lastActivity < idleMs) return false;
    return !lastNudge || now - lastNudge >= gapMs;
};

/**
 * The generative AI the "copy and open" button goes to. A class with the
 * setting decides it and the student cannot change it; only the development
 * flag (?features=genai outside a class) falls back to the remembered choice.
 * @param {object} params - parameters
 * @param {{enabled: boolean, service: ?string, url: ?string}} params.classGenai - see normalizeStudentGenai
 * @param {?string} params.devChoice - the remembered development choice: a service id or an https URL
 * @returns {?{name: string, url: string, fromClass: boolean}} null when nothing is chosen yet
 */
export const resolveGenaiTarget = ({ classGenai, devChoice }) => {
    if (classGenai && classGenai.enabled) {
        return { name: genaiServiceLabel(classGenai.service, classGenai.url), url: classGenai.url, fromClass: true };
    }
    const known = DEV_GENAI_SERVICES.find((s) => s.id === devChoice);
    if (known) return { name: known.label, url: known.url, fromClass: false };
    if (isHttpsUrl(devChoice))
        return { name: genaiServiceLabel('other', devChoice), url: devChoice, fromClass: false };
    return null;
};

/**
 * Whether the face is shown: only to a student of a class that uses a
 * generative AI. `?features=genai` keeps it on outside a class for development.
 * @param {object} params - parameters
 * @param {?string} params.role - classroom role ('student' / 'teacher' / null)
 * @param {?string} params.sessionToken - the student's session
 * @param {{enabled: boolean}} params.classGenai - see normalizeStudentGenai
 * @param {boolean} params.devFlag - `?features=genai`
 * @returns {boolean} true to show the face
 */
export const isGenaiAvailable = ({ role, sessionToken, classGenai, devFlag }) => {
    if (role === 'student' && sessionToken && classGenai && classGenai.enabled) return true;
    return Boolean(devFlag);
};
