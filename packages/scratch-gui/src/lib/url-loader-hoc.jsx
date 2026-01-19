import bindAll from 'lodash.bindall';
import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, intlShape, injectIntl} from 'react-intl';
import {connect} from 'react-redux';
import log from '../lib/log';
import sharedMessages from './shared-messages';

import {
    extractScratchProjectId,
    isValidScratchProjectUrl
} from './url-parser';

import {
    LoadingStates,
    getIsLoadingUpload,
    getIsShowingWithoutId,
    onLoadedProject,
    projectError,
    setProjectId,
    requestProjectUpload
} from '../reducers/project-state';
import {setProjectTitle} from '../reducers/project-title';
import {
    openLoadingProject,
    closeLoadingProject,
    openUrlLoaderModal,
    closeUrlLoaderModal
} from '../reducers/modals';
import {
    closeFileMenu
} from '../reducers/menus';

const messages = defineMessages({
    loadError: {
        id: 'gui.urlLoader.loadError',
        defaultMessage: 'The project URL that was entered failed to load.',
        description: 'An error that displays when a project URL fails to load.'
    },
    invalidUrl: {
        id: 'gui.urlLoader.invalidUrl',
        defaultMessage: 'Please enter a valid Scratch project URL.',
        description: 'An error that displays when an invalid URL is entered.'
    }
});

/**
 * Higher Order Component to provide behavior for loading project from URL into editor.
 * @param {React.Component} WrappedComponent the component to add URL loading functionality to
 * @returns {React.Component} WrappedComponent with URL loading functionality added
 *
 * <URLLoaderHOC>
 *     <WrappedComponent />
 * </URLLoaderHOC>
 */
const URLLoaderHOC = function (WrappedComponent) {
    class URLLoaderComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleStartSelectingUrlLoad',
                'handleUrlSubmit',
                'loadScratchProjectFromUrl',
                'handleFinishedLoadingUpload',
                'clearLoadingReferences'
            ]);
        }
        componentDidUpdate (prevProps) {
            if (this.props.isLoadingUpload && !prevProps.isLoadingUpload) {
                this.handleFinishedLoadingUpload();
            }
        }

        handleStartSelectingUrlLoad () {
            this.props.openUrlLoaderModal();
            this.props.closeFileMenu();
        }

        handleUrlSubmit (url, errorCallback) {
            const {
                intl,
                isShowingWithoutId,
                loadingState,
                projectChanged,
                userOwnsProject
            } = this.props;

            // Validate Scratch project URL
            if (!isValidScratchProjectUrl(url)) {
                // Instead of alert, pass error to modal via callback
                if (errorCallback) {
                    errorCallback(intl.formatMessage(messages.invalidUrl));
                }
                return;
            }

            // Store project ID for loading
            this.projectIdToLoad = extractScratchProjectId(url);
            this.projectUrlToLoad = url;

            // If user owns the project, or user has changed the project,
            // we must confirm with the user that they really intend to
            // replace it.
            let uploadAllowed = true;
            if (userOwnsProject || (projectChanged && isShowingWithoutId)) {
                uploadAllowed = confirm( // eslint-disable-line no-alert
                    intl.formatMessage(sharedMessages.replaceProjectWarning)
                );
            }

            if (uploadAllowed) {
                // Start the loading process
                this.props.requestProjectUpload(loadingState);
                // Close modal only when validation passes and user confirms
                this.props.closeUrlLoaderModal();
            } else {
                // Close modal if user cancels the replacement
                this.props.closeUrlLoaderModal();
            }
        }

        handleFinishedLoadingUpload () {
            if (this.projectIdToLoad) {
                this.loadScratchProjectFromUrl(this.projectIdToLoad);
            } else {
                this.props.cancelFileUpload(this.props.loadingState);
            }
        }

        loadScratchProjectFromUrl (projectId) {
            this.props.onLoadingStarted();

            // Set project ID in Redux state first (like project-fetcher-hoc.jsx)
            this.props.setProjectId(projectId.toString());

            // Use the same approach as project-fetcher-hoc.jsx
            // First get the project token via the proxy API
            const options = {
                method: 'GET',
                uri: `https://api.smalruby.app/scratch-api-proxy/projects/${projectId}`,
                json: true
            };

            fetch(options.uri, {
                method: options.method,
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const projectToken = data.project_token;

                    // Now load the project using storage system (like project-fetcher-hoc.jsx)
                    const storage = this.props.vm.runtime.storage;
                    storage.setProjectToken(projectToken);

                    return storage.load(storage.AssetType.Project, projectId, storage.DataFormat.JSON);
                })
                .then(projectAsset => {
                    if (projectAsset) {
                        // Load project directly to VM (like sb-file-uploader-hoc.jsx for LOADING_VM_FILE_UPLOAD)
                        return this.props.vm.loadProject(projectAsset.data);
                    }
                    throw new Error('Could not find project');
                })
                .then(() => {
                    // Set project title based on the project data or URL
                    const projectTitle = `Project ${this.projectIdToLoad}`;
                    this.props.onSetProjectTitle(projectTitle);

                    // Use onLoadedProject for LOADING_VM_FILE_UPLOAD state
                    this.props.onLoadedProject(this.props.loadingState, true, true);
                })
                .catch(error => {
                    log.warn('URL loader error:', error);
                    this.props.onError(error);
                    alert(this.props.intl.formatMessage(messages.loadError)); // eslint-disable-line no-alert
                })
                .then(() => {
                    this.props.onLoadingFinished();
                    // Clear the project reference
                    this.clearLoadingReferences();
                });
        }

        clearLoadingReferences () {
            this.projectIdToLoad = null;
            this.projectUrlToLoad = null;
        }

        render () {
            const {
                /* eslint-disable no-unused-vars */
                cancelFileUpload,
                closeFileMenu: closeFileMenuProp,
                closeUrlLoaderModal: closeUrlLoaderModalProp,
                intl,
                isLoadingUpload,
                isShowingWithoutId,
                loadingState,
                onError,
                onLoadedProject: onLoadedProjectProp,
                onLoadingFinished,
                onLoadingStarted,
                onSetProjectTitle,
                openUrlLoaderModal: openUrlLoaderModalProp,
                projectChanged,
                requestProjectUpload: requestProjectUploadProp,
                setProjectId: setProjectIdProp,
                userOwnsProject,
                vm,
                onStartSelectingUrlLoad: onStartSelectingUrlLoadProp,
                /* eslint-enable no-unused-vars */
                ...componentProps
            } = this.props;
            return (
                <React.Fragment>
                    <WrappedComponent
                        onStartSelectingUrlLoad={this.handleStartSelectingUrlLoad}
                        onUrlLoaderSubmit={this.handleUrlSubmit}
                        vm={vm}
                        {...componentProps}
                    />
                </React.Fragment>
            );
        }
    }

    URLLoaderComponent.propTypes = {
        canSave: PropTypes.bool,
        cancelFileUpload: PropTypes.func,
        closeFileMenu: PropTypes.func,
        closeUrlLoaderModal: PropTypes.func,
        intl: intlShape.isRequired,
        isLoadingUpload: PropTypes.bool,
        isShowingWithoutId: PropTypes.bool,
        loadingState: PropTypes.oneOf(LoadingStates),
        onError: PropTypes.func,
        onLoadedProject: PropTypes.func,
        onLoadingFinished: PropTypes.func,
        onLoadingStarted: PropTypes.func,
        onSetProjectTitle: PropTypes.func,
        onStartSelectingUrlLoad: PropTypes.func,
        openUrlLoaderModal: PropTypes.func,
        projectChanged: PropTypes.bool,
        requestProjectUpload: PropTypes.func,
        setProjectId: PropTypes.func,
        userOwnsProject: PropTypes.bool,
        vm: PropTypes.shape({
            loadProject: PropTypes.func,
            runtime: PropTypes.shape({
                storage: PropTypes.object
            })
        })
    };

    const mapStateToProps = (state, ownProps) => {
        const loadingState = state.scratchGui.projectState.loadingState;
        const user = state.session && state.session.session && state.session.session.user;
        return {
            isLoadingUpload: getIsLoadingUpload(loadingState),
            isShowingWithoutId: getIsShowingWithoutId(loadingState),
            loadingState: loadingState,
            projectChanged: state.scratchGui.projectChanged,
            userOwnsProject: ownProps.authorUsername && user &&
                (ownProps.authorUsername === user.username),
            vm: state.scratchGui.vm
        };
    };

    const mapDispatchToProps = dispatch => ({
        cancelFileUpload: loadingState => dispatch(onLoadedProject(loadingState, false, false)),
        closeFileMenu: () => dispatch(closeFileMenu()),
        closeUrlLoaderModal: () => dispatch(closeUrlLoaderModal()),
        onError: error => dispatch(projectError(error)),
        onLoadedProject: (loadingState, canSave, success) =>
            dispatch(onLoadedProject(loadingState, canSave, success)),
        onLoadingFinished: () => {
            dispatch(closeLoadingProject());
            dispatch(closeFileMenu());
        },
        onLoadingStarted: () => dispatch(openLoadingProject()),
        onSetProjectTitle: title => dispatch(setProjectTitle(title)),
        openUrlLoaderModal: () => dispatch(openUrlLoaderModal()),
        requestProjectUpload: loadingState => dispatch(requestProjectUpload(loadingState)),
        setProjectId: projectId => dispatch(setProjectId(projectId))
    });

    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );

    return injectIntl(connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(URLLoaderComponent));
};

export {
    URLLoaderHOC as default
};
