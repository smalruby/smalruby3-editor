/* eslint-disable no-console */
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import googleDriveAPI from '../lib/google-drive-api';
import intlShape from '../lib/intlShape.js';
import log from '../lib/log';
import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';
import { setGoogleDriveFile } from '../reducers/google-drive-file';
import { closeFileMenu } from '../reducers/menus';
import { setProjectUnchanged } from '../reducers/project-changed';
import { projectTitleInitialState, setProjectTitle } from '../reducers/project-title';

const messages = defineMessages({
    uploadError: {
        id: 'gui.googleDriveSaver.uploadError',
        defaultMessage: 'Failed to upload project to Google Drive.',
        description: 'An error that displays when a Google Drive project upload fails.',
    },
    authError: {
        id: 'gui.googleDriveSaver.authError',
        defaultMessage: 'Failed to authenticate with Google Drive. Please try again.',
        description: 'An error that displays when Google Drive authentication fails.',
    },
    configError: {
        id: 'gui.googleDriveSaver.configError',
        defaultMessage: 'Google Drive is not configured. Please contact the administrator.',
        description: 'An error that displays when Google Drive API is not configured.',
    },
    uploadSuccess: {
        id: 'gui.googleDriveSaver.uploadSuccess',
        defaultMessage: 'Project successfully uploaded to Google Drive!',
        description: 'A message that displays when a project is successfully uploaded to Google Drive.',
    },
    updateError: {
        id: 'gui.googleDriveSaver.updateError',
        defaultMessage: 'Failed to save project to Google Drive.',
        description: 'An error that displays when a Google Drive project update fails.',
    },
});

/**
 * Higher Order Component to provide behavior for saving projects to Google Drive.
 * @param {React.Component} WrappedComponent the component to add Google Drive saving functionality to
 * @returns {React.Component} WrappedComponent with Google Drive saving functionality added
 *
 * <GoogleDriveSaverHOC>
 *     <WrappedComponent />
 * </GoogleDriveSaverHOC>
 */
const GoogleDriveSaverHOC = function (WrappedComponent) {
    class GoogleDriveSaverComponent extends React.Component {
        constructor(props) {
            super(props);
            bindAll(this, [
                'handleStartSavingToGoogleDrive',
                'handleSaveToGoogleDrive',
                'handleSaveDirectlyToGoogleDrive',
                'handleCancelGoogleDriveSave',
                'getProjectFilename',
                'scheduleAutoSave',
                'clearAutoSaveTimeout',
                'tryToAutoSave',
                'performSaveToGoogleDrive',
            ]);
            this.state = {
                showSaveDialog: false,
                saveStatus: 'idle', // 'idle' | 'saving' | 'saved'
                saveDirectStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'auth_error'
                autoSaveTimeoutId: null,
            };
            this.autoSaveIntervalSecs = 30; // Auto-save interval: 30 seconds
            // DEBUG: Counter for simulating auth errors (0 = disabled, >0 = number of errors to simulate)
            this.simulateAuthErrorCount = 0;
        }

        componentDidUpdate(prevProps) {
            // Schedule auto-save when project changes
            if (this.props.projectChanged && !prevProps.projectChanged) {
                this.scheduleAutoSave();
            }
        }

        componentWillUnmount() {
            // Clear auto-save timeout when component unmounts
            this.clearAutoSaveTimeout();
        }

        /**
         * Get project filename from title
         * @returns {string} Filename with .sb3 extension
         */
        getProjectFilename() {
            let filenameTitle = this.props.projectTitle;
            if (!filenameTitle || filenameTitle.length === 0) {
                filenameTitle = projectTitleInitialState;
            }
            return `${filenameTitle.substring(0, 100)}.sb3`;
        }

        /**
         * Clear auto-save timeout
         */
        clearAutoSaveTimeout() {
            if (this.state.autoSaveTimeoutId !== null) {
                clearTimeout(this.state.autoSaveTimeoutId);
                this.setState({ autoSaveTimeoutId: null });
            }
        }

        /**
         * Perform save to Google Drive and update UI
         * @param {string} fileId - Google Drive file ID
         * @param {string} fileName - File name
         * @returns {Promise<void>} Promise that resolves when save is complete
         */
        async performSaveToGoogleDrive(fileId, fileName) {
            // Generate project data
            const content = await this.props.saveProjectSb3();

            // Update existing file in Google Drive
            await googleDriveAPI.updateFile(fileId, fileName, content);

            // Mark project as unchanged after successful save
            this.props.onSetProjectUnchanged();

            // Set status to saved
            this.setState({ saveDirectStatus: 'saved' });

            // Reset status to idle after 3 seconds
            setTimeout(() => {
                this.setState({ saveDirectStatus: 'idle' });
            }, 3000);
        }

        /**
         * Schedule auto-save after interval
         */
        scheduleAutoSave() {
            // Only auto-save if file is from Google Drive and not already saving
            const isGoogleDriveFile = this.props.googleDriveFile && this.props.googleDriveFile.isGoogleDriveFile;
            if (
                isGoogleDriveFile &&
                this.state.autoSaveTimeoutId === null &&
                this.state.saveDirectStatus !== 'saving'
            ) {
                const timeoutId = setTimeout(this.tryToAutoSave, this.autoSaveIntervalSecs * 1000);
                this.setState({ autoSaveTimeoutId: timeoutId });
            }
        }

        /**
         * Try to auto-save if conditions are met
         */
        tryToAutoSave() {
            const isGoogleDriveFile = this.props.googleDriveFile && this.props.googleDriveFile.isGoogleDriveFile;
            if (this.props.projectChanged && isGoogleDriveFile) {
                this.handleSaveDirectlyToGoogleDrive(false); // Auto-save: don't show auth dialog
            }
        }

        /**
         * Start Google Drive save process
         */
        handleStartSavingToGoogleDrive() {
            // Check if Google Drive is configured
            if (!googleDriveAPI.constructor.isConfigured()) {
                alert(this.props.intl.formatMessage(messages.configError)); // eslint-disable-line no-alert
                log.warn('Google Drive API is not configured');
                return;
            }

            // Close file menu
            this.props.closeFileMenu();

            // Show save dialog
            this.setState({ showSaveDialog: true });
        }

        /**
         * Handle save directly to current Google Drive file (without dialog)
         * @param {boolean} isUserInitiated - True if user explicitly clicked save button, false for auto-save
         */
        async handleSaveDirectlyToGoogleDrive(isUserInitiated = true) {
            // Check if Google Drive file info exists
            if (!this.props.googleDriveFile || !this.props.googleDriveFile.isGoogleDriveFile) {
                log.warn('No Google Drive file info available for direct save');
                return;
            }

            // Check if Google Drive is configured
            if (!googleDriveAPI.constructor.isConfigured()) {
                alert(this.props.intl.formatMessage(messages.configError)); // eslint-disable-line no-alert
                log.warn('Google Drive API is not configured');
                return;
            }

            const { fileId, fileName } = this.props.googleDriveFile;

            // Close file menu if open
            this.props.closeFileMenu();

            // Clear auto-save timeout before saving
            this.clearAutoSaveTimeout();

            // Set status to saving
            this.setState({ saveDirectStatus: 'saving' });

            try {
                // DEBUG: Simulate authentication error for testing
                if (this.simulateAuthErrorCount > 0) {
                    this.simulateAuthErrorCount--;
                    console.warn(`[DEBUG] Simulating auth error (remaining: ${this.simulateAuthErrorCount})`);
                    const simulatedError = new Error('Simulated authentication error for testing');
                    simulatedError.status = 401;
                    throw simulatedError;
                }

                // Convert Ruby code to blocks
                const converter = await this.props.targetCodeToBlocks(this.props.intl);
                if (!converter.result) {
                    this.setState({ saveDirectStatus: 'idle' });
                    return;
                }

                await converter.apply();

                // Save to Google Drive and update UI
                await this.performSaveToGoogleDrive(fileId, fileName);
            } catch (error) {
                console.error('[GoogleDriveSaver] Direct save failed:', error);
                log.error('Failed to save project to Google Drive:', error);

                // Check if error is authentication related
                const isAuthError =
                    (error && error.status === 401) ||
                    (error &&
                        error.message &&
                        (error.message.toLowerCase().includes('auth') ||
                            error.message.toLowerCase().includes('unauthorized')));

                if (isAuthError) {
                    if (isUserInitiated) {
                        // User clicked save button - attempt re-authentication
                        try {
                            // Request new access token (will show OAuth dialog)
                            await googleDriveAPI.requestAccessToken();

                            // Re-authentication successful - retry save
                            await this.performSaveToGoogleDrive(fileId, fileName);
                        } catch (reAuthError) {
                            console.error('[GoogleDriveSaver] Re-authentication or retry save failed:', reAuthError);
                            log.error('Failed to re-authenticate or save:', reAuthError);
                            this.setState({ saveDirectStatus: 'idle' });
                            const errorMessage =
                                reAuthError && reAuthError.message
                                    ? reAuthError.message
                                    : this.props.intl.formatMessage(messages.authError);
                            alert(errorMessage); // eslint-disable-line no-alert
                        }
                    } else {
                        // Auto-save - don't show auth dialog, just set auth error status
                        this.setState({ saveDirectStatus: 'auth_error' });
                    }
                } else {
                    // Regular error - show alert and reset to idle
                    this.setState({ saveDirectStatus: 'idle' });
                    const errorMessage =
                        error && error.message ? error.message : this.props.intl.formatMessage(messages.updateError);
                    alert(errorMessage); // eslint-disable-line no-alert
                }
            }
        }

        /**
         * Handle cancel Google Drive save dialog
         */
        handleCancelGoogleDriveSave() {
            this.setState({ showSaveDialog: false });
        }

        /**
         * Handle save to Google Drive
         * @param {string} filename - File name
         * @param {string} folderId - Google Drive folder ID (null for My Drive root)
         */
        async handleSaveToGoogleDrive(filename, folderId) {
            // Close dialog and set status to saving
            this.setState({ showSaveDialog: false, saveStatus: 'saving' });

            try {
                // Convert Ruby code to blocks
                const converter = await this.props.targetCodeToBlocks(this.props.intl);
                if (!converter.result) {
                    this.setState({ saveStatus: 'idle' });
                    return;
                }

                await converter.apply();

                // Generate project data
                const content = await this.props.saveProjectSb3();

                // Upload to Google Drive
                const response = await googleDriveAPI.uploadFile(filename, content, folderId);

                // Store Google Drive file metadata for direct save functionality
                this.props.onSetGoogleDriveFile(response.id, filename, folderId);

                // === Smalruby: Start of sync project title on copy save ===
                // Update project title to match the saved filename (without .sb3 extension)
                this.props.onSetProjectTitle(filename.replace(/\.sb3$/, ''));
                // === Smalruby: End of sync project title on copy save ===

                // Set status to saved
                this.setState({ saveStatus: 'saved' });

                // Reset status to idle after 3 seconds
                setTimeout(() => {
                    this.setState({ saveStatus: 'idle' });
                }, 3000);
            } catch (error) {
                console.error('[GoogleDriveSaver] Upload failed:', error);
                log.error('Failed to upload project to Google Drive:', error);
                this.setState({ saveStatus: 'idle' });

                // Show error message
                const errorMessage =
                    error && error.message ? error.message : this.props.intl.formatMessage(messages.uploadError);
                alert(errorMessage); // eslint-disable-line no-alert
            }
        }

        render() {
            const {
                closeFileMenu: _closeFileMenuProp,
                intl,
                locale: _locale,
                projectTitle: _projectTitle,
                saveProjectSb3: _saveProjectSb3,
                targetCodeToBlocks: _targetCodeToBlocks,
                ...componentProps
            } = this.props;

            return (
                <WrappedComponent
                    googleDriveSaveDialogVisible={this.state.showSaveDialog}
                    googleDriveSaveDirectStatus={this.state.saveDirectStatus}
                    googleDriveSaveStatus={this.state.saveStatus}
                    intl={intl}
                    projectFilename={this.getProjectFilename()}
                    onCancelGoogleDriveSave={this.handleCancelGoogleDriveSave}
                    onSaveDirectlyToGoogleDrive={this.handleSaveDirectlyToGoogleDrive}
                    onSaveToGoogleDrive={this.handleSaveToGoogleDrive}
                    onStartSavingToGoogleDrive={this.handleStartSavingToGoogleDrive}
                    {...componentProps}
                />
            );
        }
    }

    GoogleDriveSaverComponent.propTypes = {
        closeFileMenu: PropTypes.func,
        googleDriveFile: PropTypes.shape({
            fileId: PropTypes.string,
            fileName: PropTypes.string,
            folderId: PropTypes.string,
            isGoogleDriveFile: PropTypes.bool,
        }),
        intl: intlShape.isRequired,
        locale: PropTypes.string,
        onSetGoogleDriveFile: PropTypes.func,
        onSetProjectTitle: PropTypes.func,
        onSetProjectUnchanged: PropTypes.func,
        projectChanged: PropTypes.bool,
        projectTitle: PropTypes.string,
        saveProjectSb3: PropTypes.func,
        targetCodeToBlocks: PropTypes.func,
    };

    const mapStateToProps = state => ({
        googleDriveFile: state.scratchGui.googleDriveFile,
        locale: state.locales.locale,
        projectChanged: state.scratchGui.projectChanged,
        projectTitle: state.scratchGui.projectTitle,
        saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
    });

    const mapDispatchToProps = dispatch => ({
        closeFileMenu: () => dispatch(closeFileMenu()),
        onSetGoogleDriveFile: (fileId, fileName, folderId) =>
            dispatch(setGoogleDriveFile(fileId, fileName, folderId)),
        // === Smalruby: Start of sync project title on copy save ===
        onSetProjectTitle: title => dispatch(setProjectTitle(title)),
        // === Smalruby: End of sync project title on copy save ===
        onSetProjectUnchanged: () => dispatch(setProjectUnchanged()),
    });

    return RubyToBlocksConverterHOC(
        injectIntl(connect(mapStateToProps, mapDispatchToProps)(GoogleDriveSaverComponent)),
    );
};

export { GoogleDriveSaverHOC as default };
