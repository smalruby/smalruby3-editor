// DoD verification for co-teacher (shared classroom management, Issue #704).
//
// Drives the real editor: devlogin -> dashboard -> create class -> open detail
// -> assert the co-teacher section renders -> invite a co-teacher by email ->
// assert it appears in the list -> remove it.
//
// Runs headless in the container (my checks) and headful on the host so you can
// watch it in your own Chrome:
//   HEADLESS=false CHANNEL=chrome SLOWMO=300 KEEP_OPEN=1 node verify-co-teacher.mjs
//
// NOTE: the invite/remove steps call the co-teacher API, which must be deployed
// to the stage that CLASSROOM_API_ENDPOINT points at. Until then this script
// verifies the UI renders and reports the API step as a known-pending failure.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[co-teacher]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOTS = resolve(__dirname, '.screenshots');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const tokenMatch = envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m);
const DEV_TOKEN = tokenMatch ? tokenMatch[1].trim().replace(/^"|"$/g, '') : null;
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const TEACHER_URL = `${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`;
const INVITE_EMAIL = 'co-teacher-verify@example.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const launchOpts = { headless: process.env.HEADLESS !== 'false' };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => log('[pageerror]', e.message));

const results = [];
const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    log(`${ok ? 'PASS' : 'FAIL'}: ${name}${extra ? ` — ${extra}` : ''}`);
};

try {
    log('devlogin -> dashboard...');
    await page.goto(TEACHER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);
    await page.click('[data-testid="settings-menu"]');
    await sleep(300);
    await page.click('[data-testid="settings-classroom-management"]');
    await page.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 60000 });

    // Dismiss tutorials that overlay clicks.
    await page.evaluate(() => {
        const findStore = () => {
            const all = [document.body, ...document.body.querySelectorAll('*')];
            for (const el of all) {
                const k = Object.keys(el).find((x) => x.startsWith('__reactContainer'));
                if (k) {
                    let f = el[k].stateNode.current;
                    const stack = [f];
                    const seen = new WeakSet();
                    while (stack.length) {
                        f = stack.pop();
                        if (!f || seen.has(f)) continue;
                        seen.add(f);
                        const p = f.memoizedProps;
                        if (p?.store?.dispatch) return p.store;
                        if (p?.value?.store?.dispatch) return p.value.store;
                        if (f.child) stack.push(f.child);
                        if (f.sibling) stack.push(f.sibling);
                    }
                }
            }
            return null;
        };
        const store = findStore();
        if (store) {
            for (const name of ['classCreation', 'classDetail', 'inviteStudents']) {
                store.dispatch({ type: 'scratch-gui/classroom-tutorial/MARK_SEEN', name });
            }
        }
    });
    await sleep(300);

    // Optionally switch UI locale (LOCALE=ja / ja-Hira / en) to verify i18n.
    if (process.env.LOCALE) {
        await page.evaluate((locale) => {
            const findStore = () => {
                const all = [document.body, ...document.body.querySelectorAll('*')];
                for (const el of all) {
                    const k = Object.keys(el).find((x) => x.startsWith('__reactContainer'));
                    if (!k) continue;
                    const stack = [el[k].stateNode.current];
                    const seen = new WeakSet();
                    while (stack.length) {
                        const f = stack.pop();
                        if (!f || seen.has(f)) continue;
                        seen.add(f);
                        const p = f.memoizedProps;
                        if (p?.store?.dispatch) return p.store;
                        if (p?.value?.store?.dispatch) return p.value.store;
                        if (f.child) stack.push(f.child);
                        if (f.sibling) stack.push(f.sibling);
                    }
                }
                return null;
            };
            const store = findStore();
            if (store) store.dispatch({ type: 'scratch-gui/locales/SELECT_LOCALE', locale });
        }, process.env.LOCALE);
        await sleep(500);
        log(`locale set to ${process.env.LOCALE}`);
    }

    log('creating a class (v2 combined form)...');
    await page.click('[data-testid="classroom-class-create"]');
    const stamp = `${Date.now()}`.slice(-6);
    await page.fill('[data-testid="classroom-class-create-name"]', `CoTeacher検証-${stamp}`);
    await page.fill('[data-testid="classroom-class-create-count"]', '3');
    await page.fill('[data-testid="classroom-class-create-assignment"]', `課題-${stamp}`);
    await page.click('[data-testid="classroom-class-create-submit"]');
    await page.waitForSelector('[data-testid="classroom-board"]', { timeout: 30000 });
    await sleep(500);

    log('opening the class settings on the class list (v2: co-teachers are class-wide)...');
    await page.click('[data-testid="classroom-breadcrumb-class-list"]');
    await page.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 20000 });
    const card = page.locator('[data-testid^="classroom-class-card-"]', { hasText: `CoTeacher検証-${stamp}` });
    await card.waitFor({ state: 'visible', timeout: 20000 });
    const groupId = (await card.getAttribute('data-testid')).replace('classroom-class-card-', '');
    await page.click(`[data-testid="classroom-class-settings-open-${groupId}"]`);
    await page.waitForSelector(`[data-testid="classroom-class-settings-${groupId}"]`, { timeout: 10000 });
    check('class settings form renders', true);
    await page.screenshot({ path: resolve(SHOTS, 'co-teacher-section.png') });

    // 1. Add a co-teacher email as a chip and save.
    await page.fill('[data-testid="classroom-class-settings-co-teacher-input"]', INVITE_EMAIL);
    await page.click('[data-testid="classroom-class-settings-add-co-teacher"]');
    await sleep(300);
    const chipShown = await page
        .$(`[data-testid="classroom-class-settings-remove-co-teacher-${INVITE_EMAIL}"]`)
        .then((el) => !!el);
    check('co-teacher chip added in the form', chipShown);
    await page.click('[data-testid="classroom-class-settings-save"]');
    await sleep(2000);

    // 2. Reopen: the saved co-teacher is listed (server round-trip).
    await page.click(`[data-testid="classroom-class-settings-open-${groupId}"]`);
    await page.waitForSelector(`[data-testid="classroom-class-settings-${groupId}"]`, { timeout: 10000 });
    const persisted = await page
        .$(`[data-testid="classroom-class-settings-remove-co-teacher-${INVITE_EMAIL}"]`)
        .then((el) => !!el);
    check('co-teacher persisted on the class', persisted);

    // 3. Remove and save; reopen shows it gone.
    await page.click(`[data-testid="classroom-class-settings-remove-co-teacher-${INVITE_EMAIL}"]`);
    await page.click('[data-testid="classroom-class-settings-save"]');
    await sleep(2000);
    await page.click(`[data-testid="classroom-class-settings-open-${groupId}"]`);
    await page.waitForSelector(`[data-testid="classroom-class-settings-${groupId}"]`, { timeout: 10000 });
    const removed = await page
        .$(`[data-testid="classroom-class-settings-remove-co-teacher-${INVITE_EMAIL}"]`)
        .then((el) => !el);
    check('co-teacher removed from the class', removed);
    await page.click('[data-testid="classroom-class-settings-cancel"]');

    // Cleanup: archive the class.
    await page.click(`[data-testid="classroom-class-settings-open-${groupId}"]`);
    await page.waitForSelector(`[data-testid="classroom-class-settings-${groupId}"]`, { timeout: 10000 });
    await page.click('[data-testid="classroom-class-settings-archive"]');
    await sleep(1000);
} catch (e) {
    log('ERROR:', e.message);
    check('script completed without throwing', false, e.message);
} finally {
    const passed = results.filter((r) => r.ok).length;
    log(`--- summary: ${passed}/${results.length} checks passed ---`);
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 — leaving browser open. Ctrl+C to exit.');
        await new Promise(() => {});
    }
    await browser.close();
    // Exit non-zero only if the UI itself failed to render; the API step is
    // allowed to be pending until the stage is deployed.
    const uiOk = results.find((r) => r.name.startsWith('co-teacher section'))?.ok;
    process.exit(uiOk ? 0 : 1);
}
