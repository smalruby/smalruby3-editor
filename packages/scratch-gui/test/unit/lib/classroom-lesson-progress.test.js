/* eslint-env jest */
/**
 * 先生の進み具合（#1602）: 座席の色・表の記号・できた人・並べ方・CSV。
 */
import {
    CELL_KINDS,
    CURRENT_FRESH_MS,
    SEAT_STATES,
    buildLessonProgressCsv,
    challengeHeadText,
    clearedSummary,
    columnTotals,
    formatCsvTime,
    lessonProgressContext,
    noteNames,
    progressRowsByMember,
    progressTableRows,
    seatNote,
    seatProgress,
    seatTile,
    sortProgressRows,
} from '../../../src/lib/classroom-lesson-progress.js';

const course = {
    id: 'c',
    lessons: [
        { id: 'l1', challenges: [{ id: 'a' }, { id: 'b' }, { id: 'x' }] },
        { id: 'l2', challenges: [{ id: 'd' }, { id: 'e' }] },
    ],
};

// 4 つ選んで ★ 2（b・d）、条件は 3 つ
const lesson = {
    courseId: 'c',
    challengeIds: ['a', 'b', 'd', 'e'],
    requiredChallengeIds: ['b', 'd'],
    completion: { type: 'count', count: 3 },
    submitWork: false,
    scoring: null,
};

const NOW = Date.UTC(2026, 10, 15, 1, 30);
const minutesAgo = (m) => new Date(NOW - m * 60 * 1000).toISOString();
const done = (before = false) => ({ completedAt: minutesAgo(30), before });

const ctx = lessonProgressContext(lesson, course);

describe('lessonProgressContext', () => {
    test('いまの設定のチャレンジをレッスンの順で、レッスンごとにまとめる', () => {
        expect(ctx.challengeIds).toEqual(['a', 'b', 'd', 'e']);
        expect(ctx.target).toBe(3);
        expect(ctx.lessonGroups.map((g) => [g.lesson.id, g.span])).toEqual([
            ['l1', 2],
            ['l2', 2],
        ]);
        expect(ctx.columns.filter((c) => c.required).map((c) => c.id)).toEqual(['b', 'd']);
    });

    test('コースのデータに無いチャレンジは数えない', () => {
        const c = lessonProgressContext({ ...lesson, challengeIds: ['a', 'gone', 'b'] }, course);
        expect(c.challengeIds).toEqual(['a', 'b']);
    });

    test('レッスンが無い・コースが無いときは null', () => {
        expect(lessonProgressContext(null, course)).toBeNull();
        expect(lessonProgressContext(lesson, null)).toBeNull();
        expect(lessonProgressContext({ ...lesson, courseId: 'other' }, course)).toBeNull();
    });
});

describe('seatProgress', () => {
    test('1 つもできていなければ「まだ」', () => {
        const p = seatProgress(null, ctx, NOW);
        expect(p.state).toBe(SEAT_STATES.NOT_STARTED);
        expect(p.remaining).toBe(3);
        expect(p.requiredLeft).toBe(2);
    });

    test('条件の数を超えてできても必須が残れば緑にしない・できた数は条件で止める', () => {
        const row = { challenges: { a: done(), e: done(), b: done(), x: done() }, current: null };
        const p = seatProgress(row, ctx, NOW);
        expect(p.done).toBe(3);
        expect(p.state).toBe(SEAT_STATES.IN_PROGRESS);
        expect(p.requiredLeft).toBe(1);
        expect(p.remaining).toBe(1);
        expect(p.shown).toBe(3);
    });

    test('今の設定に無いチャレンジの記録は数えない', () => {
        const p = seatProgress({ challenges: { x: done(), zzz: done() } }, ctx, NOW);
        expect(p.done).toBe(0);
    });

    test('条件の数以上で必須が全部なら課題クリア（前もふくむ）', () => {
        const row = { challenges: { a: done(true), b: done(), d: done(true) } };
        const p = seatProgress(row, ctx, NOW);
        expect(p.cleared).toBe(true);
        expect(p.state).toBe(SEAT_STATES.CLEARED);
        expect(p.before).toBe(2);
        expect(p.cells).toMatchObject({ a: CELL_KINDS.BEFORE, b: CELL_KINDS.DONE, e: CELL_KINDS.TODO });
    });

    test('いまやっているチャレンジは ▶、10 分以上は !', () => {
        const base = { challenges: { a: done() }, updatedAt: minutesAgo(1) };
        const now = seatProgress({ ...base, current: { challengeId: 'b', openedAt: minutesAgo(3) } }, ctx, NOW);
        expect(now.cells.b).toBe(CELL_KINDS.CURRENT);
        expect(now.stuck).toBe(false);
        const stuck = seatProgress({ ...base, current: { challengeId: 'b', openedAt: minutesAgo(12) } }, ctx, NOW);
        expect(stuck.cells.b).toBe(CELL_KINDS.STUCK);
        expect(stuck.stuck).toBe(true);
        expect(stuck.current.elapsedMs).toBe(12 * 60 * 1000);
    });

    test('▶ と ! の目安は最後の送信から 35 分（#1779）', () => {
        expect(CURRENT_FRESH_MS).toBe(35 * 60 * 1000);
    });

    test.each([
        [34, CELL_KINDS.STUCK],
        [35, CELL_KINDS.TODO],
        [36, CELL_KINDS.TODO],
    ])('最後の送信が %i 分前なら %s（35 分以上前は ▶ と ! を出さない）', (minutes, kind) => {
        const row = {
            challenges: {},
            current: { challengeId: 'b', openedAt: minutesAgo(40) },
            updatedAt: minutesAgo(minutes),
        };
        const p = seatProgress(row, ctx, NOW);
        expect(p.cells.b).toBe(kind);
        expect(p.stuck).toBe(kind === CELL_KINDS.STUCK);
        expect(p.current === null).toBe(kind === CELL_KINDS.TODO);
    });

    test('課題クリアした子は 34 分前の送信でも ! にせず ▶ のまま', () => {
        const row = {
            challenges: { a: done(), b: done(), d: done() },
            current: { challengeId: 'e', openedAt: minutesAgo(40) },
            updatedAt: minutesAgo(34),
        };
        const p = seatProgress(row, ctx, NOW);
        expect(p.cleared).toBe(true);
        expect(p.cells.e).toBe(CELL_KINDS.CURRENT);
        expect(p.stuck).toBe(false);
    });

    test('できたチャレンジを開き直していても止まっているにしない', () => {
        const row = {
            challenges: { b: done() },
            current: { challengeId: 'b', openedAt: minutesAgo(20) },
            updatedAt: minutesAgo(1),
        };
        const p = seatProgress(row, ctx, NOW);
        expect(p.current).toBeNull();
        expect(p.cells.b).toBe(CELL_KINDS.DONE);
    });
});

const members = [
    { memberId: 'seat-01', displayName: 'あ' },
    { memberId: 'seat-02', displayName: 'い' },
    { memberId: 'seat-03', displayName: 'う', left: true },
];
const data = {
    lesson,
    progress: [
        { memberId: 'seat-01', seatNumber: 1, challenges: { a: done() }, current: null, updatedAt: minutesAgo(1) },
        {
            memberId: 'seat-02',
            seatNumber: 2,
            challenges: { a: done(true), b: done(), d: done() },
            current: { challengeId: 'e', openedAt: minutesAgo(15) },
            updatedAt: minutesAgo(2),
        },
        { memberId: 'seat-03', seatNumber: 3, challenges: { a: done() }, current: null, updatedAt: minutesAgo(50) },
    ],
};
const byMember = progressRowsByMember(data);

describe('座席のタイルと表の行', () => {
    test('未参加の席は進み具合を出さない', () => {
        expect(seatTile(null, null, ctx, NOW).state).toBe(SEAT_STATES.NOT_JOINED);
        expect(seatTile(members[2], byMember['seat-03'], ctx, NOW).state).toBe(SEAT_STATES.NOT_JOINED);
        expect(seatTile(members[1], byMember['seat-02'], ctx, NOW).state).toBe(SEAT_STATES.CLEARED);
    });

    test('「クリア N / 参加 N」', () => {
        const tiles = members.map((m) => seatTile(m, byMember[m.memberId], ctx, NOW));
        tiles.push(seatTile(null, null, ctx, NOW));
        expect(clearedSummary(tiles)).toEqual({ cleared: 1, joined: 2 });
    });

    test('表は参加中の席と記録の残る席だけ（誰も来ていない席は出さない）', () => {
        const rows = progressTableRows(members, byMember, 5, ctx, NOW);
        expect(rows.map((r) => [r.seatNumber, r.joined])).toEqual([
            [1, true],
            [2, true],
            [3, false],
        ]);
    });

    test('できた人と、いまやっている人の数', () => {
        const rows = progressTableRows(members, byMember, 5, ctx, NOW);
        const totals = columnTotals(rows, ctx);
        expect(totals.a).toEqual({ done: 3, current: 0 });
        expect(totals.e).toEqual({ done: 0, current: 1 });
    });

    test('並べ方: 進んでいる順・止まっている順（同じなら席の順）', () => {
        const rows = progressTableRows(members, byMember, 5, ctx, NOW);
        expect(sortProgressRows(rows, 'progress').map((r) => r.seatNumber)).toEqual([2, 1, 3]);
        // 2 はいまやっているが課題クリアなので後ろ（#1767 Q1）→ 全員同じで席の順
        expect(sortProgressRows(rows, 'stuck').map((r) => r.seatNumber)).toEqual([1, 2, 3]);
        expect(sortProgressRows(sortProgressRows(rows, 'progress'), 'seat').map((r) => r.seatNumber)).toEqual([
            1, 2, 3,
        ]);
    });
});

describe('課題クリアした子は止まっているにしない（#1767 Q1）', () => {
    const row = {
        challenges: { a: done(), b: done(), d: done() },
        current: { challengeId: 'e', openedAt: minutesAgo(20) },
        updatedAt: minutesAgo(1),
    };

    test('クリアした席は ! にせず ▶（何分いるかは残す）', () => {
        const p = seatProgress(row, ctx, NOW);
        expect(p.cleared).toBe(true);
        expect(p.stuck).toBe(false);
        expect(p.cells.e).toBe(CELL_KINDS.CURRENT);
        expect(p.current.elapsedMs).toBe(20 * 60 * 1000);
    });

    test('止まっている順ではクリアした席を後ろに回す', () => {
        const ms = [
            { memberId: 'seat-01', displayName: 'あ' },
            { memberId: 'seat-02', displayName: 'い' },
        ];
        const rows = progressTableRows(
            ms,
            {
                'seat-01': { ...row, memberId: 'seat-01' },
                'seat-02': {
                    memberId: 'seat-02',
                    challenges: {},
                    current: { challengeId: 'a', openedAt: minutesAgo(3) },
                    updatedAt: minutesAgo(1),
                },
            },
            2,
            ctx,
            NOW,
        );
        expect(sortProgressRows(rows, 'stuck').map((r) => r.seatNumber)).toEqual([2, 1]);
    });
});

describe('CSV の数式（#1767 M3）', () => {
    test('名前が = で始まっても数式にしない', () => {
        const rows = progressTableRows([{ memberId: 'seat-01', displayName: '=HYPERLINK("x")' }], {}, 1, ctx, NOW);
        const csv = buildLessonProgressCsv(rows, {}, ctx, ['A', 'B', 'D', 'E'], NOW);
        expect(csv.split('\r\n')[1]).toBe('01,"\'=HYPERLINK(""x"")",,0,,,,,0');
    });
});

describe('CSV', () => {
    test('時刻は 2026/11/15 10:23 の形', () => {
        const iso = new Date(2026, 10, 15, 10, 23).toISOString();
        expect(formatCsvTime(iso)).toBe('2026/11/15 10:23');
        expect(formatCsvTime('nope')).toBe('');
    });

    test('出席番号・名前・課題クリア・できた数・チャレンジごと・得点', () => {
        const rows = progressTableRows(members, byMember, 5, ctx, NOW);
        const csv = buildLessonProgressCsv(rows, byMember, ctx, ['A', 'B', 'D', 'E'], NOW);
        const lines = csv.replace(/^﻿/, '').split('\r\n');
        expect(lines[0]).toBe('出席番号,名前,課題クリア,できた数,A,B,D,E,得点');
        const time = formatCsvTime(minutesAgo(30));
        // 条件 3・必須 2（#1778）: 必須 1 つ = 35 点・必須でない 1 つ = 30 ÷ (3 − 2) = 30 点
        expect(lines[1]).toBe(`01,あ,,1,${time},,,,30`);
        expect(lines[2]).toBe(`02,い,○,3,前,${time},${time},,100`);
    });
});

describe('challengeHeadText（#1779 Q8）', () => {
    const column = { lessonIndex: 0, challenge: { number: 2 }, required: false };
    test('英語は番号（1-2）を出す', () => {
        expect(challengeHeadText(column, 'Move with arrow keys', 'en')).toBe('1-2');
        expect(challengeHeadText({ ...column, lessonIndex: 1 }, 'x', 'en-US')).toBe('2-2');
    });
    test('英語の必須は ★ を付けた番号', () => {
        expect(challengeHeadText({ ...column, required: true }, 'Move', 'en')).toBe('★1-2');
    });
    test('ja / ja-Hira は今のまま名前', () => {
        expect(challengeHeadText(column, '矢印キーで動かす', 'ja')).toBe('矢印キーで動かす');
        expect(challengeHeadText({ ...column, required: true }, 'やじるし', 'ja-Hira')).toBe('★やじるし');
    });
});

describe('席のメモ: じゅんびチェックとおさらい（#2301）', () => {
    const notes = [
        {
            id: 'l1',
            challenges: [
                { id: 'a', name: 'A' },
                { id: 'b', name: 'B' },
            ],
        },
        { id: 'l2', challenges: [{ id: 'd', name: 'D' }] },
    ];
    const courses = [{ id: 'c', lessons: notes }];

    test('結果が無い席は何も出さない', () => {
        expect(seatNote(null, NOW, courses)).toEqual({ readiness: null, review: null });
        expect(seatNote({ challenges: {}, readiness: null }, NOW, courses).readiness).toBeNull();
    });

    test('missing が空なら ✓、あれば知っているチャレンジと知らない数', () => {
        expect(seatNote({ readiness: { checkedAt: minutesAgo(5), missing: [] } }, NOW, courses).readiness).toEqual({
            ready: true,
            missing: [],
            unknownCount: 0,
        });
        const note = seatNote(
            { readiness: { checkedAt: minutesAgo(5), missing: ['d', 'zz', 'a', 'd'] } },
            NOW,
            courses,
        );
        expect(note.readiness.ready).toBe(false);
        expect(note.readiness.missing.map((c) => c.id)).toEqual(['d', 'a']);
        expect(note.readiness.unknownCount).toBe(1);
    });

    test('おさらいは、最後の送信が新しいあいだだけ出す', () => {
        const row = (updatedAt) => ({
            challenges: {},
            current: { challengeId: 'b', openedAt: minutesAgo(3), review: true },
            updatedAt,
        });
        expect(seatNote(row(minutesAgo(2)), NOW, courses).review).toEqual({
            challengeId: 'b',
            challenge: notes[0].challenges[1],
        });
        expect(seatNote(row(new Date(NOW - CURRENT_FRESH_MS).toISOString()), NOW, courses).review).toBeNull();
        const plain = { ...row(minutesAgo(2)), current: { challengeId: 'b', openedAt: minutesAgo(3) } };
        expect(seatNote(plain, NOW, courses).review).toBeNull();
        const unknown = {
            ...row(minutesAgo(2)),
            current: { challengeId: 'zz', openedAt: minutesAgo(3), review: true },
        };
        expect(seatNote(unknown, NOW, courses).review).toEqual({ challengeId: 'zz', challenge: null });
    });

    test('名前は 2 つまで、残りは「ほか N」', () => {
        expect(noteNames(['A', 'B'], 0)).toEqual({ names: ['A', 'B'], more: 0 });
        expect(noteNames(['A', 'B', 'C'], 1)).toEqual({ names: ['A', 'B'], more: 2 });
    });

    test('できた数・課題クリア・得点・CSV には使わない', () => {
        const base = { memberId: 'seat-01', challenges: { a: done() }, current: null, updatedAt: minutesAgo(1) };
        const withNote = {
            ...base,
            readiness: { checkedAt: minutesAgo(5), missing: ['a'] },
            current: { challengeId: 'zz', openedAt: minutesAgo(2), review: true },
        };
        expect(seatProgress(withNote, ctx, NOW)).toEqual(seatProgress(base, ctx, NOW));
        const m = [{ memberId: 'seat-01', displayName: 'あ' }];
        const csv = (row) =>
            buildLessonProgressCsv(
                progressTableRows(m, { 'seat-01': row }, 1, ctx, NOW),
                { 'seat-01': row },
                ctx,
                ['A', 'B', 'D', 'E'],
                NOW,
            );
        expect(csv(withNote)).toBe(csv(base));
    });
});
