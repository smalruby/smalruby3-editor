import 'web-audio-test-api';

import React from 'react';
import configureStore from 'redux-mock-store';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import {LoadingState} from '../../../src/reducers/project-state';
import VM from '@smalruby/scratch-vm';

import SBFileUploaderHOC from '../../../src/lib/sb-file-uploader-hoc.jsx';
import {IntlProvider} from 'react-intl';

describe('SBFileUploaderHOC', () => {
    const mockStore = configureStore();
    let store;
    let vm;

    // Wrap this in a function so it gets test specific states and can be reused.
    const getContainer = function () {
        const Component = () => <div />;
        return SBFileUploaderHOC(Component);
    };

    const unwrappedInstance = () => {
        const WrappedComponent = getContainer();
        // default starting state: looking at a project you created, not logged in
        const wrapper = renderWithIntl(
            <WrappedComponent
                projectChanged
                canSave={false}
                cancelFileUpload={jest.fn()}
                closeFileMenu={jest.fn()}
                requestProjectUpload={jest.fn()}
                userOwnsProject={false}
                vm={vm}
                onLoadingFinished={jest.fn()}
                onLoadingStarted={jest.fn()}
                onUpdateProjectTitle={jest.fn()}
                store={store}
            />
        );
        return wrapper;
    };

    beforeEach(() => {
        vm = new VM();
        store = mockStore({
            scratchGui: {
                projectState: {
                    loadingState: LoadingState.SHOWING_WITHOUT_ID
                },
                settings: {
                    rubyVersion: '1'
                },
                vm: {},
                test: {
                    isTest: false
                }
            },
            locales: {
                locale: 'en'
            }
        });
    });

    test('should dispatch clearGoogleDriveFile when user uploads a file', () => {
        // Use a component that triggers file upload on mount
        const Component = ({onStartSelectingFileUpload}) => {
            React.useEffect(() => {
                onStartSelectingFileUpload();
            }, []); // eslint-disable-line react-hooks/exhaustive-deps
            return <div />;
        };
        const WrappedComponent = SBFileUploaderHOC(Component);
        const mockClearGoogleDriveFile = jest.fn();
        const mockRequestProjectUpload = jest.fn();

        renderWithIntl(
            <WrappedComponent
                canSave={false}
                cancelFileUpload={jest.fn()}
                clearGoogleDriveFile={mockClearGoogleDriveFile}
                closeFileMenu={jest.fn()}
                isLoadingUpload={false}
                isShowingWithoutId
                isTest
                loadingState={LoadingState.SHOWING_WITHOUT_ID}
                projectChanged={false}
                requestProjectUpload={mockRequestProjectUpload}
                store={store}
                userOwnsProject={false}
                vm={vm}
                onLoadingFinished={jest.fn()}
                onLoadingStarted={jest.fn()}
                onSetProjectTitle={jest.fn()}
                onUpdateProjectTitle={jest.fn()}
            />
        );

        // Find the hidden file input element created by createFileObjects
        const fileInput = document.querySelector('input[type="file"]');
        expect(fileInput).not.toBeNull();

        // Simulate file selection (triggers handleChange)
        const file = new File(['test'], 'test.sb3', {type: 'application/octet-stream'});
        Object.defineProperty(fileInput, 'files', {value: [file]});
        fileInput.dispatchEvent(new Event('change', {bubbles: true}));

        expect(mockClearGoogleDriveFile).toHaveBeenCalled();
        expect(mockRequestProjectUpload).toHaveBeenCalled();
    });

    test('if isLoadingUpload becomes true, without fileToUpload set, will call cancelFileUpload', () => {
        const mockedCancelFileUpload = jest.fn();
        const WrappedComponent = getContainer();
        const {rerender} = renderWithIntl(
            <WrappedComponent
                projectChanged
                canSave={false}
                cancelFileUpload={mockedCancelFileUpload}
                closeFileMenu={jest.fn()}
                isLoadingUpload={false}
                requestProjectUpload={jest.fn()}
                store={store}
                userOwnsProject={false}
                vm={vm}
                onLoadingFinished={jest.fn()}
                onLoadingStarted={jest.fn()}
                onUpdateProjectTitle={jest.fn()}
            />
        );
        rerender(
            <IntlProvider
                locale="en"
                messages={{ }}
            >
                <WrappedComponent
                    projectChanged
                    canSave={false}
                    cancelFileUpload={mockedCancelFileUpload}
                    closeFileMenu={jest.fn()}
                    isLoadingUpload
                    requestProjectUpload={jest.fn()}
                    store={store}
                    userOwnsProject={false}
                    vm={vm}
                    onLoadingFinished={jest.fn()}
                    onLoadingStarted={jest.fn()}
                    onUpdateProjectTitle={jest.fn()}
                />
            </IntlProvider>
        );
        expect(mockedCancelFileUpload).toHaveBeenCalled();
    });
});
