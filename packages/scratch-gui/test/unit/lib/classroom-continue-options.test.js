/* eslint-env jest */
/**
 * 「続きに使える提出物」(#1201) の正規化。
 */
import {
    CONTINUE_KINDS,
    decideStartMethod,
    normalizeContinueOptions,
} from '../../../src/lib/classroom-continue-options.js';

const item = (over = {}) => ({
    classroomId: 'c1',
    assignmentName: '第1回',
    projectName: '作品',
    submittedAt: '2026-10-01T10:00:00.000Z',
    projectUrl: 'https://signed.example/p.sb3',
    ...over,
});

describe('normalizeContinueOptions', () => {
    test('どちらも無ければ null (= 提出物の選択肢は出さない)', () => {
        expect(normalizeContinueOptions(null)).toBeNull();
        expect(normalizeContinueOptions({})).toBeNull();
        expect(normalizeContinueOptions({ current: null, previous: null })).toBeNull();
    });

    test('projectUrl の無いものは捨てる', () => {
        expect(normalizeContinueOptions({ current: item({ projectUrl: null }), previous: null })).toBeNull();
    });

    test('片方だけでも選択肢にする', () => {
        expect(normalizeContinueOptions({ previous: item() })).toEqual({ current: null, previous: item() });
        expect(normalizeContinueOptions({ current: item() })).toEqual({ current: item(), previous: null });
    });

    test('種類は previous / current の 2 つ', () => {
        expect(CONTINUE_KINDS).toEqual(['previous', 'current']);
    });
});

describe('decideStartMethod (#1793 始め方を 1 つに決める)', () => {
    const none = null;
    const previousOnly = { current: null, previous: item() };
    const currentOnly = { current: item(), previous: null };
    const both = { current: item(), previous: item() };
    const decide = (options, { hasStarter = false, lesson = false } = {}) =>
        decideStartMethod({ options, hasStarter, lesson });

    // 順番: この課題で提出済み → 前回の提出物 → スターター → いまの作品（ui-ux.md「始め方を決める順番」）
    test('この課題で提出済みなら、それを主ボタンにする（前回・スターターより先）', () => {
        expect(decide(both, { hasStarter: true })).toEqual({
            main: 'current',
            others: ['previous', 'starter', 'keep'],
        });
    });

    test('この課題の提出が無く前回の提出物があれば、前回を主ボタンにする（スターターより先）', () => {
        expect(decide(previousOnly, { hasStarter: true })).toEqual({
            main: 'previous',
            others: ['starter', 'keep'],
        });
    });

    test('提出物が無くスターターがあれば、スターターを主ボタンにする', () => {
        expect(decide(none, { hasStarter: true })).toEqual({ main: 'starter', others: ['keep'] });
    });

    test('どれも無ければ「はじめる」（いまの作品のまま）。ほかの始め方は出さない', () => {
        expect(decide(none)).toEqual({ main: 'keep', others: [] });
        expect(decide({ current: null, previous: null })).toEqual({ main: 'keep', others: [] });
    });

    test('ほかの始め方は、主ボタンにしなかった使えるものを順番どおりに並べ、最後に「いまの作品のまま」', () => {
        expect(decide(currentOnly)).toEqual({ main: 'current', others: ['keep'] });
        expect(decide(currentOnly, { hasStarter: true }).others).toEqual(['starter', 'keep']);
    });

    test('前回の提出物は「ほかの始め方」に残る', () => {
        expect(decide(both).others).toContain('previous');
    });

    test('保存済みの「前回の提出物から始めさせる」(#1825 で廃止) が渡されても読まない', () => {
        expect(decideStartMethod({ options: none, hasStarter: true, startFromPrevious: true })).toEqual({
            main: 'starter',
            others: ['keep'],
        });
    });

    describe('レッスンの課題', () => {
        test('主ボタンは「はじめる」（レッスン表）。スターターが無ければほかの始め方は出さない', () => {
            expect(decide(both, { lesson: true })).toEqual({ main: 'lesson', others: [] });
        });

        test('スターターがあれば、ほかの始め方に使えるもの（この課題・前回・スターター）を入れる', () => {
            expect(decide(both, { lesson: true, hasStarter: true })).toEqual({
                main: 'lesson',
                others: ['current', 'previous', 'starter'],
            });
            expect(decide(none, { lesson: true, hasStarter: true }).others).toEqual(['starter']);
        });
    });
});
