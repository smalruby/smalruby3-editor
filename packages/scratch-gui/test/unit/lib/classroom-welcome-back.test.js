/* eslint-env jest */
/**
 * おかえりなさいの画面で「この課題で出した作品から続ける」を主ボタンにするか (#1825)。
 */
import {
    projectHasBlocks,
    shouldOfferCurrentSubmission,
    submissionKey,
} from '../../../src/lib/classroom-welcome-back.js';

const CURRENT = {
    classroomId: 'c1',
    submittedAt: '2026-11-10T01:00:00.000Z',
    projectUrl: 'https://signed.example/cur.sb3',
};

// すべての条件を満たす状態。各テストはここから 1 つだけ変える。
const ok = (over = {}) => ({
    sessionVerified: true,
    lesson: false,
    projectChanged: false,
    projectFromOutside: false,
    hasBlocks: false,
    current: CURRENT,
    loadedSubmission: null,
    ...over,
});

describe('submissionKey', () => {
    test('課題と提出した時刻で 1 つの提出物を表す', () => {
        expect(submissionKey(CURRENT)).toBe('c1:2026-11-10T01:00:00.000Z');
    });

    test('出し直すと別の提出物になる', () => {
        expect(submissionKey({ ...CURRENT, submittedAt: '2026-11-11T01:00:00.000Z' })).not.toBe(
            submissionKey(CURRENT),
        );
    });

    test('提出物が無い・時刻が無いときは null', () => {
        expect(submissionKey(null)).toBeNull();
        expect(submissionKey({ classroomId: 'c1', submittedAt: null })).toBeNull();
    });
});

describe('projectHasBlocks', () => {
    const target = (ids) => ({ blocks: { _blocks: Object.fromEntries(ids.map((id) => [id, {}])) } });

    test('どのスプライトにもステージにもブロックが無ければ false', () => {
        expect(projectHasBlocks([target([]), target([])])).toBe(false);
    });

    test('どれか 1 つにでもブロックがあれば true（ステージもふくむ）', () => {
        expect(projectHasBlocks([target([]), target(['a'])])).toBe(true);
        expect(projectHasBlocks([target(['s']), target([])])).toBe(true);
    });

    test('target がまだ無い（作品を読み込む前・入れかえの途中）ときは「ブロックがある」とみなす', () => {
        expect(projectHasBlocks([])).toBe(true);
    });

    test('読めない target は「ブロックがある」とみなす（迷ったら「つづける」）', () => {
        expect(projectHasBlocks(null)).toBe(true);
        expect(projectHasBlocks([{}])).toBe(true);
    });
});

describe('shouldOfferCurrentSubmission', () => {
    test('すべての条件を満たせば出す', () => {
        expect(shouldOfferCurrentSubmission(ok())).toBe(true);
    });

    test('返却済みの提出物でも出す（提出物の状態は見ない）', () => {
        expect(shouldOfferCurrentSubmission(ok({ current: { ...CURRENT, status: 'returned' } }))).toBe(true);
    });

    test('1. セッションを確かめられていなければ出さない', () => {
        expect(shouldOfferCurrentSubmission(ok({ sessionVerified: false }))).toBe(false);
    });

    test('2. ブロックが 1 つでもあれば出さない', () => {
        expect(shouldOfferCurrentSubmission(ok({ hasBlocks: true }))).toBe(false);
    });

    test('2. 開いてから変更があれば出さない', () => {
        expect(shouldOfferCurrentSubmission(ok({ projectChanged: true }))).toBe(false);
    });

    test('2. ファイル・Google ドライブなどから開いた作品なら出さない', () => {
        expect(shouldOfferCurrentSubmission(ok({ projectFromOutside: true }))).toBe(false);
    });

    test('3. この課題で出した作品が無い・調べられなかったときは出さない', () => {
        expect(shouldOfferCurrentSubmission(ok({ current: null }))).toBe(false);
        expect(shouldOfferCurrentSubmission(ok({ current: undefined }))).toBe(false);
    });

    test('3. 読み込める URL の無い提出物では出さない', () => {
        expect(shouldOfferCurrentSubmission(ok({ current: { ...CURRENT, projectUrl: null } }))).toBe(false);
    });

    test('4. このタブで同じ提出物を読み込んだあとは、作品が空でも出さない', () => {
        expect(shouldOfferCurrentSubmission(ok({ loadedSubmission: submissionKey(CURRENT) }))).toBe(false);
    });

    test('4. このタブで読み込んだのが前の提出物なら、出し直した提出物を出す', () => {
        expect(shouldOfferCurrentSubmission(ok({ loadedSubmission: 'c1:2026-11-01T00:00:00.000Z' }))).toBe(true);
    });

    test('レッスンの課題では出さない（いまの主ボタンのまま）', () => {
        expect(shouldOfferCurrentSubmission(ok({ lesson: true }))).toBe(false);
    });

    test('引数が無くても落ちずに出さない', () => {
        expect(shouldOfferCurrentSubmission({})).toBe(false);
    });
});
