// 先生の画面（モーダルを閉じた状態）で退室依頼のトーストが出て、その場で承認でき、
// 依頼した生徒がその席に自動で参加することを 3 つのブラウザで確かめる（#1200）。
// 前提: dev server（localhost:8601）が stg の classroom API を向いている・.env に DEV_BYPASS_TOKEN。
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[verify]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOT_DIR = resolve(process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp', 'verify-teacher-kick-toast'));
mkdirSync(SHOT_DIR, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const DEV_TOKEN = (envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m) || [])[1]?.trim().replace(/^"|"$/g, '');
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE = process.env.BASE_URL || 'http://localhost:8601/';
const HEADLESS = process.env.HEADLESS !== 'false';
// 授業 PC のビューポート（#1221）
const VIEWPORT = { width: 1300, height: 600 };

const browser = await chromium.launch({ headless: HEADLESS });
const open = async (name, url) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[${name}:err]`, e.message));
    if (process.env.TRACE && name === 'teacher') {
        page.on('response', (r) => {
            if (!r.url().includes('kick-request')) return;
            const path = r.url().replace(/^https:\/\/[^/]+/, '');
            if (path.startsWith('/kick-requests/pending') && r.status() === 200) {
                r.json().then((j) => console.log(`[${name}:net] ${new Date().toISOString().slice(11, 19)} pending`, `active=${j.activeAssignmentCount}`, JSON.stringify((j.requests || []).map((q) => [q.assignmentName || q.classroomName, q.seatNumber]))), () => {});
            } else console.log(`[${name}:net]`, r.request().method(), r.status(), path);
        });
        page.on('console', (m) => { if (/kick|poll/i.test(m.text())) console.log(`[${name}:console]`, m.text().slice(0, 200)); });
    }
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 120000 });
    await sleep(1000);
    return page;
};
const shot = (page, name) => page.screenshot({ path: resolve(SHOT_DIR, `${name}.png`) });
const fail = async (msg, pages) => {
    for (const [n, p] of Object.entries(pages)) await shot(p, `FAIL-${n}`).catch(() => {});
    console.error('[verify] FAIL:', msg);
    await browser.close();
    process.exit(1);
};

// === 先生: devlogin → クラス + 課題を作る → 参加コードを得る → モーダルを閉じる ===
const teacher = await open('teacher', `${BASE}?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`);
await teacher.click('[data-testid="settings-menu"]');
await sleep(300);
await teacher.click('[data-testid="settings-classroom-management"]');
await teacher.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 30000 });
// チュートリアルの吹き出しがクリックを奪わないよう、既読にする（mesh-v2-classroom-binding.mjs と同じ方法）
await teacher.evaluate(() => {
    const all = [document.body, ...document.body.querySelectorAll('*')];
    let root = null;
    for (const el of all) {
        const k = Object.keys(el).find((x) => x.startsWith('__reactContainer'));
        if (k) { root = el[k]; break; }
    }
    const stack = [root?.stateNode?.current];
    const seen = new WeakSet();
    while (stack.length && !window.__store) {
        const f = stack.pop();
        if (!f || seen.has(f)) continue;
        seen.add(f);
        const p = f.memoizedProps;
        if (p?.store?.dispatch) window.__store = p.store;
        else if (p?.value?.store?.dispatch) window.__store = p.value.store;
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
    }
    for (const name of ['classCreation', 'classDetail', 'inviteStudents']) {
        window.__store?.dispatch({ type: 'scratch-gui/classroom-tutorial/MARK_SEEN', name });
    }
});
const stamp = Date.now().toString().slice(-6);
const assignmentName = `退室依頼検証-${stamp}`;
await teacher.click('[data-testid="classroom-class-create"]');
await teacher.fill('[data-testid="classroom-class-create-name"]', `自動検証-${stamp}`);
await teacher.fill('[data-testid="classroom-class-create-count"]', '5');
await teacher.fill('[data-testid="classroom-class-create-assignment"]', assignmentName);
await teacher.click('[data-testid="classroom-class-create-submit"]');
await teacher.waitForSelector('[data-testid="classroom-board"]', { timeout: 30000 });
await teacher.waitForFunction(
    (label) => [...document.querySelectorAll('[data-testid^="classroom-board-open-"]')].some((el) => el.textContent.includes(label)),
    assignmentName,
    { timeout: 30000 },
);
await teacher.evaluate((label) => {
    [...document.querySelectorAll('[data-testid^="classroom-board-open-"]')].find((el) => el.textContent.includes(label)).click();
}, assignmentName);
await teacher.waitForSelector('[data-testid="classroom-detail-join-code"]', { timeout: 30000 });
const joinCode = (await teacher.textContent('[data-testid="classroom-detail-join-code"]')).replace(/[^A-Za-z0-9]/g, '');
log('join code:', joinCode);
// モーダルを閉じて、メイン画面で通知を待つ
await teacher.evaluate(() => {
    window.__store.dispatch({ type: 'scratch-gui/modals/CLOSE_MODAL', modal: 'teacherClassroomModal' });
    window.__store.dispatch({ type: 'scratch-gui/classroom/CLOSE_TEACHER_MODAL' });
});
await sleep(800);
const teacherMenu = await teacher.$('[data-testid="classroom-teacher-menu-button"]');
log('teacher menu on menu bar:', !!teacherMenu, 'modal open:', !!(await teacher.$('[data-testid="classroom-modal"]')));
await shot(teacher, '01-teacher-main-before');

// === 生徒 A: 席 1 に座る ===
const joinSeat = async (name, seat) => {
    const page = await open(name, `${BASE}?no_beforeunload=1&classcode=${joinCode.toLowerCase()}`);
    await page.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 30000 });
    await page.waitForSelector(`[data-testid="classroom-seat-${seat}"]`, { timeout: 15000 });
    await page.click(`[data-testid="classroom-seat-${seat}"]`);
    return page;
};
const studentA = await joinSeat('studentA', 1);
await studentA.click('[data-testid="classroom-confirm-seat"]');
await studentA.waitForSelector('[data-testid="classroom-phase-student-joined"]', { timeout: 20000 });
log('student A joined seat 1');

// === 生徒 B: 埋まっている席 1 を押して退室依頼を送る ===
const studentB = await joinSeat('studentB', 1);
await studentB.waitForSelector('[data-testid="kick-request-confirm-dialog"]', { timeout: 15000 });
await studentB.fill('[data-testid="kick-request-reason-input"]', '自分の席です');
await studentB.click('[data-testid="kick-request-submit"]');
await studentB.waitForSelector('[data-testid="kick-request-pending-banner"]', { timeout: 15000 });
const sentAt = Date.now();
log('student B sent a kick request for seat 1');
await shot(studentB, '02-studentB-pending');

// === 先生: メイン画面にトーストが出る（ポーリング 10 秒 + 余裕） ===
// トーストは一番古い依頼を先頭に出す。前の実行で残った検証用の依頼（stg・1 時間で消える）が
// 先頭にあるときは「却下」で片付けて、今回の課題名の依頼が先頭に来るのを待つ
const deadline = Date.now() + 60000;
let toast = null;
while (Date.now() < deadline) {
    const el = await teacher.$('[data-testid="classroom-teacher-kick-toast"]');
    const text = el ? await el.textContent() : '';
    if (el && text.includes(assignmentName)) { toast = el; break; }
    if (el && /退室依頼検証-\d+/.test(text)) {
        log('rejecting a leftover request from an earlier run:', text.match(/退室依頼検証-\d+/)[0]);
        await teacher.click('[data-testid="classroom-teacher-kick-toast-reject"]').catch(() => {});
        await sleep(1500);
        continue;
    }
    await sleep(1000);
}
if (toast) log('first poll after the request already includes it (see net log)');
if (!toast) await fail('teacher toast did not appear within 40s', { teacher, studentB });
log(`toast appeared after ${Math.round((Date.now() - sentAt) / 1000)}s:`, (await toast.textContent()).replace(/\s+/g, ' ').slice(0, 120));
const badge = await teacher.$('[data-testid="classroom-teacher-menu-badge"]');
log('teacher menu badge:', badge ? (await badge.textContent()).trim() : '(none)');
const box = await toast.boundingBox();
log('toast box:', box, 'fits 600px:', box && box.y >= 0 && box.y + box.height <= VIEWPORT.height);
await shot(teacher, '03-teacher-toast');

// === 先生: トーストで承認 → 生徒 B が席 1 に自動で参加する ===
await teacher.click('[data-testid="classroom-teacher-kick-toast-approve"]');
await teacher
    .waitForSelector('[data-testid="classroom-teacher-kick-toast"]', { state: 'detached', timeout: 15000 })
    .catch(() => log('toast still visible after approve'));
await shot(teacher, '04-teacher-after-approve');
const joinedB = await studentB
    .waitForSelector('[data-testid="classroom-phase-student-joined"], [data-testid="classroom-menu-seat-number"]', { timeout: 30000 })
    .catch(() => null);
if (!joinedB) await fail('student B did not auto-join after approve', { teacher, studentB });
await sleep(500);
const seatB = await studentB.$('[data-testid="classroom-joined-seat-number"], [data-testid="classroom-menu-seat-number"]');
log('student B joined, seat:', seatB ? (await seatB.textContent()).trim() : '?');
await shot(studentB, '05-studentB-joined');
log('PASS');
await browser.close();
