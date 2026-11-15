// The class list (#1959: EPIC #1956 Q4・Q5・Q12) at the lesson PC size (1300x600). The
// classroom API is stubbed with page.route, so no login or stg data is needed — only the
// dev server.
//
// Scenarios:
//   eight     8 classes: every card is on screen (4 x 2), the 「確認が必要な課題」 band shows the
//             assignments with submissions not returned, the main button is visible and the
//             page / body do not scroll (R6). Takes the docs screenshot 0210 with DOCS_SHOTS=1.
//   many      11 classes: only the card frame scrolls.
//   empty     no class: the empty message.
//   archived  「アーカイブ済みのクラス」 switches to the archived cards with ［元に戻す］ (docs 0216),
//             and ⋮ › アーカイブ on a card asks first (docs 0230).
//   long      long class names and sections are cut with「…」 on one line.
//   keyboard  Tab reaches the cards and their buttons; Enter opens ⋮, Escape closes it.
//
//   node verify-classroom-class-list.mjs                  # headless, asserts (exit 1 on a failure)
//   DOCS_SHOTS=1 node verify-classroom-class-list.mjs     # + docs/classroom/screenshots
//   LOCALE=ja-Hira node verify-classroom-class-list.mjs   # ひらがなで測る (DOCS_SHOTS は ja のときだけ)
//   BASE=http://localhost:8621 node verify-classroom-class-list.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_DIR = resolve(REPO_ROOT, 'docs/classroom/screenshots');
const LOCALE = process.env.LOCALE || 'ja';
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1' && LOCALE === 'ja';
const VIEWPORT = { width: 1300, height: 600 };
mkdirSync(SHOT_DIR, { recursive: true });

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const CLASS_DEFS = [
    ['技術', '2年1組', 40, { googleClassroomCourseId: 'gc1' }],
    ['情報', '1年A', 38, { genai: { enabled: true, service: 'gemini' } }],
    ['総合', '', 32, {}],
    ['技術', '2年2組', 39, { role: 'co-teacher' }],
    ['技術', '2年3組', 40, {}],
    ['プログラミング部', '', 12, {}],
    ['技術', '1年1組', 40, {}],
    ['情報', '1年B', 37, {}],
    ['技術', '3年1組', 36, {}],
    ['技術', '3年2組', 35, {}],
    ['理科', '2年1組', 40, {}],
];
const LONG_NAME = '技術・家庭科（情報の技術）プログラミングによる問題の解決と双方向性のあるコンテンツ';
const LONG_SECTION = '2年1組 A コース（火曜 3・4 時間目）';

const makeGroups = (n, { long = false } = {}) =>
    CLASS_DEFS.slice(0, n).map(([name, section, studentCount, over], i) => ({
        groupId: `g${i + 1}`,
        name: long && i < 2 ? LONG_NAME : name,
        section: long && i < 2 ? LONG_SECTION : section,
        year: 2026,
        studentCount,
        status: 'active',
        schemaVersion: 2,
        topics: [],
        role: 'owner',
        createdAt: iso(now - (60 - i) * DAY),
        ...over,
    }));

const assignment = (over) => ({
    studentCount: 30,
    googleClassroomCourseId: null,
    coTeacherEmails: [],
    topic: null,
    hasAssignment: true,
    status: 'active',
    role: 'owner',
    createdAt: iso(now - 10 * DAY),
    expiresAt: iso(now + 80 * DAY),
    ...over,
});
const makeClassrooms = (groups) => {
    const list = [];
    groups.forEach((g, i) => {
        if (i === 6) return; // 技術 1年1組 has no assignment yet
        list.push(
            assignment({
                classroomId: `c${i + 1}a`,
                groupId: g.groupId,
                className: g.name,
                assignmentName: i % 2 ? '双方向のコンテンツ' : 'ねこを動かそう',
                joinCode: `ab${i}cde`,
                sortDate: iso(now - (i + 1) * DAY),
            }),
        );
        if (i < 5) {
            list.push(
                assignment({
                    classroomId: `c${i + 1}b`,
                    groupId: g.groupId,
                    className: g.name,
                    assignmentName: 'チャットアプリを作ろう',
                    joinCode: `xy${i}zwq`,
                    sortDate: iso(now + (i + 2) * DAY),
                }),
            );
        }
    });
    return list;
};
// Submissions: c1a has 12 not returned, c2a 25, the others are all returned.
const submissionsFor = (classroomId) => {
    const unreturned = { c1a: 12, c2a: 25 }[classroomId] || 0;
    return Array.from({ length: Math.max(unreturned, 4) }, (_, i) => ({
        submissionId: `${classroomId}-s${i}`,
        memberId: `seat-${String(i + 1).padStart(2, '0')}`,
        status: i < unreturned ? 'submitted' : 'returned',
        submittedAt: iso(now - DAY),
    }));
};

const results = [];
const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const state = { groups: [], classrooms: [] };
const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
await page.route('**/kick-requests/pending', (r) => r.fulfill({ json: { requests: [] } }));
await page.route('**/classroom-groups', (r) => r.fulfill({ json: { groups: state.groups } }));
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: state.classrooms } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: state.classrooms } }));
await page.route(/\/classrooms\/[^/]+\/submissions$/, (r) => {
    const id = r.request().url().match(/classrooms\/([^/]+)\/submissions$/)[1];
    return r.fulfill({ json: { submissions: submissionsFor(id) } });
});

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name, docsName) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `issue-1959-${name}${LOCALE === 'ja' ? '' : `-${LOCALE}`}.png`) });
    if (DOCS_SHOTS && docsName) await page.screenshot({ path: resolve(DOCS_DIR, docsName) });
};

const openList = async ({ groups, classrooms }) => {
    state.groups = groups;
    state.classrooms = classrooms;
    await page.goto(`${BASE}/?no_beforeunload=1&locale=${LOCALE}&devlogin=stub-token`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    // The dev server's warning overlay would swallow the clicks.
    await page.addStyleTag({ content: '#webpack-dev-server-client-overlay { display: none !important; }' });
    await page.$eval(tid('classroom-teacher-menu-button'), (el) => el.click());
    await page.waitForTimeout(300);
    await page.$eval(tid('classroom-teacher-menu-class-list'), (el) => el.click());
    await page.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 20000 });
    await page.waitForTimeout(800);
};

// R6: the main button's bottom, the body (the class list screen) and the page, and the card frame.
const measure = () =>
    page.evaluate(() => {
        const se = document.scrollingElement;
        const body = document.querySelector('[data-testid="classroom-phase-teacher-class-list"]');
        const btn = document.querySelector('[data-testid="classroom-class-create"]');
        const frame = document.querySelector('[data-testid="classroom-class-list-scroll"]');
        const cards = Array.from(document.querySelectorAll('[data-testid^="classroom-class-card-"]'));
        const frameRect = frame ? frame.getBoundingClientRect() : null;
        const visible = cards.filter((c) => {
            const r = c.getBoundingClientRect();
            return frameRect && r.top >= frameRect.top - 1 && r.bottom <= frameRect.bottom + 1;
        });
        const lastBottom = cards.length ? Math.max(...cards.map((c) => c.getBoundingClientRect().bottom)) : null;
        const card = cards[0] ? cards[0].getBoundingClientRect() : null;
        return {
            title: document.querySelector('[data-testid="classroom-phase-teacher-class-list"] h2')?.textContent,
            bottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
            bodyOk: body ? body.scrollHeight <= body.clientHeight : false,
            body: body ? `${body.scrollHeight}/${body.clientHeight}` : '-',
            frame: frame ? `${frame.scrollHeight}/${frame.clientHeight}` : '-',
            frameScrolls: frame ? frame.scrollHeight > frame.clientHeight : false,
            pageOk: se.scrollHeight <= se.clientHeight && se.scrollWidth <= se.clientWidth,
            cards: cards.length,
            visible: visible.length,
            lastBottom: lastBottom === null ? null : Math.round(lastBottom),
            cardSize: card ? `${Math.round(card.width)}x${Math.round(card.height)}` : '-',
            band: document.querySelector('[data-testid="classroom-review-band"]')?.innerText.replace(/\s+/g, ' '),
        };
    });
const r6 = (m) => m.bottom !== null && m.bottom <= VIEWPORT.height && m.bodyOk && m.pageOk;
const r6Detail = (m) =>
    `create bottom=${m.bottom}/${VIEWPORT.height} page=${m.pageOk ? 'no scroll' : 'SCROLLS'} body=${m.body} frame=${m.frame} cards=${m.visible}/${m.cards} visible card=${m.cardSize} last-card bottom=${m.lastBottom}`;

try {
    // eight
    const eight = makeGroups(8);
    await openList({ groups: eight, classrooms: makeClassrooms(eight) });
    await page.waitForSelector(tid('classroom-review-item-c1a'), { timeout: 10000 });
    let m = await measure();
    const expectedTitle = 'クラス';
    record('eight classes on one screen', r6(m) && m.cards === 8 && m.visible === 8 && !m.frameScrolls && m.title === expectedTitle, `title=${m.title} ${r6Detail(m)}`);
    const band = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid^="classroom-review-item-"]')).map((e) =>
            e.getAttribute('data-testid').replace('classroom-review-item-', ''),
        ),
    );
    record('needs-review band', band.join() === 'c1a,c2a', `items=${band.join(',')} text=${m.band}`);
    const bandColors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid^="classroom-class-band-"]')).map((e) => getComputedStyle(e).backgroundColor),
    );
    record('class colors', new Set(bandColors).size === 8, bandColors.join(' '));
    await shot('eight', '0210-teacher-class-list.png');

    // ［採点を開く］ opens grading of that class.
    await page.locator(tid('classroom-review-open-c2a')).click();
    await page.waitForTimeout(800);
    const grading = await page.evaluate(() => !!document.querySelector('[data-testid="classroom-phase-teacher-evaluation"]'));
    record('open grading from the band', grading, `evaluation=${grading}`);

    // many
    const many = makeGroups(11);
    await openList({ groups: many, classrooms: makeClassrooms(many) });
    m = await measure();
    record('eleven classes: only the card frame scrolls', r6(m) && m.cards === 11 && m.frameScrolls, r6Detail(m));
    await shot('many');

    // empty
    await openList({ groups: [], classrooms: [] });
    m = await measure();
    const empty = await page.evaluate(() => !!document.querySelector('[data-testid="classroom-class-list-empty"]'));
    record('no class', r6(m) && empty && !m.band, `empty=${empty} band=${m.band || 'none'} ${r6Detail(m)}`);
    await shot('empty');

    // archived
    const withArchived = makeGroups(5).map((g, i) => (i >= 3 ? { ...g, status: 'archived' } : g));
    await openList({ groups: withArchived, classrooms: makeClassrooms(withArchived) });
    await page.locator(tid('classroom-show-archived')).click();
    await page.waitForTimeout(300);
    const arch = await page.evaluate(() => ({
        list: !!document.querySelector('[data-testid="classroom-archived-class-list"]'),
        cards: Array.from(document.querySelectorAll('[data-testid^="classroom-class-card-"]')).map((e) =>
            e.getAttribute('data-testid').replace('classroom-class-card-', ''),
        ),
        restore: document.querySelectorAll('[data-testid^="classroom-class-restore-"]').length,
        menus: document.querySelectorAll('[data-testid^="classroom-class-menu-"]').length,
        band: !!document.querySelector('[data-testid="classroom-review-band"]'),
    }));
    m = await measure();
    record('archived classes', arch.list && arch.cards.join() === 'g4,g5' && arch.restore === 2 && arch.menus === 0 && !arch.band && r6(m), `${JSON.stringify(arch)} ${r6Detail(m)}`);
    await shot('archived', '0216-class-list-archived.png');

    // archive from ⋮ (confirm dialog, not red)
    await page.locator(tid('classroom-show-archived')).click();
    await page.locator(tid('classroom-class-menu-g1')).click();
    await page.locator(tid('classroom-class-archive-g1')).click();
    const dlg = await page.evaluate(() => {
        const confirm = document.querySelector('[data-testid="classroom-class-archive-confirm"]');
        return {
            open: !!document.querySelector('[data-testid="classroom-class-archive-dialog"]'),
            focus: document.activeElement?.getAttribute('data-testid'),
            bg: confirm ? getComputedStyle(confirm).backgroundColor : null,
            bottom: confirm ? Math.round(confirm.getBoundingClientRect().bottom) : null,
        };
    });
    record('archive confirmation from ⋮', dlg.open && dlg.focus === 'classroom-class-archive-cancel' && dlg.bottom <= VIEWPORT.height, JSON.stringify(dlg));
    await shot('archive-dialog', '0230-class-card-archive-confirm.png');
    await page.keyboard.press('Escape');

    // long
    const long = makeGroups(8, { long: true });
    await openList({ groups: long, classrooms: makeClassrooms(long) });
    m = await measure();
    const cut = await page.evaluate(() => {
        const name = document.querySelector('[data-testid="classroom-class-band-g1"] span');
        const band = document.querySelector('[data-testid="classroom-class-band-g1"]');
        return {
            cut: name.scrollWidth > name.clientWidth,
            oneLine: getComputedStyle(name).whiteSpace === 'nowrap',
            bandH: Math.round(band.getBoundingClientRect().height),
        };
    });
    record('long class names', r6(m) && m.visible === 8 && cut.cut && cut.oneLine && cut.bandH === 64, `${JSON.stringify(cut)} ${r6Detail(m)}`);
    await shot('long');

    // keyboard
    const kb = makeGroups(8);
    await openList({ groups: kb, classrooms: makeClassrooms(kb) });
    await page.locator(tid('classroom-class-open-g1')).focus();
    const seen = [];
    for (let i = 0; i < 4; i++) {
        seen.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')));
        await page.keyboard.press('Tab');
    }
    // seen: open-g1, evaluate-g1, settings-open-g1, menu-g1
    await page.locator(tid('classroom-class-menu-g1')).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const menuOpen = await page.evaluate(() => !!document.querySelector('[data-testid="classroom-class-menu-g1-list"]'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const menuClosed = await page.evaluate(() => !document.querySelector('[data-testid="classroom-class-menu-g1-list"]'));
    record(
        'keyboard',
        seen.join() === 'classroom-class-open-g1,classroom-class-evaluate-g1,classroom-class-settings-open-g1,classroom-class-menu-g1' && menuOpen && menuClosed,
        `tab order=${seen.join(' → ')} ⋮ enter=${menuOpen} escape=${menuClosed}`,
    );
} catch (e) {
    record('script', false, e.message);
} finally {
    await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed (locale=${LOCALE})`);
process.exit(failed.length ? 1 : 0);
