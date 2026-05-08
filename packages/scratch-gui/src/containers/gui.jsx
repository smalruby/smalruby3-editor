import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {compose} from 'redux';
import {connect} from 'react-redux';
import ReactModal from 'react-modal';
import VM from '@smalruby/scratch-vm';
import {injectIntl} from 'react-intl';
import intlShape from '../lib/intlShape.js';

import ErrorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import {
    getIsError,
    getIsShowingProject
} from '../reducers/project-state';
import {
    activateTab,
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    SOUNDS_TAB_INDEX,
    RUBY_TAB_INDEX
} from '../reducers/editor-tab';

import {
    closeCostumeLibrary,
    closeBackdropLibrary,
    closeTelemetryModal,
    openExtensionLibrary,
    closeDebugModal,
    closeKoshienTestModal,
    closeUrlLoaderModal,
    closeTipsLibrary,
    openWelcomeModal
} from '../reducers/modals';

import {setPlatform} from '../reducers/platform';
import {setTheme} from '../reducers/settings';
import {setDynamicAssets} from '../reducers/dynamic-assets';
import {showAlertWithTimeout} from '../reducers/alerts';
import {highlightTarget} from '../reducers/targets';
import {
    rubyCodeShape,
    updateRubyCodeErrors,
    convertedRubyCode
} from '../reducers/ruby-code';
import {
    targetCodeToBlocks
} from '../lib/ruby-to-blocks-converter';

import FontLoaderHOC from '../lib/font-loader-hoc.jsx';
import LocalizationHOC from '../lib/localization-hoc.jsx';
import SBFileUploaderHOC from '../lib/sb-file-uploader-hoc.jsx';
import URLLoaderHOC from '../lib/url-loader-hoc.jsx';
import ProjectFetcherHOC from '../lib/project-fetcher-hoc.jsx';
import TitledHOC from '../lib/titled-hoc.jsx';
import ProjectSaverHOC from '../lib/project-saver-hoc.jsx';
import QueryParserHOC from '../lib/query-parser-hoc.jsx';
import vmListenerHOC from '../lib/vm-listener-hoc.jsx';
import vmManagerHOC from '../lib/vm-manager-hoc.jsx';
import cloudManagerHOC from '../lib/cloud-manager-hoc.jsx';
import systemPreferencesHOC from '../lib/system-preferences-hoc.jsx';
import {PLATFORM} from '../lib/platform.js';
// === Smalruby: Start of classcode auto-open ===
import {isClassroomConfigured} from '../lib/classroom-api.js';
import {openClassroomModal} from '../reducers/classroom.js';
import {getUrlParams} from '../lib/url-params.js';
// === Smalruby: End of classcode auto-open ===

import GUIComponent from '../components/gui/gui.jsx';
import {GUIStoragePropType} from '../gui-config';
import {AccountMenuOptionsPropTypes} from '../lib/account-menu-options';
import {
    costumeShape,
    soundShape,
    spriteShape
} from '../lib/assets-prop-types.js';

class GUI extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleActivateTab'
        ]);
    }
    componentDidMount () {
        this.props.onStorageInit(this.props.storage.scratchStorage);
        this.props.onVmInit(this.props.vm);
        this.props.storage.setProjectMetadata?.(this.props.projectId);
        if (this.props.platform) {
            this.props.onSetPlatform(this.props.platform);
        }
        if (this.props.dynamicAssets) {
            this.props.onUpdateDynamicAssets(this.props.dynamicAssets);
        }
        // === Smalruby: Start of classcode auto-open ===
        const urlParams = getUrlParams();
        if (urlParams.classcode && isClassroomConfigured()) {
            this.props.onOpenClassroomModal();
        }
        // === Smalruby: End of classcode auto-open ===
    }
    componentDidUpdate (prevProps) {
        if (this.props.dynamicAssets !== prevProps.dynamicAssets) {
            this.props.onUpdateDynamicAssets(this.props.dynamicAssets);
        }
        if (this.props.projectId !== prevProps.projectId) {
            if (this.props.projectId !== null) {
                this.props.onUpdateProjectId(this.props.projectId);
            }

            this.props.storage.setProjectMetadata?.(this.props.projectId);
        }
        if (this.props.isShowingProject && !prevProps.isShowingProject) {
            // this only notifies container when a project changes from not yet loaded to loaded
            // At this time the project view in www doesn't need to know when a project is unloaded
            this.props.onProjectLoaded();
        }
        if (this.props.shouldStopProject && !prevProps.shouldStopProject) {
            this.props.vm.stopAll();
        }
        // When leaving Ruby tab with modified code, convert Ruby to blocks
        if (prevProps.activeTabIndex === RUBY_TAB_INDEX &&
            this.props.activeTabIndex !== RUBY_TAB_INDEX &&
            prevProps.rubyCode.modified) {
            const destinationTab = this.props.activeTabIndex;
            // Immediately switch back to Ruby tab while conversion runs
            this.props.onActivateTab(RUBY_TAB_INDEX);
            targetCodeToBlocks(
                this.props.vm,
                prevProps.rubyCode.target,
                prevProps.rubyCode.code,
                this.props.intl,
                {version: prevProps.rubyVersion}
            ).then(converter => {
                if (converter.result) {
                    this.props.updateRubyCodeErrorsState(converter.errors);
                    this.props.convertedRubyCodeState();
                    converter.apply().then(() => {
                        this.props.onActivateTab(destinationTab);
                    });
                    return;
                }
                this.props.vm.setEditingTarget(prevProps.rubyCode.target.id);
                if (!prevProps.rubyCode.target.isStage) {
                    this.props.onHighlightTarget(prevProps.rubyCode.target.id);
                }
                this.props.onShowConvertRubyToBlocksErrorAlert();
                this.props.updateRubyCodeErrorsState(converter.errors);
            });
        }
    }
    handleActivateTab (tab) {
        this.props.onActivateTab(tab);
    }
    render () {
        if (this.props.isError) {
            throw new Error(
                `Error in Scratch GUI [location=${window.location}]: ${this.props.error}`);
        }
        const {

            assetHost,
            cloudHost,
            error,
            isError,
            isShowingProject,
            onProjectLoaded,
            onStorageInit,
            onUpdateProjectId,
            onVmInit,
            projectHost,
            projectId,

            children,
            fetchingProject,
            isLoading,
            loadingStateVisible,
            onActivateTab: _onActivateTab,
            rubyCode: _rubyCode,
            rubyVersion: _rubyVersion,
            convertedRubyCodeState: _convertedRubyCodeState,
            onHighlightTarget: _onHighlightTarget,
            onShowConvertRubyToBlocksErrorAlert: _onShowConvertRubyToBlocksErrorAlert,
            updateRubyCodeErrorsState: _updateRubyCodeErrorsState,
            ...componentProps
        } = this.props;


        return (
            <GUIComponent
                loading={fetchingProject || isLoading || loadingStateVisible}
                onActivateTab={this.handleActivateTab}
                {...componentProps}
            >
                {children}
            </GUIComponent>
        );
    }
}

GUI.propTypes = {
    activeTabIndex: PropTypes.number,
    storage: GUIStoragePropType,
    accountMenuOptions: AccountMenuOptionsPropTypes,
    assetHost: PropTypes.string,
    children: PropTypes.node,
    cloudHost: PropTypes.string,
    dynamicAssets: PropTypes.shape({
        backdrops: PropTypes.arrayOf(costumeShape),
        costumes: PropTypes.arrayOf(costumeShape),
        sounds: PropTypes.arrayOf(soundShape),
        sprites: PropTypes.arrayOf(spriteShape)
    }),
    error: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    fetchingProject: PropTypes.bool,
    intl: intlShape,
    isError: PropTypes.bool,
    isLoading: PropTypes.bool,
    isShowingProject: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    loadingStateVisible: PropTypes.bool,
    manuallySaveThumbnails: PropTypes.bool,
    onSetManualThumbnail: PropTypes.func,
    onSetManualThumbnailButtonClick: PropTypes.func,
    onProjectLoaded: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onStorageInit: PropTypes.func,
    onUpdateProjectId: PropTypes.func,
    onUpdateDynamicAssets: PropTypes.func,
    onVmInit: PropTypes.func,
    platform: PropTypes.oneOf(Object.keys(PLATFORM)),
    onSetPlatform: PropTypes.func.isRequired,
    /**
     * Indicates whether we should highlight new editor features in the UI.
     * Used only when there are new features to highlight.
     */
    showNewFeatureCallouts: PropTypes.bool,
    projectHost: PropTypes.string,
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    shouldStopProject: PropTypes.bool,
    telemetryModalVisible: PropTypes.bool,
    koshienTestModalVisible: PropTypes.bool,
    urlLoaderModalVisible: PropTypes.bool,
    onRequestCloseKoshienTestModal: PropTypes.func,
    onRequestCloseUrlLoaderModal: PropTypes.func,
    onActivateTab: PropTypes.func,
    onActivateRubyTab: PropTypes.func,
    onUrlLoaderSubmit: PropTypes.func,
    onStartSelectingUrlLoad: PropTypes.func,
    blocksId: PropTypes.string,
    stageSizeMode: PropTypes.string,
    colorMode: PropTypes.string,
    theme: PropTypes.string,
    blockDisplayModalVisible: PropTypes.bool,
    onSetTheme: PropTypes.func,
    rubyCode: rubyCodeShape,
    rubyVersion: PropTypes.string,
    convertedRubyCodeState: PropTypes.func,
    onHighlightTarget: PropTypes.func,
    onShowConvertRubyToBlocksErrorAlert: PropTypes.func,
    updateRubyCodeErrorsState: PropTypes.func,
    username: PropTypes.string,
    userOwnsProject: PropTypes.bool,
    // TODO: Is this unused?
    hideTutorialProjects: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired,
    onOpenClassroomModal: PropTypes.func // === Smalruby: classcode auto-open ===
};

GUI.defaultProps = {
    isTotallyNormal: false,
    onStorageInit: () => {},
    onProjectLoaded: () => {},
    onUpdateProjectId: () => {},
    onVmInit: (/* vm */) => {}
};

const mapStateToProps = (state, ownProps) => {
    const loadingState = state.scratchGui.projectState.loadingState;
    return {
        storage: state.scratchGui.config.storage,
        activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
        alertsVisible: state.scratchGui.alerts.visible,
        backdropLibraryVisible: state.scratchGui.modals.backdropLibrary,
        blocksTabVisible: state.scratchGui.editorTab.activeTabIndex === BLOCKS_TAB_INDEX,
        connectionModalVisible: state.scratchGui.modals.connectionModal,
        cardsVisible: state.scratchGui.cards.visible,
        costumeLibraryVisible: state.scratchGui.modals.costumeLibrary,
        costumesTabVisible: state.scratchGui.editorTab.activeTabIndex === COSTUMES_TAB_INDEX,
        debugModalVisible: state.scratchGui.modals.debugModal,
        error: state.scratchGui.projectState.error,
        isError: getIsError(loadingState),
        isFullScreen: state.scratchGui.mode.isFullScreen,
        isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
        isRtl: state.locales.isRtl,
        isShowingProject: getIsShowingProject(loadingState),
        loadingStateVisible: state.scratchGui.modals.loadingProject,
        platform: ownProps.platform,
        projectId: state.scratchGui.projectState.projectId,
        soundsTabVisible: state.scratchGui.editorTab.activeTabIndex === SOUNDS_TAB_INDEX,
        rubyTabVisible: state.scratchGui.editorTab.activeTabIndex === RUBY_TAB_INDEX,
        targetIsStage: (
            state.scratchGui.targets.stage &&
            state.scratchGui.targets.stage.id === state.scratchGui.targets.editingTarget
        ),
        telemetryModalVisible: state.scratchGui.modals.telemetryModal,
        tipsLibraryVisible: state.scratchGui.modals.tipsLibrary,
        koshienTestModalVisible: state.scratchGui.modals.koshienTestModal,
        urlLoaderModalVisible: state.scratchGui.modals.urlLoaderModal,
        blocksId: state.scratchGui.timeTravel.year.toString(),
        stageSizeMode: state.scratchGui.stageSize.stageSize,
        colorMode: state.scratchGui.settings.colorMode,
        theme: state.scratchGui.settings.theme,
        blockDisplayModalVisible: state.scratchGui.blockDisplay.modalVisible,
        // === Smalruby: Start of smalrubot firmware modal ===
        smalrubotFirmwareModalVisible: state.scratchGui.smalrubotFirmware.modalVisible,
        // === Smalruby: End of smalrubot firmware modal ===
        // === Smalruby: Start of classroom modal ===
        classroomModalVisible: state.scratchGui.classroom ? state.scratchGui.classroom.modalVisible : false,
        teacherModalVisible: state.scratchGui.classroom ? state.scratchGui.classroom.teacherModalVisible : false,
        // === Smalruby: End of classroom modal ===
        dnclMode: state.scratchGui.dnclMode.dnclMode, // === Smalruby: DNCL block filtering ===
        rubyCode: state.scratchGui.rubyCode,
        rubyVersion: state.scratchGui.settings.rubyVersion,
        vm: state.scratchGui.vm
    };
};

const mapDispatchToProps = dispatch => ({
    onExtensionButtonClick: () => dispatch(openExtensionLibrary()),
    onActivateTab: tab => dispatch(activateTab(tab)),
    onUpdateDynamicAssets: dynamicAssets => dispatch(setDynamicAssets(dynamicAssets)),
    onActivateCostumesTab: () => dispatch(activateTab(COSTUMES_TAB_INDEX)),
    onActivateSoundsTab: () => dispatch(activateTab(SOUNDS_TAB_INDEX)),
    onActivateRubyTab: () => dispatch(activateTab(RUBY_TAB_INDEX)),
    onSetPlatform: platform => dispatch(setPlatform(platform)),
    onSetTheme: theme => dispatch(setTheme(theme)),
    onRequestCloseBackdropLibrary: () => dispatch(closeBackdropLibrary()),
    onRequestCloseCostumeLibrary: () => dispatch(closeCostumeLibrary()),
    onRequestCloseDebugModal: () => dispatch(closeDebugModal()),
    onRequestCloseTelemetryModal: () => dispatch(closeTelemetryModal()),
    onRequestCloseKoshienTestModal: () => dispatch(closeKoshienTestModal()),
    onRequestCloseUrlLoaderModal: () => dispatch(closeUrlLoaderModal()),
    onRequestCloseTipsLibrary: () => dispatch(closeTipsLibrary()),
    convertedRubyCodeState: () => dispatch(convertedRubyCode()),
    onHighlightTarget: id => dispatch(highlightTarget(id)),
    onShowConvertRubyToBlocksErrorAlert: () => showAlertWithTimeout(dispatch, 'convertRubyToBlocksError'),
    updateRubyCodeErrorsState: errors => dispatch(updateRubyCodeErrors(errors)),
    // === Smalruby: Start of classcode auto-open ===
    onOpenClassroomModal: () => dispatch(openClassroomModal()),
    // === Smalruby: End of classcode auto-open ===
    // === Smalruby: Start of welcome modal ===
    onShowWelcomeModal: () => dispatch(openWelcomeModal())
    // === Smalruby: End of welcome modal ===
});

const ConnectedGUI = injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(GUI));

// note that redux's 'compose' function is just being used as a general utility to make
// the hierarchy of HOC constructor calls clearer here; it has nothing to do with redux's
// ability to compose reducers.
const WrappedGui = compose(
    LocalizationHOC,
    ErrorBoundaryHOC('Top Level App'),
    FontLoaderHOC,
    QueryParserHOC,
    ProjectFetcherHOC,
    TitledHOC,
    ProjectSaverHOC,
    vmListenerHOC,
    vmManagerHOC,
    SBFileUploaderHOC,
    URLLoaderHOC,
    cloudManagerHOC,
    systemPreferencesHOC
)(ConnectedGUI);

WrappedGui.setAppElement = ReactModal.setAppElement;
export default WrappedGui;
