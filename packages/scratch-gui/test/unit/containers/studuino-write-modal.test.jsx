/* eslint-env jest */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { WriteModal } from '../../../src/containers/studuino-write-modal.jsx';
import en from '../../../src/locales/en';

jest.mock('../../../src/containers/modal.jsx', () => {
    const FakeModal = ({ children }) => <div data-testid="fake-modal">{children}</div>;
    return FakeModal;
});

jest.mock('../../../src/lib/studuino-compile', () => ({
    compileStuduinoIr: jest.fn(),
    studuinoCompileErrorMessageId: () => 'gui.studuinoWrite.error.notConfigured',
}));

jest.mock('../../../src/lib/studuino-block-marks', () => ({ jumpToBlock: jest.fn() }));

const compile = require('../../../src/lib/studuino-compile').compileStuduinoIr;
const { jumpToBlock } = require('../../../src/lib/studuino-block-marks');

const flag = { id: 'f', opcode: 'event_whenflagclicked', topLevel: true, next: null, inputs: {}, fields: {} };
const say = { id: 's', opcode: 'looks_nextcostume', topLevel: true, next: null, inputs: {}, fields: {} };

const makeVm = (blocks, { stageBlocks = {}, stageVariables = {} } = {}) => {
    const runtime = new EventEmitter();
    runtime.extensionStorage = {};
    runtime.targets = [
        { id: 'stage', isStage: true, isOriginal: true, blocks: { _blocks: stageBlocks }, variables: stageVariables },
        { id: 'sprite', isStage: false, isOriginal: true, blocks: { _blocks: blocks }, variables: {} },
    ];
    return { runtime, editingTarget: runtime.targets[1] };
};

const renderModal = (vm, props = {}) =>
    render(
        <IntlProvider locale="en" messages={en}>
            <WriteModal visible abortCount={0} vm={vm} onClose={jest.fn()} {...props} />
        </IntlProvider>,
    );

const status = (name) => screen.getByTestId(`studuino-write-step-${name}`).dataset.status;

afterEach(() => {
    cleanup();
    compile.mockReset();
    jumpToBlock.mockReset();
});

describe('StuduinoWriteModal', () => {
    test('checks the program and shows the compile error', async () => {
        compile.mockResolvedValue({ ok: false, error: 'not_configured' });
        renderModal(makeVm({ f: flag }));
        await waitFor(() => expect(status('compile')).toBe('failed'));
        expect(status('check')).toBe('done');
        expect(screen.getByTestId('studuino-write-message')).toHaveTextContent('not available here');
        expect(screen.getByTestId('studuino-write-license')).toBeInTheDocument();
    });

    test('shows the blocks that can not be used and does not compile', () => {
        renderModal(makeVm({ f: flag, s: say }));
        expect(status('check')).toBe('failed');
        expect(compile).not.toHaveBeenCalled();
        expect(screen.getByTestId('studuino-write-show-blocks')).toBeInTheDocument();
    });

    test('is ready to write when the hex is made, and can save the C++', async () => {
        compile.mockResolvedValue({ ok: true, hex: ':00000001FF\n', source: 'void setup(){}' });
        renderModal(makeVm({ f: flag }));
        await waitFor(() => expect(status('compile')).toBe('done'));
        expect(screen.getByTestId('studuino-write-save-source')).toBeInTheDocument();
        // jsdom has no Web Serial: the write button is not shown and the message says so
        expect(screen.queryByTestId('studuino-write-write')).toBeNull();
        expect(screen.getByTestId('studuino-write-message')).toHaveTextContent('Chrome or Edge');
    });

    test('the stop button (abortCount) stops it', async () => {
        compile.mockReturnValue(new Promise(() => {}));
        const vm = makeVm({ f: flag });
        const { rerender } = renderModal(vm);
        rerender(
            <IntlProvider locale="en" messages={en}>
                <WriteModal visible abortCount={1} vm={vm} onClose={jest.fn()} />
            </IntlProvider>,
        );
        await waitFor(() => expect(screen.getByTestId('studuino-write-retry')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('studuino-write-close'));
    });

    test('two green flags: lists the used and the unused script, and a click jumps to the block (#2353)', () => {
        const onClose = jest.fn();
        const stageFlag = { ...flag, id: 'f0' };
        renderModal(makeVm({ f: flag }, { stageBlocks: { f0: stageFlag } }), { onClose });
        expect(status('check')).toBe('failed');
        expect(screen.getByTestId('studuino-write-notice-0').dataset.reason).toBe('used_flag');
        const unused = screen.getByTestId('studuino-write-notice-1');
        expect(unused.dataset.reason).toBe('unused_flag');
        expect(unused).toHaveTextContent('is not used');
        fireEvent.click(unused);
        expect(onClose).toHaveBeenCalled();
        expect(jumpToBlock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ blockId: 'f', targetId: 'sprite' }),
            { highlight: true },
        );
    });

    test('a variable whose value is not a number is a warning and the write goes on (#2353)', async () => {
        compile.mockResolvedValue({ ok: true, hex: ':00000001FF\n', source: 'void setup(){}' });
        const change = {
            id: 'c',
            opcode: 'data_changevariableby',
            topLevel: false,
            parent: 'f',
            next: null,
            inputs: { VALUE: { name: 'VALUE', block: 'n', shadow: 'n' } },
            fields: { VARIABLE: { name: 'VARIABLE', id: 'v', value: 'score' } },
        };
        const num = { id: 'n', opcode: 'math_number', shadow: true, parent: 'c', inputs: {}, fields: { NUM: { value: '1' } } };
        renderModal(
            makeVm(
                { f: { ...flag, next: 'c' }, c: change, n: num },
                { stageVariables: { v: { id: 'v', name: 'score', type: '', value: 'abc' } } },
            ),
        );
        await waitFor(() => expect(status('compile')).toBe('done'));
        const warning = screen.getByTestId('studuino-write-notice-0');
        expect(warning.dataset.kind).toBe('warning');
        expect(warning).toHaveTextContent('"score"');
    });
});
