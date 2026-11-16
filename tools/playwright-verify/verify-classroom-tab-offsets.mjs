/**
 * クラス管理（先生）のタブの行の位置と、タブの下に使える高さを測る (#1988)。
 *
 * クラスの中の［ストリーム］［授業］［採点］と、課題の［説明］［メンバー］を順に開き、
 *   - タブの行の上端（画面の上から・紫のヘッダーの下から）
 *   - タブの行の下から本文の下までの高さ（タブの下に使える高さ）
 *   - 採点（40 席を読み込んだ成績表）で一度に全部見える席の行の数
 * を一覧で出す。クラスの中の 3 つのタブで、タブの行の上端が同じでなければ exit 1
 * （タブを切りかえるたびにタブの行が上下に動かないこと）。
 *
 * classroom API は route interception でスタブするので stg デプロイ不要 (dev server だけが前提)。
 * スクショは tmp/classroom-tabs-*.png。
 *
 *   node verify-classroom-tab-offsets.mjs                        # コンテナ内 (headless)・1300x600・ja
 *   BASE=http://localhost:8631 node verify-classroom-tab-offsets.mjs
 *   LOCALE=ja-Hira node verify-classroom-tab-offsets.mjs         # ひらがなで測る
 *   VIEWPORT=1920x1080 node verify-classroom-tab-offsets.mjs     # 大きい画面で測る
 *   LABEL=before node verify-classroom-tab-offsets.mjs           # スクショの名前に付ける (直す前・後の比べ用)
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

const HEADLESS = process.env.HEADLESS !== 'false';
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const LOCALE = process.env.LOCALE || 'ja';
const LABEL = process.env.LABEL || '';
const [VW, VH] = (process.env.VIEWPORT || '1300x600').split('x').map(Number);
const VIEWPORT = { width: VW, height: VH };
const SEATS = 40;
const LONG_CLASS = '3年2組 技術・家庭科（情報の技術）';
const LESSONS = [
    { classroomId: 'c1', assignmentName: '迷路ゲームを作ろう' },
    { classroomId: 'c2', assignmentName: 'ボールをよけよう' },
];
const seatId = (n) => `seat-${String(n).padStart(2, '0')}`;
const tid = (id) => `[data-testid="${id}"]`;

const summary = (lesson) => ({
    classroomId: lesson.classroomId,
    className: LONG_CLASS,
    assignmentName: lesson.assignmentName,
    joinCode: 'abc234',
    studentCount: SEATS,
    googleClassroomCourseId: null,
    googleClassroomAlternateLink: null,
    createdAt: '2026-10-10T00:00:00.000Z',
    expiresAt: '2027-01-10T00:00:00.000Z',
    coTeacherEmails: [],
    groupId: 'g1',
    topic: null,
    sortDate: '2026-10-10T00:00:00.000Z',
    hasAssignment: true,
    status: 'active',
    role: 'owner',
});

// 最小の sb3 (緑の旗 → 10 歩動かす)。
const makeSb3 = async () => {
    const zip = new JSZip();
    zip.file(
        'project.json',
        JSON.stringify({
            targets: [
                { isStage: true, name: 'Stage', blocks: {}, variables: {}, lists: {}, costumes: [], sounds: [] },
                {
                    isStage: false,
                    name: 'ねこ',
                    variables: {},
                    lists: {},
                    costumes: [],
                    sounds: [],
                    blocks: {
                        a: { opcode: 'event_whenflagclicked', next: 'b', parent: null, inputs: {}, fields: {}, topLevel: true },
                        b: {
                            opcode: 'motion_movesteps',
                            next: null,
                            parent: 'a',
                            inputs: { STEPS: [1, [4, '10']] },
                            fields: {},
                            topLevel: false,
                        },
                    },
                },
            ],
            meta: { semver: '3.0.0' },
        }),
    );
    return zip.generateAsync({ type: 'nodebuffer' });
};

// タブの行（tablist を包む行）・本文の枠・成績表の枠を測る。
const measure = (page) =>
    page.evaluate(() => {
        const main = document.querySelector('[data-testid="classroom-teacher-modal"] main');
        // エディタのタブ（コード・コスチューム…）ではなく、クラス管理の本文の中のタブの並び。
        const lists = [...main.querySelectorAll('[role="tablist"]')].filter((el) => el.offsetParent);
        const list = lists[0];
        // ［⚙ クラスの設定］などと同じ行に並ぶときは、線を引いている行（親）を測る。
        const row = list ? (list.parentElement.querySelector(':scope > [role="tablist"] ~ *') ? list.parentElement : list) : null;
        const rowRect = row ? row.getBoundingClientRect() : null;
        const mainRect = main.getBoundingClientRect();
        const m = document.querySelector('.eval-matrix-wrapper, [class*="eval-matrix-wrapper"]');
        let rowsVisible = null;
        if (m && m.offsetParent) {
            const frame = m.getBoundingClientRect();
            const head = m.querySelector('thead');
            const top = head ? head.getBoundingClientRect().bottom : frame.top;
            rowsVisible = [...m.querySelectorAll('tbody tr')].filter((tr) => {
                const r = tr.getBoundingClientRect();
                return r.top >= top - 1 && r.bottom <= frame.bottom + 1;
            }).length;
        }
        const tab = list ? list.querySelector('[role="tab"]') : null;
        return {
            mainTop: Math.round(mainRect.top),
            tabTop: rowRect ? Math.round(rowRect.top) : null,
            tabBottom: rowRect ? Math.round(rowRect.bottom) : null,
            tabHeight: tab ? Math.round(tab.getBoundingClientRect().height) : null,
            below: rowRect ? Math.round(mainRect.bottom - rowRect.bottom) : null,
            rowsVisible,
            pageOk: document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight,
        };
    });

const rows = [];
const shoot = (page, shot) =>
    page.screenshot({
        path: resolve(
            SHOT_DIR,
            `classroom-tabs-${LABEL ? `${LABEL}-` : ''}${shot}-${VW}x${VH}${LOCALE === 'ja' ? '' : `-${LOCALE}`}.png`,
        ),
    });
const take = async (page, name, shot) => {
    await page.waitForTimeout(500);
    const m = await measure(page);
    rows.push({ name, ...m });
    console.log(`${name}: ${JSON.stringify(m)}`);
    await shoot(page, shot);
};

const sb3 = await makeSb3();
const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
const members = Array.from({ length: SEATS }, (_, i) => ({
    memberId: seatId(i + 1),
    displayName: String(i + 1).padStart(2, '0'),
    lastActiveAt: new Date().toISOString(),
}));

await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
await page.route('**/kick-requests/pending**', (r) => r.fulfill({ json: { requests: [], activeAssignmentCount: 2 } }));
await page.route('**/classroom-groups', (r) =>
    r.fulfill({ json: { groups: [{ groupId: 'g1', name: LONG_CLASS, year: 2026, status: 'active', schemaVersion: 2, topics: [] }] } }),
);
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: LESSONS.map(summary) } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: LESSONS.map(summary) } }));
for (const lesson of LESSONS) {
    const id = lesson.classroomId;
    await page.route(`**/classrooms/${id}`, (r) => r.fulfill({ json: summary(lesson) }));
    await page.route(`**/classrooms/${id}/members`, (r) => r.fulfill({ json: { members } }));
    await page.route(`**/classrooms/${id}/kick-requests`, (r) => r.fulfill({ json: { requests: [] } }));
    await page.route(`**/classrooms/${id}/assignment`, (r) =>
        r.fulfill({ json: { pages: [{ text: 'ねこを動かしてゴールまで進もう。', imageUrl: null }], starterUrl: null } }),
    );
    await page.route(`**/classrooms/${id}/submissions`, (r) =>
        r.fulfill({
            json: {
                submissions: Array.from({ length: SEATS }, (_, i) => i + 1)
                    .filter((n) => n % 9 !== 0)
                    .map((n) => ({
                        submissionId: `${id}-s${n}`,
                        memberId: seatId(n),
                        status: 'submitted',
                        submittedAt: '2026-10-25T03:00:00.000Z',
                        projectUrl: `https://example.invalid/${id}/${n}.sb3`,
                    })),
            },
        }),
    );
}
await page.route('https://example.invalid/**', (r) =>
    r.fulfill({ status: 200, body: sb3, headers: { 'content-type': 'application/octet-stream' } }),
);

await page.goto(`${BASE}/?no_beforeunload=1&locale=${LOCALE}&devlogin=stub-token`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.locator(tid('settings-menu')).click();
await page.locator(tid('settings-classroom-management')).click();
await page.waitForSelector(tid('classroom-class-open-g1'), { timeout: 20000 });
await page.locator(tid('classroom-class-open-g1')).click();
await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });

await page.locator(tid('classroom-board-tab-stream')).click();
await take(page, 'class: stream', 'stream');
await page.locator(tid('classroom-board-tab-classwork')).click();
await take(page, 'class: classwork', 'classwork');
await page.locator(tid('classroom-board-tab-grading')).click();
await page.waitForSelector('[data-testid="classroom-phase-teacher-evaluation"]', { timeout: 20000 });
await take(page, 'class: grading (before loading)', 'grading');
await page.click(tid('classroom-eval-load'));
await page.waitForSelector(tid('classroom-eval-matrix'), { timeout: 30000 });
await take(page, 'class: grading (40 seats)', 'grading-loaded');

// 採点から授業へ（返却していない採点は無いので、聞かずに移る）。
await page.locator(tid('classroom-board-tab-classwork')).click();
const confirm = await page.$(tid('classroom-eval-leave-confirm-yes'));
if (confirm) await confirm.click();
await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
await take(page, 'class: classwork (back from grading)', 'classwork-back');

const toggle = page.locator(tid('classroom-board-row-toggle-c1'));
await toggle.waitFor({ timeout: 20000 });
if (!(await page.$(tid('classroom-board-open-c1')))) await toggle.click();
await page.locator(tid('classroom-board-open-c1')).click();
await page.waitForSelector(tid('classroom-phase-teacher-detail'), { timeout: 20000 });
await page.locator(tid('classroom-tab-members')).click();
await take(page, 'assignment: members', 'members');
await page.locator(tid('classroom-tab-description')).click();
await take(page, 'assignment: description', 'description');

await browser.close();

console.log(`\n${VW}x${VH} ${LOCALE}`);
console.log('| screen | tab row top (from header) | tab height | height below the tabs | seat rows visible |');
console.log('|---|---|---|---|---|');
for (const r of rows) {
    console.log(
        `| ${r.name} | ${r.tabTop} (${r.tabTop === null ? '-' : r.tabTop - r.mainTop}) | ${r.tabHeight} | ${r.below} | ${r.rowsVisible ?? '-'} |`,
    );
}
const classTops = new Set(rows.filter((r) => r.name.startsWith('class:')).map((r) => r.tabTop));
const pageOk = rows.every((r) => r.pageOk);
console.log(`\nclass tabs top: ${[...classTops].join(', ')} → ${classTops.size === 1 ? 'SAME' : 'MOVES'}`);
console.log(`page scroll: ${pageOk ? 'none' : 'NG'}`);
process.exit(classTops.size === 1 && pageOk ? 0 : 1);
