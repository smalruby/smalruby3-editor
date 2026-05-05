import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import RubyDownloader from '../../../src/containers/ruby-downloader';
import _RubyGenerator from '../../../src/lib/ruby-generator';
import { targetCodeToBlocks as _targetCodeToBlocks } from '../../../src/lib/ruby-to-blocks-converter';

jest.mock('../../../src/lib/ruby-generator', () => ({
    targetsToCode: jest.fn(() => 'mocked ruby code'),
}));

jest.mock('../../../src/lib/ruby-to-blocks-converter', () => ({
    targetCodeToBlocks: jest.fn(),
    NullRubyToBlocksConverter: { result: true, errors: [], apply: () => Promise.resolve() },
}));

const mockTargetCodeToBlocks = _targetCodeToBlocks;

describe('RubyDownloader Container', () => {
    const mockStore = configureStore();
    let store;
    let vm;
    let mockWritable;

    const createStore = (overrides = {}) =>
        mockStore({
            scratchGui: {
                koshienFile: {
                    fileHandle: null,
                },
                projectTitle: 'project',
                targets: {
                    sprites: {},
                    stage: { id: 'stage', blocks: {} },
                },
                vm: vm,
                rubyCode: {
                    modified: false,
                    code: '',
                    target: { id: 'target', blocks: {} },
                    ...overrides.rubyCode,
                },
                settings: {
                    rubyVersion: '1',
                    ...overrides.settings,
                },
            },
        });

    beforeEach(() => {
        vm = {
            runtime: {
                targets: [{ id: 'stage', blocks: {}, isStage: true }],
            },
        };
        store = createStore();

        mockWritable = {
            write: jest.fn(() => Promise.resolve()),
            close: jest.fn(() => Promise.resolve()),
        };
        window.showSaveFilePicker = jest.fn(() =>
            Promise.resolve({
                createWritable: jest.fn(() => Promise.resolve(mockWritable)),
            }),
        );

        mockTargetCodeToBlocks.mockReset();
    });

    test('calls onSaveError when showSaveFilePicker rejects', async () => {
        const error = new Error('Abort');
        error.name = 'AbortError';
        window.showSaveFilePicker.mockImplementation(() => Promise.reject(error));

        const onSaveError = jest.fn();

        const { getByText } = render(
            <Provider store={store}>
                <RubyDownloader onSaveError={onSaveError}>
                    {(className, downloadProject) => <button onClick={downloadProject}>Download</button>}
                </RubyDownloader>
            </Provider>,
        );

        fireEvent.click(getByText('Download'));

        await waitFor(() => {
            expect(onSaveError).toHaveBeenCalledWith(error);
        });
    });

    describe('block conversion validation before save', () => {
        test('skips conversion when rubyCode is not modified', async () => {
            store = createStore({ rubyCode: { modified: false, code: '', target: { id: 'target' } } });
            const onSaveFinished = jest.fn();

            const { getByText } = render(
                <Provider store={store}>
                    <RubyDownloader onSaveFinished={onSaveFinished}>
                        {(className, downloadProject) => <button onClick={downloadProject}>Download</button>}
                    </RubyDownloader>
                </Provider>,
            );

            fireEvent.click(getByText('Download'));

            await waitFor(() => {
                expect(onSaveFinished).toHaveBeenCalled();
            });
            expect(mockTargetCodeToBlocks).not.toHaveBeenCalled();
        });

        test('calls targetCodeToBlocks and apply when rubyCode is modified', async () => {
            const mockApply = jest.fn(() => Promise.resolve());
            mockTargetCodeToBlocks.mockResolvedValue({
                result: true,
                errors: [],
                apply: mockApply,
            });

            store = createStore({
                rubyCode: {
                    modified: true,
                    code: 'puts "hello"',
                    target: { id: 'target', blocks: {} },
                },
            });
            const onSaveFinished = jest.fn();

            const { getByText } = render(
                <Provider store={store}>
                    <RubyDownloader onSaveFinished={onSaveFinished}>
                        {(className, downloadProject) => <button onClick={downloadProject}>Download</button>}
                    </RubyDownloader>
                </Provider>,
            );

            fireEvent.click(getByText('Download'));

            await waitFor(() => {
                expect(mockTargetCodeToBlocks).toHaveBeenCalledWith(
                    vm,
                    { id: 'target', blocks: {} },
                    'puts "hello"',
                    undefined,
                    { version: '1' },
                );
            });
            expect(mockApply).toHaveBeenCalled();
            await waitFor(() => {
                expect(onSaveFinished).toHaveBeenCalled();
            });
        });

        test('aborts save and calls onConversionError when conversion fails', async () => {
            const errors = [{ row: 1, column: 0, message: 'syntax error' }];
            mockTargetCodeToBlocks.mockResolvedValue({
                result: false,
                errors: errors,
            });

            store = createStore({
                rubyCode: {
                    modified: true,
                    code: 'invalid code',
                    target: { id: 'target', blocks: {} },
                },
            });
            const onSaveFinished = jest.fn();
            const onSaveError = jest.fn();
            const onConversionError = jest.fn();

            const { getByText } = render(
                <Provider store={store}>
                    <RubyDownloader
                        onConversionError={onConversionError}
                        onSaveError={onSaveError}
                        onSaveFinished={onSaveFinished}
                    >
                        {(className, downloadProject) => <button onClick={downloadProject}>Download</button>}
                    </RubyDownloader>
                </Provider>,
            );

            fireEvent.click(getByText('Download'));

            await waitFor(() => {
                expect(onConversionError).toHaveBeenCalledWith(errors);
            });
            expect(onSaveError).toHaveBeenCalled();
            expect(onSaveFinished).not.toHaveBeenCalled();
        });

        test('does not write file when conversion fails', async () => {
            mockTargetCodeToBlocks.mockResolvedValue({
                result: false,
                errors: [{ row: 1, column: 0, message: 'error' }],
            });

            store = createStore({
                rubyCode: {
                    modified: true,
                    code: 'bad code',
                    target: { id: 'target', blocks: {} },
                },
            });

            const { getByText } = render(
                <Provider store={store}>
                    <RubyDownloader onConversionError={jest.fn()} onSaveError={jest.fn()}>
                        {(className, downloadProject) => <button onClick={downloadProject}>Download</button>}
                    </RubyDownloader>
                </Provider>,
            );

            fireEvent.click(getByText('Download'));

            await waitFor(() => {
                expect(mockTargetCodeToBlocks).toHaveBeenCalled();
            });

            // File System API should not be called
            expect(mockWritable.write).not.toHaveBeenCalled();
        });

        test('writes file after successful conversion round-trip', async () => {
            const mockApply = jest.fn(() => Promise.resolve());
            mockTargetCodeToBlocks.mockResolvedValue({
                result: true,
                errors: [],
                apply: mockApply,
            });

            store = createStore({
                rubyCode: {
                    modified: true,
                    code: 'puts "hello"',
                    target: { id: 'target', blocks: {} },
                },
            });
            const onSaveFinished = jest.fn();

            const { getByText } = render(
                <Provider store={store}>
                    <RubyDownloader onSaveFinished={onSaveFinished}>
                        {(className, downloadProject) => <button onClick={downloadProject}>Download</button>}
                    </RubyDownloader>
                </Provider>,
            );

            fireEvent.click(getByText('Download'));

            await waitFor(() => {
                expect(onSaveFinished).toHaveBeenCalled();
            });

            // Conversion was applied
            expect(mockApply).toHaveBeenCalled();
            // File was written via File System API
            expect(mockWritable.write).toHaveBeenCalled();
            expect(mockWritable.close).toHaveBeenCalled();
        });

        test('dispatches convertedRubyCode after successful conversion', async () => {
            const mockApply = jest.fn(() => Promise.resolve());
            mockTargetCodeToBlocks.mockResolvedValue({
                result: true,
                errors: [],
                apply: mockApply,
            });

            store = createStore({
                rubyCode: {
                    modified: true,
                    code: 'puts "hello"',
                    target: { id: 'target', blocks: {} },
                },
            });

            const { getByText } = render(
                <Provider store={store}>
                    <RubyDownloader>
                        {(className, downloadProject) => <button onClick={downloadProject}>Download</button>}
                    </RubyDownloader>
                </Provider>,
            );

            fireEvent.click(getByText('Download'));

            await waitFor(() => {
                expect(mockApply).toHaveBeenCalled();
            });

            const actions = store.getActions();
            expect(actions).toContainEqual(
                expect.objectContaining({ type: 'smalruby3-gui/ruby-code/CONVERTED_RUBYCODE' }),
            );
        });
    });
});
