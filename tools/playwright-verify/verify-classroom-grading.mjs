/**
 * 採点の画面 (#1304) を 1300×600 で手順ごとに開いて測る。
 *
 * 「1 提出を読み込む → 2 AIで採点 → 3 コメントを下書き → 4 コメントを返却」の各手順で、
 *   - いまの手順のボタン (aria-current="step") が主ボタンになっているか
 *   - 主ボタンの下端が 600 以下か (縦スクロールせずに押せるか・R6)
 *   - 画面 ([data-testid="classroom-phase-teacher-evaluation"]) とページがスクロールしないか
 *     (40 人の表は一覧の例外として表の枠 .eval-matrix-wrapper の中だけスクロール可)
 * を一覧で出す。1 つでも外れたら exit 1。
 *
 * classroom API は route interception でスタブするので stg デプロイ不要 (dev server だけが前提)。
 * スクショは tmp/classroom-grading-*.png。
 *
 *   node verify-classroom-grading.mjs                       # コンテナ内 (headless)
 *   BASE=http://localhost:8624 node verify-classroom-grading.mjs
 *   DOCS_SHOTS=1 node verify-classroom-grading.mjs          # docs/classroom/screenshots も撮り直す
 *   BEFORE=1 node verify-classroom-grading.mjs              # 直す前の画面 (手順のボタンが無い) を撮るだけ
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
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
const BEFORE = process.env.BEFORE === '1';
const VIEWPORT = { width: 1300, height: 600 };
const SEATS = 40;
const ROOT = '[data-testid="classroom-phase-teacher-evaluation"]';
const MATRIX = '.eval-matrix-wrapper, [class*="eval-matrix-wrapper"]';

// 撮った画面 → docs/classroom/screenshots (ファイル名は変えない)。
const DOC_SHOT_NAMES = {
    'step1-load': '0233-teacher-grading-load.png',
    'step2-grade': '0234-teacher-grading-loaded.png',
    'step4-return': '0235-teacher-grading-return.png',
    'export-menu': '0236-teacher-grading-export-menu.png',
    'hint-open': '0237-teacher-grading-hint-detail.png',
    'settings-open': '0238-teacher-grading-settings.png',
};

const LONG_CLASS = '3年2組 技術・家庭科（情報の技術）';
const LESSONS = [
    { classroomId: 'c1', assignmentName: '迷路ゲームを作ろう' },
    { classroomId: 'c2', assignmentName: 'ボールをよけよう' },
];
const seatId = (n) => `seat-${String(n).padStart(2, '0')}`;

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

// 最小の sb3 (緑の旗 → 10 歩動かす)。静的解析が通るようにする。
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

const rows = [];
const record = (row) => {
    rows.push(row);
    console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name} — ${row.detail}`);
};

const measure = (page) =>
    page.evaluate(
        ({ root, matrix }) => {
            const el = document.querySelector(root);
            const current = document.querySelector('[aria-current="step"]');
            const m = document.querySelector(matrix);
            const se = document.scrollingElement;
            return {
                current: current ? current.getAttribute('data-testid') : null,
                currentBottom: current ? Math.round(current.getBoundingClientRect().bottom) : null,
                footerBottom: (() => {
                    const cancel = document.querySelector('[data-testid="classroom-evaluation-cancel"]');
                    return cancel ? Math.round(cancel.getBoundingClientRect().bottom) : null;
                })(),
                rootScroll: el.scrollHeight,
                rootClient: el.clientHeight,
                matrixScroll: m ? m.scrollHeight : null,
                matrixClient: m ? m.clientHeight : null,
                pageScroll: se.scrollHeight,
                pageClient: se.clientHeight,
                vh: window.innerHeight,
            };
        },
        { root: ROOT, matrix: MATRIX },
    );

const shoot = async (page, shot) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `classroom-grading-${BEFORE ? 'before-' : ''}${shot}.png`) });
    if (DOCS_SHOTS && !BEFORE && DOC_SHOT_NAMES[shot]) {
        await page.screenshot({ path: resolve(REPO_ROOT, 'docs', 'classroom', 'screenshots', DOC_SHOT_NAMES[shot]) });
    }
};

const judge = async (page, { name, expected, shot }) => {
    const m = await measure(page);
    const rootOk = m.rootScroll <= m.rootClient;
    const pageOk = m.pageScroll <= m.pageClient;
    const currentOk = m.current === expected;
    const bottomOk = m.currentBottom !== null && m.currentBottom <= m.vh;
    record({
        name,
        ok: rootOk && pageOk && currentOk && bottomOk,
        detail:
            `current ${m.current} (expected ${expected}) bottom ${m.currentBottom}/${m.vh}` +
            ` · cancel bottom ${m.footerBottom}/${m.vh}` +
            ` · screen ${rootOk ? 'OK' : 'NG'} ${m.rootScroll}/${m.rootClient}` +
            ` · page ${pageOk ? 'OK' : 'NG'} ${m.pageScroll}/${m.pageClient}` +
            (m.matrixScroll === null ? '' : ` · matrix frame ${m.matrixScroll}/${m.matrixClient}`),
    });
    await shoot(page, shot);
};

const sb3 = await makeSb3();
const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();

await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
await page.route('**/kick-requests/pending', (r) => r.fulfill({ json: { requests: [] } }));
await page.route('**/classroom-groups', (r) =>
    r.fulfill({ json: { groups: [{ groupId: 'g1', name: LONG_CLASS, year: 2026, status: 'active', schemaVersion: 2, topics: [] }] } }),
);
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: LESSONS.map(summary) } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: LESSONS.map(summary) } }));
for (const lesson of LESSONS) {
    await page.route(`**/classrooms/${lesson.classroomId}/submissions`, (r) =>
        r.fulfill({
            json: {
                submissions: Array.from({ length: SEATS }, (_, i) => i + 1)
                    .filter((n) => n % 9 !== 0)
                    .map((n) => ({
                        submissionId: `${lesson.classroomId}-s${n}`,
                        memberId: seatId(n),
                        status: 'submitted',
                        submittedAt: '2026-10-25T03:00:00.000Z',
                        projectUrl: `https://example.invalid/${lesson.classroomId}/${n}.sb3`,
                    })),
            },
        }),
    );
    await page.route(`**/classrooms/${lesson.classroomId}/evaluate`, async (r) => {
        const body = JSON.parse(r.request().postData() || '{}');
        const results = (body.submissions || []).map((s, i) =>
            body.mode === 'grade'
                ? { seatNumber: s.seatNumber, grade: ['S', 'A', 'B', 'C'][i % 4], reason: '旗で動く', needsReview: i % 7 === 0 }
                : { seatNumber: s.seatNumber, comment: '旗を押すとねこが動くところがよくできています。' },
        );
        await r.fulfill({ json: { results } });
    });
}
await page.route('https://example.invalid/**', (r) =>
    r.fulfill({ status: 200, body: sb3, headers: { 'content-type': 'application/octet-stream' } }),
);

await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.locator('[data-testid="settings-menu"]').click();
await page.locator('[data-testid="settings-classroom-management"]').click();
await page.waitForSelector('[data-testid="classroom-class-evaluate-g1"]', { timeout: 20000 });
await page.locator('[data-testid="classroom-class-evaluate-g1"]').click();
await page.waitForSelector(ROOT, { timeout: 20000 });
await page.waitForTimeout(500);

if (BEFORE) {
    await shoot(page, 'step1-load');
    await page.click('[data-testid="classroom-eval-load"]');
    await page.waitForSelector('[data-testid="classroom-eval-matrix"]', { timeout: 30000 });
    await page.waitForTimeout(500);
    await shoot(page, 'step2-grade');
    const before = await page.evaluate((root) => {
        const el = document.querySelector(root);
        const grade = document.querySelector('[data-testid="classroom-eval-run-grade"]');
        return {
            runGradeBottom: Math.round(grade.getBoundingClientRect().bottom),
            screen: `${el.scrollHeight}/${el.clientHeight}`,
        };
    }, ROOT);
    console.log(`BEFORE (40 seats loaded): ${JSON.stringify(before)}`);
    await browser.close();
    process.exit(0);
}

await judge(page, { name: '1 before loading', expected: 'classroom-eval-load', shot: 'step1-load' });

await page.click('[data-testid="classroom-eval-hint-toggle"]');
await page.waitForTimeout(200);
await judge(page, { name: '1 hint opened', expected: 'classroom-eval-load', shot: 'hint-open' });
await page.click('[data-testid="classroom-eval-hint-toggle"]');

await page.click('[data-testid="classroom-eval-load"]');
await page.waitForSelector('[data-testid="classroom-eval-matrix"]', { timeout: 30000 });
await page.waitForTimeout(500);
await judge(page, { name: '2 loaded (40 seats)', expected: 'classroom-eval-run-grade', shot: 'step2-grade' });

await page.click('[data-testid="classroom-eval-settings-toggle"]');
await page.waitForTimeout(200);
await judge(page, { name: '2 grading settings opened', expected: 'classroom-eval-run-grade', shot: 'settings-open' });
await page.click('[data-testid="classroom-eval-settings-toggle"]');

await page.click('[data-testid="classroom-eval-run-grade"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="classroom-eval-progress"]'), null, { timeout: 30000 });
await page.waitForTimeout(500);
await judge(page, { name: '3 graded', expected: 'classroom-eval-run-comment', shot: 'step3-comment' });

await page.click('[data-testid="classroom-eval-run-comment"]');
await page.waitForFunction(() => !document.querySelector('[data-testid="classroom-eval-progress"]'), null, { timeout: 30000 });
await page.waitForTimeout(500);
await judge(page, { name: '4 comments drafted', expected: 'classroom-eval-return-comments', shot: 'step4-return' });

await page.click('[data-testid="classroom-eval-export-menu"]');
await page.waitForTimeout(200);
const menu = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    return items.map((e) => ({ id: e.getAttribute('data-testid'), bottom: Math.round(e.getBoundingClientRect().bottom), top: Math.round(e.getBoundingClientRect().top) }));
});
const menuOk = menu.length === 2 && menu.every((m) => m.top >= 0 && m.bottom <= VIEWPORT.height);
record({ name: 'export menu open', ok: menuOk, detail: JSON.stringify(menu) });
await shoot(page, 'export-menu');

await browser.close();
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} checks passed at ${VIEWPORT.width}x${VIEWPORT.height}`);
process.exit(failed.length ? 1 : 0);
