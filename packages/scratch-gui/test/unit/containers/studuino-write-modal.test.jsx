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

const compile = require('../../../src/lib/studuino-compile').compileStuduinoIr;

const flag = { id: 'f', opcode: 'event_whenflagclicked', topLevel: true, next: null, inputs: {}, fields: {} };
const say = { id: 's', opcode: 'looks_nextcostume', topLevel: true, next: null, inputs: {}, fields: {} };

const makeVm = (blocks) => {
    const runtime = new EventEmitter();
    runtime.extensionStorage = {};
    runtime.targets = [
        { id: 'stage', isStage: true, isOriginal: true, blocks: { _blocks: {} }, variables: {} },
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
});
