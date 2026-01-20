import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
import RubyDownloader from '../../../src/containers/ruby-downloader';
import _RubyGenerator from '../../../src/lib/ruby-generator';

jest.mock('../../../src/lib/ruby-generator', () => ({
    targetsToCode: jest.fn(() => 'mocked ruby code')
}));

describe('RubyDownloader Container', () => {
    const mockStore = configureStore();
    let store;
    let vm;

    beforeEach(() => {
        vm = {
            runtime: {
                targets: [
                    {id: 'stage', blocks: {}, isStage: true}
                ]
            }
        };
        store = mockStore({
            scratchGui: {
                koshienFile: {
                    fileHandle: null
                },
                projectTitle: 'project',
                targets: {
                    sprites: {},
                    stage: {id: 'stage', blocks: {}}
                },
                vm: vm,
                rubyCode: {
                    modified: false,
                    code: '',
                    target: {id: 'target', blocks: {}}
                }
            }
        });
        // Mock showSaveFilePicker
        window.showSaveFilePicker = jest.fn();
    });

    test('calls onSaveError when showSaveFilePicker rejects', async () => {
        const error = new Error('Abort');
        error.name = 'AbortError';
        window.showSaveFilePicker.mockImplementation(() => Promise.reject(error));

        const onSaveError = jest.fn();

        const {getByText} = render(
            <Provider store={store}>
                <RubyDownloader onSaveError={onSaveError}>
                    {(className, downloadProject) => (
                        <button onClick={downloadProject}>Download</button>
                    )}
                </RubyDownloader>
            </Provider>
        );

        fireEvent.click(getByText('Download'));

        await waitFor(() => {
            expect(onSaveError).toHaveBeenCalledWith(error);
        });
    });
});
