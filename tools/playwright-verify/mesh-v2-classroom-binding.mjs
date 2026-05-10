import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[verify]', ...a);

// Resolve paths relative to this script: <repo>/tools/playwright-verify/<this>.mjs
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const ENV_PATH = resolve(REPO_ROOT, '.env');
const PROFILE_DIR = resolve(__dirname, '.profiles');

// Read DEV_BYPASS_TOKEN from monorepo .env so the teacher tab can skip
// Google login (stg / local only).
const envText = readFileSync(ENV_PATH, 'utf8');
const tokenMatch = envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m);
const DEV_TOKEN = tokenMatch ? tokenMatch[1].trim().replace(/^"|"$/g, '') : null;
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const TEACHER_URL = `http://localhost:8601/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`;
const STUDENT_BASE = 'http://localhost:8601/?no_beforeunload=1';

const findStore = async (page) =>
    page.evaluate(() => {
        if (window.__store) return true;
        const findFiberRoot = () => {
            const all = [document.body, ...document.body.querySelectorAll('*')];
            for (const el of all) {
                const k = Object.keys(el).find((x) => x.startsWith('__reactContainer'));
                if (k) return el[k];
            }
            return null;
        };
        const root = findFiberRoot();
        if (!root) return false;
        const seen = new WeakSet();
        const stack = [root.stateNode.current];
        while (stack.length) {
            const f = stack.pop();
            if (!f || seen.has(f)) continue;
            seen.add(f);
            const p = f.memoizedProps;
            if (p) {
                if (p.store && typeof p.store.dispatch === 'function') {
                    window.__store = p.store;
                    return true;
                }
                if (p.value && p.value.store && typeof p.value.store.dispatch === 'function') {
                    window.__store = p.value.store;
                    return true;
                }
            }
            if (f.child) stack.push(f.child);
            if (f.sibling) stack.push(f.sibling);
        }
        return false;
    });

const getState = (page, path) =>
    page.evaluate((p) => {
        const parts = p.split('.');
        let v = window.__store.getState();
        for (const k of parts) v = v?.[k];
        return v;
    }, path);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Use persistent contexts so the Google login survives script restarts.
const teacherCtx = await chromium.launchPersistentContext(resolve(PROFILE_DIR, 'teacher'), {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--window-position=0,0'],
});
const teacher = teacherCtx.pages()[0] || (await teacherCtx.newPage());
teacher.on('pageerror', (e) => console.log('[teacher:err]', e.message));

// Student context is opened lazily only when needed so the user cannot accidentally
// close the empty window before the script reaches the student-side step.
let studentCtx = null;
let student = null;
const ensureStudent = async () => {
    if (student && !student.isClosed()) return student;
    studentCtx = await chromium.launchPersistentContext(resolve(PROFILE_DIR, 'student'), {
        headless: false,
        viewport: { width: 1280, height: 800 },
        args: ['--window-position=640,40'],
    });
    student = studentCtx.pages()[0] || (await studentCtx.newPage());
    student.on('pageerror', (e) => console.log('[student:err]', e.message));
    return student;
};

// === Teacher tab ===
log('opening teacher tab (with devlogin)...');
await teacher.goto(TEACHER_URL, { waitUntil: 'domcontentloaded' });
await teacher.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 60000 });
await sleep(1000);
await findStore(teacher);

// Open Settings menu → Classroom management
log('opening classroom management as teacher...');
await teacher.click('[data-testid="settings-menu"]');
await sleep(300);
await teacher.click('[data-testid="settings-classroom-management"]');
// devlogin auto-logs in, so we may go straight to dashboard. Otherwise we see login phase.
await teacher.waitForSelector(
    '[data-testid="classroom-phase-teacher-login"], [data-testid="classroom-phase-teacher-dashboard"], [data-testid="classroom-create"]',
    { timeout: 15000 },
);
log('classroom modal opened.');

// If already on the dashboard (cached Google login from persistent profile),
// the "create" button is visible immediately. Otherwise we still need to click
// the Google login button.
const onDashboardImmediately = await teacher
    .$('[data-testid="classroom-create"]')
    .then((el) => !!el)
    .catch(() => false);

if (!onDashboardImmediately) {
    log('clicking Google login. >>> Please complete Google login in the teacher window. <<<');
    await teacher.click('[data-testid="classroom-google-login"]');
}

// Wait for the dashboard. The dashboard view doesn't have a `classroom-phase-*`
// data-testid, but its "create classroom" button does — that's our signal.
log('polling for teacher-dashboard (up to 10 minutes)...');
const deadline = Date.now() + 10 * 60 * 1000;
let lastPhaseLog = 0;
while (Date.now() < deadline) {
    const onDashboard = await teacher
        .$('[data-testid="classroom-create"]')
        .then((el) => !!el)
        .catch(() => false);
    if (onDashboard) {
        log('teacher dashboard reached.');
        break;
    }
    if (Date.now() - lastPhaseLog > 10000) {
        const visiblePhase = await teacher
            .evaluate(() => {
                const el = document.querySelector('[data-testid^="classroom-phase-"]');
                return el ? el.getAttribute('data-testid') : null;
            })
            .catch(() => null);
        log(`  current phase: ${visiblePhase || '(none)'} (waiting for dashboard)`);
        lastPhaseLog = Date.now();
    }
    await sleep(2000);
}
if (Date.now() >= deadline) throw new Error('teacher dashboard not reached');

// Mark all classroom tutorials as "seen" so their overlays don't intercept clicks.
// Reliable across renders, vs. clicking the overlay's dismiss button which may not
// be in the DOM yet when we look for it.
await teacher.evaluate(() => {
    const names = ['classCreation', 'classDetail', 'inviteStudents'];
    for (const name of names) {
        window.__store.dispatch({ type: 'scratch-gui/classroom-tutorial/MARK_SEEN', name });
    }
});
await sleep(200);

// Click "Create class"
await sleep(500);
await teacher.click('[data-testid="classroom-create"]');
await teacher.waitForSelector('[data-testid="classroom-phase-teacher-create"]', { timeout: 10000 });

const stamp = Date.now().toString().slice(-6);
const className = `自動検証-${stamp}`;
const assignmentName = `課題-${stamp}`;
await teacher.fill('[data-testid="classroom-name-input"]', className);
await teacher.fill('[data-testid="classroom-count-input"]', '5');
await teacher.fill('[data-testid="classroom-assignment-name-input"]', assignmentName);
await teacher.click('[data-testid="classroom-create-submit"]');

// === Pre-bind a custom domain on the teacher tab so we can later assert it
// is restored on unbind (i.e. domain returns to "myhome", not null). ===
const TEACHER_PRE_DOMAIN = 'pre-teacher';
log(`setting teacher pre-bind domain: ${TEACHER_PRE_DOMAIN}`);
await teacher.evaluate((d) => {
    window.__store.dispatch({ type: 'scratch-gui/mesh-v2/SET_DOMAIN', domain: d });
    const ext = window.__store.getState().scratchGui.vm?.runtime?.peripheralExtensions?.meshV2;
    if (ext && typeof ext.setDomain === 'function') ext.setDomain(d);
    window.localStorage.setItem('mesh_v2_domain', d);
}, TEACHER_PRE_DOMAIN);
await sleep(200);

// After creation we are back at the dashboard (not auto-selected). Click the
// newly created class in the sidebar to select it — that triggers our binding.
log('waiting for new class to appear in sidebar, then clicking it...');
await teacher.waitForFunction(
    (label) => {
        const items = Array.from(document.querySelectorAll('[data-testid^="classroom-sidebar-item-"]'));
        return items.some((el) => el.textContent && el.textContent.includes(label));
    },
    assignmentName,
    { timeout: 30000 },
);
const clickedClassroomId = await teacher.evaluate((label) => {
    const items = Array.from(document.querySelectorAll('[data-testid^="classroom-sidebar-item-"]'));
    const match = items.find((el) => el.textContent && el.textContent.includes(label));
    if (!match) return null;
    match.click();
    return match.getAttribute('data-classroom-id');
}, assignmentName);
log('clicked sidebar item, classroomId:', clickedClassroomId);

log('polling for teacherSelection.joinCode (up to 30s)...');
let joinCode = null;
const createDeadline = Date.now() + 30000;
while (Date.now() < createDeadline) {
    joinCode = await teacher.evaluate(() => {
        return window.__store.getState().scratchGui.classroom.teacherSelection?.joinCode || null;
    });
    if (joinCode) break;
    await sleep(1000);
}
log(`class selected. teacherSelection.joinCode: ${joinCode}`);
if (!joinCode) throw new Error('class selection did not populate teacherSelection');

// Verify teacher mesh domain is lowercased joinCode
const teacherMeshDomain = await getState(teacher, 'scratchGui.meshV2.domain');
const expectedDomain = joinCode ? joinCode.toLowerCase() : null;
log(
    `teacher mesh domain: ${teacherMeshDomain} (expected: ${expectedDomain})`,
    teacherMeshDomain === expectedDomain ? 'PASS' : 'FAIL',
);

// Close teacher modal so we can see the editor
await teacher.evaluate(() => {
    window.__store.dispatch({
        type: 'scratch-gui/modals/CLOSE_MODAL',
        modal: 'teacherClassroomModal',
    });
    window.__store.dispatch({ type: 'scratch-gui/classroom/CLOSE_TEACHER_MODAL' });
});
await sleep(500);

// === Student tab ===
log('opening student tab with classcode auto-join...');
await ensureStudent();
const studentURL = `${STUDENT_BASE}&classcode=${joinCode.toLowerCase()}`;
await student.goto(studentURL, { waitUntil: 'domcontentloaded' });
await student.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 60000 });
await sleep(1500);
await findStore(student);

// classcode auto-join takes us to seat-select phase
await student.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 30000 });
// Seats may take a moment to render after lookupClassroom; wait for at least one free seat.
await student
    .waitForFunction(
        () => {
            const btns = Array.from(document.querySelectorAll('button[data-seat]'));
            return btns.length > 0 && btns.some((b) => !b.disabled);
        },
        { timeout: 10000 },
    )
    .catch(() => {});
const pickedSeat = await student.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[data-seat]'));
    const states = btns.map((b) => `${b.getAttribute('data-seat')}:${b.disabled ? 'taken' : 'free'}`);
    const free = btns.find((b) => !b.disabled);
    if (!free) return { seat: null, states };
    free.click();
    return { seat: free.getAttribute('data-seat'), states };
});
log('student in seat-select phase, picked seat:', pickedSeat.seat, 'states:', pickedSeat.states);
if (!pickedSeat.seat) throw new Error('no free seat available');

// Pre-bind a custom domain before SET_SESSION fires, so we can assert restore-on-leave.
const STUDENT_PRE_DOMAIN = 'pre-student';
log(`setting student pre-bind domain: ${STUDENT_PRE_DOMAIN}`);
await student.evaluate((d) => {
    window.__store.dispatch({ type: 'scratch-gui/mesh-v2/SET_DOMAIN', domain: d });
    const ext = window.__store.getState().scratchGui.vm?.runtime?.peripheralExtensions?.meshV2;
    if (ext && typeof ext.setDomain === 'function') ext.setDomain(d);
    window.localStorage.setItem('mesh_v2_domain', d);
}, STUDENT_PRE_DOMAIN);
await sleep(200);

await student.click('[data-testid="classroom-confirm-seat"]');

await student.waitForSelector('[data-testid="classroom-phase-student-joined"]', { timeout: 20000 });
log('student joined.');

// Close student joined modal
await student.click('[data-testid="classroom-joined-close"]').catch(() => {});
await sleep(500);

// Verify student mesh domain
const studentClassroom = await getState(student, 'scratchGui.classroom');
log('student classroom.role:', studentClassroom.role, 'joinCode:', studentClassroom.joinCode);
const studentMeshDomain = await getState(student, 'scratchGui.meshV2.domain');
log(
    `student mesh domain: ${studentMeshDomain} (expected: ${expectedDomain})`,
    studentMeshDomain === expectedDomain ? 'PASS' : 'FAIL',
);

// Open meshV2 connection modal in student tab and confirm input is read-only
await student.evaluate(() => {
    const vm = window.__store.getState().scratchGui.vm;
    return vm.extensionManager.loadExtensionURL('meshV2').catch(() => {});
});
await sleep(1000);
await student.evaluate(() => {
    window.__store.dispatch({ type: 'scratch-gui/connection-modal/setId', extensionId: 'meshV2' });
    window.__store.dispatch({ type: 'scratch-gui/modals/OPEN_MODAL', modal: 'connectionModal' });
});
await sleep(800);
const studentInput = await student.evaluate(() => {
    const el = document.querySelector('[data-testid="meshV2-domain-input"]');
    return el ? { value: el.value, disabled: el.disabled, readOnly: el.readOnly } : null;
});
log('student meshV2 input:', studentInput);
await student.screenshot({ path: resolve(__dirname, '.screenshots', 'student-bound.png') });

// Same in teacher tab
await teacher.evaluate(() => {
    const vm = window.__store.getState().scratchGui.vm;
    return vm.extensionManager.loadExtensionURL('meshV2').catch(() => {});
});
await sleep(1000);
await teacher.evaluate(() => {
    window.__store.dispatch({ type: 'scratch-gui/connection-modal/setId', extensionId: 'meshV2' });
    window.__store.dispatch({ type: 'scratch-gui/modals/OPEN_MODAL', modal: 'connectionModal' });
});
await sleep(800);
const teacherInput = await teacher.evaluate(() => {
    const el = document.querySelector('[data-testid="meshV2-domain-input"]');
    return el ? { value: el.value, disabled: el.disabled, readOnly: el.readOnly } : null;
});
log('teacher meshV2 input:', teacherInput);
await teacher.screenshot({ path: resolve(__dirname, '.screenshots', 'teacher-bound.png') });

// === Restore-previous-domain test (Redux + extension._domain + localStorage) ===
log('--- restore previous domain test ---');

const dumpDomainState = async (page, label) => {
    const snap = await page.evaluate(() => {
        const reduxDomain = window.__store.getState().scratchGui.meshV2.domain;
        const ext = window.__store.getState().scratchGui.vm?.runtime?.peripheralExtensions?.meshV2;
        const extDomain = ext ? ext.domain : '(extension not loaded)';
        const ls = window.localStorage.getItem('mesh_v2_domain');
        return { redux: reduxDomain, ext: extDomain, ls };
    });
    log(`${label}: redux=${snap.redux}, ext=${snap.ext}, localStorage=${snap.ls}`);
    return snap;
};

await dumpDomainState(student, 'student BEFORE leave');
// Use actual UI: open classroom modal → student-status phase has a Leave button.
// First close any open mesh modal so we can interact with classroom modal.
await student.evaluate(() => window.__store.dispatch({ type: 'scratch-gui/modals/CLOSE_MODAL', modal: 'connectionModal' }));
await sleep(200);
await student.evaluate(() => window.__store.dispatch({ type: 'scratch-gui/classroom/OPEN_MODAL' }));
await student.waitForSelector('[data-testid="classroom-phase-student-status"]', { timeout: 10000 });
await student.click('[data-testid="classroom-leave"]');
// Confirmation may appear; accept any confirm dialog.
await sleep(300);
const confirmBtn = await student.$('[data-testid="classroom-leave-confirm"]');
if (confirmBtn) await confirmBtn.click();
await student.waitForSelector('[data-testid="classroom-phase-student-join"]', { timeout: 15000 });
await sleep(500);
const studentAfter = await dumpDomainState(student, 'student AFTER leave (via UI)');
console.assert(
    studentAfter.redux === STUDENT_PRE_DOMAIN,
    `FAIL: student redux did not restore to ${STUDENT_PRE_DOMAIN}, got ${studentAfter.redux}`,
);
console.assert(
    studentAfter.ls === STUDENT_PRE_DOMAIN,
    `FAIL: student localStorage did not restore to ${STUDENT_PRE_DOMAIN}, got ${studentAfter.ls}`,
);
console.assert(
    studentAfter.ext === STUDENT_PRE_DOMAIN || studentAfter.ext === '(extension not loaded)',
    `FAIL: student ext domain did not restore to ${STUDENT_PRE_DOMAIN}, got ${studentAfter.ext}`,
);

await dumpDomainState(teacher, 'teacher BEFORE logout');
// Use actual UI: close mesh modal, open classroom-teacher-modal, click logout.
await teacher.evaluate(() => window.__store.dispatch({ type: 'scratch-gui/modals/CLOSE_MODAL', modal: 'connectionModal' }));
await sleep(200);
await teacher.evaluate(() => window.__store.dispatch({ type: 'scratch-gui/classroom/OPEN_TEACHER_MODAL' }));
await teacher.waitForSelector('[data-testid="classroom-teacher-logout"]', { timeout: 10000 });
await teacher.click('[data-testid="classroom-teacher-logout"]');
const logoutConfirm = await teacher.$('[data-testid="classroom-teacher-logout-confirm"]');
if (logoutConfirm) await logoutConfirm.click();
await teacher.waitForSelector('[data-testid="classroom-phase-teacher-login"]', { timeout: 15000 });
await sleep(500);
const teacherAfter = await dumpDomainState(teacher, 'teacher AFTER logout (via UI)');
console.assert(
    teacherAfter.redux === TEACHER_PRE_DOMAIN,
    `FAIL: teacher redux did not restore to ${TEACHER_PRE_DOMAIN}, got ${teacherAfter.redux}`,
);
console.assert(
    teacherAfter.ls === TEACHER_PRE_DOMAIN,
    `FAIL: teacher localStorage did not restore to ${TEACHER_PRE_DOMAIN}, got ${teacherAfter.ls}`,
);
console.assert(
    teacherAfter.ext === TEACHER_PRE_DOMAIN || teacherAfter.ext === '(extension not loaded)',
    `FAIL: teacher ext domain did not restore to ${TEACHER_PRE_DOMAIN}, got ${teacherAfter.ext}`,
);

log('--- summary ---');
log('joinCode:', joinCode, '→ expected mesh domain:', expectedDomain);
log('teacher domain:', teacherMeshDomain, 'student domain:', studentMeshDomain);
log('teacher input:', teacherInput);
log('student input:', studentInput);

log('done. browser will stay open for inspection. Ctrl+C to exit.');
// Keep the browser open so the user can inspect both tabs.
await new Promise(() => {});
