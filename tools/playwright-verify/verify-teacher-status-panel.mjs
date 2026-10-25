// 先生用フローティングパネル「いまの課題の状況」（#1203）を 1300×600 で確かめる。
// classroom API はスタブ（page.route）なので stg / DEV_BYPASS_TOKEN は不要。
// - 40 席・退室依頼 3 件（最大の状態）でパネルが画面内に収まる
// - パネルを出したままブロックをドラッグできる
// - 最小化 / 元に戻す
// - 退室依頼をパネルから承認できる（approve API が呼ばれ、一覧から消える）
// 前提: dev server（BASE_URL、既定 localhost:8601）・リポジトリ直下の .env に CLASSROOM_API_ENDPOINT。
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[verify]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOT_DIR = resolve(process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp', 'verify-teacher-status-panel'));
mkdirSync(SHOT_DIR, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const API = (envText.match(/^CLASSROOM_API_ENDPOINT=(.+)$/m) || [])[1]?.trim().replace(/^"|"$/g, '').replace(/\/$/, '');
if (!API) throw new Error('CLASSROOM_API_ENDPOINT missing in .env');

const BASE = process.env.BASE_URL || 'http://localhost:8601/';
const HEADLESS = process.env.HEADLESS !== 'false';
// 授業 PC のビューポート（#1221）
const VIEWPORT = { width: 1300, height: 600 };
const SEATS = 40;

// --- スタブデータ ---
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const classrooms = [
    { classroomId: 'c1', className: '1年1組', assignmentName: 'じゃんけんゲーム', studentCount: SEATS, groupId: 'g1', status: 'active', sortDate: iso(now), joinCode: 'abcd' },
    { classroomId: 'c2', className: '1年2組', assignmentName: 'お絵かき', studentCount: 30, groupId: 'g2', status: 'active', sortDate: iso(now - 86400000), joinCode: 'efgh' },
];
const members = Array.from({ length: 36 }, (_, i) => ({
    memberId: `seat-${String(i + 1).padStart(2, '0')}`,
    seatNumber: i + 1,
    nickname: `せいと${i + 1}`,
    lastActiveAt: iso(i % 4 === 3 ? now - 2 * 3600000 : now - 60000),
}));
const submissions = members
    .filter((_, i) => i % 3 === 0)
    .map((m) => ({ memberId: m.memberId, submissionId: `s-${m.memberId}`, submittedAt: iso(now), status: 'submitted' }));
let kickRequests = [5, 12, 27].map((seat, i) => ({
    requestId: `r${i + 1}`,
    classroomId: 'c1',
    groupId: 'g1',
    className: '1年1組',
    assignmentName: 'じゃんけんゲーム',
    seatNumber: seat,
    occupantName: `せいと${seat}`,
    reason: 'わたしの席です',
    createdAt: iso(now - (3 - i) * 60000),
}));
const calls = [];

const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[page:err]', e.message));
await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const path = req.url().slice(API.length).split('?')[0];
    const method = req.method();
    calls.push(`${method} ${path}`);
    const json = (body) =>
        route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (method === 'OPTIONS') {
        return route.fulfill({
            status: 204,
            headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' },
        });
    }
    if (path === '/classrooms') return json({ classrooms });
    if (path === '/kick-requests/pending') return json({ requests: kickRequests, activeAssignmentCount: 2 });
    const approve = path.match(/^\/classrooms\/(\w+)\/kick-requests\/(\w+)\/approve$/);
    if (approve) {
        const r = kickRequests.find((k) => k.requestId === approve[2]);
        kickRequests = kickRequests.filter((k) => k.requestId !== approve[2]);
        if (r) {
            const idx = members.findIndex((m) => m.seatNumber === r.seatNumber);
            if (idx >= 0) members.splice(idx, 1);
        }
        return json({ ok: true });
    }
    if (/^\/classrooms\/c1\/members$/.test(path)) return json({ members });
    if (/^\/classrooms\/c1\/submissions$/.test(path)) return json({ submissions });
    if (/^\/classrooms\/c2\/members$/.test(path)) return json({ members: [] });
    if (/^\/classrooms\/c2\/submissions$/.test(path)) return json({ submissions: [] });
    if (path === '/notifications') return json({ notifications: [] });
    return json({});
});

const shot = (name) => page.screenshot({ path: resolve(SHOT_DIR, `${name}.png`) });
const fail = async (msg) => {
    await shot('FAIL').catch(() => {});
    console.error('[verify] FAIL:', msg);
    await browser.close();
    process.exit(1);
};
const check = (cond, msg) => (cond ? log('OK', msg) : fail(msg));

await page.goto(`${BASE}?no_beforeunload=1&devlogin=stub-token`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 180000 });
await page.waitForSelector('[data-testid="classroom-teacher-menu-button"]', { timeout: 30000 });
await sleep(1000);

// メニュー → いまの課題の状況
await page.click('[data-testid="classroom-teacher-menu-button"]');
await page.click('[data-testid="classroom-teacher-menu-status-panel"]');
await page.waitForSelector('[data-testid="classroom-teacher-panel"]');
// 最初は課題が未選択 → 課題を選ぶ
await page.selectOption('[data-testid="classroom-teacher-panel-assignment"]', 'c1');
await page.waitForSelector('[data-testid="classroom-teacher-panel-seat-40"]');
await page.waitForFunction(() =>
    document.querySelectorAll('[data-testid="classroom-teacher-panel-kick-request"]').length === 3);
await page.waitForFunction(() =>
    /27/.test(document.querySelector('[data-testid="classroom-teacher-panel-seated"]')?.textContent || ''));
await sleep(500);

const rect = await page.$eval('[data-testid="classroom-teacher-panel"]', (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height };
});
log('panel rect', JSON.stringify(rect));
await check(rect.top >= 0 && rect.left >= 0 && rect.bottom <= VIEWPORT.height && rect.right <= VIEWPORT.width,
    `40 seats + 3 kick requests fit in ${VIEWPORT.width}x${VIEWPORT.height}`);
const bodyScroll = await page.$eval('[data-testid="classroom-teacher-panel-body"]', (el) => el.scrollHeight - el.clientHeight);
log('panel body overflow px', bodyScroll);
await check(
    (await page.textContent('[data-testid="classroom-teacher-panel-seated"]')).includes('着席（目安） 27 / 40'),
    'seated (approx.) count');
await check(
    (await page.textContent('[data-testid="classroom-teacher-panel-submitted"]')).includes('提出 12 / 36'),
    'submitted / joined count');
await shot('01-panel-1300x600');

// パネル表示中にブロックをドラッグできる
const countBlocks = () =>
    page.evaluate(() => document.querySelectorAll('.blocklyMainBackground ~ .blocklyBlockCanvas > .blocklyDraggable, svg.blocklySvg > g.blocklyWorkspace > g.blocklyBlockCanvas > g.blocklyDraggable').length);
const before = await countBlocks();
const src = await page.$('.blocklyFlyout .blocklyBlockCanvas > .blocklyDraggable');
const box = await src.boundingBox();
await page.mouse.move(box.x + 10, box.y + 10);
await page.mouse.down();
await page.mouse.move(box.x + 150, box.y + 60, { steps: 8 });
await page.mouse.move(box.x + 300, box.y + 120, { steps: 8 });
await page.mouse.up();
await sleep(500);
const after = await countBlocks();
log('workspace blocks', before, '->', after);
await check(after === before + 1, 'a block can be dragged into the workspace while the panel is shown');
await shot('02-dragged-block');

// パネル自体をドラッグして位置を記憶
const header = await page.$('[data-testid="classroom-teacher-panel-header"]');
const hb = await header.boundingBox();
await page.mouse.move(hb.x + 40, hb.y + hb.height / 2);
await page.mouse.down();
await page.mouse.move(hb.x - 200, hb.y + hb.height / 2 - 50, { steps: 10 });
await page.mouse.up();
const stored = await page.evaluate(() => localStorage.getItem('smalruby:classroomTeacherPanelPosition'));
await check(!!stored, `panel position remembered (${stored})`);

// 最小化 / 元に戻す
await page.click('[data-testid="classroom-teacher-panel-minimize"]');
await check(!(await page.$('[data-testid="classroom-teacher-panel-body"]')), 'minimized: body hidden');
await check(!!(await page.$('[data-testid="classroom-teacher-panel-header-counts"]')), 'minimized: header shows counts');
await shot('03-minimized');
await page.click('[data-testid="classroom-teacher-panel-minimize"]');
await page.waitForSelector('[data-testid="classroom-teacher-panel-body"]');
log('OK restored');

// 退室依頼の承認
await page.click('[data-testid="classroom-teacher-panel-kick-request"][data-request-id="r1"] [data-testid="classroom-teacher-panel-kick-approve"]');
await page.waitForFunction(() =>
    document.querySelectorAll('[data-testid="classroom-teacher-panel-kick-request"]').length === 2);
await check(calls.includes('POST /classrooms/c1/kick-requests/r1/approve'), 'approve API called');
await shot('04-approved');

// 閉じる
await page.click('[data-testid="classroom-teacher-panel-close"]');
await check(!(await page.$('[data-testid="classroom-teacher-panel"]')), 'closed');

log('PASS');
await browser.close();
