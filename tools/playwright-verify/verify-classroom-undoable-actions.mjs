// 取り消せる操作の扱い (#1923) を 1300×600 で確かめる。
//   C2: クラス設定と課題のアーカイブの確認の［アーカイブする］は赤ではなく主ボタン（青）。
//   C3: メンバー詳細の「退室させる」は ⋮ の中。押すと「出席番号 N の生徒を課題から
//       退室させますか？（作品は残ります）」の確認を挟み、［退室させる］で DELETE が出る。
//   C14: メンバー詳細の退室依頼の［承認］は、トースト・状況のパネルと同じオレンジ（$error-primary）。
// 確定のボタンの下端が 600 以下か、本文・ページが縦にスクロールしないかを測り、一覧で出す。
// classroom API は page.route でスタブするので、dev server だけが前提（ログイン・stg 不要）。
// 採点画面を離れるときの確認 (C4) は verify-classroom-grading.mjs が測る。
//
//   node verify-classroom-undoable-actions.mjs                  # ja と ja-Hira（headless）
//   LOCALES=ja node verify-classroom-undoable-actions.mjs
//   DOCS_SHOTS=1 node verify-classroom-undoable-actions.mjs     # + docs/classroom/screenshots（ja のとき）
//   BASE=http://localhost:8611 node verify-classroom-undoable-actions.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_DIR = resolve(REPO_ROOT, 'docs/classroom/screenshots');
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
const LOCALES = (process.env.LOCALES || 'ja,ja-Hira').split(',');
const VIEWPORT = { width: 1300, height: 600 };
mkdirSync(SHOT_DIR, { recursive: true });

const now = Date.now();
const minutesAgo = (m) => new Date(now - m * 60 * 1000).toISOString();
const SEATS = 40;
const seatId = (n) => `seat-${String(n).padStart(2, '0')}`;
const classroom = {
    classroomId: 'c1',
    className: '技術',
    assignmentName: 'ねこ迷路ゲーム',
    joinCode: 'abc234',
    studentCount: SEATS,
    googleClassroomCourseId: null,
    googleClassroomAlternateLink: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    expiresAt: '2027-02-03T00:00:00.000Z',
    coTeacherEmails: [],
    groupId: 'g1',
    topic: null,
    sortDate: '2026-11-01T00:00:00.000Z',
    hasAssignment: true,
    status: 'active',
    role: 'owner',
};
const group = {
    groupId: 'g1',
    name: '技術',
    year: 2026,
    section: '2年1組',
    studentCount: SEATS,
    status: 'active',
    schemaVersion: 2,
    topics: [],
    coTeacherEmails: [],
};
// seat 4 は来ていない（退室依頼あり）、9 の倍数は未参加、ほかは参加済み。
const members = Array.from({ length: SEATS }, (_, i) => i + 1)
    .filter((n) => n % 9 !== 0)
    .map((n) => ({
        memberId: seatId(n),
        displayName: String(n).padStart(2, '0'),
        lastActiveAt: minutesAgo(n === 4 || n % 5 === 0 ? 240 : 2),
    }));
const submissions = members
    .filter((m) => !['seat-01', 'seat-04', 'seat-07'].includes(m.memberId))
    .map((m, i) => ({
        submissionId: `s-${m.memberId}`,
        memberId: m.memberId,
        status: i % 6 === 1 ? 'returned' : 'submitted',
        submittedAt: minutesAgo(20 + i),
        projectName: 'ねこ迷路ゲーム',
        projectUrl: `https://example.invalid/${m.memberId}.sb3`,
        screenshotUrls: [],
        hiddenFromPeers: false,
    }));
const kickRequests = [{ requestId: 'k1', seatNumber: 4, reason: '席を間違えました', createdAt: minutesAgo(1) }];

const results = [];
const record = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
};
const tid = (id) => `[data-testid="${id}"]`;

// 確定のボタンの下端と、本文・ページのスクロール。
const measure = (page, buttonSel, bodySel) =>
    page.evaluate(
        ({ buttonSel, bodySel }) => {
            const b = document.querySelector(buttonSel);
            const body = document.querySelector(bodySel);
            const se = document.scrollingElement;
            const style = b ? getComputedStyle(b) : null;
            return {
                bottom: b ? Math.round(b.getBoundingClientRect().bottom) : null,
                bg: style ? style.backgroundColor : null,
                body: body ? `${body.scrollHeight}/${body.clientHeight}` : null,
                bodyOk: body ? body.scrollHeight <= body.clientHeight : false,
                pageOk: se.scrollHeight <= se.clientHeight,
                vh: window.innerHeight,
            };
        },
        { buttonSel, bodySel },
    );
// 赤（R の成分が強く G・B が弱い）でないこと。主ボタンの青は B が強い。
const rgb = (css) => (css.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const isBlue = (css) => {
    const [r, g, b] = rgb(css || '');
    return b > r && b > 120;
};
const isOrange = (css) => {
    const [r, g, b] = rgb(css || '');
    return r > 230 && g > 110 && g < 170 && b < 60; // $error-primary #FF8C1A
};
// bodyMayScroll: 本文のスクロールをこのスクリプトでは問わない（#1923 で変えていない既存の並び。
// 課題のアーカイブの確認は座席の下に足され、課題詳細の左の枠がスクロールして確認を見せる）。
const judge = async (page, { name, button, body, color, bodyMayScroll = false }) => {
    const m = await measure(page, button, body);
    const colorOk = color ? color(m.bg) : true;
    const ok = m.bottom !== null && m.bottom <= m.vh && (m.bodyOk || bodyMayScroll) && m.pageOk && colorOk;
    record(
        name,
        ok,
        `${button} bottom ${m.bottom}/${m.vh} bg ${m.bg} · body ${body} ${m.body}` +
            `${bodyMayScroll && !m.bodyOk ? ' (scrolls: existing layout, not judged)' : ''} · page ${m.pageOk ? 'OK' : 'NG'}`,
    );
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false', args: ['--disable-dev-shm-usage'] });
try {
    for (const locale of LOCALES) {
        const shot = async (page, name, doc) => {
            await page.screenshot({ path: resolve(SHOT_DIR, `issue-1923-${name}-${locale}.png`) });
            if (DOCS_SHOTS && doc && locale === 'ja') await page.screenshot({ path: resolve(DOCS_DIR, doc) });
        };
        const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => console.log('[pageerror]', e.message));
        const deletes = [];
        await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
        await page.route(/\/kick-requests\/pending/, (r) => r.fulfill({ json: { requests: [], activeAssignmentCount: 1 } }));
        await page.route('**/classroom-groups', (r) => r.fulfill({ json: { groups: [group] } }));
        await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
        await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: [classroom] } }));
        await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: [classroom] } }));
        await page.route(/\/classrooms\/c1$/, (r) => r.fulfill({ json: classroom }));
        await page.route(/\/classrooms\/c1\/members$/, (r) => r.fulfill({ json: { members } }));
        await page.route(/\/classrooms\/c1\/members\/[^/]+$/, (r) => {
            deletes.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`);
            return r.fulfill({ json: { ok: true } });
        });
        await page.route(/\/classrooms\/c1\/kick-requests$/, (r) => r.fulfill({ json: { requests: kickRequests } }));
        await page.route(/\/classrooms\/c1\/submissions$/, (r) => r.fulfill({ json: { submissions } }));
        await page.route(/\/classrooms\/c1\/assignment$/, (r) =>
            r.fulfill({ json: { assignment: { pages: [{ text: 'ねこを迷路のゴールまで動かそう。' }] }, lesson: null } }),
        );

        await page.goto(`${BASE}/?no_beforeunload=1&locale=${locale}&devlogin=stub-token`, { waitUntil: 'load' });
        await page.waitForTimeout(3000);
        await page.addStyleTag({ content: '#webpack-dev-server-client-overlay { display: none !important; }' });
        await page.locator(tid('settings-menu')).click();
        await page.locator(tid('settings-classroom-management')).click();
        await page.waitForSelector(tid('classroom-class-settings-open-g1'), { timeout: 20000 });

        // ---------- C2: クラス設定のアーカイブの確認 ----------
        await page.locator(tid('classroom-class-settings-open-g1')).click();
        await page.waitForSelector(tid('classroom-class-settings-archive'), { timeout: 10000 });
        await page.locator(tid('classroom-class-settings-archive')).click();
        await page.waitForSelector(tid('classroom-class-settings-archive-confirm-message'));
        await page.waitForTimeout(300);
        await judge(page, {
            name: `[${locale}] C2 class settings: [アーカイブする] is the primary blue and visible`,
            button: tid('classroom-class-settings-archive'),
            body: tid('classroom-phase-teacher-class-list'),
            color: isBlue,
        });
        await shot(page, 'class-archive-confirm', '0215-class-archive-confirm.png');
        await page.locator(tid('classroom-class-settings-archive-cancel')).click();
        await page.locator(tid('classroom-class-settings-cancel')).click();
        await page.waitForTimeout(300);

        // ---------- 課題を開く ----------
        await page.locator(tid('classroom-class-open-g1')).click();
        await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
        await page.locator(tid('classroom-board-tab-classwork')).click();
        await page.locator(tid('classroom-board-row-toggle-c1')).click();
        await page.locator(tid('classroom-board-open-c1')).click();
        await page.waitForSelector(tid('classroom-phase-teacher-detail'), { timeout: 20000 });
        await page.locator(tid('classroom-tab-members')).click();
        await page.waitForSelector(tid('classroom-member-seat-04'), { timeout: 20000 });
        await page.waitForTimeout(500);

        // ---------- C2: 課題のアーカイブの確認 ----------
        await page.locator(tid('classroom-detail-more-menu')).click();
        await page.locator(tid('classroom-delete-classroom')).click();
        await page.waitForSelector(tid('classroom-delete-confirm'));
        await page.waitForTimeout(500);
        await judge(page, {
            name: `[${locale}] C2 assignment: [アーカイブ] is the primary blue and visible`,
            button: tid('classroom-delete-confirm'),
            body: tid('classroom-phase-teacher-detail'),
            color: isBlue,
            bodyMayScroll: true,
        });
        await shot(page, 'assignment-archive-confirm');
        await page.locator(tid('classroom-delete-cancel')).click();
        await page.waitForTimeout(300);

        // ---------- C14: 退室依頼の［承認］の色 ----------
        await page.locator(tid('classroom-member-seat-04')).click();
        await page.waitForSelector(tid('classroom-kick-request-approve-k1'), { timeout: 10000 });
        await page.waitForTimeout(300);
        await judge(page, {
            name: `[${locale}] C14 kick request: [承認] is $error-primary orange and visible`,
            button: tid('classroom-kick-request-approve-k1'),
            body: tid('classroom-phase-teacher-detail'),
            color: isOrange,
        });
        await shot(page, 'kick-request-panel', '0208-teacher-kick-request-panel.png');

        // ---------- C3: 退室させる ----------
        await page.locator(tid('classroom-member-seat-02')).click();
        await page.waitForSelector(tid('classroom-member-detail-hide-from-peers'), { timeout: 10000 });
        await page.waitForTimeout(500);
        record(
            `[${locale}] C3 the header has no remove button (it is in ⋮)`,
            (await page.$(tid('classroom-member-remove'))) === null &&
                (await page.$(tid('classroom-member-more-menu'))) !== null,
        );
        await shot(page, 'member-detail', '0223-teacher-member-detail-hide-from-peers.png');
        await page.locator(tid('classroom-member-more-menu')).click();
        const itemText = await page.textContent(tid('classroom-member-remove'));
        record(`[${locale}] C3 ⋮ has 退室させる`, /退室させる|たいしつさせる/.test(itemText), itemText);
        await page.locator(tid('classroom-member-remove')).click();
        await page.waitForSelector(tid('classroom-member-remove-confirm-message'));
        await page.waitForTimeout(200);
        const message = await page.textContent(tid('classroom-member-remove-confirm-message'));
        record(
            `[${locale}] C3 confirm names the seat and that the work is kept (no DELETE yet)`,
            /2/.test(message) && /作品は残ります|さくひんはのこります/.test(message) && deletes.length === 0,
            `"${message}" deletes=${deletes.length}`,
        );
        await judge(page, {
            name: `[${locale}] C3 confirm: [退室させる] is the primary blue and visible`,
            button: tid('classroom-member-remove-confirm'),
            body: tid('classroom-phase-teacher-detail'),
            color: isBlue,
        });
        await shot(page, 'member-remove-confirm', '0258-teacher-member-remove-confirm.png');
        await page.locator(tid('classroom-member-remove-cancel')).click();
        record(
            `[${locale}] C3 [キャンセル] closes the confirm without a DELETE`,
            (await page.$(tid('classroom-member-remove-confirm-message'))) === null && deletes.length === 0,
        );
        await page.locator(tid('classroom-member-more-menu')).click();
        await page.locator(tid('classroom-member-remove')).click();
        await page.locator(tid('classroom-member-remove-confirm')).click();
        await page.waitForTimeout(800);
        record(
            `[${locale}] C3 [退室させる] removes seat 2`,
            deletes.length === 1 && deletes[0] === 'DELETE /classrooms/c1/members/seat-02',
            JSON.stringify(deletes),
        );
        await ctx.close();
    }
} catch (e) {
    record('script', false, e.stack);
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed at ${VIEWPORT.width}x${VIEWPORT.height}`);
process.exit(failed.length ? 1 : 0);
