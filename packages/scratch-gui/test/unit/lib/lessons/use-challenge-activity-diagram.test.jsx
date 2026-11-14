/* eslint-env jest */
/**
 * いまのチャレンジのアクティビティ図を返す hook を守る: 変換の結果をチャレンジ・locale・Ruby のバージョンごとに
 * 覚えること、失敗は null で、それも覚えること、キーが変わったあとに前の図を出さないこと。
 * 変換（RubyToBlocksConverter）は差し替えて、呼ばれた回数と答えを決める。
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { ja as jaDiagram } from '../../../../src/lib/lessons/activity-diagram/activity-diagram.locale';
import {
    clearActivityDiagramCache,
    useChallengeActivityDiagram,
} from '../../../../src/lib/lessons/activity-diagram/use-challenge-activity-diagram';
import { defineChallenge } from '../../../../src/lib/lessons/courses';

// 変換の呼ばれ方を記録し、答えをテストから決める（resolve を呼ぶまで終わらない）
const calls = [];
jest.mock('../../../../src/lib/ruby-to-blocks-converter', () => {
    class FakeConverter {
        constructor(vm, options) {
            this.options = options;
            this.blocks = {};
            this.errors = [];
        }

        targetCodeToBlocks(target, code) {
            return new Promise((resolve) => {
                calls.push({ code, version: this.options.version, converter: this, resolve });
            });
        }
    }
    return { __esModule: true, default: FakeConverter };
});

// 変換の結果に入れるブロック: 旗が押されたとき → 「<text>」と言う
const sayBlocks = (text) => ({
    hat: { id: 'hat', opcode: 'event_whenflagclicked', topLevel: true, shadow: false, next: 'say', inputs: {} },
    say: {
        id: 'say',
        opcode: 'looks_say',
        topLevel: false,
        shadow: false,
        next: null,
        inputs: { MESSAGE: { name: 'MESSAGE', block: 'msg', shadow: 'msg' } },
    },
    msg: { id: 'msg', opcode: 'text', shadow: true, fields: { TEXT: { name: 'TEXT', value: text } } },
});

const finish = async (call, blocks) => {
    await act(async () => {
        if (blocks) call.converter.blocks = blocks;
        call.resolve(Boolean(blocks));
    });
};

const challengeOf = (id, code, activityDiagram = true) => defineChallenge({ id, activityDiagram, code });

const renderDiagramHook = (initial) =>
    renderHook(({ challenge, locale, rubyVersion }) => useChallengeActivityDiagram(challenge, { rubyVersion }), {
        initialProps: initial,
        wrapper: ({ children, locale = initial.locale }) => (
            <IntlProvider locale={locale} messages={jaDiagram}>
                {children}
            </IntlProvider>
        ),
    });

const labelsOf = (layout) => layout.shapes.map((s) => s.label).filter(Boolean);

describe('useChallengeActivityDiagram', () => {
    beforeEach(() => {
        calls.length = 0;
        clearActivityDiagramCache();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('returns null for a challenge that does not show the diagram, without converting', () => {
        const { result } = renderDiagramHook({ challenge: challengeOf('a', 'say("a")\n', false), locale: 'ja' });
        expect(result.current).toBeNull();
        expect(calls).toHaveLength(0);
    });

    test('converts the answer once per challenge, locale and Ruby version', async () => {
        const a = challengeOf('a', 'say("a")\n');
        const first = renderDiagramHook({ challenge: a, locale: 'ja', rubyVersion: '2' });
        expect(first.result.current).toBeNull();
        expect(calls).toHaveLength(1);
        await finish(calls[0], sayBlocks('a'));
        await waitFor(() => expect(first.result.current).not.toBeNull());
        expect(labelsOf(first.result.current)).toContain('「a」と言う');
        expect(first.result.current.description).toBe('旗が押されたとき → 「a」と言う');

        // 同じキー（課題の全文とヒントの両方で使う）は変換し直さない
        const second = renderDiagramHook({ challenge: a, locale: 'ja', rubyVersion: '2' });
        await waitFor(() => expect(second.result.current).not.toBeNull());
        expect(calls).toHaveLength(1);

        // Ruby のバージョンが変わると変換し直す
        second.rerender({ challenge: a, locale: 'ja', rubyVersion: '1' });
        expect(calls).toHaveLength(2);
        expect(calls[1].version).toBe('1');
    });

    test('converts again when the locale changes', async () => {
        const a = challengeOf('a', 'say("a")\n');
        renderDiagramHook({ challenge: a, locale: 'ja', rubyVersion: '2' });
        renderDiagramHook({ challenge: a, locale: 'en', rubyVersion: '2' });
        expect(calls).toHaveLength(2);
    });

    test('a failed conversion gives null and is remembered (not converted again)', async () => {
        const a = challengeOf('a', 'say("a")\n');
        const first = renderDiagramHook({ challenge: a, locale: 'ja', rubyVersion: '2' });
        await finish(calls[0], null);
        expect(first.result.current).toBeNull();
        const second = renderDiagramHook({ challenge: a, locale: 'ja', rubyVersion: '2' });
        await act(async () => {});
        expect(second.result.current).toBeNull();
        expect(calls).toHaveLength(1);
    });

    test('does not show the diagram of the previous challenge while the next one converts', async () => {
        const a = challengeOf('a', 'say("a")\n');
        const b = challengeOf('b', 'say("b")\n');
        const { result, rerender } = renderDiagramHook({ challenge: a, locale: 'ja', rubyVersion: '2' });
        await finish(calls[0], sayBlocks('a'));
        await waitFor(() => expect(result.current).not.toBeNull());

        rerender({ challenge: b, locale: 'ja', rubyVersion: '2' });
        // b の変換が終わるまでは、a の図を出さない
        expect(result.current).toBeNull();
        await finish(calls[1], sayBlocks('b'));
        await waitFor(() => expect(result.current).not.toBeNull());
        expect(labelsOf(result.current)).toContain('「b」と言う');
    });

    test('a late result of the previous challenge does not replace the current one', async () => {
        const a = challengeOf('a', 'say("a")\n');
        const b = challengeOf('b', 'say("b")\n');
        const { result, rerender } = renderDiagramHook({ challenge: a, locale: 'ja', rubyVersion: '2' });
        rerender({ challenge: b, locale: 'ja', rubyVersion: '2' });
        await finish(calls[1], sayBlocks('b'));
        await waitFor(() => expect(result.current).not.toBeNull());
        // a の変換があとから終わっても、b の図のまま
        await finish(calls[0], sayBlocks('a'));
        expect(labelsOf(result.current)).toContain('「b」と言う');
        expect(labelsOf(result.current)).not.toContain('「a」と言う');
    });
});
