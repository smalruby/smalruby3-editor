/**
 * 採点の画面 (#1304) を 1300×600 で手順ごとに開いて測る。
 *
 * 「1 提出を読み込む → 2 AIで採点 → 3 コメントを下書き → 4 コメントを返却」の各手順で、
 *   - いまの手順のボタン (aria-current="step") が主ボタンになっているか
 *   - 主ボタンの下端が 600 以下か (縦スクロールせずに押せるか・R6)
 *   - 画面 ([data-testid="classroom-phase-teacher-evaluation"]) とページがスクロールしないか
 *     (40 人の表は一覧の例外として表の枠 .eval-matrix-wrapper の中だけスクロール可)
 * を一覧で出す。返却していない採点があるときのキャンセル・パンくずの確認 (#1923 C4) で、
 * 確認の［戻る］が見えるかも測る。1 つでも外れたら exit 1。
 *
 * classroom API は route interception でスタブするので stg デプロイ不要 (dev server だけが前提)。
 * スクショは tmp/classroom-grading-*.png。
 *
 *   node verify-classroom-grading.mjs                       # コンテナ内 (headless)
 *   BASE=http://localhost:8624 node verify-classroom-grading.mjs
 *   DOCS_SHOTS=1 node verify-classroom-grading.mjs          # docs/classroom/screenshots も撮り直す
 *   BEFORE=1 node verify-classroom-grading.mjs              # 直す前の画面 (手順のボタンが無い) を撮るだけ
 *   LOCALE=ja-Hira node verify-classroom-grading.mjs        # ひらがなで測る (既定は ja。DOCS_SHOTS は ja のときだけ)
 *   ASSIGNMENTS=6 node verify-classroom-grading.mjs         # 課題 6 つの表 (表の枠の中だけ横にスクロールし、ページが横に広がらないか・#1945)
 *   VIEWPORT=1920x1080 node verify-classroom-grading.mjs    # 大きい画面でも測る (既定は 1300x600)
 *
 * 採点簿 (#1962): 表は点だけ、セルを押すと右の列 ([data-testid="classroom-eval-detail"]) に根拠・コメント。
 * 各手順で、ページの横スクロールが無いこと・手順の行の右端が画面の中・右の列が画面の中に収まることも測る。
 *
 * ［作品を開く］(#1980): 右の列の中で、列をスクロールせずに見えるか・課題名と重ならないか。
 * 押すと確かめずに作品をエディタに開いてクラス管理を閉じるか（採点の画面は隠して残る・#1990）。
 *
 * 戻る帯 (#1990): 開いたあと、エディタの上（メニューバーの下）に「出席番号・課題名」と［‹ 採点に戻る］が
 * 出るか。帯の高さと、帯の有る・無しでのステージ・スプライトの領域・ブロックの領域の位置を測る。
 * ［戻る］で同じ席の右の列と、点・根拠・コメントの下書きのまま採点の画面に戻るか。✕ で閉じても聞かず、
 * 設定のメニューの「クラス管理」から開き直すと採点の画面に戻るか。新しい作品を作ると帯が消えるか。
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
const DOCS_SHOTS =
    process.env.DOCS_SHOTS === '1' && LOCALE === 'ja' && !process.env.ASSIGNMENTS && !process.env.VIEWPORT;
const BEFORE = process.env.BEFORE === '1';
const [VW, VH] = (process.env.VIEWPORT || '1300x600').split('x').map(Number);
const VIEWPORT = { width: VW, height: VH };
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
    'leave-confirm': '0259-teacher-grading-leave-confirm.png',
};

const LONG_CLASS = '3年2組 技術・家庭科（情報の技術）';
const ASSIGNMENTS = Number(process.env.ASSIGNMENTS || 2);
const NAMES = ['迷路ゲームを作ろう', 'ボールをよけよう', 'ねこを動かそう', '音を鳴らそう', 'クイズを作ろう', '数を数えよう'];
const LESSONS = Array.from({ length: ASSIGNMENTS }, (_, i) => ({
    classroomId: `c${i + 1}`,
    assignmentName: NAMES[i % NAMES.length],
}));
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
                pageScrollW: se.scrollWidth,
                pageClientW: se.clientWidth,
                matrixScrollW: m ? m.scrollWidth : null,
                matrixClientW: m ? m.clientWidth : null,
                stepsRight: (() => {
                    const steps = document.querySelector('[data-testid="classroom-eval-steps"]');
                    return steps ? Math.round(steps.getBoundingClientRect().right) : null;
                })(),
                detailBottom: (() => {
                    const d = document.querySelector('[data-testid="classroom-eval-detail"]');
                    return d ? Math.round(d.getBoundingClientRect().bottom) : null;
                })(),
                detailRight: (() => {
                    const d = document.querySelector('[data-testid="classroom-eval-detail"]');
                    return d ? Math.round(d.getBoundingClientRect().right) : null;
                })(),
                // 表の枠の中で全部見えている席の行の数（見出しの行の下から枠の下まで）
                rowsVisible: (() => {
                    if (!m) return null;
                    const frame = m.getBoundingClientRect();
                    const head = m.querySelector('thead');
                    const top = head ? head.getBoundingClientRect().bottom : frame.top;
                    return [...m.querySelectorAll('tbody tr')].filter((tr) => {
                        const r = tr.getBoundingClientRect();
                        return r.top >= top - 1 && r.bottom <= frame.bottom + 1;
                    }).length;
                })(),
                vh: window.innerHeight,
                vw: window.innerWidth,
            };
        },
        { root: ROOT, matrix: MATRIX },
    );

const shoot = async (page, shot) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `classroom-grading-${BEFORE ? 'before-' : ''}${shot}${LOCALE === 'ja' ? '' : `-${LOCALE}`}${process.env.ASSIGNMENTS ? `-${process.env.ASSIGNMENTS}` : ''}.png`) });
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
    // #1945: ページは横にもスクロールしない・手順の行と右の列は画面の中。
    const widthOk = m.pageScrollW <= m.pageClientW && m.stepsRight !== null && m.stepsRight <= m.vw;
    const detailOk = m.detailBottom === null || (m.detailBottom <= m.vh && m.detailRight <= m.vw);
    record({
        name,
        ok: rootOk && pageOk && currentOk && bottomOk && widthOk && detailOk,
        detail:
            `current ${m.current} (expected ${expected}) bottom ${m.currentBottom}/${m.vh}` +
            ` · cancel bottom ${m.footerBottom}/${m.vh}` +
            ` · screen ${rootOk ? 'OK' : 'NG'} ${m.rootScroll}/${m.rootClient}` +
            ` · page ${pageOk ? 'OK' : 'NG'} ${m.pageScroll}/${m.pageClient}` +
            ` · page width ${m.pageScrollW}/${m.pageClientW} · steps right ${m.stepsRight}/${m.vw}` +
            (m.detailBottom === null ? '' : ` · detail bottom ${m.detailBottom} right ${m.detailRight}`) +
            (m.matrixScroll === null
                ? ''
                : ` · matrix frame ${m.matrixScroll}/${m.matrixClient} (w ${m.matrixScrollW}/${m.matrixClientW})` +
                  ` · rows visible ${m.rowsVisible}`),
    });
    await shoot(page, shot);
};

const sb3 = await makeSb3();
const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();

await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
// 退室依頼のトーストの「課題を開く」からの移動も確かめる (#1923)。途中で 1 件だけ返す。
let pendingKicks = [];
await page.route('**/kick-requests/pending**', (r) =>
    r.fulfill({ json: { requests: pendingKicks, activeAssignmentCount: ASSIGNMENTS } }),
);
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

await page.goto(`${BASE}/?no_beforeunload=1&locale=${LOCALE}&devlogin=stub-token`, { waitUntil: 'load' });
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

// 採点簿 (#1962): 表のセルに入力欄は無く、押すと右の列にその席が出る。
const gradebook = await page.evaluate(() => {
    const matrix = document.querySelector('[data-testid="classroom-eval-matrix"]');
    return {
        fieldsInTable: matrix.querySelectorAll('select, input, textarea').length,
        title: document.querySelector('[data-testid="classroom-eval-detail-title"]')?.textContent ?? null,
    };
});
record({
    name: 'gradebook: the table has no fields, the first submitted seat is in the right column',
    ok: gradebook.fieldsInTable === 0 && /01/.test(gradebook.title || ''),
    detail: JSON.stringify(gradebook),
});
await page.click(`[data-testid="classroom-eval-cell-button-12-${LESSONS[LESSONS.length - 1].classroomId}"]`);
await page.waitForTimeout(200);
const chosen = await page.evaluate(
    (id) => ({
        title: document.querySelector('[data-testid="classroom-eval-detail-title"]')?.textContent ?? null,
        grade: !!document.querySelector(`[data-testid="classroom-eval-grade-12-${id}"]`),
    }),
    LESSONS[LESSONS.length - 1].classroomId,
);
record({
    name: 'gradebook: pressing seat 12 of the last assignment shows it on the right',
    ok: /12/.test(chosen.title || '') && chosen.grade,
    detail: JSON.stringify(chosen),
});
await judge(page, { name: '2 seat 12 chosen', expected: 'classroom-eval-run-grade', shot: 'step2-chosen' });

// ［作品を開く］(#1980): 右の列の中・画面の中にあり、列をスクロールしなくても見える。課題名とは重ならない。
const openWork = await page.evaluate(() => {
    const q = (id) => document.querySelector(`[data-testid="${id}"]`);
    const b = q('classroom-eval-detail-open-work');
    const d = q('classroom-eval-detail');
    const l = q('classroom-eval-detail-lesson');
    if (!b || !d) return null;
    const r = b.getBoundingClientRect();
    const dr = d.getBoundingClientRect();
    const lr = l.getBoundingClientRect();
    return {
        text: b.textContent,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        detail: [Math.round(dr.left), Math.round(dr.top), Math.round(dr.right), Math.round(dr.bottom)],
        lessonRight: Math.round(lr.right),
        lessonClipped: l.scrollWidth > l.clientWidth,
        detailScrollTop: d.scrollTop,
        textFits: b.scrollWidth <= b.clientWidth,
        vh: window.innerHeight,
        vw: window.innerWidth,
    };
});
record({
    name: '[作品を開く] is in the right column, visible without scrolling it, beside the assignment name',
    ok:
        !!openWork &&
        openWork.top >= openWork.detail[1] &&
        openWork.bottom <= Math.min(openWork.detail[3], openWork.vh) &&
        openWork.left >= openWork.detail[0] &&
        openWork.right <= Math.min(openWork.detail[2], openWork.vw) &&
        openWork.lessonRight <= openWork.left &&
        openWork.detailScrollTop === 0 &&
        openWork.textFits,
    detail: JSON.stringify(openWork),
});

// ‹ › で移ったセルが、上に留まる見出しの行・左に留まる出席番号の列の下に隠れないか（#1962 FYI1）。
// 左の課題の列を選び、枠を下の端・右の端までスクロールしてから、上の席へ ‹ で戻る。
await page.click(`[data-testid="classroom-eval-cell-button-12-${LESSONS[0].classroomId}"]`);
const hidden = async () =>
    page.evaluate((matrix) => {
        const m = document.querySelector(matrix);
        const sel = m.querySelector('[aria-pressed="true"]');
        const head = m.querySelector('thead').getBoundingClientRect();
        const seat = m.querySelector('thead th').getBoundingClientRect();
        const r = sel.getBoundingClientRect();
        const frame = m.getBoundingClientRect();
        return {
            id: sel.getAttribute('data-testid'),
            underHead: r.top < head.bottom - 1,
            underSeat: r.left < seat.right - 1,
            outside: r.bottom > frame.bottom + 1 || r.right > frame.right + 1,
        };
    }, MATRIX);
for (let i = 0; i < 12; i++) await page.click('[data-testid="classroom-eval-detail-next"]');
await page.evaluate((matrix) => {
    const m = document.querySelector(matrix);
    m.scrollTop = m.scrollHeight;
    m.scrollLeft = m.scrollWidth;
}, MATRIX);
for (let i = 0; i < 14; i++) await page.click('[data-testid="classroom-eval-detail-prev"]');
await page.waitForTimeout(200);
const afterNav = await hidden();
record({
    name: '‹ › keeps the chosen cell out from under the sticky heading row and seat column',
    ok: !afterNav.underHead && !afterNav.underSeat && !afterNav.outside,
    detail: JSON.stringify(afterNav),
});

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
// Escape はクラス管理のモーダルごと閉じるので、メニューはボタンでもう一度押して閉じる。
await page.click('[data-testid="classroom-eval-export-menu"]');
await page.waitForTimeout(200);

// 離れる確認 (#1923 C4): 書き出していない採点・返却していないコメントがあるとき、どの入口から
// 離れようとしても、すぐには離れず手順の行が確認に変わる。確認の［書き出す］［戻る］が 1300×600 で見えるか。
const leaveState = () =>
    page.evaluate((root) => {
        const q = (id) => document.querySelector(`[data-testid="${id}"]`);
        const el = document.querySelector(root);
        const yes = q('classroom-eval-leave-confirm');
        const exp = q('classroom-eval-leave-export');
        const se = document.scrollingElement;
        return {
            message: q('classroom-eval-leave-confirm-message')?.textContent ?? null,
            lost: q('classroom-eval-leave-confirm-message')?.getAttribute('data-lost') ?? null,
            yes: yes ? yes.textContent : null,
            yesBottom: yes ? Math.round(yes.getBoundingClientRect().bottom) : null,
            exportBottom: exp ? Math.round(exp.getBoundingClientRect().bottom) : null,
            exportRight: exp ? Math.round(exp.getBoundingClientRect().right) : null,
            steps: !!q('classroom-eval-steps'),
            onScreen: !!el,
            screenOk: el ? el.scrollHeight <= el.clientHeight : false,
            screen: el ? `${el.scrollHeight}/${el.clientHeight}` : null,
            pageOk: se.scrollHeight <= se.clientHeight,
            vh: window.innerHeight,
            vw: window.innerWidth,
        };
    }, ROOT);
// 紫のヘッダーの「← エディタに戻る」(#1958)。共有 Modal のヘッダーは隠している。
const backButton = '[data-testid="classroom-teacher-back-to-editor"]';
const entries = [
    { name: 'cancel', run: () => page.click('[data-testid="classroom-evaluation-cancel"]'), yes: /戻る|もどる/ },
    { name: 'breadcrumb', run: () => page.click('[data-testid="classroom-breadcrumb-class-list"]'), yes: /戻る|もどる/ },
    // クラスの中のタブ (#1958): 採点から［ストリーム］［授業］へ移るときも聞く。
    { name: 'tab stream', run: () => page.click('[data-testid="classroom-board-tab-stream"]'), yes: /離れる|はなれる/ },
    {
        name: 'tab classwork',
        run: () => page.click('[data-testid="classroom-board-tab-classwork"]'),
        yes: /離れる|はなれる/,
    },
    {
        name: 'notifications "open all"',
        run: async () => {
            await page.click('[data-testid="classroom-notifications-button"]');
            await page.click('[data-testid="classroom-notifications-menu-button"]');
            await page.click('[data-testid="classroom-notifications-open-all"]');
            await page.click('[data-testid="classroom-notifications-button"]').catch(() => {});
        },
        yes: /離れる|はなれる/,
    },
    {
        name: 'logout',
        run: async () => {
            await page.click('[data-testid="classroom-avatar-button"]');
            await page.click('[data-testid="classroom-teacher-logout"]');
        },
        yes: /離れる|はなれる/,
    },
    {
        name: 'kick toast "open the assignment"',
        run: async () => {
            pendingKicks = [
                {
                    requestId: 'k1',
                    classroomId: LESSONS[0].classroomId,
                    groupId: 'g1',
                    className: LONG_CLASS,
                    assignmentName: LESSONS[0].assignmentName,
                    seatNumber: 3,
                    occupantName: 'せいと3',
                    reason: '席を間違えました',
                    createdAt: new Date().toISOString(),
                },
            ];
            await page.waitForSelector('[data-testid="classroom-teacher-kick-toast-open"]', { timeout: 30000 });
            // 本物のクリックで押す (#1952)。トーストがモーダルの下にあると、採点の手順の行に取られて止まる。
            await page.locator('[data-testid="classroom-teacher-kick-toast-open"]').click({ timeout: 5000 });
            pendingKicks = [];
        },
        yes: /離れる|はなれる/,
    },
    {
        name: 'load again',
        run: () => page.click('[data-testid="classroom-eval-load"]'),
        yes: /読み込み直す|よみこみなおす/,
        lost: 'grades',
    },
];
for (const entry of entries) {
    await entry.run();
    await page.waitForTimeout(300);
    const st = await leaveState();
    record({
        name: `leave confirm via ${entry.name} ([書き出す] [${entry.yes.source}] visible, no scroll)`,
        ok:
            st.onScreen &&
            !!st.message &&
            entry.yes.test(st.yes || '') &&
            st.lost === (entry.lost || 'grades comments') &&
            !st.steps &&
            st.yesBottom !== null &&
            st.yesBottom <= st.vh &&
            st.exportBottom !== null &&
            st.exportBottom <= st.vh &&
            st.screenOk &&
            st.pageOk,
        detail:
            `"${st.message}" · [data-testid="classroom-eval-leave-confirm"] "${st.yes}" bottom ${st.yesBottom}/${st.vh}` +
            ` · [data-testid="classroom-eval-leave-export"] bottom ${st.exportBottom} right ${st.exportRight}/${st.vw}` +
            ` · screen ${ROOT} ${st.screen} · page ${st.pageOk ? 'OK' : 'NG'}`,
    });
    if (entry.name === 'cancel') await shoot(page, 'leave-confirm');
    if (!st.onScreen) break;
    await page.click('[data-testid="classroom-eval-leave-cancel"]');
    await page.waitForTimeout(200);
    const back = await leaveState();
    record({
        name: `[採点を続ける] after ${entry.name} keeps the grading screen`,
        ok: back.onScreen && back.message === null && back.steps,
        detail: `steps ${back.steps} · message ${back.message}`,
    });
}

// 書き出すと採点は残るが、返却していないコメントはまだ消えるので確かめる。
await page.click('[data-testid="classroom-evaluation-cancel"]');
await page.click('[data-testid="classroom-eval-leave-export"]');
await page.waitForTimeout(200);
const afterExport = await leaveState();
record({
    name: 'after [書き出す] the question follows: only the comments not returned are lost',
    ok: !!afterExport.message && afterExport.lost === 'comments',
    detail: `"${afterExport.message}" lost=${afterExport.lost}`,
});
await page.click('[data-testid="classroom-eval-leave-cancel"]');
await page.waitForTimeout(200);
// 書き出したあとの読み込み直しは、採点が残っているので確かめない（コメントの下書きは残る）。
await page.click('[data-testid="classroom-eval-load"]');
await page.waitForTimeout(300);
const reload = await leaveState();
record({
    name: 'load again after the export does not ask (grades are in the CSV, drafts stay)',
    ok: reload.message === null,
    detail: `"${reload.message}"`,
});
await page.waitForSelector('[data-testid="classroom-eval-matrix"]', { timeout: 30000 });
await page.waitForTimeout(500);

// ［作品を開く］で、選んだ席の作品をエディタに開き、クラス管理を閉じる (#1980)。確かめない (#1990)。
// 表の解析用の最小の sb3 はコスチュームが無くエディタに読み込めないので、開く 1 つだけ本物の作品を返す。
const { readFile } = await import('node:fs/promises');
const openSb3 = await readFile(resolve(REPO_ROOT, 'packages/scratch-gui/test/fixtures/monitor-variable.sb3'));
await page.route(`https://example.invalid/${LESSONS[0].classroomId}/5.sb3`, (r) =>
    r.fulfill({ status: 200, body: openSb3, headers: { 'content-type': 'application/octet-stream' } }),
);
const openedUrls = [];
page.on('request', (req) => {
    if (req.url().startsWith('https://example.invalid/')) openedUrls.push(req.url());
});
const C1 = LESSONS[0].classroomId;
await page.click(`[data-testid="classroom-eval-cell-button-5-${C1}"]`);
// 下書き: 根拠とコメントを書きかえる（戻ったときに残っているかを見る）。
const REASON = '根拠の下書き（戻る帯の確認）';
const COMMENT = 'コメントの下書き（戻る帯の確認）';
await page.selectOption(`[data-testid="classroom-eval-grade-5-${C1}"]`, 'A').catch(() => {});
await page.fill(`[data-testid="classroom-eval-reason-5-${C1}"]`, REASON);
await page.fill(`[data-testid="classroom-eval-comment-5-${C1}"]`, COMMENT);
const draftState = () =>
    page.evaluate((c1) => {
        const q = (id) => document.querySelector(`[data-testid="${id}"]`);
        return {
            onScreen: !!q('classroom-phase-teacher-evaluation'),
            title: q('classroom-eval-detail-title')?.textContent ?? null,
            reason: q(`classroom-eval-reason-5-${c1}`)?.value ?? null,
            comment: q(`classroom-eval-comment-5-${c1}`)?.value ?? null,
            grade: q(`classroom-eval-grade-5-${c1}`)?.value ?? null,
        };
    }, C1);
const before = await draftState();

// エディタの部品の位置（モーダルの下でも並びは同じなので、開く前に測る）。
const editorLayout = () =>
    page.evaluate(() => {
        const rect = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
        };
        const se = document.scrollingElement;
        return {
            bar: rect('[data-testid="classroom-teacher-work-bar"]'),
            menuBar: rect('[class*="menu-bar_menu-bar_"]'),
            stage: rect('[class*="stage_stage_"]'),
            spriteSelector: rect('[class*="sprite-selector_sprite-selector_"]'),
            blocks: rect('.injectionDiv'),
            pageScrolls: se.scrollHeight > se.clientHeight,
            vh: window.innerHeight,
        };
    });
const noBar = await editorLayout();
await page.click('[data-testid="classroom-eval-detail-open-work"]');
await page.waitForSelector('[data-testid="classroom-teacher-work-bar"]', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1000);
const opened = await page.evaluate(() => {
    const vm = window.vm || (window.smalruby && window.smalruby.vm);
    return {
        screenGone: !document.querySelector('[data-testid="classroom-phase-teacher-evaluation"]'),
        leaveAsked: !!document.querySelector('[data-testid="classroom-eval-leave-confirm"]'),
        barText: document.querySelector('[data-testid="classroom-teacher-work-bar-text"]')?.textContent ?? null,
        back: document.querySelector('[data-testid="classroom-teacher-work-bar-back"]')?.textContent ?? null,
        sprites: vm ? vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage).map((t) => t.getName()) : null,
    };
});
record({
    name: '[作品を開く] opens the seat\'s work at once (no question) and closes the classroom screen',
    ok:
        opened.screenGone &&
        !opened.leaveAsked &&
        openedUrls.includes(`https://example.invalid/${C1}/5.sb3`),
    detail: `${JSON.stringify(opened)} · fetched ${openedUrls.join(', ')}`,
});
record({
    name: 'the bar shows the seat number and the assignment name, and [‹ 採点に戻る]',
    ok:
        /5/.test(opened.barText || '') &&
        (opened.barText || '').includes(LESSONS[0].assignmentName) &&
        /採点に戻る|さいてんにもどる/.test(opened.back || ''),
    detail: `"${opened.barText}" · "${opened.back}"`,
});
const withBar = await editorLayout();
record({
    name: 'the bar sits under the menu bar; stage, sprites and blocks stay on the screen (no page scroll)',
    ok:
        !!withBar.bar &&
        !!withBar.menuBar &&
        withBar.bar.top >= withBar.menuBar.bottom - 1 &&
        withBar.stage &&
        withBar.stage.bottom <= withBar.vh &&
        withBar.spriteSelector &&
        withBar.spriteSelector.bottom <= withBar.vh &&
        withBar.blocks &&
        withBar.blocks.bottom <= withBar.vh &&
        !withBar.pageScrolls,
    detail: `without bar ${JSON.stringify(noBar)} · with bar ${JSON.stringify(withBar)}`,
});
await shoot(page, 'work-bar');

// ［‹ 採点に戻る］で、同じ席の右の列と下書きのまま戻る。
await page.click('[data-testid="classroom-teacher-work-bar-back"]');
await page.waitForSelector(ROOT, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(500);
const back1 = await draftState();
const barGone1 = await page.evaluate(() => !document.querySelector('[data-testid="classroom-teacher-work-bar"]'));
record({
    name: '[‹ 採点に戻る] comes back to the same seat with the drafts (grade, reason, comment)',
    ok:
        back1.onScreen &&
        back1.title === before.title &&
        back1.reason === REASON &&
        back1.comment === COMMENT &&
        back1.grade === before.grade &&
        barGone1,
    detail: `before ${JSON.stringify(before)} · after ${JSON.stringify(back1)} · bar gone ${barGone1}`,
});
await shoot(page, 'work-bar-back');

// ✕（エディタに戻る）は聞かずに閉じ、設定のメニューの「クラス管理」から開き直すと採点の画面に戻る。
await page.click(backButton);
await page.waitForTimeout(400);
const closed = await page.evaluate(() => ({
    gone: !document.querySelector('[data-testid="classroom-phase-teacher-evaluation"]'),
    asked: !!document.querySelector('[data-testid="classroom-eval-leave-confirm"]'),
}));
await page.click('[data-testid="settings-menu"]').catch(() => {});
await page.waitForTimeout(300);
await page.click('[data-testid="settings-classroom-management"]').catch(() => {});
await page.waitForSelector(ROOT, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(400);
const back2 = await draftState();
record({
    name: '[← エディタに戻る] closes without asking; the menu opens the grading screen again with the drafts',
    ok: closed.gone && !closed.asked && back2.onScreen && back2.reason === REASON && back2.comment === COMMENT,
    detail: `closed ${JSON.stringify(closed)} · reopened ${JSON.stringify(back2)}`,
});

// 作品を開き直して、新しい作品を作る（vm.loadProject）と帯は消える。
await page.click('[data-testid="classroom-eval-detail-open-work"]');
await page.waitForSelector('[data-testid="classroom-teacher-work-bar"]', { timeout: 20000 }).catch(() => {});
const barAgain = await page.evaluate(() => !!document.querySelector('[data-testid="classroom-teacher-work-bar"]'));
await page.evaluate(async () => {
    // window.smalruby は Ruby タブを開くまで無いので、React の props から vm を取る（読むだけ）。
    const findVm = () => {
        const el = document.querySelector('[class*="gui_page-wrapper"]') || document.body.firstElementChild;
        const key = el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
        for (let f = key ? el[key] : null; f; f = f.return) {
            if (f.memoizedProps && f.memoizedProps.vm && f.memoizedProps.vm.loadProject) return f.memoizedProps.vm;
        }
        return null;
    };
    const vm = window.vm || (window.smalruby && window.smalruby.vm) || findVm();
    // 読み込み直すだけでも「ほかの作品を読み込んだ」と同じ（ランタイムの PROJECT_LOADED）。
    await vm.loadProject(vm.toJSON());
});
await page.waitForTimeout(500);
const barAfterNew = await page.evaluate(() => !!document.querySelector('[data-testid="classroom-teacher-work-bar"]'));
record({
    name: 'loading another project removes the bar',
    ok: barAgain && !barAfterNew,
    detail: `bar after reopening the work ${barAgain} · after another project ${barAfterNew}`,
});

// メニューバーのログアウト: 隠れている採点の画面に下書きがあれば、クラス管理を開いて採点の確認を出す (#1990)。
await page.click('[data-testid="classroom-teacher-menu-button"]');
await page.click('[data-testid="classroom-teacher-menu-logout"]');
await page.waitForSelector('[data-testid="classroom-eval-leave-confirm"]', { timeout: 10000 }).catch(() => {});
const menuLogout = await leaveState();
const stillIn = await page.evaluate(() => !!document.querySelector('[data-testid="classroom-teacher-menu-button"]'));
record({
    name: 'menu bar logout over the hidden grading drafts opens class management and asks first',
    ok: menuLogout.onScreen && !!menuLogout.message && /離れる|はなれる/.test(menuLogout.yes || '') && stillIn,
    detail: `"${menuLogout.message}" · [${menuLogout.yes}] bottom ${menuLogout.yesBottom}/${menuLogout.vh} · logged in ${stillIn}`,
});
await page.click('[data-testid="classroom-eval-leave-cancel"]');
await page.waitForTimeout(200);
const afterStay = await draftState();
record({
    name: '[採点を続ける] after the menu bar logout keeps the drafts',
    ok: afterStay.onScreen && afterStay.reason === REASON && afterStay.comment === COMMENT,
    detail: JSON.stringify(afterStay),
});

await browser.close();
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} checks passed at ${VIEWPORT.width}x${VIEWPORT.height}`);
process.exit(failed.length ? 1 : 0);
