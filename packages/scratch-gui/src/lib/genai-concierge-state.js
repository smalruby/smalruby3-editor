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

/** The host of the branch previews (stg values, built like production). */
export const PREVIEW_HOSTNAME = 'preview.smalruby.app';

/**
 * Whether `?features=genai` (the face outside a class, for development) works (#1412).
 * Only with the dev server (`npm start`, not a production build) and in the branch
 * previews: on smalruby.app the AI is only for the classes whose teacher turned it on.
 * The previews are production builds too, so they are told apart by the host name.
 * @param {object} params - parameters
 * @param {string[]} params.features - the `?features=` values
 * @param {boolean} params.production - a production build (`process.env.NODE_ENV`)
 * @param {string} params.hostname - `window.location.hostname`
 * @returns {boolean} true to turn the development flag on
 */
export const isGenaiDevFlag = ({ features, production, hostname }) =>
    features.includes('genai') && (!production || hostname === PREVIEW_HOSTNAME);

/**
 * Whether the face is shown: only to a student of a class that uses a
 * generative AI. `?features=genai` keeps it on outside a class for development
 * (only with the dev server and the previews, see isGenaiDevFlag).
 * @param {object} params - parameters
 * @param {?string} params.role - classroom role ('student' / 'teacher' / null)
 * @param {?string} params.sessionToken - the student's session
 * @param {{enabled: boolean}} params.classGenai - see normalizeStudentGenai
 * @param {boolean} params.devFlag - `?features=genai` (see isGenaiDevFlag)
 * @returns {boolean} true to show the face
 */
export const isGenaiAvailable = ({ role, sessionToken, classGenai, devFlag }) => {
    if (role === 'student' && sessionToken && classGenai && classGenai.enabled) return true;
    return Boolean(devFlag);
};

/**
 * Whether the face is shown in the Ruby tab (#1398): as in the code tab, and only for
 * Ruby version 2 (#1396 決定 4). Also in the Japanese (DNCL) mode, with its own
 * question (#1402).
 * @param {object} params - the parameters of isGenaiAvailable, and:
 * @param {?string} params.rubyVersion - the Ruby version ('1' / '2')
 * @returns {boolean} true to show the face
 */
export const isRubyTabGenaiAvailable = ({ rubyVersion, ...rest }) =>
    isGenaiAvailable(rest) && String(rubyVersion) === '2';

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

/** Height of the menu bar at the top of the page ($menu-bar-height): the panel stays below it. */
const MENU_BAR_HEIGHT = 48;
/** Space kept between the panel and the edges it stays in (px). */
const PANEL_EDGE = 8;
/** The panel is never dragged so low that less than this height is left for it (px). */
const MIN_PANEL_HEIGHT = 240;

/**
 * Where the panel may be dragged to, and how tall it may grow (#1293 P5). It stays in the
 * box around the face that clips it (the editor below the tabs), below the menu bar and in
 * the window: out of them it is cut off or covered, and its header (× and the handle to
 * move it) can no longer be reached. It may grow up to the top of that space.
 * @param {object} params - parameters
 * @param {number} params.rootLeft - left of the face's box in the window
 * @param {number} params.rootBottom - bottom of the face's box in the window
 * @param {{left: number, bottom: number}} params.place - the panel in the face's box (panelPlacement)
 * @param {number} params.panelWidth - width of the panel
 * @param {{x: number, y: number}} params.offset - how far the student dragged the panel
 * @param {{top: number, left: number, right: number, bottom: number}} params.clip - the box that
 *   clips the panel, in the window (the window itself when nothing clips it)
 * @returns {{offset: {x: number, y: number}, maxHeight: number}} the offset kept in the space and the panel's max height
 */
export const panelFrame = ({ rootLeft, rootBottom, place, panelWidth, offset, clip }) => {
    const top = Math.max(MENU_BAR_HEIGHT, clip.top) + PANEL_EDGE;
    const baseBottom = rootBottom - place.bottom;
    const maxY = clip.bottom - PANEL_EDGE - baseBottom;
    const minY = Math.min(maxY, top + MIN_PANEL_HEIGHT - baseBottom);
    const y = Math.min(maxY, Math.max(minY, offset.y));
    const baseLeft = rootLeft + place.left;
    const maxX = clip.right - PANEL_EDGE - panelWidth - baseLeft;
    const minX = Math.min(maxX, clip.left + PANEL_EDGE - baseLeft);
    const x = Math.min(maxX, Math.max(minX, offset.x));
    return { offset: { x, y }, maxHeight: Math.max(0, baseBottom + y - top) };
};

/**
 * Room beside the face (px) for the whole 「AI に相談」 label: less than this (e.g. the
 * code tab on an iPad held upright), the label would cover much of the blocks or the code,
 * so it is shortened to 「AI」.
 */
const FULL_LABEL_ROOM = 300;
/** Room beside the face (px) for the short label. */
const SHORT_LABEL_ROOM = 60;

/**
 * Which label goes beside the face (#1414). None while the panel is open or the nudge
 * is shown (it is in the same place), nor before the area is measured.
 * @param {object} params - parameters
 * @param {number} params.areaWidth - width of the script area (the face's offset parent)
 * @param {number} params.rootLeft - left of the face in the script area
 * @param {number} params.faceWidth - width of the face
 * @param {boolean} params.open - the panel is open
 * @param {boolean} params.nudge - the nudge is shown
 * @returns {'full'|'short'|'none'} the label to show
 */
export const faceLabel = ({ areaWidth, rootLeft, faceWidth, open, nudge }) => {
    if (open || nudge || !areaWidth) return 'none';
    // The label stays clear of the buttons along the right edge, as the panel does.
    const room = areaWidth - PANEL_RIGHT_MARGIN - rootLeft - faceWidth - FACE_GAP;
    if (room >= FULL_LABEL_ROOM) return 'full';
    if (room >= SHORT_LABEL_ROOM) return 'short';
    return 'none';
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

/**
 * The marked changes to bring into view: those of the sprite in the editor, else the
 * first sprite with some. Removed blocks are not in the editor to be shown.
 * @param {Array<object>} marks - [{target, changes}]
 * @param {?object} editingTarget - the target in the editor
 * @returns {{owner: ?object, ids: Array<string>}} the target and the ids to show
 */
export const marksToShow = (marks, editingTarget) => {
    const marked = marks.filter((mark) => mark.changes.some((change) => change.kind !== 'removed'));
    const mark = marked.find((m) => m.target === editingTarget) || marked[0];
    if (!mark) return { owner: null, ids: [] };
    return {
        owner: mark.target,
        ids: mark.changes.filter((change) => change.kind !== 'removed').map((change) => change.id),
    };
};

/**
 * Resolves once Blockly has drawn the blocks it was given: where a block inside
 * a script sits is only known after it is drawn.
 * @param {?object} scratchBlocks - ScratchBlocks (Blockly's renderManagement)
 * @returns {Promise} resolves after the queued renders
 */
export const afterBlocksRender = (scratchBlocks) => {
    const renders = scratchBlocks && scratchBlocks.renderManagement;
    if (renders && typeof renders.finishQueuedRenders === 'function') return renders.finishQueuedRenders();
    return Promise.resolve();
};

/**
 * Shows `owner`'s blocks in the editor and resolves once they are in the
 * workspace. Switching sprites reloads the workspace in the `workspaceUpdate`
 * handler of the blocks container (registered first, so it has run when ours
 * does): waiting for that event instead of a fixed time keeps working on a
 * slow PC (#1281 Q1).
 * @param {object} vm - the VM
 * @param {?object} owner - the target to show, or null for the one in the editor
 * @returns {Promise} resolves when the workspace shows the blocks
 */
export const showInEditor = (vm, owner) =>
    new Promise((resolve) => {
        if (!owner || owner === vm.editingTarget || !vm.runtime.targets.includes(owner)) {
            resolve();
            return;
        }
        vm.once('workspaceUpdate', resolve);
        vm.setEditingTarget(owner.id);
        // Not switched after all: there is no update to wait for.
        if (vm.editingTarget !== owner) {
            vm.removeListener('workspaceUpdate', resolve);
            resolve();
        }
    });

/** Checks that could not become blocks before Rubytee is offered (#1280). */
export const TAKEOVER_AFTER_FAILURES = 2;

/**
 * Whether to show 「ルビティーにまかせる」: after the answer failed to become
 * blocks twice, and only in a class whose teacher lets the students use Rubytee.
 * @param {object} params - parameters
 * @param {number} params.failures - checks that could not become blocks
 * @param {boolean} params.rubyteeAvailable - the student's class uses Rubytee
 * @returns {boolean} whether to show the entrance
 */
export const canOfferTakeover = ({ failures, rubyteeAvailable }) =>
    rubyteeAvailable === true && failures >= TAKEOVER_AFTER_FAILURES;

/**
 * Whether the panel may offer 「ルビティーにまかせる」 at all: in a class that uses Rubytee,
 * in the code tab and in the Ruby tab's Ruby and furigana modes (#1400). Not in DNCL mode
 * (#1396 決定 3): Rubytee answers in Ruby, not in the student's DNCL.
 * @param {object} params - parameters
 * @param {boolean} params.rubyteeAvailable - the student's class uses Rubytee
 * @param {boolean} params.rubyTab - the panel is in the Ruby tab
 * @param {boolean} params.dnclMode - the Ruby tab is in DNCL mode
 * @returns {boolean} whether Rubytee may be offered
 */
export const isTakeoverAvailable = ({ rubyteeAvailable, rubyTab, dnclMode }) =>
    rubyteeAvailable === true && !(rubyTab && dnclMode);
