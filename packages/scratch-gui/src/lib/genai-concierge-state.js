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
 * is looking at something else: the running program, a hidden tab, or the
 * panel itself. Alerts don't count (the code tab has no errors to read).
 * @param {object} params - parameters
 * @param {number} params.now - ms epoch
 * @param {number} params.lastActivity - ms epoch of the last input or project change
 * @param {number} params.lastNudge - ms epoch of the last offer (0 = never)
 * @param {number} params.idleMs - inactivity needed before offering
 * @param {boolean} params.busy - panel or bubble open, program running, or tab hidden
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

/** The steps of the panel, in order (the progress display under the header, #1293 G9). */
const STEP_IDS = ['trouble', 'copy', 'paste'];

/**
 * The progress display of the panel (#1293 G9): finished steps are filled in
 * with ✓, the current one is outlined. Once the blocks are in ('done') every
 * step is finished and none can be gone back to (the answer is already used).
 * @param {string} step - 'trouble' / 'copy' / 'paste' / 'done'
 * @returns {Array<{id: string, status: string, canReturn: boolean}>} status is 'done' / 'current' / 'todo'
 */
export const stepperItems = (step) => {
    const at = step === 'done' ? STEP_IDS.length : STEP_IDS.indexOf(step);
    return STEP_IDS.map((id, i) => {
        let status = 'todo';
        if (i < at) status = 'done';
        else if (i === at) status = 'current';
        return { id, status, canReturn: status === 'done' && step !== 'done' };
    });
};

/**
 * What the student does in step 2 (#1293), as a checklist: copy (and open
 * the AI) → paste it there and send → go on when the answer has come.
 * Smalruby cannot see the AI's tab, so only the copy is ever ticked.
 * @param {object} params - parameters
 * @param {boolean} params.copied - the question (or a part of it) was copied
 * @returns {Array<string>} 'done' / 'next' / 'wait' for each of the three items
 */
export const copyChecklist = ({ copied }) => (copied ? ['done', 'next', 'wait'] : ['next', 'wait', 'wait']);

/**
 * Space between the panel and the right edge of the script area (px): clears the
 * workspace's scrollbar and the buttons along its right edge (zoom, block screenshot).
 */
const PANEL_RIGHT_MARGIN = 60;
const FACE_GAP = 8;

/**
 * Where the panel goes, relative to the face (#1293 G8): at the right edge of
 * the script area, so the blocks it puts in (top left) are not under it. When
 * the area is too narrow to keep the panel beside the face, it sits above it.
 * @param {object} params - parameters
 * @param {number} params.areaWidth - width of the script area (the face's offset parent)
 * @param {number} params.rootLeft - left of the face in the script area
 * @param {number} params.panelWidth - width of the panel
 * @param {number} params.faceWidth - width of the face
 * @returns {{left: number, bottom: number}} css left / bottom of the panel inside the face's box
 */
export const panelPlacement = ({ areaWidth, rootLeft, panelWidth, faceWidth }) => {
    const left = areaWidth - PANEL_RIGHT_MARGIN - panelWidth - rootLeft;
    if (left >= faceWidth + FACE_GAP) return { left, bottom: 0 };
    return { left: Math.max(0, left), bottom: faceWidth + FACE_GAP };
};

/** Space left above and to the left of the blocks when scrolling to them (px). */
const BLOCKS_MARGIN = 24;

/**
 * The workspace scroll that brings the blocks the panel put in to the top
 * left of the script area (#1293 G8), away from the panel at the right.
 * @param {object} params - parameters
 * @param {?{left: number, top: number}} params.bbox - workspace bounding box of the blocks
 * @param {number} params.scale - workspace scale
 * @returns {?{x: number, y: number}} arguments of workspace.scroll, null when there are no blocks
 */
export const scrollToShowBlocks = ({ bbox, scale }) => {
    if (!bbox) return null;
    return { x: BLOCKS_MARGIN - bbox.left * scale, y: BLOCKS_MARGIN - bbox.top * scale };
};
