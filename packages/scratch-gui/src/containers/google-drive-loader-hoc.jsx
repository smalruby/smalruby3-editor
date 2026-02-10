/* eslint-disable no-console */
import bindAll from 'lodash.bindall';
import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, injectIntl} from 'react-intl';
import intlShape from '../lib/intlShape.js';
import {connect} from 'react-redux';
import log from '../lib/log';
import sharedMessages from '../lib/shared-messages';

import googleDriveAPI from '../lib/google-drive-api';
import {
    LoadingStates,
    getIsLoadingUpload,
    onLoadedProject
} from '../reducers/project-state';
import {setProjectTitle} from '../reducers/project-title';
import {setRubyVersion} from '../reducers/settings';
import {persistRubyVersion} from '../lib/settings/ruby-version/persistence';
import {setGoogleDriveFile} from '../reducers/google-drive-file';
import {setProjectUnchanged} from '../reducers/project-changed';
import {
    openLoadingProject,
    closeLoadingProject
} from '../reducers/modals';
import {
    closeFileMenu
} from '../reducers/menus';

const messages = defineMessages({
    loadError: {
        id: 'gui.googleDriveLoader.loadError',
        defaultMessage: 'Failed to load project from Google Drive.',
        description: 'An error that displays when a Google Drive project file fails to load.'
    },
    authError: {
        id: 'gui.googleDriveLoader.authError',
        defaultMessage: 'Failed to authenticate with Google Drive. Please try again.',
        description: 'An error that displays when Google Drive authentication fails.'
    },
    configError: {
        id: 'gui.googleDriveLoader.configError',
        defaultMessage: 'Google Drive is not configured. Please contact the administrator.',
        description: 'An error that displays when Google Drive API is not configured.'
    },
    pickerTitle: {
        id: 'gui.googleDriveLoader.pickerTitle',
        defaultMessage: 'Select a Scratch 3.0 project (.sb3) from Google Drive',
        description: 'Title for Google Drive file picker dialog.'
    }
});

/**
 * Higher Order Component to provide behavior for loading projects from Google Drive.
 * @param {React.Component} WrappedComponent the component to add Google Drive loading functionality to
 * @returns {React.Component} WrappedComponent with Google Drive loading functionality added
 *
 * <GoogleDriveLoaderHOC>
 *     <WrappedComponent />
 * </GoogleDriveLoaderHOC>
 */
const GoogleDriveLoaderHOC = function (WrappedComponent) {
    class GoogleDriveLoaderComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleStartSelectingGoogleDrive',
                'handlePickerCallback',
                'handleFinishedLoadingUpload',
                'getProjectTitleFromFilename'
            ]);
        }

        componentDidUpdate (prevProps) {
            if (this.props.isLoadingUpload && !prevProps.isLoadingUpload) {
                this.handleFinishedLoadingUpload();
            }
        }

        /**
         * Start Google Drive file selection process
         */
        handleStartSelectingGoogleDrive () {
            // Check if Google Drive is configured
            if (!googleDriveAPI.constructor.isConfigured()) {
                alert(this.props.intl.formatMessage(messages.configError)); // eslint-disable-line no-alert
                log.warn('Google Drive API is not configured');
                return;
            }

            // Close file menu
            this.props.closeFileMenu();

            // Get localized title
            const title = this.props.intl.formatMessage(messages.pickerTitle);

            // Initialize and show Google Picker
            // Don't show loading modal yet - wait until user selects a file
            googleDriveAPI.showPicker(this.handlePickerCallback, this.props.locale, title)
                .catch(error => {
                    log.error('Failed to show Google Picker:', error);
                    alert(this.props.intl.formatMessage(messages.authError)); // eslint-disable-line no-alert
                });
        }

        /**
         * Handle Google Picker callback
         * @param {object} result - Picker result
         */
        handlePickerCallback (result) {
            if (result.cancelled) {
                // User cancelled picker
                this.props.onCloseLoadingProject();
                return;
            }

            if (result.error) {
                // Error occurred
                log.error('Google Drive picker error:', result.error);
                this.props.onCloseLoadingProject();
                alert(result.error); // eslint-disable-line no-alert
                return;
            }

            if (result.selected) {
                // File selected - show loading modal immediately (before download)
                const {fileName} = result;

                // Update project title
                const projectTitle = this.getProjectTitleFromFilename(fileName);
                this.props.onSetProjectTitle(projectTitle);

                // Show loading modal
                this.props.onLoadingStarted();
                return;
            }

            if (result.success) {
                // File downloaded successfully - load the project
                const {fileId, fileName, fileData} = result;

                // Convert ArrayBuffer to Uint8Array
                const content = new Uint8Array(fileData);

                // Load the project
                // smalruby: mesh V1 to V2 migration
                this.props.vm.hasMeshV1Project(content)
                    .then(hasMeshV1 => {
                        let migrateMeshV1ToV2 = false;
                        if (hasMeshV1) {
                            migrateMeshV1ToV2 = !confirm( // eslint-disable-line no-alert
                                this.props.intl.formatMessage(sharedMessages.migrateMeshV1Warning)
                            );
                        }
                        return this.props.vm.loadProject(content, {migrateMeshV1ToV2});
                    })
                    .then(() => this.props.vm.hasKoshienProject(content))
                    .then(hasKoshien => {
                        if (hasKoshien) {
                            if (this.props.rubyVersion !== '1') {
                                alert(this.props.intl.formatMessage( // eslint-disable-line no-alert
                                    sharedMessages.changedRubyVersionByKoshien
                                ));
                            }
                            this.props.onSetRubyVersion('1');
                        }
                        // Store Google Drive file metadata for direct save functionality
                        this.props.onSetGoogleDriveFile(fileId, fileName, null);
                        // Mark project as unchanged after loading from Google Drive
                        this.props.onSetProjectUnchanged();
                        this.props.onLoadingFinished(this.props.loadingState, true);
                        this.props.onCloseLoadingProject();
                    })
                    .catch(error => {
                        console.error('[GoogleDriveLoader] Project load failed:', {
                            error: error,
                            errorType: typeof error,
                            errorMessage: error && error.message,
                            errorStack: error && error.stack
                        });
                        log.error('Failed to load project from Google Drive:', error);
                        this.props.onCloseLoadingProject();
                        alert(this.props.intl.formatMessage(messages.loadError)); // eslint-disable-line no-alert
                    });
            }
        }

        /**
         * Extract project title from filename
         * @param {string} filename - File name
         * @returns {string} Project title
         */
        getProjectTitleFromFilename (filename) {
            return filename.replace(/\.sb3$/, '');
        }

        /**
         * Handle finished loading upload
         */
        handleFinishedLoadingUpload () {
            this.props.onLoadingFinished(this.props.loadingState, true);
        }

        render () {
            const {
                closeFileMenu: _closeFileMenuProp,
                intl,
                isLoadingUpload: _isLoadingUpload,
                loadingState: _loadingState,
                locale: _locale,
                onCloseLoadingProject: _onCloseLoadingProject,
                onLoadingFinished: _onLoadingFinished,
                onLoadingStarted: _onLoadingStarted,
                onSetProjectTitle: _onSetProjectTitle,
                onSetRubyVersion: _onSetRubyVersion,
                openUrlLoaderModal: _openUrlLoaderModal,
                rubyVersion: _rubyVersion,
                vm: _vm,
                ...componentProps
            } = this.props;

            return (
                <WrappedComponent
                    intl={intl}
                    onStartSelectingGoogleDrive={this.handleStartSelectingGoogleDrive}
                    {...componentProps}
                />
            );
        }
    }

    GoogleDriveLoaderComponent.propTypes = {
        closeFileMenu: PropTypes.func,
        intl: intlShape.isRequired,
        isLoadingUpload: PropTypes.bool,
        loadingState: PropTypes.oneOf(LoadingStates),
        locale: PropTypes.string,
        onCloseLoadingProject: PropTypes.func,
        onLoadingFinished: PropTypes.func,
        onLoadingStarted: PropTypes.func,
        onSetGoogleDriveFile: PropTypes.func,
        onSetProjectTitle: PropTypes.func,
        onSetRubyVersion: PropTypes.func,
        onSetProjectUnchanged: PropTypes.func,
        openUrlLoaderModal: PropTypes.func,
        rubyVersion: PropTypes.string,
        vm: PropTypes.shape({
            loadProject: PropTypes.func,
            hasMeshV1Project: PropTypes.func,
            hasKoshienProject: PropTypes.func
        })
    };

    const mapStateToProps = state => ({
        isLoadingUpload: getIsLoadingUpload(state.scratchGui.projectState.loadingState),
        loadingState: state.scratchGui.projectState.loadingState,
        locale: state.locales.locale,
        rubyVersion: state.scratchGui.settings.rubyVersion,
        vm: state.scratchGui.vm
    });

    const mapDispatchToProps = dispatch => ({
        closeFileMenu: () => dispatch(closeFileMenu()),
        onCloseLoadingProject: () => dispatch(closeLoadingProject()),
        onLoadingFinished: (loadingState, success) => {
            dispatch(onLoadedProject(loadingState, false, success));
            dispatch(closeLoadingProject());
        },
        onLoadingStarted: () => dispatch(openLoadingProject()),
        onSetGoogleDriveFile: (fileId, fileName, folderId) => dispatch(setGoogleDriveFile(fileId, fileName, folderId)),
        onSetProjectTitle: title => dispatch(setProjectTitle(title)),
        onSetRubyVersion: version => {
            dispatch(setRubyVersion(version));
            persistRubyVersion(version);
        },
        onSetProjectUnchanged: () => dispatch(setProjectUnchanged())
    });

    return injectIntl(connect(
        mapStateToProps,
        mapDispatchToProps
    )(GoogleDriveLoaderComponent));
};

export {
    GoogleDriveLoaderHOC as default
};
