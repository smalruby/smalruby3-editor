// === Smalruby: This file is Smalruby-specific (Google Drive state management integration tests) ===
import React from 'react';
import { IntlProvider } from 'react-intl';
import configureStore from 'redux-mock-store';
import 'web-audio-test-api';
import VM from '@smalruby/scratch-vm';
import GoogleDriveSaverHOC from '../../../src/containers/google-drive-saver-hoc.jsx';
import SBFileUploaderHOC from '../../../src/lib/sb-file-uploader-hoc.jsx';
import { LoadingState } from '../../../src/reducers/project-state';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

// Mock google-drive-api module
jest.mock('../../../src/lib/google-drive-api', () => ({
    __esModule: true,
    default: {
        constructor: { isConfigured: () => true },
        uploadFile: jest.fn(),
        updateFile: jest.fn(),
        requestAccessToken: jest.fn(),
    },
}));

// Mock ruby-to-blocks-converter-hoc to pass through
jest.mock('../../../src/lib/ruby-to-blocks-converter-hoc.jsx', () => Component => Component);

const googleDriveAPI = require('../../../src/lib/google-drive-api').default;

describe('Google Drive state management', () => {
    const mockStore = configureStore();
    let vm;

    beforeEach(() => {
        vm = new VM();
        jest.clearAllMocks();
    });

    describe('File upload clears Google Drive state', () => {
        test('should dispatch CLEAR_GOOGLE_DRIVE_FILE when uploading file after saving to Google Drive', () => {
            const store = mockStore({
                scratchGui: {
                    projectState: {
                        loadingState: LoadingState.SHOWING_WITHOUT_ID,
                    },
                    settings: {
                        rubyVersion: '1',
                    },
                    vm: {},
                    test: {
                        isTest: true,
                    },
                    projectChanged: false,
                    googleDriveFile: {
                        fileId: 'existing-file-id',
                        fileName: 'my-project.sb3',
                        folderId: 'folder-123',
                        isGoogleDriveFile: true,
                    },
                },
                locales: {
                    locale: 'en',
                },
            });

            const mockClearGoogleDriveFile = jest.fn();
            const mockRequestProjectUpload = jest.fn();

            // Create component that triggers file upload on mount
            const InnerComponent = ({ onStartSelectingFileUpload }) => {
                React.useEffect(() => {
                    onStartSelectingFileUpload();
                }, []); // eslint-disable-line react-hooks/exhaustive-deps
                return <div />;
            };
            const WrappedComponent = SBFileUploaderHOC(InnerComponent);

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
                />,
            );

            // Simulate file selection
            const fileInput = document.querySelector('input[type="file"]');
            expect(fileInput).not.toBeNull();
            const file = new File(['test'], 'new-project.sb3', { type: 'application/octet-stream' });
            Object.defineProperty(fileInput, 'files', { value: [file] });
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Google Drive state should be cleared
            expect(mockClearGoogleDriveFile).toHaveBeenCalled();
            // Upload should proceed
            expect(mockRequestProjectUpload).toHaveBeenCalled();
        });
    });

    describe('Copy save syncs project title', () => {
        test('should update project title to match saved filename', async () => {
            const store = mockStore({
                scratchGui: {
                    projectState: {
                        loadingState: 'SHOWING_WITHOUT_ID',
                    },
                    projectChanged: false,
                    projectTitle: 'old-project-name',
                    vm: vm,
                    googleDriveFile: {
                        fileId: null,
                        fileName: null,
                        folderId: null,
                        isGoogleDriveFile: false,
                    },
                },
                locales: {
                    locale: 'en',
                },
            });

            googleDriveAPI.uploadFile.mockResolvedValue({ id: 'new-file-id' });

            let capturedProps;
            const Component = props => {
                capturedProps = props;
                return <div />;
            };
            const WrappedComponent = GoogleDriveSaverHOC(Component);

            renderWithIntl(
                <WrappedComponent
                    store={store}
                    saveProjectSb3={jest.fn().mockResolvedValue(new ArrayBuffer(8))}
                    targetCodeToBlocks={jest.fn().mockResolvedValue({
                        result: true,
                        apply: jest.fn().mockResolvedValue(),
                    })}
                />,
            );

            // Save copy with a different filename
            await capturedProps.onSaveToGoogleDrive('renamed-project.sb3', 'folder-456');

            // Verify actions dispatched
            const actions = store.getActions();

            // Google Drive file metadata should be set
            const setFileAction = actions.find(a => a.type === 'googleDriveFile/SET_GOOGLE_DRIVE_FILE');
            expect(setFileAction).toBeDefined();
            expect(setFileAction.fileId).toBe('new-file-id');
            expect(setFileAction.fileName).toBe('renamed-project.sb3');
            expect(setFileAction.folderId).toBe('folder-456');

            // Project title should match the new filename (without .sb3)
            const setTitleAction = actions.find(a => a.type === 'projectTitle/SET_PROJECT_TITLE');
            expect(setTitleAction).toBeDefined();
            expect(setTitleAction.title).toBe('renamed-project');
        });
    });

    describe('Auto-save auth error handling', () => {
        test('should set auth_error status on auto-save 401 without showing dialog', async () => {
            const store = mockStore({
                scratchGui: {
                    projectState: {
                        loadingState: 'SHOWING_WITHOUT_ID',
                    },
                    projectChanged: true,
                    projectTitle: 'test-project',
                    vm: vm,
                    googleDriveFile: {
                        fileId: 'file-id',
                        fileName: 'test.sb3',
                        folderId: null,
                        isGoogleDriveFile: true,
                    },
                },
                locales: {
                    locale: 'en',
                },
            });

            const authError = new Error('Unauthorized');
            authError.status = 401;
            googleDriveAPI.updateFile.mockRejectedValue(authError);

            let capturedProps;
            const Component = props => {
                capturedProps = props;
                return <div />;
            };
            const WrappedComponent = GoogleDriveSaverHOC(Component);

            renderWithIntl(
                <WrappedComponent
                    store={store}
                    saveProjectSb3={jest.fn().mockResolvedValue(new ArrayBuffer(8))}
                    targetCodeToBlocks={jest.fn().mockResolvedValue({
                        result: true,
                        apply: jest.fn().mockResolvedValue(),
                    })}
                />,
            );

            // Simulate auto-save (isUserInitiated=false)
            await capturedProps.onSaveDirectlyToGoogleDrive(false);

            // Should NOT have attempted re-authentication
            expect(googleDriveAPI.requestAccessToken).not.toHaveBeenCalled();
        });

        test('should re-authenticate and retry on user-initiated save after auth error', async () => {
            const store = mockStore({
                scratchGui: {
                    projectState: {
                        loadingState: 'SHOWING_WITHOUT_ID',
                    },
                    projectChanged: true,
                    projectTitle: 'test-project',
                    vm: vm,
                    googleDriveFile: {
                        fileId: 'file-id',
                        fileName: 'test.sb3',
                        folderId: null,
                        isGoogleDriveFile: true,
                    },
                },
                locales: {
                    locale: 'en',
                },
            });

            const authError = new Error('Unauthorized');
            authError.status = 401;
            googleDriveAPI.updateFile.mockRejectedValueOnce(authError).mockResolvedValueOnce({});
            googleDriveAPI.requestAccessToken.mockResolvedValue();

            let capturedProps;
            const Component = props => {
                capturedProps = props;
                return <div />;
            };
            const WrappedComponent = GoogleDriveSaverHOC(Component);

            renderWithIntl(
                <WrappedComponent
                    store={store}
                    saveProjectSb3={jest.fn().mockResolvedValue(new ArrayBuffer(8))}
                    targetCodeToBlocks={jest.fn().mockResolvedValue({
                        result: true,
                        apply: jest.fn().mockResolvedValue(),
                    })}
                />,
            );

            // User clicks save (isUserInitiated=true)
            await capturedProps.onSaveDirectlyToGoogleDrive(true);

            // Should have attempted re-authentication
            expect(googleDriveAPI.requestAccessToken).toHaveBeenCalled();
            // Should have retried updateFile
            expect(googleDriveAPI.updateFile).toHaveBeenCalledTimes(2);
            // Should have marked project as unchanged after successful save
            const actions = store.getActions();
            const unchangedAction = actions.find(
                a => a.type === 'scratch-gui/project-changed/SET_PROJECT_CHANGED' && a.changed === false,
            );
            expect(unchangedAction).toBeDefined();
        });
    });
});
