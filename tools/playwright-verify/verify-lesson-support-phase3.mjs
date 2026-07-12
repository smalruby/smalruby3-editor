// Lesson-support Phase 3 (EPIC #974) — AI evaluation E2E:
//   teacher: create group + lesson in it
//   student: join -> submit the open project
//   teacher: group manage -> Evaluate -> load submissions (sb3 static
//            analysis in-browser) -> run AI grading (real Claude via stg) ->
//            matrix shows a grade -> draft a student comment -> return it
//   student: reopens the modal and sees the returned comment
//
// Same env/vars as verify-lesson-support-phase1.mjs. Requires the stg
// classroom backend with ANTHROPIC_API_KEY configured.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[lesson-support-p3]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOTS = resolve(__dirname, '.screenshots');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const DEV_TOKEN = (envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m)?.[1] || '').trim().replace(/^"|"$/g, '');
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUN_TAG = new Date().toISOString().slice(11, 19);
const GROUP_NAME = `E2E評価組 ${RUN_TAG}`;
const CLASS_NAME = `E2E評価 ${RUN_TAG}`;
const ASSIGNMENT_NAME = `第1回 ${RUN_TAG}`;

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
if (process.env.DISABLE_WEB_SECURITY === '1') launchOpts.args = ['--disable-web-security'];

const assert = (cond, label) => {
    if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
    log(`  ok: ${label}`);
};

const browser = await chromium.launch(launchOpts);
let ok = false;
let teacherPage;
let studentPage;
try {
    // ---- Teacher: group + lesson ----
    teacherPage = await browser.newPage({ viewport: { width: 1600, height: 950 }, locale: 'ja-JP' });
    teacherPage.on('pageerror', (e) => log('[teacher pageerror]', e.message));
    log('teacher: login + create group and lesson...');
    await teacherPage.goto(`${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`, {
        waitUntil: 'domcontentloaded',
    });
    await teacherPage.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);
    await teacherPage.click('[data-testid="settings-menu"]');
    await sleep(300);
    await teacherPage.click('[data-testid="settings-classroom-management"]');
    // v2: login lands on the class list; class + first assignment in one form
    await teacherPage.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 60000 });
    await teacherPage.click('[data-testid="classroom-class-create"]');
    await teacherPage.fill('[data-testid="classroom-class-create-name"]', GROUP_NAME);
    await teacherPage.fill('[data-testid="classroom-class-create-count"]', '3');
    await teacherPage.fill('[data-testid="classroom-class-create-assignment"]', ASSIGNMENT_NAME);
    await teacherPage.click('[data-testid="classroom-class-create-submit"]');
    await teacherPage.waitForSelector('[data-testid="classroom-board"]', { timeout: 30000 });
    await sleep(500);
    await dismissTutorial(teacherPage);
    await teacherPage
        .locator('[data-testid^="classroom-board-open-"]')
        .first()
        .click();
    await teacherPage.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    // Combined creation already assigned the lesson to the class
    const selectedGroupLabel = await teacherPage
        .locator('[data-testid="classroom-detail-group-select"] option:checked')
        .textContent();
    assert(selectedGroupLabel.includes(GROUP_NAME), 'lesson already assigned to the class');
    const joinCode = (await teacherPage.textContent('[data-testid="classroom-detail-join-code"]')).trim();
    assert(/^[a-z0-9]{6}$/.test(joinCode), `lesson in group, join code ${joinCode}`);

    // ---- Student: join + submit ----
    log('student: join and submit the open project...');
    studentPage = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'ja-JP' });
    studentPage.on('pageerror', (e) => log('[student pageerror]', e.message));
    await studentPage.goto(`${BASE_URL}/?no_beforeunload=1&classcode=${joinCode}`, {
        waitUntil: 'domcontentloaded',
    });
    await studentPage.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 90000 });
    await studentPage.click('[data-testid="classroom-seat-1"]');
    await studentPage.click('[data-testid="classroom-confirm-seat"]');
    await studentPage.waitForSelector('[data-testid="classroom-phase-student-joined"]', { timeout: 30000 });
    await studentPage.click('[data-testid="classroom-joined-close"]');
    await sleep(500);
    // Submit via the class menu (status view)
    await studentPage.click('[data-testid="classroom-menu-button"]');
    await studentPage.waitForSelector('[data-testid="classroom-submit-button"]', { timeout: 20000 });
    await studentPage.click('[data-testid="classroom-submit-button"]');
    await studentPage.waitForSelector('[data-testid="classroom-submit-confirm"]', { timeout: 20000 });
    await studentPage.click('[data-testid="classroom-submit-confirm"]');
    await studentPage.waitForSelector('[data-testid="classroom-submit-status"]', { timeout: 60000 });
    assert(true, 'student submitted');

    // ---- Teacher: evaluation flow ----
    log('teacher: evaluation screen...');
    await teacherPage.bringToFront();
    await teacherPage.click('[data-testid="classroom-group-manage"]');
    await teacherPage.waitForSelector('[data-testid="classroom-phase-teacher-group-manage"]', { timeout: 20000 });
    const row = teacherPage
        .locator('[data-testid^="classroom-group-row-"]')
        .filter({ has: teacherPage.locator(`input[value="${GROUP_NAME}"]`) });
    await row.locator('[data-testid^="classroom-group-evaluate-"]').click();
    await teacherPage.waitForSelector('[data-testid="classroom-phase-teacher-evaluation"]', { timeout: 20000 });

    log('teacher: load submissions (in-browser sb3 analysis)...');
    await teacherPage.click('[data-testid="classroom-eval-load"]');
    await teacherPage.waitForSelector('[data-testid="classroom-eval-matrix"]', { timeout: 60000 });
    assert(await teacherPage.$('[data-testid^="classroom-eval-cell-1-"]'), 'matrix has seat 1 cell');
    await teacherPage.screenshot({ path: resolve(SHOTS, 'lesson-support-p3-1-matrix.png') });

    log('teacher: run AI grading (real Claude via stg)...');
    await teacherPage.click('[data-testid="classroom-eval-run-grade"]');
    await teacherPage.waitForFunction(
        () => {
            const select = document.querySelector('[data-testid^="classroom-eval-grade-1-"]');
            return select && ['S', 'A', 'B', 'C'].includes(select.value);
        },
        { timeout: 90000 },
    );
    const grade = await teacherPage.$eval('[data-testid^="classroom-eval-grade-1-"]', (el) => el.value);
    const reason = await teacherPage.$eval('[data-testid^="classroom-eval-reason-1-"]', (el) => el.value);
    assert(['S', 'A', 'B', 'C'].includes(grade), `AI grade proposed: ${grade}`);
    assert(reason.length > 0, `AI reason present: ${reason.slice(0, 40)}…`);
    const overall = await teacherPage.textContent('[data-testid="classroom-eval-overall-1"]');
    assert(['S', 'A', 'B', 'C'].includes(overall.trim()), `overall grade shown: ${overall.trim()}`);
    await teacherPage.screenshot({ path: resolve(SHOTS, 'lesson-support-p3-2-graded.png') });

    log('teacher: draft + return a student comment...');
    await teacherPage.click('[data-testid="classroom-eval-run-comment"]');
    await teacherPage.waitForFunction(
        () => {
            const textarea = document.querySelector('[data-testid^="classroom-eval-comment-1-"]');
            return textarea && textarea.value.length > 10;
        },
        { timeout: 90000 },
    );
    const comment = await teacherPage.$eval('[data-testid^="classroom-eval-comment-1-"]', (el) => el.value);
    assert(comment.length > 10, `comment drafted: ${comment.slice(0, 40)}…`);
    await teacherPage.click('[data-testid="classroom-eval-return-comments"]');
    await sleep(3000);
    await teacherPage.screenshot({ path: resolve(SHOTS, 'lesson-support-p3-3-comment.png') });

    // ---- Student: sees the returned comment ----
    log('student: verify the returned comment...');
    await studentPage.bringToFront();
    await studentPage.click('[data-testid="classroom-student-refresh"]');
    await studentPage.waitForSelector('[data-testid="classroom-status-teacher-comment"]', { timeout: 30000 });
    const shown = await studentPage.textContent('[data-testid="classroom-status-teacher-comment"]');
    assert(shown.includes(comment.slice(0, 10)), 'student sees the returned comment');
    await studentPage.screenshot({ path: resolve(SHOTS, 'lesson-support-p3-4-student-comment.png') });

    ok = true;
    log('ALL PASS');
} catch (e) {
    log('ERROR:', e.message);
    try {
        await teacherPage?.screenshot({ path: resolve(SHOTS, 'lesson-support-p3-error-teacher.png') });
        await studentPage?.screenshot({ path: resolve(SHOTS, 'lesson-support-p3-error-student.png') });
    } catch {
        /* ignore */
    }
} finally {
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 — leaving browser open.');
        await new Promise(() => {});
    }
    await browser.close();
    process.exit(ok ? 0 : 1);
}
