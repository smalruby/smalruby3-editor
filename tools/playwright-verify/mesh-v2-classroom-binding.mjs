import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
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

// BASE_URL で接続先を変えられる。8601 以外のポートでは stg の CORS に弾かれるので
// DISABLE_WEB_SECURITY=1 を付ける。
const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const TEACHER_URL = `${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`;
const STUDENT_BASE = `${BASE_URL}/?no_beforeunload=1`;
// テスト用のクラス名の頭。最後にこの頭のクラスをアーカイブして片付ける（前の失敗の残りも含む）。
const CLASS_PREFIX = 'メッシュ連動検証-';
const SCREENSHOT_DIR = resolve(__dirname, '.screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

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

// 確かめた結果を集める。1 つでも FAIL があれば最後に exit 1 で終わる。
const failures = [];
const check = (cond, label) => {
    log(cond ? 'PASS' : 'FAIL', label);
    if (!cond) failures.push(label);
};

// HEADLESS defaults to true so the script runs in the (display-less) devpod
// container. Set HEADLESS=false (and optionally CHANNEL=chrome) on the host to
// watch it run in a real window.
const HEADLESS = process.env.HEADLESS !== 'false';
const extraLaunch = process.env.CHANNEL ? { channel: process.env.CHANNEL } : {};
const webSecurityArgs = process.env.DISABLE_WEB_SECURITY === '1' ? ['--disable-web-security'] : [];

// Use persistent contexts so the Google login survives script restarts.
const teacherCtx = await chromium.launchPersistentContext(resolve(PROFILE_DIR, 'teacher'), {
    headless: HEADLESS,
    ...extraLaunch,
    viewport: { width: 1280, height: 800 },
    args: ['--window-position=0,0', ...webSecurityArgs],
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
        headless: HEADLESS,
        ...extraLaunch,
        viewport: { width: 1280, height: 800 },
        args: ['--window-position=640,40', ...webSecurityArgs],
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
    '[data-testid="classroom-phase-teacher-login"], [data-testid="classroom-phase-teacher-class-list"]',
    { timeout: 15000 },
);
log('classroom modal opened.');

// If already on the dashboard (cached Google login from persistent profile),
// the "create" button is visible immediately. Otherwise we still need to click
// the Google login button.
const onDashboardImmediately = await teacher
    .$('[data-testid="classroom-phase-teacher-class-list"]')
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
        .$('[data-testid="classroom-phase-teacher-class-list"]')
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

// 片付け: このスクリプトが作ったクラス（と、前に失敗した実行で残った同じ頭のクラス）を
// クラス一覧の「設定」からアーカイブする。先生はログアウト済みのことがあるので開き直す。
const archiveTestClasses = async () => {
    const page = await teacherCtx.newPage();
    try {
        await page.goto(TEACHER_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 60000 });
        await sleep(1000);
        await findStore(page);
        await page.click('[data-testid="settings-menu"]');
        await sleep(300);
        await page.click('[data-testid="settings-classroom-management"]');
        await page.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 30000 });
        await sleep(1500);
        const groupIds = await page.$$eval(
            '[data-testid^="classroom-class-card-"]',
            (els, prefix) =>
                els
                    .filter((el) => el.textContent.includes(prefix))
                    .map((el) => el.dataset.testid.replace('classroom-class-card-', '')),
            CLASS_PREFIX,
        );
        for (const gid of groupIds) {
            await page.click(`[data-testid="classroom-class-settings-open-${gid}"]`);
            await page.waitForSelector('[data-testid="classroom-class-settings-archive"]', { timeout: 5000 });
            // 1 回目で確認を出し、2 回目でアーカイブする
            await page.click('[data-testid="classroom-class-settings-archive"]');
            await page.waitForSelector('[data-testid="classroom-class-settings-archive-confirm-message"]', {
                timeout: 5000,
            });
            await page.click('[data-testid="classroom-class-settings-archive"]');
            await page.waitForSelector(`[data-testid="classroom-class-settings-open-${gid}"]`, {
                state: 'detached',
                timeout: 15000,
            });
            log('cleanup: archived class', gid);
        }
        if (groupIds.length === 0) log('cleanup: no test class to archive');
    } catch (e) {
        log('cleanup: could not archive the test class:', e.message);
    } finally {
        await page.close().catch(() => {});
    }
};

try {
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

    // v2: class + first assignment in one form from the class list
    await sleep(500);
    await teacher.click('[data-testid="classroom-class-create"]');
    const stamp = Date.now().toString().slice(-6);
    const className = `${CLASS_PREFIX}${stamp}`;
    const assignmentName = `課題-${stamp}`;
    await teacher.fill('[data-testid="classroom-class-create-name"]', className);
    await teacher.fill('[data-testid="classroom-class-create-count"]', '5');
    await teacher.click('[data-testid="classroom-class-create-submit"]');
    await teacher.waitForSelector('[data-testid="classroom-board"]', { timeout: 30000 });
    // The create-class dialog makes only the class; the assignment is made inside it.
    // 「授業」のタブの［＋ 作成 ▾］のメニューの「課題」から作る。
    if (await teacher.$('[data-testid="classroom-board-tab-classwork"]')) {
        await teacher.click('[data-testid="classroom-board-tab-classwork"]');
    }
    await sleep(500);
    await teacher.click('[data-testid="classroom-board-create-menu"]');
    await teacher.click('[data-testid="classroom-board-create"]');
    await teacher.fill('[data-testid="classroom-board-create-name"]', assignmentName);
    await teacher.click('[data-testid="classroom-board-create-submit"]');

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

    // 課題の行を開き、［課題を開く］で課題の画面へ — that triggers our binding.
    log('waiting for the new assignment on the board, then opening it...');
    const row = teacher.locator('[data-testid^="classroom-board-row-toggle-"]', { hasText: assignmentName });
    await row.waitFor({ timeout: 30000 });
    const clickedClassroomId = (await row.getAttribute('data-testid')).replace('classroom-board-row-toggle-', '');
    if (!(await teacher.$(`[data-testid="classroom-board-open-${clickedClassroomId}"]`))) await row.click();
    await teacher.click(`[data-testid="classroom-board-open-${clickedClassroomId}"]`);
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    log('opened assignment, classroomId:', clickedClassroomId);

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
    check(
        teacherMeshDomain === expectedDomain,
        `teacher mesh domain: ${teacherMeshDomain} (expected: ${expectedDomain})`,
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
    await student.click('[data-testid="classroom-start-main"]').catch(() => {});
    await sleep(500);

    // Verify student mesh domain
    const studentClassroom = await getState(student, 'scratchGui.classroom');
    log('student classroom.role:', studentClassroom.role, 'joinCode:', studentClassroom.joinCode);
    const studentMeshDomain = await getState(student, 'scratchGui.meshV2.domain');
    check(
        studentMeshDomain === expectedDomain,
        `student mesh domain: ${studentMeshDomain} (expected: ${expectedDomain})`,
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
    check(
        !!studentInput && studentInput.disabled && studentInput.value === expectedDomain,
        `student meshV2 domain input is disabled and shows ${expectedDomain}`,
    );
    await student.screenshot({ path: resolve(SCREENSHOT_DIR, 'student-bound.png') });

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
    check(
        !!teacherInput && teacherInput.disabled && teacherInput.value === expectedDomain,
        `teacher meshV2 domain input is disabled and shows ${expectedDomain}`,
    );
    await teacher.screenshot({ path: resolve(SCREENSHOT_DIR, 'teacher-bound.png') });

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
    check(
        studentAfter.redux === STUDENT_PRE_DOMAIN,
        `student redux restored to ${STUDENT_PRE_DOMAIN} (got ${studentAfter.redux})`,
    );
    check(
        studentAfter.ls === STUDENT_PRE_DOMAIN,
        `student localStorage restored to ${STUDENT_PRE_DOMAIN} (got ${studentAfter.ls})`,
    );
    check(
        studentAfter.ext === STUDENT_PRE_DOMAIN || studentAfter.ext === '(extension not loaded)',
        `student ext domain restored to ${STUDENT_PRE_DOMAIN} (got ${studentAfter.ext})`,
    );

    await dumpDomainState(teacher, 'teacher BEFORE logout');
    // Use actual UI: close mesh modal, open classroom-teacher-modal, click logout.
    await teacher.evaluate(() => window.__store.dispatch({ type: 'scratch-gui/modals/CLOSE_MODAL', modal: 'connectionModal' }));
    await sleep(200);
    await teacher.evaluate(() => window.__store.dispatch({ type: 'scratch-gui/classroom/OPEN_TEACHER_MODAL' }));
    // ログアウトはタイトルバー右上のアバターメニュー内に移動した（#1111 レビュー）。
    // 先にアバターボタンを開いてからログアウトをクリックする。
    await teacher.waitForSelector('[data-testid="classroom-avatar-button"]', { timeout: 10000 });
    await teacher.click('[data-testid="classroom-avatar-button"]');
    await teacher.waitForSelector('[data-testid="classroom-teacher-logout"]', { timeout: 10000 });
    await teacher.click('[data-testid="classroom-teacher-logout"]');
    const logoutConfirm = await teacher.$('[data-testid="classroom-teacher-logout-confirm"]');
    if (logoutConfirm) await logoutConfirm.click();
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-login"]', { timeout: 15000 });
    await sleep(500);
    const teacherAfter = await dumpDomainState(teacher, 'teacher AFTER logout (via UI)');
    check(
        teacherAfter.redux === TEACHER_PRE_DOMAIN,
        `teacher redux restored to ${TEACHER_PRE_DOMAIN} (got ${teacherAfter.redux})`,
    );
    check(
        teacherAfter.ls === TEACHER_PRE_DOMAIN,
        `teacher localStorage restored to ${TEACHER_PRE_DOMAIN} (got ${teacherAfter.ls})`,
    );
    check(
        teacherAfter.ext === TEACHER_PRE_DOMAIN || teacherAfter.ext === '(extension not loaded)',
        `teacher ext domain restored to ${TEACHER_PRE_DOMAIN} (got ${teacherAfter.ext})`,
    );

    log('--- summary ---');
    log('joinCode:', joinCode, '→ expected mesh domain:', expectedDomain);
    log('teacher domain:', teacherMeshDomain, 'student domain:', studentMeshDomain);
    log('teacher input:', teacherInput);
    log('student input:', studentInput);
} catch (e) {
    log('ERROR:', e.message);
    failures.push(`error: ${e.message}`);
} finally {
    await archiveTestClasses();
}

// Keep the browser open for inspection only when running headful (or when
// KEEP_OPEN=1). In headless/container runs, close cleanly and exit 0 (all
// checks passed) or 1 (any FAIL) so the script is usable as a regression check.
log(failures.length === 0 ? 'checks: all passed' : `checks: ${failures.length} failed`);
if (!HEADLESS || process.env.KEEP_OPEN === '1') {
    log('done. browser will stay open for inspection. Ctrl+C to exit.');
    await new Promise(() => {});
} else {
    await teacherCtx.close();
    if (studentCtx) await studentCtx.close();
    if (failures.length > 0) {
        log(`NG (${failures.length} failed):`);
        for (const f of failures) log('  -', f);
        process.exit(1);
    }
    log('ALL OK');
    process.exit(0);
}
