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

describe('decideJoinStart (#1202 前回の提出物から始めさせる)', () => {
    const previousOnly = { current: null, previous: item() };
    const withCurrent = { current: item(), previous: item() };

    // 参加しただけでは何も読み込まない。生徒がボタンを押したときだけ読み込む
    // （自動で読み込むと、同じものを押したときに上書き確認が出て 2 重に読み込む）。
    test('設定 OFF: スターターがあれば選択肢に出す。おすすめ・案内は無い', () => {
        expect(decideJoinStart(previousOnly, false, true)).toEqual({
            showStarter: true,
            recommend: null,
            notice: null,
        });
        expect(decideJoinStart(null, false, false)).toEqual({ showStarter: false, recommend: null, notice: null });
    });

    test('設定 ON で前回の提出物があれば、それをおすすめにしてスターターは出さない（選び間違えない）', () => {
        expect(decideJoinStart(previousOnly, true, true)).toEqual({
            showStarter: false,
            recommend: 'previous',
            notice: 'recommendPrevious',
        });
    });

    test('設定 ON で前回の提出物が無ければ、スターターをおすすめにしてそのことを知らせる', () => {
        expect(decideJoinStart(null, true, true)).toEqual({
            showStarter: true,
            recommend: 'starter',
            notice: 'noPrevious',
        });
        expect(decideJoinStart({ current: null, previous: null }, true, false)).toEqual({
            showStarter: false,
            recommend: null,
            notice: 'noPrevious',
        });
    });

    test('設定 ON でもこの課題で提出済みなら、おすすめせず選ばせる (今回の作業を前回で上書きしない)', () => {
        expect(decideJoinStart(withCurrent, true, true)).toEqual({
            showStarter: true,
            recommend: null,
            notice: null,
        });
    });
});
