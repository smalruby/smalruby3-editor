// Lesson-support Phase 1 (EPIC #974) end-to-end regression:
//   teacher: create class -> open assignment editor -> write 2 pages ->
//            set the open project as starter -> save
//   student: join with the class code -> assignment panel auto-opens ->
//            starter auto-loads -> pager works -> "Start Working!" closes
//   teacher: verify submission-free detail still works -> delete class
//
// Requires: dev server (BASE_URL, default http://localhost:8601) built from
// this branch + stg classroom backend + DEV_BYPASS_TOKEN in repo root .env.
//
//   node verify-lesson-support-phase1.mjs                    # headless (container)
//   HEADLESS=false CHANNEL=chrome node verify-lesson-support-phase1.mjs  # host
//
// Env: HEADLESS / CHANNEL / SLOWMO / KEEP_OPEN / BASE_URL (see smoke-teacher-dashboard.mjs)
//      DISABLE_WEB_SECURITY=1 -> chromium --disable-web-security. Needed when
//      BASE_URL is not localhost:8601 (the stg classroom API only allows that
//      origin in CORS). Test-only browser; never browse the web with it.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[lesson-support]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const ENV_PATH = resolve(REPO_ROOT, '.env');
const SHOTS = resolve(__dirname, '.screenshots');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(ENV_PATH, 'utf8');
const tokenMatch = envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m);
const DEV_TOKEN = tokenMatch ? tokenMatch[1].trim().replace(/^"|"$/g, '') : null;
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUN_TAG = new Date().toISOString().slice(11, 19);
const CLASS_NAME = `E2E課題配信 ${RUN_TAG}`;
const ASSIGNMENT_NAME = `ねこを動かそう ${RUN_TAG}`;

// The first-login tutorial overlay blocks clicks in a fresh browser profile.
const dismissTutorial = async (page) => {
    const dismiss = await page.$('[data-testid^="classroom-tutorial-dismiss-"]');
    if (dismiss) {
        await dismiss.click();
        await sleep(300);
    }
};

const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);
if (process.env.DISABLE_WEB_SECURITY === '1') {
    launchOpts.args = ['--disable-web-security'];
}

const assert = (cond, label) => {
    if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
    log(`  ok: ${label}`);
};

const browser = await chromium.launch(launchOpts);
let ok = false;
let teacherPage;
try {
    // ---------------- Teacher: create class + assignment ----------------
    teacherPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP' });
    teacherPage.on('pageerror', (e) => log('[teacher pageerror]', e.message));

    log('teacher: navigating with devlogin...');
    await teacherPage.goto(`${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`, {
        waitUntil: 'domcontentloaded',
    });
    await teacherPage.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);

    log('teacher: opening classroom management...');
    await teacherPage.click('[data-testid="settings-menu"]');
    await sleep(300);
    await teacherPage.click('[data-testid="settings-classroom-management"]');
    await teacherPage.waitForSelector('[data-testid="classroom-create"]', { timeout: 60000 });
    await dismissTutorial(teacherPage);

    log('teacher: creating class...');
    await teacherPage.click('[data-testid="classroom-create"]');
    await teacherPage.fill('[data-testid="classroom-name-input"]', CLASS_NAME);
    await teacherPage.fill('[data-testid="classroom-count-input"]', '5');
    await teacherPage.fill('[data-testid="classroom-assignment-name-input"]', ASSIGNMENT_NAME);
    await teacherPage.click('[data-testid="classroom-create-submit"]');
    // Creation returns to the dashboard; the new class appears in the sidebar
    // (grouped by class name; the clickable card shows the assignment name).
    await teacherPage.waitForSelector('[data-testid^="classroom-sidebar-item-"]', { timeout: 30000 });
    await sleep(1000);
    await dismissTutorial(teacherPage);
    const sidebarItem = teacherPage
        .locator('[data-testid^="classroom-sidebar-item-"]', { hasText: ASSIGNMENT_NAME })
        .first();
    await sidebarItem.click();
    await teacherPage.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    const joinCode = (await teacherPage.textContent('[data-testid="classroom-detail-join-code"]')).trim();
    assert(/^[a-z0-9]{6}$/.test(joinCode), `join code obtained (${joinCode})`);

    log('teacher: opening assignment editor...');
    await teacherPage.click('[data-testid="classroom-edit-assignment-content"]');
    await teacherPage.waitForSelector('[data-testid="classroom-phase-teacher-assignment-edit"]', { timeout: 20000 });
    await teacherPage.screenshot({ path: resolve(SHOTS, 'lesson-support-1-editor-empty.png') });

    log('teacher: writing pages...');
    await teacherPage.fill('[data-testid="classroom-assignment-page-text-0"]', 'ページ1: ねこを10歩動かすプログラムを作ろう');
    await teacherPage.click('[data-testid="classroom-assignment-add-page"]');
    await teacherPage.fill('[data-testid="classroom-assignment-page-text-1"]', 'ページ2: できたら「提出」ボタンで提出しよう');

    log('teacher: setting the open project as starter...');
    await teacherPage.click('[data-testid="classroom-assignment-starter-current"]');
    const starterStatus = await teacherPage.textContent('[data-testid="classroom-assignment-starter-status"]');
    assert(starterStatus.length > 0, 'starter status shown');
    await teacherPage.screenshot({ path: resolve(SHOTS, 'lesson-support-2-editor-filled.png') });

    log('teacher: saving assignment...');
    await teacherPage.click('[data-testid="classroom-assignment-save"]');
    await teacherPage.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 30000 });
    assert(true, 'assignment saved (returned to detail)');

    // ---------------- Student: join -> auto assignment ----------------
    log('student: opening classcode URL...');
    const studentPage = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'ja-JP' });
    studentPage.on('pageerror', (e) => log('[student pageerror]', e.message));
    await studentPage.goto(`${BASE_URL}/?no_beforeunload=1&classcode=${joinCode}`, {
        waitUntil: 'domcontentloaded',
    });
    await studentPage.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 90000 });
    await studentPage.click('[data-testid="classroom-seat-1"]');
    await studentPage.click('[data-testid="classroom-confirm-seat"]');

    log('student: waiting for the assignment panel (auto-open)...');
    await studentPage.waitForSelector('[data-testid="classroom-phase-student-assignment"]', { timeout: 30000 });
    const joined = await studentPage.textContent('[data-testid="classroom-assignment-joined-notice"]');
    assert(joined.includes('01'), 'joined notice shows seat 01');
    const page1 = await studentPage.textContent('[data-testid="classroom-assignment-view-text"]');
    assert(page1.includes('ねこを10歩'), 'page 1 text visible');
    await studentPage.screenshot({ path: resolve(SHOTS, 'lesson-support-3-student-assignment.png') });

    log('student: pager...');
    await studentPage.click('[data-testid="classroom-assignment-next-page"]');
    const page2 = await studentPage.textContent('[data-testid="classroom-assignment-view-text"]');
    assert(page2.includes('提出'), 'page 2 text visible');
    const indicator = await studentPage.textContent('[data-testid="classroom-assignment-page-indicator"]');
    assert(indicator.replace(/\s/g, '') === '2/2', 'page indicator 2/2');

    log('student: starter reload button present + close panel...');
    assert(await studentPage.$('[data-testid="classroom-assignment-reload-starter"]'), 'starter button present');
    await studentPage.click('[data-testid="classroom-assignment-close"]');
    await studentPage.waitForSelector('[data-testid="classroom-modal"]', { state: 'detached', timeout: 10000 });
    assert(true, 'panel closed (student lands in editor)');

    log('student: reopening the modal shows status with View Assignment...');
    await studentPage.click('[data-testid="classroom-menu-button"]');
    await studentPage.waitForSelector('[data-testid="classroom-phase-student-status"]', { timeout: 20000 });
    await studentPage.waitForSelector('[data-testid="classroom-view-assignment-button"]', { timeout: 20000 });
    await studentPage.click('[data-testid="classroom-view-assignment-button"]');
    await studentPage.waitForSelector('[data-testid="classroom-phase-student-assignment"]', { timeout: 20000 });
    assert(true, 'assignment reopened from status view');
    await studentPage.screenshot({ path: resolve(SHOTS, 'lesson-support-4-student-reopen.png') });

    ok = true;
    log('ALL PASS');
} catch (e) {
    log('ERROR:', e.message);
    try {
        await teacherPage?.screenshot({ path: resolve(SHOTS, 'lesson-support-error-teacher.png') });
    } catch { /* ignore */ }
} finally {
    // Cleanup: delete the class so stg stays tidy (best-effort).
    try {
        if (teacherPage) {
            log('cleanup: deleting class...');
            await teacherPage.bringToFront();
            const del = await teacherPage.$('[data-testid="classroom-delete"]');
            if (del) {
                await del.click();
                await sleep(300);
                const confirm = await teacherPage.$('[data-testid="classroom-delete-confirm"]');
                if (confirm) await confirm.click();
                await sleep(1000);
            }
        }
    } catch (e) {
        log('cleanup skipped:', e.message);
    }
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 set — leaving browser open. Ctrl+C to exit.');
        await new Promise(() => {});
    }
    await browser.close();
    process.exit(ok ? 0 : 1);
}
