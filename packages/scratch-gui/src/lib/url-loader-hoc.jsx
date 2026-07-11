import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import { injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import { GUIStoragePropType } from '../gui-config';
import log from '../lib/log';
import { closeFileMenu } from '../reducers/menus';
import { openLoadingProject, closeLoadingProject, openUrlLoaderModal, closeUrlLoaderModal } from '../reducers/modals';
import {
    LoadingStates,
    getIsLoadingUpload,
    getIsShowingWithoutId,
    onLoadedProject,
    restoreProjectState,
    setProjectId,
    requestProjectUpload,
} from '../reducers/project-state';
import { setProjectTitle } from '../reducers/project-title';
import { setRubyVersion } from '../reducers/settings';
import intlShape from './intlShape';
import { loadProjectWithChecks } from './project-loader-utils';
import { persistRubyVersion } from './settings/ruby-version/persistence';
import sharedMessages from './shared-messages';
import { UrlLoaderError, fetchProjectInfo, formatLoadError, urlLoaderMessages } from './url-loader';
import { extractScratchProjectId, isValidScratchProjectUrl } from './url-parser';

const SCRATCH_API_PROXY_ENDPOINT = (process.env.SCRATCH_API_PROXY_ENDPOINT || 'https://api.smalruby.app').replace(
    /\/+$/,
    '',
);

const URLLoaderHOC = function (WrappedComponent) {
    class URLLoaderComponent extends React.Component {
        constructor(props) {
            super(props);
            bindAll(this, [
                'handleStartSelectingUrlLoad',
                'handleUrlSubmit',
                'loadScratchProjectFromUrl',
                'handleFinishedLoadingUpload',
                'clearLoadingReferences',
            ]);
            this.urlLoaderErrorCallback = null;
        }

        componentDidUpdate(prevProps) {
            if (this.props.isLoadingUpload && !prevProps.isLoadingUpload) {
                this.handleFinishedLoadingUpload();
            }
        }

        handleStartSelectingUrlLoad() {
            this.props.openUrlLoaderModal();
            this.props.closeFileMenu();
        }

        handleUrlSubmit(url, errorCallback) {
            const { intl, isShowingWithoutId, loadingState, projectChanged, userOwnsProject } = this.props;

            if (!isValidScratchProjectUrl(url)) {
                if (errorCallback) {
                    errorCallback(intl.formatMessage(urlLoaderMessages.invalidUrl));
                }
                return;
            }

            this.projectIdToLoad = extractScratchProjectId(url);
            this.projectUrlToLoad = url;
            this.urlLoaderErrorCallback = errorCallback || null;

            let uploadAllowed = true;
            if (userOwnsProject || (projectChanged && isShowingWithoutId)) {
                // eslint-disable-next-line no-alert
                uploadAllowed = confirm(intl.formatMessage(sharedMessages.replaceProjectWarning));
            }

            if (uploadAllowed) {
                // Keep the modal open during the fetch so that the errorCallback
                // can post the error back into the *same* modal instance on
                // failure. The modal is closed in `loadScratchProjectFromUrl`
                // only after the project has loaded successfully.
                this.props.requestProjectUpload(loadingState);
            } else {
                this.props.closeUrlLoaderModal();
                this.urlLoaderErrorCallback = null;
            }
        }

        handleFinishedLoadingUpload() {
            if (this.projectIdToLoad) {
                this.loadScratchProjectFromUrl(this.projectIdToLoad);
            } else {
                this.props.cancelFileUpload(this.props.loadingState);
            }
        }

        loadScratchProjectFromUrl(projectId) {
            // Capture the project id we are showing *before* setProjectId() moves
            // it to the target id. If the load fails, loadProjectWithChecks
            // restores the VM to this previous project, so we must restore redux
            // to the same id to keep app state and VM content consistent (#972).
            const previousProjectId = this.props.reduxProjectId;
            this.props.onLoadingStarted();
            this.props.setProjectId(projectId.toString());

            fetchProjectInfo(SCRATCH_API_PROXY_ENDPOINT, projectId)
                .then((data) => {
                    const projectToken = data.project_token;
                    const storage = this.props.storage;
                    storage.setProjectToken?.(projectToken);

                    return storage.scratchStorage.load(
                        storage.scratchStorage.AssetType.Project,
                        projectId,
                        storage.scratchStorage.DataFormat.JSON,
                    );
                })
                .then((projectAsset) => {
                    if (projectAsset) {
                        return loadProjectWithChecks(
                            this.props.vm,
                            this.props.intl,
                            projectAsset.data,
                            this.props.rubyVersion,
                            this.props.onSetRubyVersion,
                        );
                    }
                    throw new UrlLoaderError('Could not find project', 404);
                })
                .then(() => {
                    const projectTitle = `Project ${this.projectIdToLoad}`;
                    this.props.onSetProjectTitle(projectTitle);
                    this.props.onLoadedProject(this.props.loadingState, true, true);
                    // Close the modal only after a successful load.
                    this.props.closeUrlLoaderModal();
                })
                .catch((error) => {
                    log.warn('URL loader error:', error);
                    // vm.loadProject() disposes the current project before it
                    // deserializes, so a failed load empties the runtime.
                    // loadProjectWithChecks has already restored the previous
                    // project into the VM; restore redux to that same project
                    // (id + showing state) instead of leaving the failed target
                    // id in a fatal ERROR / mismatched state, which would make
                    // gui.jsx throw and reset the whole editor (#972).
                    this.props.restorePreviousProjectState(previousProjectId);
                    const message = formatLoadError(error, this.props.intl);
                    if (this.urlLoaderErrorCallback) {
                        // The modal is still mounted (we did not close it on
                        // submit), so the callback can put the error back into
                        // the same modal instance for the user to retry.
                        this.urlLoaderErrorCallback(message);
                    } else {
                        // eslint-disable-next-line no-alert
                        alert(message);
                    }
                })
                .then(() => {
                    this.props.onLoadingFinished();
                    this.clearLoadingReferences();
                });
        }

        clearLoadingReferences() {
            this.projectIdToLoad = null;
            this.projectUrlToLoad = null;
            this.urlLoaderErrorCallback = null;
        }

        render() {
            const {
                cancelFileUpload: _cancelFileUpload,
                closeFileMenu: _closeFileMenuProp,
                closeUrlLoaderModal: _closeUrlLoaderModalProp,
                intl: _intl,
                isLoadingUpload: _isLoadingUpload,
                isShowingWithoutId: _isShowingWithoutId,
                loadingState: _loadingState,
                onLoadedProject: _onLoadedProjectProp,
                onLoadingFinished: _onLoadingFinished,
                onLoadingStarted: _onLoadingStarted,
                onSetProjectTitle: _onSetProjectTitle,
                onSetRubyVersion: _onSetRubyVersion,
                openUrlLoaderModal: _openUrlLoaderModalProp,
                projectChanged: _projectChanged,
                reduxProjectId: _reduxProjectId,
                requestProjectUpload: _requestProjectUploadProp,
                restorePreviousProjectState: _restorePreviousProjectStateProp,
                rubyVersion: _rubyVersion,
                setProjectId: _setProjectIdProp,
                userOwnsProject: _userOwnsProject,
                vm,
                onStartSelectingUrlLoad: _onStartSelectingUrlLoadProp,
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
        onLoadedProject: PropTypes.func,
        onLoadingFinished: PropTypes.func,
        onLoadingStarted: PropTypes.func,
        onSetProjectTitle: PropTypes.func,
        onSetRubyVersion: PropTypes.func,
        onStartSelectingUrlLoad: PropTypes.func,
        openUrlLoaderModal: PropTypes.func,
        projectChanged: PropTypes.bool,
        reduxProjectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        requestProjectUpload: PropTypes.func,
        restorePreviousProjectState: PropTypes.func,
        rubyVersion: PropTypes.string,
        setProjectId: PropTypes.func,
        storage: GUIStoragePropType,
        userOwnsProject: PropTypes.bool,
        vm: PropTypes.shape({
            loadProject: PropTypes.func,
            hasMeshV1Project: PropTypes.func,
            hasKoshienProject: PropTypes.func,
            runtime: PropTypes.shape({
                storage: PropTypes.shape({}),
            }),
        }),
    };

    const mapStateToProps = (state, ownProps) => {
        const loadingState = state.scratchGui.projectState.loadingState;
        const user = state.session && state.session.session && state.session.session.user;
        return {
            isLoadingUpload: getIsLoadingUpload(loadingState),
            isShowingWithoutId: getIsShowingWithoutId(loadingState),
            loadingState: loadingState,
            projectChanged: state.scratchGui.projectChanged,
            reduxProjectId: state.scratchGui.projectState.projectId,
            rubyVersion: state.scratchGui.settings.rubyVersion,
            storage: state.scratchGui.config.storage,
            userOwnsProject: ownProps.authorUsername && user && ownProps.authorUsername === user.username,
            vm: state.scratchGui.vm,
        };
    };

    const mapDispatchToProps = (dispatch) => ({
        cancelFileUpload: (loadingState) => dispatch(onLoadedProject(loadingState, false, false)),
        closeFileMenu: () => dispatch(closeFileMenu()),
        closeUrlLoaderModal: () => dispatch(closeUrlLoaderModal()),
        onLoadedProject: (loadingState, canSave, success) =>
            dispatch(onLoadedProject(loadingState, canSave, success)),
        onLoadingFinished: () => {
            dispatch(closeLoadingProject());
            dispatch(closeFileMenu());
        },
        onLoadingStarted: () => dispatch(openLoadingProject()),
        onSetProjectTitle: (title) => dispatch(setProjectTitle(title)),
        onSetRubyVersion: (version) => {
            dispatch(setRubyVersion(version));
            persistRubyVersion(version);
        },
        openUrlLoaderModal: () => dispatch(openUrlLoaderModal()),
        requestProjectUpload: (loadingState) => dispatch(requestProjectUpload(loadingState)),
        restorePreviousProjectState: (projectId) => dispatch(restoreProjectState(projectId)),
        setProjectId: (projectId) => dispatch(setProjectId(projectId)),
    });

    const mergeProps = (stateProps, dispatchProps, ownProps) =>
        Object.assign({}, stateProps, dispatchProps, ownProps);

    return injectIntl(connect(mapStateToProps, mapDispatchToProps, mergeProps)(URLLoaderComponent));
};

export { URLLoaderHOC as default };
