/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { LessonHint } from '../../../src/containers/lesson-hint.jsx';
import { findChallenge } from '../../../src/lib/lessons/courses';
import { rubyToBlocksXml } from '../../../src/lib/lessons/hint-blocks';

jest.mock('../../../src/lib/lessons/hint-blocks', () => ({
    rubyToBlocksXml: jest.fn(() => Promise.resolve({ xml: '<xml><block type="x"></block></xml>', errors: [] })),
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
    onHideHint: jest.fn(),
    onInsertCode: jest.fn(),
    onNextHint: jest.fn(),
    onPrevHint: jest.fn(),
    rubyVersion: '2',
    scratchBlocks: null,
    vm: { editingTarget: { id: 'sprite' } },
});

const renderContainer = (props) =>
    render(
        <IntlProvider locale="en">
            <LessonHint {...props} />
        </IntlProvider>,
    );

const flush = () => act(() => Promise.resolve());

describe('LessonHint container', () => {
    beforeEach(() => {
        rubyToBlocksXml.mockClear();
    });

    test('renders nothing while the hint is hidden or outside lesson mode', () => {
        const hidden = renderContainer({ ...baseProps(), hint: hintFor(0, { visible: false }) });
        expect(hidden.queryByTestId('lesson-hint')).not.toBeInTheDocument();
        hidden.unmount();
        const outside = renderContainer({ ...baseProps(), current: null, hint: null });
        expect(outside.queryByTestId('lesson-hint')).not.toBeInTheDocument();
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

    test('the last page inserts the challenge code for the course language', () => {
        const props = { ...baseProps(), hint: hintFor(6) };
        const { getByTestId } = renderContainer(props);
        expect(getByTestId('lesson-hint-debug').querySelectorAll('li')).toHaveLength(2);
        fireEvent.click(getByTestId('lesson-hint-insert-code'));
        expect(props.onInsertCode).toHaveBeenCalledWith(props.current.challenge.code, 'blocks');
        expect(rubyToBlocksXml).not.toHaveBeenCalled();
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
