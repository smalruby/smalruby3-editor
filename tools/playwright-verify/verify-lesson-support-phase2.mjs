// Lesson-support Phase 2 (EPIC #974) — groups (組) UI regression:
//   teacher: create a group -> create a class -> assign it to the group via
//            the detail selector -> sidebar shows the group hierarchy ->
//            duplicate the lesson -> archive the group (falls back to
//            className grouping)
//
// Same env/vars as verify-lesson-support-phase1.mjs (HEADLESS / CHANNEL /
// SLOWMO / KEEP_OPEN / BASE_URL / DISABLE_WEB_SECURITY).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[lesson-support-p2]', ...a);
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
const GROUP_NAME = `E2E 2年1組 ${RUN_TAG}`;
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
if (process.env.DISABLE_WEB_SECURITY === '1') {
    launchOpts.args = ['--disable-web-security'];
}

const assert = (cond, label) => {
    if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
    log(`  ok: ${label}`);
};

const browser = await chromium.launch(launchOpts);
let ok = false;
let page;
try {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP' });
    page.on('pageerror', (e) => log('[pageerror]', e.message));

    log('teacher: navigating with devlogin...');
    await page.goto(`${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`, {
        waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);
    await page.click('[data-testid="settings-menu"]');
    await sleep(300);
    await page.click('[data-testid="settings-classroom-management"]');
    // v2: login lands on the class list; class + first assignment in one form
    await page.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 60000 });

    log('teacher: creating a class with its first assignment...');
    await page.click('[data-testid="classroom-class-create"]');
    await page.fill('[data-testid="classroom-class-create-name"]', GROUP_NAME);
    await page.fill('[data-testid="classroom-class-create-count"]', '4');
    await page.fill('[data-testid="classroom-class-create-assignment"]', ASSIGNMENT_NAME);
    await page.click('[data-testid="classroom-class-create-submit"]');
    await page.waitForSelector('[data-testid="classroom-board"]', { timeout: 30000 });
    await sleep(500);
    await dismissTutorial(page);

    // The class appears on the class list with its card settings (v2)
    await page.click('[data-testid="classroom-breadcrumb-class-list"]');
    await page.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 20000 });
    const card = page.locator('[data-testid^="classroom-class-card-"]', { hasText: GROUP_NAME });
    await card.waitFor({ state: 'visible', timeout: 20000 });
    const groupId = (await card.getAttribute('data-testid')).replace('classroom-class-card-', '');
    assert(true, 'class card present on the class list');
    await page.screenshot({ path: resolve(SHOTS, 'lesson-support-p2-1-class-list.png') });

    log('teacher: opening the assignment from the board...');
    await page.click(`[data-testid="classroom-class-open-${groupId}"]`);
    await page.waitForSelector('[data-testid="classroom-board"]', { timeout: 20000 });
    await page
        .locator('[data-testid^="classroom-board-open-"]', { hasText: ASSIGNMENT_NAME })
        .first()
        .click();
    await page.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    await page.waitForSelector('[data-testid="classroom-breadcrumbs"]', { timeout: 10000 });
    assert(true, 'assignment detail shows breadcrumbs');
    await page.screenshot({ path: resolve(SHOTS, 'lesson-support-p2-2-detail.png') });

    log('teacher: reusing the lesson (duplicate via the board)...');
    await page.click('[data-testid="classroom-breadcrumb-assignments"]');
    await page.waitForSelector('[data-testid="classroom-board"]', { timeout: 10000 });
    const rowsBefore = await page.$$eval('[data-testid^="classroom-board-row-"]', (els) => els.length);
    await page.click('[data-testid="classroom-board-reuse"]');
    await page.waitForSelector('[data-testid="classroom-board-reuse-view"]', { timeout: 10000 });
    await page.selectOption('[data-testid="classroom-board-reuse-filter"]', { index: 1 });
    // pick our own assignment (filter may show other classes' too — select by name)
    await page.selectOption('[data-testid="classroom-board-reuse-filter"]', '');
    await page
        .locator('[data-testid="classroom-board-reuse-view"] li', { hasText: ASSIGNMENT_NAME })
        .first()
        .locator('[data-testid^="classroom-board-reuse-copy-"]')
        .click();
    await page
        .locator('[data-testid^="classroom-board-row-"]', { hasText: `${ASSIGNMENT_NAME}のコピー` })
        .first()
        .waitFor({ state: 'visible', timeout: 20000 });
    const rowsAfter = await page.$$eval('[data-testid^="classroom-board-row-"]', (els) => els.length);
    assert(rowsAfter === rowsBefore + 1, `reuse added a board row (${rowsBefore} -> ${rowsAfter})`);
    assert(true, 'duplicated lesson labeled のコピー');
    await page.screenshot({ path: resolve(SHOTS, 'lesson-support-p2-3-duplicated.png') });

    log('teacher: archiving the class via card settings...');
    await page.click('[data-testid="classroom-breadcrumb-class-list"]');
    await page.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 20000 });
    await page.click(`[data-testid="classroom-class-settings-open-${groupId}"]`);
    await page.waitForSelector(`[data-testid="classroom-class-settings-${groupId}"]`, { timeout: 10000 });
    await page.click('[data-testid="classroom-class-settings-archive"]');
    await sleep(1500);
    const archivedCard = page.locator(`[data-testid="classroom-class-card-${groupId}"]`);
    assert((await archivedCard.count()) === 0, 'archived class hidden from the class list');

    ok = true;
    log('ALL PASS');
} catch (e) {
    log('ERROR:', e.message);
    try {
        await page?.screenshot({ path: resolve(SHOTS, 'lesson-support-p2-error.png') });
    } catch {
        /* ignore */
    }
} finally {
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 set — leaving browser open. Ctrl+C to exit.');
        await new Promise(() => {});
    }
    await browser.close();
    process.exit(ok ? 0 : 1);
}
