/* eslint-env jest */
/**
 * 課題のレッスンの設定（#1598）: 下書き ↔ API の lesson・完了の条件・採点の点。
 */
import {
    buildLessonPayload,
    canChooseRequiredPoints,
    ceilPoints,
    challengePoints,
    completionRange,
    completionTarget,
    computeLessonScore,
    createLessonDraft,
    defaultRequiredPoints,
    droppedChallengeIds,
    effectiveScoring,
    lessonChanges,
    isSameLessonScoring,
    lessonDraftFromSaved,
    missingChallengeIds,
    requiredPointsUnusedReason,
    scoringCounts,
    setChallengeChecked,
    setChallengeRequired,
    setCompletion,
    setLessonChecked,
    setScoring,
    splitLessonPoints,
    validateLessonDraft,
} from '../../../src/lib/classroom-lesson-settings.js';
import { COURSES } from '../../../src/lib/lessons/courses.js';

const course = {
    id: 'c',
    lessons: [
        { id: 'l1', challenges: [{ id: 'a' }, { id: 'b' }, { id: 'c1' }] },
        { id: 'l2', challenges: [{ id: 'd' }, { id: 'e' }, { id: 'f' }] },
    ],
};

const withAll = () =>
    setLessonChecked(setLessonChecked(createLessonDraft('c'), course, 'l2', true), course, 'l1', true);

describe('チャレンジを選ぶ', () => {
    test('レッスンにチェックすると中のチャレンジが全部入り、順番はレッスンの順のまま', () => {
        const draft = withAll();
        expect(draft.challengeIds).toEqual(['a', 'b', 'c1', 'd', 'e', 'f']);
    });

    test('チャレンジごとに外せる・戻すと元の位置に入る', () => {
        let draft = setChallengeChecked(withAll(), course, 'b', false);
        expect(draft.challengeIds).toEqual(['a', 'c1', 'd', 'e', 'f']);
        draft = setChallengeChecked(draft, course, 'b', true);
        expect(draft.challengeIds).toEqual(['a', 'b', 'c1', 'd', 'e', 'f']);
    });

    test('レッスンのチェックを外すと中のチャレンジが外れ、★ も外れる', () => {
        let draft = setChallengeRequired(withAll(), 'a', true);
        draft = setLessonChecked(draft, course, 'l1', false);
        expect(draft.challengeIds).toEqual(['d', 'e', 'f']);
        expect(draft.requiredChallengeIds).toEqual([]);
    });

    test('★ は選んだチャレンジにだけ付く・レッスンの順に並ぶ', () => {
        let draft = setChallengeChecked(withAll(), course, 'b', false);
        draft = setChallengeRequired(draft, 'b', true);
        expect(draft.requiredChallengeIds).toEqual([]);
        draft = setChallengeRequired(draft, 'e', true);
        draft = setChallengeRequired(draft, 'a', true);
        expect(draft.requiredChallengeIds).toEqual(['a', 'e']);
        draft = setChallengeRequired(draft, 'a', false);
        expect(draft.requiredChallengeIds).toEqual(['e']);
    });
});

describe('完了の条件', () => {
    test('既定は「全部」', () => {
        const draft = withAll();
        expect(completionTarget(draft)).toBe(6);
        expect(buildLessonPayload(draft).completion).toEqual({ type: 'all' });
    });

    test('n は必須の数（最低 1）から選んだ数まで', () => {
        let draft = withAll();
        expect(completionRange(draft)).toEqual({ min: 1, max: 6 });
        draft = setChallengeRequired(setChallengeRequired(draft, 'a', true), 'b', true);
        expect(completionRange(draft)).toEqual({ min: 2, max: 6 });
        expect(setCompletion(draft, 'count', 0).completion.count).toBe(2);
        expect(setCompletion(draft, 'count', 9).completion.count).toBe(6);
        expect(setCompletion(draft, 'count', 4).completion).toEqual({ type: 'count', count: 4 });
    });

    test('「n つ」に切り替えた直後は選んだ数・「全部」に戻すと n を忘れる', () => {
        let draft = setCompletion(withAll(), 'count');
        expect(draft.completion).toEqual({ type: 'count', count: 6 });
        draft = setCompletion(draft, 'count', 3);
        draft = setCompletion(draft, 'all');
        expect(draft.completion).toEqual({ type: 'all', count: null });
        expect(setCompletion(draft, 'count').completion.count).toBe(6);
    });

    test('選ぶ数が減ると n も範囲に収まる', () => {
        let draft = setCompletion(withAll(), 'count', 5);
        draft = setLessonChecked(draft, course, 'l2', false);
        expect(draft.completion.count).toBe(3);
        expect(buildLessonPayload(draft).completion).toEqual({ type: 'count', count: 3 });
    });
});

describe('採点の点', () => {
    test('必須の点の既定は満点の 70%（切り上げ・満点まで）', () => {
        expect(defaultRequiredPoints(100)).toBe(70);
        expect(defaultRequiredPoints(50)).toBe(35);
        expect(defaultRequiredPoints(7)).toBe(5);
        expect(defaultRequiredPoints(1)).toBe(1);
    });

    test('小数第 6 位で丸めてから切り上げる', () => {
        expect(ceilPoints(40.00000000000001)).toBe(40);
        expect(ceilPoints(77.5)).toBe(78);
    });

    test('例: 満点 100・6 つ（★ 2）・必須の点 70 → 35 点と 7.5 点', () => {
        const draft = setChallengeRequired(setChallengeRequired(withAll(), 'a', true), 'd', true);
        expect(effectiveScoring(draft)).toEqual({ total: 100, requiredPoints: 70, optionalPoints: 30 });
        expect(challengePoints(draft)).toEqual({ required: 35, optional: 7.5 });
    });

    test('必須が 0 個なら全部同じ点・必須でないものが 0 個なら必須の点 = 満点', () => {
        expect(effectiveScoring(withAll())).toEqual({ total: 100, requiredPoints: 0, optionalPoints: 100 });
        expect(canChooseRequiredPoints(withAll())).toBe(false);
        let all = withAll();
        for (const id of all.challengeIds) all = setChallengeRequired(all, id, true);
        expect(effectiveScoring(all)).toEqual({ total: 100, requiredPoints: 100, optionalPoints: 0 });
        expect(canChooseRequiredPoints(all)).toBe(false);
    });

    test('満点は 1〜1000、必須の点は 0〜満点に収める', () => {
        const draft = setChallengeRequired(withAll(), 'a', true);
        expect(setScoring(draft, { total: 5000 }).scoring.total).toBe(1000);
        expect(setScoring(draft, { total: 0 }).scoring.total).toBe(1);
        const s = setScoring(setScoring(draft, { total: 50 }), { requiredPoints: 80 });
        expect(s.scoring).toEqual({ total: 50, requiredPoints: 50 });
        expect(setScoring(s, { requiredPoints: '' }).scoring.requiredPoints).toBeNull();
        expect(effectiveScoring(setScoring(draft, { total: 50 })).requiredPoints).toBe(35);
        // 満点を打ち直す途中（100 → 5 → 50）で必須の点を失わない
        const typed = setScoring(setScoring(setScoring(draft, { requiredPoints: 30 }), { total: 5 }), { total: 50 });
        expect(effectiveScoring(typed).requiredPoints).toBe(30);
    });

    test('採点を触っていなければ scoring は null（既定のまま）', () => {
        expect(buildLessonPayload(withAll()).scoring).toBeNull();
    });

    test('レッスンの点 = できたチャレンジの点の合計（切り上げ・満点まで・設定の外は数えない）', () => {
        const draft = setChallengeRequired(setChallengeRequired(withAll(), 'a', true), 'd', true);
        const lesson = buildLessonPayload(setScoring(draft, { total: 100 }));
        expect(computeLessonScore(lesson, ['a', 'd', 'b'])).toBe(78);
        expect(computeLessonScore(lesson, ['a', 'b', 'c1', 'e'])).toBe(58);
        expect(computeLessonScore(lesson, ['a', 'b', 'c1', 'd', 'e', 'f', 'zzz'])).toBe(100);
        // scoring が null（既定）でも同じ計算
        expect(computeLessonScore(buildLessonPayload(draft), ['a', 'd', 'b'])).toBe(78);
        expect(computeLessonScore(null, ['a'])).toBeNull();
    });

    test('誤差で 1 点ずれない（満点 50・7 つ（★ 1）・必須の点 30）', () => {
        const lesson = {
            courseId: 'x',
            challengeIds: ['r', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6'],
            requiredChallengeIds: ['r'],
            scoring: { total: 50, requiredPoints: 30, optionalPoints: 20 },
        };
        expect(computeLessonScore(lesson, ['r', 'o1', 'o2', 'o3'])).toBe(40);
    });
});

describe('API の lesson との行き来', () => {
    test('下書き → payload → 下書き で変わらない', () => {
        let draft = setChallengeRequired(withAll(), 'b', true);
        draft = setCompletion(draft, 'count', 4);
        draft = setScoring({ ...draft, submitWork: true }, { total: 50, requiredPoints: 20 });
        const payload = buildLessonPayload(draft);
        expect(payload).toEqual({
            courseId: 'c',
            challengeIds: ['a', 'b', 'c1', 'd', 'e', 'f'],
            requiredChallengeIds: ['b'],
            completion: { type: 'count', count: 4 },
            submitWork: true,
            scoring: { total: 50, requiredPoints: 20, optionalPoints: 30 },
        });
        expect(lessonChanges(lessonDraftFromSaved(payload), payload).any).toBe(false);
    });

    test('レッスンなしは null', () => {
        expect(buildLessonPayload(null)).toBeNull();
        expect(lessonDraftFromSaved(null)).toBeNull();
        expect(lessonChanges(null, null).any).toBe(false);
    });

    test('保存した値と比べて、変えたところだけが分かる', () => {
        const saved = buildLessonPayload(withAll());
        const draft = lessonDraftFromSaved(saved);
        expect(lessonChanges(setCompletion(draft, 'count', 3), saved)).toMatchObject({
            any: true,
            course: false,
            challenges: false,
            completion: true,
            submit: false,
        });
        expect(lessonChanges({ ...draft, submitWork: true }, saved).submit).toBe(true);
        expect(lessonChanges(null, saved)).toMatchObject({ any: true, course: true });
        expect(lessonChanges(draft, null)).toMatchObject({ any: true, course: true });
    });

    test('必須が無いときの保存値（必須の点 0）から読み直しても、変えていない扱い', () => {
        const draft = setScoring(withAll(), { total: 80 });
        const saved = buildLessonPayload(draft);
        expect(saved.scoring).toEqual({ total: 80, requiredPoints: 0, optionalPoints: 80 });
        const reloaded = lessonDraftFromSaved(saved);
        expect(reloaded.scoring).toEqual({ total: 80, requiredPoints: null });
        expect(lessonChanges(reloaded, saved).any).toBe(false);
        // あとで ★ を付けると、必須の点は既定（満点の 70%）から始まる
        expect(effectiveScoring(setChallengeRequired(reloaded, 'a', true)).requiredPoints).toBe(56);
    });

    test('設定から外したチャレンジ（送られた進み具合を数えなくなる）', () => {
        const saved = buildLessonPayload(withAll());
        const draft = setLessonChecked(lessonDraftFromSaved(saved), course, 'l1', false);
        expect(droppedChallengeIds(draft, saved)).toEqual(['a', 'b', 'c1']);
        expect(droppedChallengeIds(createLessonDraft('other'), saved)).toHaveLength(6);
        expect(droppedChallengeIds(draft, null)).toEqual([]);
    });
});

describe('保存の前の確かめ', () => {
    test('コースが無い・チャレンジが 0 個は保存できない', () => {
        expect(validateLessonDraft(null, null)).toBeNull();
        expect(validateLessonDraft(createLessonDraft('gone'), null)).toBe('unknownCourse');
        expect(validateLessonDraft(createLessonDraft('c'), course)).toBe('noChallenges');
        expect(validateLessonDraft(withAll(), course)).toBeNull();
    });
});

describe('本物のコース', () => {
    test('コースの id とチャレンジの id はサーバーの形に合う', () => {
        const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
        for (const c of COURSES) {
            expect(c.id).toMatch(ID);
            for (const lesson of c.lessons) {
                for (const challenge of lesson.challenges) expect(challenge.id).toMatch(ID);
            }
        }
    });
});

describe('レビュー対応（#1765）', () => {
    // 11 チャレンジ・★ 2 の下書き
    const course11 = {
        id: 'c11',
        lessons: [{ id: 'l', challenges: Array.from({ length: 11 }, (_, i) => ({ id: `x${i}` })) }],
    };
    const eleven = () => {
        let d = setLessonChecked(createLessonDraft('c11'), course11, 'l', true);
        d = setChallengeRequired(setChallengeRequired(d, 'x0', true), 'x1', true);
        return setCompletion(d, 'count');
    };

    test('M1: ★2 で「10」を確定できる（入力中の「1」は確定しない前提）', () => {
        expect(setCompletion(eleven(), 'count', '10').completion.count).toBe(10);
        // 途中の「1」を確定すると min に吸われる（だから確定は blur / Enter のときだけ）
        expect(setCompletion(eleven(), 'count', '1').completion.count).toBe(2);
    });

    test('M1: 空の確定は前の値のまま', () => {
        const d = setCompletion(eleven(), 'count', '7');
        expect(setCompletion(d, 'count', '').completion.count).toBe(7);
        const s = setScoring(d, { total: 80 });
        expect(setScoring(s, { total: '' }).scoring.total).toBe(80);
    });

    test('M1: 満点を消して 50 を確定すると 50（150 にならない）', () => {
        const d = setScoring(eleven(), { total: '50' });
        expect(effectiveScoring(d).total).toBe(50);
    });

    test('M1: 必須の点を消して確定すると既定（満点の 70%）に戻る', () => {
        const d = setScoring(setScoring(eleven(), { requiredPoints: 40 }), { requiredPoints: '' });
        expect(d.scoring.requiredPoints).toBeNull();
        expect(effectiveScoring(d).requiredPoints).toBe(70);
    });

    test('Q1: 既定と同じ点は既定として扱う（scoring: null で送る・満点に追従する）', () => {
        const d = eleven();
        expect(buildLessonPayload(setScoring(d, { total: 100 })).scoring).toBeNull();
        expect(buildLessonPayload(setScoring(d, { total: 100, requiredPoints: 70 })).scoring).toBeNull();
        // 必須の点を既定と同じにすると既定に追従する
        const linked = setScoring(setScoring(d, { requiredPoints: 70 }), { total: 200 });
        expect(effectiveScoring(linked).requiredPoints).toBe(140);
    });

    test('Q1: 既定と同じ保存値は、読み直すと満点に追従する', () => {
        const saved = {
            ...buildLessonPayload(eleven()),
            scoring: { total: 50, requiredPoints: 35, optionalPoints: 15 },
        };
        const draft = lessonDraftFromSaved(saved);
        expect(draft.scoring).toEqual({ total: 50, requiredPoints: null });
        expect(effectiveScoring(setScoring(draft, { total: 200 })).requiredPoints).toBe(140);
        const def = { ...saved, scoring: { total: 100, requiredPoints: 70, optionalPoints: 30 } };
        expect(lessonChanges(lessonDraftFromSaved(def), def).any).toBe(false);
        expect(buildLessonPayload(lessonDraftFromSaved(def)).scoring).toBeNull();
    });

    test('FYI2: コースに無い保存済みのチャレンジは数えない・保存で外れる', () => {
        const saved = {
            courseId: 'c',
            challengeIds: ['a', 'gone', 'b'],
            requiredChallengeIds: ['gone', 'a'],
            completion: { type: 'count', count: 3 },
        };
        const draft = lessonDraftFromSaved(saved, course);
        expect(draft.challengeIds).toEqual(['a', 'b']);
        expect(draft.requiredChallengeIds).toEqual(['a']);
        expect(missingChallengeIds(saved, course)).toEqual(['gone']);
        expect(missingChallengeIds(saved, null)).toEqual([]);
        expect(buildLessonPayload(draft).challengeIds).toEqual(['a', 'b']);
        expect(buildLessonPayload(draft).completion).toEqual({ type: 'count', count: 2 });
        expect(lessonChanges(draft, saved).challenges).toBe(true);
        // 得点の分母にも入れない
        expect(computeLessonScore(saved, ['a', 'b'], course)).toBe(100);
    });
});

describe('#1778: 点の配り方は条件の数 n と必須の数 r から決める', () => {
    const ids = ['a', 'b', 'c1', 'd', 'e', 'f'];
    const lessonOf = ({ required, completion = { type: 'all' }, scoring = null, challengeIds = ids }) => ({
        courseId: 'c',
        challengeIds,
        requiredChallengeIds: required,
        completion,
        submitWork: false,
        scoring,
    });

    test('splitLessonPoints: r = n / r = 0 / 0 < r < n', () => {
        expect(splitLessonPoints({ n: 6, r: 6, total: 100, requiredPoints: 70 })).toEqual({
            required: 100 / 6,
            optional: 0,
        });
        expect(splitLessonPoints({ n: 4, r: 0, total: 100, requiredPoints: 0 })).toEqual({
            required: null,
            optional: 25,
        });
        expect(splitLessonPoints({ n: 6, r: 2, total: 100, requiredPoints: 70 })).toEqual({
            required: 35,
            optional: 7.5,
        });
        expect(splitLessonPoints({ n: 0, r: 0, total: 100, requiredPoints: 0 })).toEqual({
            required: null,
            optional: 0,
        });
    });

    test('r = n（条件 6・必須 6・選んだ 8）: 必須 6 つで満点、必須以外は 0 点（保存済みの必須の点 70 は使わない）', () => {
        const lesson = lessonOf({
            challengeIds: [...ids, 'x', 'y'],
            required: ids,
            completion: { type: 'count', count: 6 },
            scoring: { total: 100, requiredPoints: 70, optionalPoints: 30 },
        });
        const extended = { id: 'c', lessons: [{ id: 'l', challenges: [...ids, 'x', 'y'].map((id) => ({ id })) }] };
        expect(computeLessonScore(lesson, ids, extended)).toBe(100);
        expect(computeLessonScore(lesson, ['x', 'y'], extended)).toBe(0);
        expect(computeLessonScore(lesson, ['a', 'b', 'c1'], extended)).toBe(50);
        const draft = lessonDraftFromSaved(lesson, extended);
        expect(canChooseRequiredPoints(draft)).toBe(false);
        expect(requiredPointsUnusedReason(draft)).toBe('allRequired');
        expect(effectiveScoring(draft)).toEqual({ total: 100, requiredPoints: 100, optionalPoints: 0 });
        expect(challengePoints(draft)).toEqual({ required: 100 / 6, optional: 0 });
    });

    test('r = 0（条件「4 つ」・選んだ 6）: 1 つ = 満点 ÷ 4、条件より多くできても満点まで', () => {
        const lesson = lessonOf({ required: [], completion: { type: 'count', count: 4 } });
        expect(computeLessonScore(lesson, ['a', 'b'], course)).toBe(50);
        expect(computeLessonScore(lesson, ['a', 'b', 'c1', 'd'], course)).toBe(100);
        expect(computeLessonScore(lesson, ids, course)).toBe(100);
        expect(requiredPointsUnusedReason(lessonDraftFromSaved(lesson, course))).toBe('noneRequired');
    });

    test('0 < r < n（満点 100・n = 6・r = 2・必須の点 70）: 必須 35 点ずつ・それ以外 7.5 点ずつ → 条件を満たすと 100', () => {
        const lesson = lessonOf({ required: ['a', 'd'] });
        expect(computeLessonScore(lesson, ids, course)).toBe(100);
        expect(computeLessonScore(lesson, ['a', 'd'], course)).toBe(70);
        expect(computeLessonScore(lesson, ['a', 'b'], course)).toBe(43); // 35 + 7.5 = 42.5 → 43
        expect(requiredPointsUnusedReason(lessonDraftFromSaved(lesson, course))).toBeNull();
    });

    test('0 < r < n で条件が「n つ」: 必須以外は (T − R) ÷ (n − r)、条件より多くできても満点まで', () => {
        // 選んだ 6・条件 4・必須 2 → 必須 35・それ以外 15
        const lesson = lessonOf({ required: ['a', 'd'], completion: { type: 'count', count: 4 } });
        expect(computeLessonScore(lesson, ['a', 'd', 'b', 'c1'], course)).toBe(100);
        expect(computeLessonScore(lesson, ['b', 'c1', 'e', 'f'], course)).toBe(60);
        expect(computeLessonScore(lesson, ids, course)).toBe(100);
    });

    test('割り切れない点も、条件ちょうどで満点（小数第 6 位で丸めてから切り上げ）', () => {
        // 満点 100・r = 0・n = 3 → 33.333… × 3
        const lesson = lessonOf({ required: [], completion: { type: 'count', count: 3 } });
        expect(computeLessonScore(lesson, ['a', 'b', 'c1'], course)).toBe(100);
        expect(computeLessonScore(lesson, ['a'], course)).toBe(34);
        // 満点 10・r = n = 3 → 3.333… × 3
        const all = lessonOf({
            required: ['a', 'b', 'c1'],
            completion: { type: 'count', count: 3 },
            scoring: { total: 10, requiredPoints: 10, optionalPoints: 0 },
        });
        expect(computeLessonScore(all, ['a', 'b', 'c1'], course)).toBe(10);
    });

    test('条件「全部」なら n = 選んだ数', () => {
        const draft = lessonDraftFromSaved(lessonOf({ required: ['a'] }), course);
        expect(scoringCounts(draft)).toEqual({ n: 6, r: 1 });
        expect(challengePoints(draft)).toEqual({ required: 70, optional: 6 });
    });

    test('採点の画面から: 必須の点を変えた lesson を作る（ほかの設定はそのまま）', () => {
        const saved = lessonOf({ required: ['a', 'd'] });
        const change = (lesson, value) => buildLessonPayload(setScoring(lessonDraftFromSaved(lesson, course), value));
        const next = change(saved, { requiredPoints: 50 });
        expect(next.scoring).toEqual({ total: 100, requiredPoints: 50, optionalPoints: 50 });
        expect(next.challengeIds).toEqual(ids);
        expect(next.requiredChallengeIds).toEqual(['a', 'd']);
        expect(computeLessonScore(next, ['a', 'd'], course)).toBe(50);
        // 既定に戻すと scoring は null（既定）
        expect(change(next, { requiredPoints: 70 }).scoring).toBeNull();
    });

    test('FYI1: 点が変わっていなければ同じ（既定の書き方の違いも同じとみなす）', () => {
        const saved = lessonOf({
            required: ['a', 'd'],
            scoring: { total: 100, requiredPoints: 70, optionalPoints: 30 },
        });
        expect(isSameLessonScoring(saved, null)).toBe(true);
        expect(isSameLessonScoring(saved, { total: 100, requiredPoints: 70, optionalPoints: 30 })).toBe(true);
        expect(isSameLessonScoring(saved, { total: 100, requiredPoints: 50, optionalPoints: 50 })).toBe(false);
        expect(isSameLessonScoring(lessonOf({ required: [] }), null)).toBe(true);
        expect(
            isSameLessonScoring(lessonOf({ required: [] }), { total: 80, requiredPoints: 0, optionalPoints: 80 }),
        ).toBe(false);
    });
});
