// === Smalruby: Start of tab activation handler ===
import bindAll from 'lodash.bindall';
// === Smalruby: End of tab activation handler ===
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
    // === Smalruby: Start of ruby tab ===
    RUBY_TAB_INDEX
    // === Smalruby: End of ruby tab ===
} from '../reducers/editor-tab';

import {
    closeCostumeLibrary,
    closeBackdropLibrary,
    closeTelemetryModal,
    openExtensionLibrary,
    closeDebugModal,
    // === Smalruby: Start of koshien ===
    closeKoshienTestModal,
    closeKoshienSettingsModal,
    // === Smalruby: End of koshien ===
    // === Smalruby: Start of url loader ===
    closeUrlLoaderModal,
    // === Smalruby: End of url loader ===
    // === Smalruby: Start of tips library close ===
    closeTipsLibrary,
    // === Smalruby: End of tips library close ===
    // === Smalruby: Start of welcome modal ===
    openWelcomeModal
    // === Smalruby: End of welcome modal ===
} from '../reducers/modals';

import {setPlatform} from '../reducers/platform';
// === Smalruby: Start of set theme ===
import {setTheme} from '../reducers/settings';
// === Smalruby: End of set theme ===
import {setDynamicAssets} from '../reducers/dynamic-assets';
import { // === Smalruby: DNCL mode notice ===
    setDnclMode,
    requestExternalExitDnclMode,
} from '../reducers/dncl-mode'; // === Smalruby: DNCL mode notice ===
// === Smalruby: Start of bug report modal ===
import {openBugReportModal} from '../reducers/bug-report';
// === Smalruby: End of bug report modal ===

import FontLoaderHOC from '../lib/font-loader-hoc.jsx';
import LocalizationHOC from '../lib/localization-hoc.jsx';
import SBFileUploaderHOC from '../lib/sb-file-uploader-hoc.jsx';
// === Smalruby: Start of url loader ===
import URLLoaderHOC from '../lib/url-loader-hoc.jsx';
// === Smalruby: End of url loader ===
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
// === Smalruby: Start of lesson mode ===
import {getCurrentChallenge} from '../reducers/lesson-mode.js';
// === Smalruby: End of lesson mode ===
// === Smalruby: Start of classroom teacher work bar ===
import {isTeacherWorkBarVisible} from '../lib/classroom-teacher-work.js';
// === Smalruby: End of classroom teacher work bar ===

import GUIComponent from '../components/gui/gui.jsx';
import {GUIStoragePropType} from '../gui-config';
import {AccountMenuOptionsPropTypes} from '../lib/account-menu-options';
import {
    costumeShape,
    soundShape,
    spriteShape
} from '../lib/assets-prop-types.js';

class GUI extends React.Component {
    // === Smalruby: Start of tab activation handler ===
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleActivateTab'
        ]);
    }
    // === Smalruby: End of tab activation handler ===
    componentDidMount () {
        this.props.onStorageInit(this.props.storage.scratchStorage);
        this.props.onVmInit(this.props.vm);
        this.props.storage.setProjectMetadata?.(this.props.projectId);
        if (this.props.platform) {
            // === Smalruby: Start of onSetPlatform prop rename ===
            this.props.onSetPlatform(this.props.platform);
            // === Smalruby: End of onSetPlatform prop rename ===
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
        // NOTE: the "leaving Ruby tab with modified code" conversion is
        // owned by containers/ruby-tab.jsx (single owner — issue #710).
    }
    // === Smalruby: Start of tab activation handler ===
    handleActivateTab (tab) {
        this.props.onActivateTab(tab);
    }
    // === Smalruby: End of tab activation handler ===
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
            // === Smalruby: Start of tab activation handler ===
            onActivateTab: _onActivateTab,
            // === Smalruby: End of tab activation handler ===
            ...componentProps
        } = this.props;


        return (
            <GUIComponent
                loading={fetchingProject || isLoading || loadingStateVisible}
                // === Smalruby: Start of tab activation handler ===
                onActivateTab={this.handleActivateTab}
                // === Smalruby: End of tab activation handler ===
                {...componentProps}
            >
                {children}
            </GUIComponent>
        );
    }
}

GUI.propTypes = {
    // === Smalruby: Start of ruby tab ===
    activeTabIndex: PropTypes.number,
    // === Smalruby: End of ruby tab ===
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
    // === Smalruby: Start of onSetPlatform prop rename ===
    onSetPlatform: PropTypes.func.isRequired,
    // === Smalruby: End of onSetPlatform prop rename ===
    /**
     * Indicates whether we should highlight new editor features in the UI.
     * Used only when there are new features to highlight.
     */
    showNewFeatureCallouts: PropTypes.bool,
    projectHost: PropTypes.string,
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    shouldStopProject: PropTypes.bool,
    telemetryModalVisible: PropTypes.bool,
    // === Smalruby: Start of smalruby gui props ===
    koshienTestModalVisible: PropTypes.bool,
    koshienSettingsModalVisible: PropTypes.bool,
    urlLoaderModalVisible: PropTypes.bool,
    onRequestCloseKoshienTestModal: PropTypes.func,
    onRequestCloseKoshienSettingsModal: PropTypes.func,
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
    // === Smalruby: End of smalruby gui props ===
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
        // === Smalruby: Start of ruby tab ===
        rubyTabVisible: state.scratchGui.editorTab.activeTabIndex === RUBY_TAB_INDEX,
        // === Smalruby: End of ruby tab ===
        targetIsStage: (
            state.scratchGui.targets.stage &&
            state.scratchGui.targets.stage.id === state.scratchGui.targets.editingTarget
        ),
        telemetryModalVisible: state.scratchGui.modals.telemetryModal,
        tipsLibraryVisible: state.scratchGui.modals.tipsLibrary,
        // === Smalruby: Start of smalruby gui state ===
        koshienTestModalVisible: state.scratchGui.modals.koshienTestModal,
        koshienSettingsModalVisible: state.scratchGui.modals.koshienSettingsModal,
        urlLoaderModalVisible: state.scratchGui.modals.urlLoaderModal,
        blocksId: state.scratchGui.timeTravel.year.toString(),
        stageSizeMode: state.scratchGui.stageSize.stageSize,
        colorMode: state.scratchGui.settings.colorMode,
        theme: state.scratchGui.settings.theme,
        blockDisplayModalVisible: state.scratchGui.blockDisplay.modalVisible,
        // === Smalruby: End of smalruby gui state ===
        // === Smalruby: Start of smalrubot firmware modal ===
        smalrubotFirmwareModalVisible: state.scratchGui.smalrubotFirmware.modalVisible,
        // === Smalruby: End of smalrubot firmware modal ===
        // === Smalruby: Start of classroom modal ===
        classroomModalVisible: state.scratchGui.classroom ? state.scratchGui.classroom.modalVisible : false,
        teacherModalVisible: state.scratchGui.classroom ? state.scratchGui.classroom.teacherModalVisible : false,
        // 「戻る帯」（containers/classroom-teacher-work-bar.jsx）が出ているあいだ、その高さの分だけ本体を縮める
        teacherWorkBarVisible: isTeacherWorkBarVisible(state.scratchGui.classroom),
        // === Smalruby: End of classroom modal ===
        dnclMode: state.scratchGui.dnclMode.dnclMode, // === Smalruby: DNCL block filtering ===
        // === Smalruby: Start of lesson mode ===
        // 課題バー（containers/lesson-mode.jsx）が出ているあいだ、その高さの分だけ本体を縮める
        lessonTaskBarVisible: Boolean(getCurrentChallenge(state)),
        // === Smalruby: End of lesson mode ===
        vm: state.scratchGui.vm
    };
};

const mapDispatchToProps = dispatch => ({
    onExtensionButtonClick: () => dispatch(openExtensionLibrary()),
    // === Smalruby: Start of DNCL mode notice ===
    onRequestExitDnclMode: () => {
        dispatch(setDnclMode(false));
        dispatch(requestExternalExitDnclMode());
    },
    // === Smalruby: End of DNCL mode notice ===
    onActivateTab: tab => dispatch(activateTab(tab)),
    onUpdateDynamicAssets: dynamicAssets => dispatch(setDynamicAssets(dynamicAssets)),
    onActivateCostumesTab: () => dispatch(activateTab(COSTUMES_TAB_INDEX)),
    onActivateSoundsTab: () => dispatch(activateTab(SOUNDS_TAB_INDEX)),
    // === Smalruby: Start of ruby tab ===
    onActivateRubyTab: () => dispatch(activateTab(RUBY_TAB_INDEX)),
    // === Smalruby: End of ruby tab ===
    // === Smalruby: Start of onSetPlatform prop rename ===
    onSetPlatform: platform => dispatch(setPlatform(platform)),
    // === Smalruby: End of onSetPlatform prop rename ===
    // === Smalruby: Start of set theme ===
    onSetTheme: theme => dispatch(setTheme(theme)),
    // === Smalruby: End of set theme ===
    onRequestCloseBackdropLibrary: () => dispatch(closeBackdropLibrary()),
    onRequestCloseCostumeLibrary: () => dispatch(closeCostumeLibrary()),
    onRequestCloseDebugModal: () => dispatch(closeDebugModal()),
    onRequestCloseTelemetryModal: () => dispatch(closeTelemetryModal()),
    // === Smalruby: Start of smalruby modal close actions ===
    onRequestCloseKoshienTestModal: () => dispatch(closeKoshienTestModal()),
    onRequestCloseKoshienSettingsModal: () => dispatch(closeKoshienSettingsModal()),
    onRequestCloseUrlLoaderModal: () => dispatch(closeUrlLoaderModal()),
    onRequestCloseTipsLibrary: () => dispatch(closeTipsLibrary()),
    // === Smalruby: End of smalruby modal close actions ===
    // === Smalruby: Start of classcode auto-open ===
    onOpenClassroomModal: () => dispatch(openClassroomModal()),
    // === Smalruby: End of classcode auto-open ===
    // === Smalruby: Start of welcome modal ===
    onShowWelcomeModal: () => dispatch(openWelcomeModal()),
    // === Smalruby: End of welcome modal ===
    // === Smalruby: Start of bug report modal ===
    onOpenBugReportModal: () => dispatch(openBugReportModal())
    // === Smalruby: End of bug report modal ===
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
    // === Smalruby: Start of url loader ===
    URLLoaderHOC,
    // === Smalruby: End of url loader ===
    cloudManagerHOC,
    systemPreferencesHOC
)(ConnectedGUI);

WrappedGui.setAppElement = ReactModal.setAppElement;
export default WrappedGui;
