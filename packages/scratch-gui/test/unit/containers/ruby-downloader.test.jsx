import React from 'react';
import {mount} from 'enzyme';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
import RubyDownloader from '../../../src/containers/ruby-downloader';
import VM from 'scratch-vm';

describe('RubyDownloader Container', () => {
    const mockStore = configureStore();
    let store;
    let vm;

    beforeEach(() => {
        vm = new VM();
        vm.runtime.targets = [
            {id: 'stage', blocks: {}, isStage: true}
        ];
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

    test('calls onSaveError when showSaveFilePicker rejects', (done) => {
        const error = {name: 'AbortError', message: 'Abort'};
        window.showSaveFilePicker.mockImplementation(() => Promise.reject(error));

        const onSaveError = (err) => {
            try {
                expect(err).toBe(error);
                done();
            } catch (e) {
                done.fail(e);
            }
        };

        const wrapper = mount(
            <Provider store={store}>
                <RubyDownloader onSaveError={onSaveError}>
                    {(className, downloadProject) => (
                        <button id="download-button" onClick={downloadProject}>Download</button>
                    )}
                </RubyDownloader>
            </Provider>
        );

        // Mock saveRuby to avoid complex VM dependencies
        wrapper.find('RubyDownloader').instance().saveRuby = jest.fn(() => new Blob(['test'], {type: 'text/plain'}));

        wrapper.find('#download-button').simulate('click');
    });
});