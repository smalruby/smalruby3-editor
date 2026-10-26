/* eslint-env jest */
/**
 * 「続きに使える提出物」(#1201) の正規化。
 */
import {
    CONTINUE_KINDS,
    decideJoinStart,
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
    test('どちらも無ければ null (= 選択肢を出さず従来どおりスターターを自動で開く)', () => {
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

describe('decideJoinStart (#1202 前回の提出物から始めさせる)', () => {
    const previousOnly = { current: null, previous: item() };
    const withCurrent = { current: item(), previous: item() };

    test('設定 OFF: 提出物があれば選ばせ、無ければスターター', () => {
        expect(decideJoinStart(previousOnly, false)).toEqual({ action: 'choose', notice: null });
        expect(decideJoinStart(null, false)).toEqual({ action: 'starter', notice: null });
    });

    test('設定 ON: 前回の提出物を開く', () => {
        expect(decideJoinStart(previousOnly, true)).toEqual({ action: 'previous', notice: 'openedPrevious' });
    });

    test('設定 ON で前回の提出物が無ければスターターにフォールバックし、そのことを知らせる', () => {
        expect(decideJoinStart(null, true)).toEqual({ action: 'starter', notice: 'noPrevious' });
        expect(decideJoinStart({ current: null, previous: null }, true)).toEqual({
            action: 'starter',
            notice: 'noPrevious',
        });
    });

    test('設定 ON でもこの課題で提出済みなら勝手に開かず選ばせる (今回の作業を前回で上書きしない)', () => {
        expect(decideJoinStart(withCurrent, true)).toEqual({ action: 'choose', notice: null });
    });
});
