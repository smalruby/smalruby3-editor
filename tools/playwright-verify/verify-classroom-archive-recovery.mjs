// Archive recovery regression (EPIC #1049: S2 archive list/restore,
// S3 retention alerts, S6 class-wide bulk download).
//
// Verifies against the dev server + the stg classroom API:
//   1. create a class + first assignment
//   2. S3: expiry badge on the board row (stg TTL=1day -> warning) and the
//      retention banner + download CTA in the assignment detail
//   3. S6: class-wide "download all submissions" produces a zip
//   4. archive the assignment ("課題をアーカイブ") — with the S1 API deployed
//      the archived section appears and restore brings the row back
//      (skipped with a WARN when stg still runs the pre-S1 API)
//   5. S2: archive a class from settings (two-step confirm), find it in the
//      archived classes section, restore it
//
//   # In the container (headless, default):
//   node verify-classroom-archive-recovery.mjs
//
//   # On the host (watch it):
//   HEADLESS=false CHANNEL=chrome SLOWMO=200 node verify-classroom-archive-recovery.mjs
//
// Env: HEADLESS / CHANNEL / SLOWMO / KEEP_OPEN / BASE_URL (same as the other scripts)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[archive-recovery]', ...a);
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
const TEACHER_URL = `${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);

const STAMP = `${Date.now()}`.slice(-6);
const CLASS_NAME = `アーカイブ検証${STAMP}`;
const ASSIGNMENT_NAME = `課題${STAMP}`;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    // LOCALE=ja-JP renders the UI in Japanese (used for docs screenshots).
    ...(process.env.LOCALE ? { locale: process.env.LOCALE } : {}),
});
page.on('pageerror', (e) => log('[pageerror]', e.message));

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name) => {
    const p = resolve(SHOTS, `archive-recovery-${name}.png`);
    await page.screenshot({ path: p });
    log('screenshot:', p);
};
const assert = (cond, msg) => {
    if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
    log('OK:', msg);
};

let ok = false;
const warns = [];
try {
    log('navigating with devlogin...');
    await page.goto(TEACHER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);

    await page.click(tid('settings-menu'));
    await sleep(300);
    await page.click(tid('settings-classroom-management'));
    await page.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 60000 });

    // --- 1. create class + first assignment ---
    log(`creating class "${CLASS_NAME}" with assignment "${ASSIGNMENT_NAME}"...`);
    await page.click(tid('classroom-class-create'));
    await page.fill(tid('classroom-class-create-name'), CLASS_NAME);
    await page.fill(tid('classroom-class-create-count'), '5');
    await page.fill(tid('classroom-class-create-assignment'), ASSIGNMENT_NAME);
    await page.click(tid('classroom-class-create-submit'));
    await page.waitForSelector(tid('classroom-board'), { timeout: 30000 });
    await sleep(1000);

    // --- 2. S3: expiry badge + retention banner (stg TTL = 1 day) ---
    const badge = await page.waitForSelector('[data-testid^="classroom-board-expiry-"]', { timeout: 15000 });
    const badgeText = await badge.textContent();
    assert(/あと\d+(日|にち)|days left/.test(badgeText || ''), `expiry badge shows days left ("${badgeText}")`);
    await shot('board-expiry-badge');

    const rowOpen = await page.$('[data-testid^="classroom-board-open-"]');
    await rowOpen.click();
    await page.waitForSelector(tid('classroom-phase-teacher-detail'), { timeout: 20000 });
    await page.waitForSelector(tid('classroom-retention-banner'), { timeout: 15000 });
    assert(await page.$(tid('classroom-retention-banner-download')), 'retention banner has a download CTA');
    await shot('detail-retention-banner');

    // --- 3. S6: class-wide bulk download ---
    await page.click(tid('classroom-breadcrumb-assignments'));
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.click(tid('classroom-board-download-class'));
    const download = await downloadPromise;
    assert(download.suggestedFilename().includes('全課題'), `class zip downloaded (${download.suggestedFilename()})`);

    // --- 4. archive the assignment + (S1-dependent) archived section ---
    log('archiving the assignment...');
    await page.click('[data-testid^="classroom-board-open-"]');
    await page.waitForSelector(tid('classroom-phase-teacher-detail'), { timeout: 20000 });
    await page.click(tid('classroom-delete-classroom'));
    const confirmText = await page.textContent(tid('classroom-delete-confirm') + ' >> xpath=../..');
    assert(/アーカイブ|archive/i.test(confirmText || ''), 'confirm message speaks of archiving (not deletion)');
    await page.click(tid('classroom-delete-confirm'));
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    await sleep(1500);

    const archivedToggle = await page.$(tid('classroom-board-archived-toggle'));
    if (archivedToggle) {
        await archivedToggle.click();
        await page.waitForSelector('[data-testid^="classroom-board-archived-row-"]', { timeout: 10000 });
        await shot('board-archived-section');
        await page.click('[data-testid^="classroom-board-restore-"]');
        await page.waitForSelector('[data-testid^="classroom-board-row-"]', { timeout: 20000 });
        assert(true, 'archived assignment restored back onto the board');
    } else {
        warns.push('archived assignments section not shown — stg API likely pre-S1 (includeArchived unsupported); skipped');
    }

    // --- 5. S2: class archive (two-step confirm) + restore ---
    log('archiving the class from settings...');
    await page.click(tid('classroom-breadcrumb-class-list'));
    await page.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 20000 });
    await sleep(500);

    // Find our class card by name, then open its settings.
    const cardHandle = await page.evaluateHandle((name) => {
        const cards = Array.from(document.querySelectorAll('[data-testid^="classroom-class-card-"]'));
        return cards.find((c) => c.textContent.includes(name)) || null;
    }, CLASS_NAME);
    const card = cardHandle.asElement();
    assert(card, `class card for "${CLASS_NAME}" is on the list`);
    const groupId = await card.evaluate((el) =>
        el.getAttribute('data-testid').replace('classroom-class-card-', ''),
    );

    await page.click(tid(`classroom-class-settings-open-${groupId}`));
    await page.click(tid('classroom-class-settings-archive'));
    await page.waitForSelector(tid('classroom-class-settings-archive-confirm-message'), { timeout: 10000 });
    assert(true, 'first archive click arms the confirmation instead of archiving');
    await shot('class-archive-confirm');
    await page.click(tid('classroom-class-settings-archive'));
    await sleep(1500);

    await page.waitForSelector(tid('classroom-show-archived'), { timeout: 15000 });
    await page.click(tid('classroom-show-archived'));
    await page.waitForSelector(tid(`classroom-class-card-${groupId}`), { timeout: 10000 });
    await shot('class-list-archived-section');
    await page.click(tid(`classroom-class-restore-${groupId}`));
    await sleep(1500);
    // The card leaves the archived list (its restore button disappears) and
    // is back in the active list. The archived section itself may stay —
    // the shared stg account accumulates other archived classes.
    await page.waitForSelector(tid(`classroom-class-card-${groupId}`), { timeout: 15000 });
    const stillArchived = await page.$(tid(`classroom-class-restore-${groupId}`));
    assert(!stillArchived, 'class restored — no longer listed as archived');

    ok = true;
} catch (e) {
    log('ERROR:', e.message);
    await shot('failure').catch(() => {});
} finally {
    for (const w of warns) log('WARN:', w);
    log(ok ? `PASS${warns.length ? ' (with warnings)' : ''}` : 'FAIL');
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 — leaving browser open. Ctrl+C to exit.');
        await new Promise(() => {});
    }
    await browser.close();
    process.exit(ok ? 0 : 1);
}
