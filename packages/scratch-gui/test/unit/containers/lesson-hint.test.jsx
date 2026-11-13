/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { LessonHint } from '../../../src/containers/lesson-hint.jsx';
import analytics from '../../../src/lib/analytics';
import { challengeCodeFor, findChallenge, localizeCode } from '../../../src/lib/lessons/courses';
import { rubyToBlocksXml } from '../../../src/lib/lessons/hint-blocks';
import { targetCodeToBlocks } from '../../../src/lib/ruby-to-blocks-converter';

jest.mock('../../../src/lib/analytics', () => ({ event: jest.fn() }));
jest.mock('../../../src/lib/lessons/hint-blocks', () => ({
    rubyToBlocksXml: jest.fn(() => Promise.resolve({ xml: '<xml><block type="x"></block></xml>', errors: [] })),
}));

const applied = [];
jest.mock('../../../src/lib/ruby-to-blocks-converter', () => ({
    targetCodeToBlocks: jest.fn((vm, target) =>
        Promise.resolve({
            result: true,
            errors: [],
            apply: () => {
                applied.push(target.id);
                return Promise.resolve();
            },
        }),
    ),
}));

const CHALLENGE_ID = 'blocks-l1-click-say';

const hintFor = (index, overrides = {}) => {
    const { challenge } = findChallenge(CHALLENGE_ID);
    const step = challenge.steps[index] || null;
    return {
        visible: true,
        index,
        count: challenge.steps.length + 1,
        step,
        spotlight: false,
        lastResort: step === null,
        debug: challenge.debug,
        code: challenge.code,
        ...overrides,
    };
};

const baseProps = () => ({
    colorMode: 'default',
    current: findChallenge(CHALLENGE_ID),
    hint: hintFor(1),
    onFinishHint: jest.fn(),
    onHideHint: jest.fn(),
    onInsertCode: jest.fn(),
    onNextHint: jest.fn(),
    onPrevHint: jest.fn(),
    rubyVersion: '2',
    scratchBlocks: null,
    vm: { editingTarget: { id: 'sprite' } },
});

const renderContainer = (props, locale = 'en') =>
    render(
        <IntlProvider locale={locale}>
            <LessonHint {...props} />
        </IntlProvider>,
    );

const flush = () => act(() => Promise.resolve());

// 「正解のプログラムを確認する」→ 確認の「はい」（いまの「プログラムを入れる」と同じ動き）
const insertWithConfirm = (getByTestId) => {
    fireEvent.click(getByTestId('lesson-hint-insert-code'));
    fireEvent.click(getByTestId('lesson-hint-insert-code-yes'));
};

describe('LessonHint container', () => {
    beforeEach(() => {
        rubyToBlocksXml.mockClear();
        targetCodeToBlocks.mockClear();
        applied.length = 0;
    });

    test('renders nothing while the hint is hidden or outside lesson mode', () => {
        const hidden = renderContainer({ ...baseProps(), hint: hintFor(0, { visible: false }) });
        expect(hidden.queryByTestId('lesson-hint')).not.toBeInTheDocument();
        hidden.unmount();
        const outside = renderContainer({ ...baseProps(), current: null, hint: null });
        expect(outside.queryByTestId('lesson-hint')).not.toBeInTheDocument();
    });

    test('opening the challenge again drops what was going on in the balloon (the confirmation)', async () => {
        const props = baseProps();
        const last = hintFor(6, { session: 1 });
        const { getByTestId, queryByTestId, rerender } = renderContainer({ ...props, hint: last });
        await flush();
        fireEvent.click(getByTestId('lesson-hint-insert-code'));
        expect(getByTestId('lesson-hint-insert-code-confirm')).toBeInTheDocument();
        // 同じページのまま開き直した（吹き出しは開いたまま）: 確認を持ち越さない
        rerender(
            <IntlProvider locale="en">
                <LessonHint {...props} hint={{ ...last, session: 2 }} />
            </IntlProvider>,
        );
        await flush();
        expect(queryByTestId('lesson-hint-insert-code-confirm')).not.toBeInTheDocument();
        expect(getByTestId('lesson-hint-insert-code')).toBeInTheDocument();
    });

    test('converts the Ruby of the step into blocks with the editing target and shows them', async () => {
        const props = baseProps();
        const { getByTestId } = renderContainer(props);
        expect(getByTestId('lesson-hint-position')).toHaveTextContent('Hint 2 of 7');
        await flush();
        expect(rubyToBlocksXml).toHaveBeenCalledTimes(1);
        expect(rubyToBlocksXml.mock.calls[0].slice(0, 3)).toEqual([
            props.vm,
            props.vm.editingTarget,
            'when_clicked do\nend\n',
        ]);
        expect(rubyToBlocksXml.mock.calls[0][4]).toEqual({ version: '2' });
        expect(getByTestId('lesson-hint-blocks')).toBeInTheDocument();
    });

    test('does not convert again for a step already converted', async () => {
        const props = baseProps();
        const { rerender } = renderContainer(props);
        await flush();
        rerender(
            <IntlProvider locale="en">
                <LessonHint {...props} hint={hintFor(0)} />
            </IntlProvider>,
        );
        await flush();
        rerender(
            <IntlProvider locale="en">
                <LessonHint {...props} hint={hintFor(1)} />
            </IntlProvider>,
        );
        await flush();
        expect(rubyToBlocksXml).toHaveBeenCalledTimes(1);
    });

    test('shows a note instead of blocks when the Ruby does not convert', async () => {
        rubyToBlocksXml.mockImplementationOnce(() => Promise.resolve({ xml: null, errors: [{ text: 'x' }] }));
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { getByTestId, queryByTestId } = renderContainer(baseProps());
        await flush();
        expect(getByTestId('lesson-hint-blocks-error')).toBeInTheDocument();
        expect(queryByTestId('lesson-hint-blocks')).not.toBeInTheDocument();
        console.warn.mockRestore();
    });

    test('the last page inserts the challenge code for the course language', async () => {
        const props = { ...baseProps(), hint: hintFor(6) };
        const { getByTestId, queryByTestId } = renderContainer(props);
        expect(getByTestId('lesson-hint-debug').querySelectorAll('li')).toHaveLength(2);
        insertWithConfirm(getByTestId);
        await flush();
        // 入れる前に、音・背景の確かめ込みで同じ変換を試す
        // code は locale ごとに持つので、いまの locale（en）のものを入れる
        const code = localizeCode(props.current.challenge.code, 'en');
        expect(code).toContain('say("Hello!", 2)');
        expect(rubyToBlocksXml).toHaveBeenCalledWith(props.vm, props.vm.editingTarget, code, expect.anything(), {
            version: '2',
            validateAssets: true,
        });
        expect(props.onInsertCode).toHaveBeenCalledWith(code, 'blocks', null, '2');
        expect(queryByTestId('lesson-hint-insert-code-error')).not.toBeInTheDocument();
    });

    test('sends answer_view to GA only when the answer program is inserted', async () => {
        analytics.event.mockClear();
        const props = { ...baseProps(), hint: hintFor(6) };
        const { getByTestId } = renderContainer(props);
        // 「いいえ」では送らない
        fireEvent.click(getByTestId('lesson-hint-insert-code'));
        fireEvent.click(getByTestId('lesson-hint-insert-code-no'));
        await flush();
        expect(analytics.event).not.toHaveBeenCalled();
        insertWithConfirm(getByTestId);
        await flush();
        expect(analytics.event).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'lessons',
                action: 'answer_view',
                label: CHALLENGE_ID,
                challenge_id: CHALLENGE_ID,
                from_assignment: false,
            }),
        );
    });

    test('does not insert and shows why when the program would not convert yet (e.g. Owl not added)', async () => {
        // en の code（"Meow"）も、ほかの locale の code（「ニャー」）も入らない
        const owlMissing = () => Promise.resolve({ xml: null, errors: [{ text: 'sound "Owl" does not exist.' }] });
        rubyToBlocksXml.mockImplementationOnce(owlMissing).mockImplementationOnce(owlMissing);
        const current = findChallenge('blocks-l1-key-sound');
        const { challenge } = current;
        const hint = {
            visible: true,
            index: challenge.steps.length,
            count: challenge.steps.length + 1,
            step: null,
            spotlight: false,
            lastResort: true,
            debug: challenge.debug,
            code: challenge.code,
        };
        analytics.event.mockClear();
        const props = { ...baseProps(), current, hint };
        const { getByTestId } = renderContainer(props);
        insertWithConfirm(getByTestId);
        await flush();
        expect(props.onInsertCode).not.toHaveBeenCalled();
        expect(getByTestId('lesson-hint-insert-code-error')).toHaveTextContent('sound "Owl" does not exist.');
        // 入れられなかったときは「正解のプログラムを確認した」を送らない
        expect(analytics.event).not.toHaveBeenCalled();
    });

    const keySoundLastPage = () => {
        const current = findChallenge('blocks-l1-key-sound');
        const { challenge } = current;
        const hint = {
            visible: true,
            index: challenge.steps.length,
            count: challenge.steps.length + 1,
            step: null,
            spotlight: false,
            lastResort: true,
            debug: challenge.debug,
            code: challenge.code,
        };
        return { ...baseProps(), current, hint };
    };

    test.each([
        ['en', 'play_until_done("Meow")'],
        ['ja', 'play_until_done("ニャー")'],
    ])(
        'inserts the code of the UI locale (%s): the cat sound of the project of that locale',
        async (locale, call) => {
            const props = keySoundLastPage();
            const { getByTestId } = renderContainer(props, locale);
            insertWithConfirm(getByTestId);
            await waitFor(() => expect(props.onInsertCode).toHaveBeenCalled());
            expect(rubyToBlocksXml).toHaveBeenCalledTimes(1);
            expect(props.onInsertCode.mock.calls[0][0]).toContain(call);
        },
    );

    test('falls back to the code of another locale when the project has the names of that locale', async () => {
        // 日本語の作品（ネコの音は「ニャー」）を英語の UI で開いた: en の code は入らないが、ja の code は入る
        rubyToBlocksXml.mockImplementationOnce(() =>
            Promise.resolve({ xml: null, errors: [{ text: 'sound "Meow" does not exist.' }] }),
        );
        const props = keySoundLastPage();
        const { getByTestId, queryByTestId } = renderContainer(props, 'en');
        insertWithConfirm(getByTestId);
        await waitFor(() => expect(props.onInsertCode).toHaveBeenCalled());
        expect(rubyToBlocksXml.mock.calls.map((c) => c[2])).toEqual([
            localizeCode(props.current.challenge.code, 'en'),
            localizeCode(props.current.challenge.code, 'ja'),
        ]);
        expect(props.onInsertCode.mock.calls[0][0]).toContain('play_until_done("ニャー")');
        expect(queryByTestId('lesson-hint-insert-code-error')).not.toBeInTheDocument();
    });

    test('shows the reasons of the locale whose program is closest to the project when none fits', async () => {
        // 日本語の作品を英語の UI で開き、Owl をまだ足していない: en の code は "Meow" と Owl の 2 つ、
        // ja の code は Owl の 1 つが合わない。作品にある「ニャー」を探させないよう、Owl だけを出す
        rubyToBlocksXml
            .mockImplementationOnce(() =>
                Promise.resolve({
                    xml: null,
                    errors: [{ text: 'sound "Meow" does not exist.' }, { text: 'sound "Owl" does not exist.' }],
                }),
            )
            .mockImplementationOnce(() =>
                Promise.resolve({ xml: null, errors: [{ text: 'sound "Owl" does not exist.' }] }),
            );
        const props = keySoundLastPage();
        const { getByTestId } = renderContainer(props, 'en');
        insertWithConfirm(getByTestId);
        await flush();
        expect(props.onInsertCode).not.toHaveBeenCalled();
        const error = getByTestId('lesson-hint-insert-code-error');
        expect(error).toHaveTextContent('sound "Owl" does not exist.');
        expect(error).not.toHaveTextContent('Meow');
    });

    test('draws the hint blocks of the UI locale', async () => {
        const current = findChallenge('blocks-l1-key-sound');
        const step = current.challenge.steps[2];
        const hint = { ...keySoundLastPage().hint, index: 2, step, lastResort: false };
        renderContainer({ ...baseProps(), current, hint }, 'en');
        await flush();
        expect(rubyToBlocksXml.mock.calls[0][2]).toBe(
            'when_key_pressed("space") do\n  play_until_done("Meow")\nend\n',
        );
        rubyToBlocksXml.mockClear();
        renderContainer({ ...baseProps(), current, hint }, 'ja');
        await flush();
        expect(rubyToBlocksXml.mock.calls[0][2]).toBe(
            'when_key_pressed("space") do\n  play_until_done("ニャー")\nend\n',
        );
    });

    test('a challenge with codeTarget "stage" selects the stage and inserts the code there', async () => {
        const stage = { id: 'stage-id', isStage: true };
        const vm = {
            editingTarget: { id: 'sprite' },
            runtime: { getTargetForStage: () => stage },
            setEditingTarget: jest.fn(),
        };
        const current = findChallenge('blocks-l1-repeat');
        expect(current.challenge.codeTarget).toBe('stage');
        const { challenge } = current;
        const hint = {
            visible: true,
            index: challenge.steps.length,
            count: challenge.steps.length + 1,
            step: null,
            spotlight: false,
            lastResort: true,
            debug: challenge.debug,
            code: challenge.code,
        };
        const props = { ...baseProps(), current, hint, vm };
        const { getByTestId } = renderContainer(props);
        insertWithConfirm(getByTestId);
        await flush();
        // 試しの変換もステージを相手にする（背景はステージのもの）
        expect(rubyToBlocksXml.mock.calls[0][1]).toBe(stage);
        expect(vm.setEditingTarget).toHaveBeenCalledWith('stage-id');
        expect(props.onInsertCode).toHaveBeenCalledWith(challenge.code, 'blocks', stage, '2');
    });

    test('a challenge with spriteCodes puts them in first and inserts the code into the remaining sprite', async () => {
        const cat = { id: 'cat', isOriginal: true, isStage: false, getName: () => 'Sprite1' };
        const penguin = { id: 'penguin', isOriginal: true, isStage: false, getName: () => 'Penguin' };
        const stage = { id: 'stage', isOriginal: true, isStage: true, getName: () => 'Stage' };
        const vm = {
            editingTarget: penguin,
            runtime: { targets: [stage, cat, penguin] },
            setEditingTarget: jest.fn(),
            addSprite: jest.fn(),
        };
        const current = findChallenge('blocks-l1-broadcast');
        const { challenge } = current;
        const hint = {
            visible: true,
            index: challenge.steps.length,
            count: challenge.steps.length + 1,
            step: null,
            spotlight: false,
            lastResort: true,
            debug: challenge.debug,
            code: challenge.code,
        };
        const props = { ...baseProps(), current, hint, vm };
        const { getByTestId } = renderContainer(props);
        insertWithConfirm(getByTestId);
        await waitFor(() => expect(props.onInsertCode).toHaveBeenCalled());
        expect(targetCodeToBlocks).toHaveBeenCalledTimes(1);
        // 9 のメッセージ・セリフは locale ごと。UI は en なので en の組（"hello" / "Hi!"）を入れる
        const en = challengeCodeFor(challenge, 'en');
        expect(targetCodeToBlocks.mock.calls[0].slice(1, 3)).toEqual([penguin, en.spriteCodes[0].code]);
        expect(applied).toEqual(['penguin']);
        expect(vm.addSprite).not.toHaveBeenCalled();
        expect(vm.setEditingTarget).toHaveBeenCalledWith('cat');
        expect(props.onInsertCode).toHaveBeenCalledWith(en.code, 'blocks', cat, '2');
    });

    const spriteCodesSetup = (targets) => {
        const vm = {
            editingTarget: targets[1],
            runtime: { targets },
            setEditingTarget: jest.fn(),
            addSprite: jest.fn(),
        };
        const current = findChallenge('blocks-l1-broadcast');
        const { challenge } = current;
        const hint = {
            visible: true,
            index: challenge.steps.length,
            count: challenge.steps.length + 1,
            step: null,
            spotlight: false,
            lastResort: true,
            debug: challenge.debug,
            code: challenge.code,
        };
        return { ...baseProps(), current, hint, vm };
    };

    test('a challenge with spriteCodes checks every program (penguin and cat) before inserting', async () => {
        const cat = { id: 'cat', isOriginal: true, isStage: false, getName: () => 'Sprite1' };
        const penguin = { id: 'penguin', isOriginal: true, isStage: false, getName: () => 'Penguin' };
        const stage = { id: 'stage', isOriginal: true, isStage: true, getName: () => 'Stage' };
        const props = spriteCodesSetup([stage, penguin, cat]);
        const { challenge } = props.current;
        const { getByTestId } = renderContainer(props);
        insertWithConfirm(getByTestId);
        await waitFor(() => expect(props.onInsertCode).toHaveBeenCalled());
        const checked = rubyToBlocksXml.mock.calls.map((c) => [c[1], c[2], c[4].validateAssets]);
        const en = challengeCodeFor(challenge, 'en');
        expect(checked).toEqual([
            [penguin, en.spriteCodes[0].code, true],
            [cat, en.code, true],
        ]);
    });

    test('pressing "insert the program" twice while it is working inserts (and adds the penguin) once', async () => {
        const cat = { id: 'cat', isOriginal: true, isStage: false, getName: () => 'Sprite1' };
        const stage = { id: 'stage', isOriginal: true, isStage: true, getName: () => 'Stage' };
        const props = spriteCodesSetup([stage, cat]);
        const penguin = { id: 'penguin', isOriginal: true, isStage: false, getName: () => 'Penguin' };
        props.vm.addSprite = jest.fn(() => {
            props.vm.runtime.targets.push(penguin);
            return Promise.resolve();
        });
        const { getByTestId } = renderContainer(props);
        insertWithConfirm(getByTestId);
        insertWithConfirm(getByTestId);
        await waitFor(() => expect(props.onInsertCode).toHaveBeenCalled());
        await flush();
        expect(props.vm.addSprite).toHaveBeenCalledTimes(1);
        expect(props.onInsertCode).toHaveBeenCalledTimes(1);
    });

    test('a challenge with spriteCodes inserts nothing when one of the programs would not convert', async () => {
        // en の組も ja の組（ほかの locale へのフォールバック）も、ネコのプログラムが変換できない
        const ok = () => Promise.resolve({ xml: '<xml></xml>', errors: [] });
        const ng = () => Promise.resolve({ xml: null, errors: [{ text: 'cannot convert' }] });
        rubyToBlocksXml
            .mockImplementationOnce(ok)
            .mockImplementationOnce(ng)
            .mockImplementationOnce(ok)
            .mockImplementationOnce(ng);
        const cat = { id: 'cat', isOriginal: true, isStage: false, getName: () => 'Sprite1' };
        const stage = { id: 'stage', isOriginal: true, isStage: true, getName: () => 'Stage' };
        // ペンギンはまだいない: target なしで確かめ、足さない
        const props = spriteCodesSetup([stage, cat]);
        const { getByTestId } = renderContainer(props);
        insertWithConfirm(getByTestId);
        await waitFor(() => expect(getByTestId('lesson-hint-insert-code-error')).toHaveTextContent('cannot convert'));
        expect(rubyToBlocksXml.mock.calls[0][1]).toBeNull();
        expect(props.vm.addSprite).not.toHaveBeenCalled();
        expect(targetCodeToBlocks).not.toHaveBeenCalled();
        expect(props.onInsertCode).not.toHaveBeenCalled();
    });

    test('next / back / close dispatch', () => {
        const props = baseProps();
        const { getByTestId } = renderContainer(props);
        fireEvent.click(getByTestId('lesson-hint-next'));
        fireEvent.click(getByTestId('lesson-hint-prev'));
        fireEvent.click(getByTestId('lesson-hint-close'));
        expect(props.onNextHint).toHaveBeenCalledTimes(1);
        expect(props.onPrevHint).toHaveBeenCalledTimes(1);
        expect(props.onHideHint).toHaveBeenCalledTimes(1);
    });
});
