import classNames from 'classnames';
import {connect} from 'react-redux';
import {compose} from 'redux';
import {defineMessages, FormattedMessage, injectIntl} from 'react-intl';
import intlShape from '../../lib/intlShape.js';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import bowser from 'bowser';
import React from 'react';

import VM from '@smalruby/scratch-vm';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import CommunityButton from './community-button.jsx';
import ShareButton from './share-button.jsx';
import {ComingSoonTooltip} from '../coming-soon/coming-soon.jsx';
import Divider from '../divider/divider.jsx';
import SaveStatus from './save-status.jsx';
import Spinner from '../spinner/spinner.jsx';
import ProjectWatcher from '../../containers/project-watcher.jsx';
import MenuBarMenu from './menu-bar-menu.jsx';
import {MenuItem, MenuSection} from '../menu/menu.jsx';
import ProjectTitleInput from './project-title-input.jsx';
import AuthorInfo from './author-info.jsx';
import AccountNav from '../../components/menu-bar/account-nav.jsx';
import LoginDropdown from './login-dropdown.jsx';
import SB3Downloader from '../../containers/sb3-downloader.jsx';
import RubyDownloader from '../../containers/ruby-downloader.jsx';
import DeletionRestorer from '../../containers/deletion-restorer.jsx';
import TurboMode from '../../containers/turbo-mode.jsx';
import MenuBarHOC from '../../containers/menu-bar-hoc.jsx';
import GoogleDriveLoaderHOC from '../../containers/google-drive-loader-hoc.jsx';
import GoogleDriveSaverHOC from '../../containers/google-drive-saver-hoc.jsx';
import GoogleDriveSaveDialog from '../google-drive-save-dialog/google-drive-save-dialog.jsx';
import SettingsMenu from './settings-menu.jsx';
import TutorialTooltip from './tutorial-tooltip.jsx';

import {
    openDebugModal,
    openKoshienTestModal,
    openUrlLoaderModal,
    openConnectionModal
} from '../../reducers/modals';
import {
    setDomain as setMeshV2Domain
} from '../../reducers/mesh-v2';
import {setConnectionModalExtensionId} from '../../reducers/connection-modal';
import {openBlockDisplayModal} from '../../reducers/block-display';
import {setPlayer} from '../../reducers/mode';
import {
    isTimeTravel220022BC,
    isTimeTravel1920,
    isTimeTravel1990,
    isTimeTravel2020,
    isTimeTravelNow,
    setTimeTravel
} from '../../reducers/time-travel';
import {
    autoUpdateProject,
    getIsUpdating,
    getIsShowingProject,
    manualUpdateProject,
    requestNewProject,
    remixProject,
    saveProjectAsCopy
} from '../../reducers/project-state';
import {clearGoogleDriveFile} from '../../reducers/google-drive-file';
import {
    incrementExtensionLoad,
    setAiSaveStatus,
    clearAiSaveStatus
} from '../../reducers/koshien-file';
import {
    openAboutMenu,
    closeAboutMenu,
    aboutMenuOpen,
    openAccountMenu,
    closeAccountMenu,
    accountMenuOpen,
    closeFileMenu,
    toggleFileMenu,
    fileMenuOpen,
    closeEditMenu,
    toggleEditMenu,
    editMenuOpen,
    openLoginMenu,
    closeLoginMenu,
    loginMenuOpen,
    openModeMenu,
    closeModeMenu,
    modeMenuOpen,
    openKoshienMenu,
    closeKoshienMenu,
    koshienMenuOpen,
    openMeshV2Menu,
    closeMeshV2Menu,
    meshV2MenuOpen,
    openSmalrubotS1Menu,
    closeSmalrubotS1Menu,
    smalrubotS1MenuOpen,
    settingsMenuOpen,
    closeSettingsMenu,
    toggleSettingsMenu
} from '../../reducers/menus';

import {updateRubyCodeTarget, updateRubyCodeErrors} from '../../reducers/ruby-code';
import {activateTab, RUBY_TAB_INDEX} from '../../reducers/editor-tab';
import {showAlertWithTimeout} from '../../reducers/alerts';

// === Smalruby: Start of smalrubot firmware menu ===
import {openSmalrubotFirmwareModal} from '../../reducers/smalrubot-firmware';
import {isFirmwareFlashSupported} from '../../lib/smalrubot-firmware-flasher';
// === Smalruby: End of smalrubot firmware menu ===
// === Smalruby: Start of classroom button ===
import {openClassroomModal} from '../../reducers/classroom';
import {isClassroomConfigured} from '../../lib/classroom-api';
import {getUrlParams} from '../../lib/url-params';
// === Smalruby: End of classroom button ===
import collectMetadata from '../../lib/collect-metadata';
import {PLATFORM} from '../../lib/platform';

import styles from './menu-bar.css';

import helpIcon from '../../lib/assets/icon--tutorials.svg';
import mystuffIcon from './icon--mystuff.png';
import profileIcon from './profile-hatti.png';
import remixIcon from './icon--remix.svg';
import dropdownCaret from './dropdown-caret.svg';
import aboutIcon from './icon--about.svg';
import fileIcon from './icon--file.svg';
import editIcon from './icon--edit.svg';
import debugIcon from '../debug-modal/icons/icon--debug.svg';
import koshienIcon from './icon--koshien.svg';
import meshConnectedIcon from './icon--mesh-connected.png';
import meshDisconnectedIcon from './icon--mesh-disconnected.png';

// === Smalruby: Start of replace Scratch logos with Smalruby logo ===
// Upstream imports scratchLogo, scratchLogoAndroid, ninetiesLogo, catLogo,
// prehistoricLogo, oldtimeyLogo and defines getScratchLogo() here.
// Smalruby uses a single logo instead.
import smalrubyLogo from './hatti.svg';
import hattiGreeting from './hatti-greeting.png';
import {createVersionChecker} from '../../lib/version-checker';
// === Smalruby: End of replace Scratch logos with Smalruby logo ===

import sharedMessages from '../../lib/shared-messages';

import {AccountMenuOptionsPropTypes} from '../../lib/account-menu-options';

const ariaMessages = defineMessages({
    tutorials: {
        id: 'gui.menuBar.tutorials',
        defaultMessage: 'Tutorials',
        description: 'accessibility text for the tutorials button'
    },
    debug: {
        id: 'gui.menuBar.debug',
        defaultMessage: 'Debug',
        description: 'accessibility text for the debug button'
    },
    koshien: {
        id: 'gui.menuBar.koshien',
        defaultMessage: 'Smalruby Koshien',
        description: 'accessibility text for the koshien button'
    }
});

// === Smalruby: Start of version update notification messages ===
const updateMessages = defineMessages({
    updateTooltip: {
        id: 'gui.menuBar.updateTooltip',
        defaultMessage: 'Try the new Smalruby!',
        description: 'tooltip text shown when a new version is available'
    },
    updateConfirm: {
        id: 'gui.menuBar.updateConfirm',
         
        defaultMessage: 'A new version of Smalruby is available. Press "OK" to update now, or "Cancel" to update later.',
        description: 'confirm dialog text for version update notification'
    }
});
// === Smalruby: End of version update notification messages ===


const MenuBarItemTooltip = ({
    children,
    className,
    enable,
    id,
    place = 'bottom'
}) => {
    if (enable) {
        return (
            <React.Fragment>
                {children}
            </React.Fragment>
        );
    }
    return (
        <ComingSoonTooltip
            className={classNames(styles.comingSoon, className)}
            place={place}
            tooltipClassName={styles.comingSoonTooltip}
            tooltipId={id}
        >
            {children}
        </ComingSoonTooltip>
    );
};


MenuBarItemTooltip.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    enable: PropTypes.bool,
    id: PropTypes.string,
    place: PropTypes.oneOf(['top', 'bottom', 'left', 'right'])
};

const MenuItemTooltip = ({id, isRtl, children, className}) => (
    <ComingSoonTooltip
        className={classNames(styles.comingSoon, className)}
        isRtl={isRtl}
        place={isRtl ? 'left' : 'right'}
        tooltipClassName={styles.comingSoonTooltip}
        tooltipId={id}
    >
        {children}
    </ComingSoonTooltip>
);

MenuItemTooltip.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    id: PropTypes.string,
    isRtl: PropTypes.bool
};

const AboutButton = props => (
    <Button
        className={classNames(styles.menuBarItem, styles.hoverable)}
        iconClassName={styles.aboutIcon}
        iconSrc={aboutIcon}
        onClick={props.onClick}
    />
);

AboutButton.propTypes = {
    onClick: PropTypes.func.isRequired
};

class MenuBar extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClickNew',
            'handleClickRemix',
            'handleClickSave',
            'handleClickSaveAsCopy',
            'handleClickGenerateRubyFromCode',
            'handleClickSeeCommunity',
            'handleClickShare',
            'handleSetMode',
            'handleKeyPress',
            'handleRestoreOption',
            'getSaveToComputerHandler',
            'getSaveAIHandler',
            'getSaveAIAsHandler',
            'getTestAIHandler',
            'handleAISaveFinished',
            'handleTestAISaveFinished',
            'handleAISaveAsFinished',
            'handleAISaveError',
            'handleConversionError',
            'restoreOptionMessage',
            'handleClickLoadFromUrl',
            'handleSaveDirectlyToGoogleDrive',
            'handleExtensionAdded',
            'handleClickKoshienEntryForm',
            'handleMeshV2MenuClick',
            'handleSmalrubotS1FirmwareFlash',
            'handleClickTutorials',
            'handleUpdateAvailable',
            'handleUpdateNotificationClick'
        ]);
        // === Smalruby: Start of version update notification ===
        this.state = {
            updateAvailable: false
        };
        this.updatePending = false;
        this.versionChecker = createVersionChecker({
            currentCommitId: process.env.COMMIT_SHA,
            onUpdateAvailable: this.handleUpdateAvailable
        });
        // === Smalruby: End of version update notification ===
    }
    componentDidMount () {
        document.addEventListener('keydown', this.handleKeyPress);

        // Listen for extension load events
        if (this.props.vm.runtime) {
            this.props.vm.runtime.on('EXTENSION_ADDED', this.handleExtensionAdded);
            this.props.vm.runtime.on('PERIPHERAL_CONNECTED', this.handleExtensionAdded);
            this.props.vm.runtime.on('PERIPHERAL_DISCONNECTED', this.handleExtensionAdded);
            this.props.vm.runtime.on('PERIPHERAL_REQUEST_ERROR', this.handleExtensionAdded);
        }

        this.syncMeshV2Domain();

        // === Smalruby: Start of version update notification ===
        this.versionChecker.start();
        // === Smalruby: End of version update notification ===
    }
    componentDidUpdate (prevProps) {
        if (this.props.extensionLoadCounter !== prevProps.extensionLoadCounter) {
            this.syncMeshV2Domain();
        }
        // === Smalruby: Start of version update notification ===
        // Show pending update notification when project becomes clean (e.g. after save)
        if (this.updatePending && prevProps.projectChanged && !this.props.projectChanged) {
            this.updatePending = false;
            this.setState({updateAvailable: true});
        }
        // === Smalruby: End of version update notification ===
    }
    componentWillUnmount () {
        document.removeEventListener('keydown', this.handleKeyPress);

        // === Smalruby: Start of version update notification ===
        this.versionChecker.stop();
        // === Smalruby: End of version update notification ===

        // Remove extension listener
        if (this.props.vm.runtime) {
            this.props.vm.runtime.off('EXTENSION_ADDED', this.handleExtensionAdded);
            this.props.vm.runtime.off('PERIPHERAL_CONNECTED', this.handleExtensionAdded);
            this.props.vm.runtime.off('PERIPHERAL_DISCONNECTED', this.handleExtensionAdded);
            this.props.vm.runtime.off('PERIPHERAL_REQUEST_ERROR', this.handleExtensionAdded);
        }
    }
    // === Smalruby: Start of version update notification ===
    handleUpdateAvailable () {
        if (this.props.projectChanged) {
            // Defer notification until project is saved
            this.updatePending = true;
        } else {
            this.setState({updateAvailable: true});
        }
    }
    handleUpdateNotificationClick () {
        // eslint-disable-next-line no-alert
        const confirmed = window.confirm(
            this.props.intl.formatMessage(updateMessages.updateConfirm)
        );
        if (confirmed) {
            // Disable beforeunload to prevent a second confirmation dialog
            window.onbeforeunload = null;
            window.location.reload();
        } else {
            this.setState({updateAvailable: false});
            // Re-check after 1 hour
            setTimeout(() => {
                this.versionChecker.check();
            }, 60 * 60 * 1000);
        }
    }
    // === Smalruby: End of version update notification ===
    handleClickNew () {
        // if the project is dirty, and user owns the project, we will autosave.
        // but if they are not logged in and can't save, user should consider
        // downloading or logging in first.
        // Note that if user is logged in and editing someone else's project,
        // they'll lose their work.
        const readyToReplaceProject = this.props.confirmReadyToReplaceProject(
            this.props.intl.formatMessage(sharedMessages.replaceProjectWarning)
        );
        if (readyToReplaceProject) {
            this.props.onClickNew(this.props.canSave && this.props.canCreateNew);
        }
    }
    handleClickRemix () {
        this.props.onClickRemix();
    }
    handleClickSave () {
        this.props.onClickSave();
    }
    handleClickSaveAsCopy () {
        this.props.onClickSaveAsCopy();
    }
    handleClickSeeCommunity (waitForUpdate) {
        if (this.props.shouldSaveBeforeTransition()) {
            this.props.autoUpdateProject(); // save before transitioning to project page
            waitForUpdate(true); // queue the transition to project page
        } else {
            waitForUpdate(false); // immediately transition to project page
        }
    }
    handleClickShare (waitForUpdate) {
        if (!this.props.isShared) {
            if (this.props.canShare) { // save before transitioning to project page
                this.props.onShare();
            }
            if (this.props.canSave) { // save before transitioning to project page
                this.props.autoUpdateProject();
                waitForUpdate(true); // queue the transition to project page
            } else {
                waitForUpdate(false); // immediately transition to project page
            }
        }
    }
    handleSetMode (mode) {
        return () => {
            // Turn on/off filters for modes.
            if (mode === '1920') {
                document.documentElement.style.filter = 'brightness(.9)contrast(.8)sepia(1.0)';
                document.documentElement.style.height = '100%';
            } else if (mode === '1990') {
                document.documentElement.style.filter = 'hue-rotate(40deg)';
                document.documentElement.style.height = '100%';
            } else {
                document.documentElement.style.filter = '';
                document.documentElement.style.height = '';
            }

            // === Smalruby: Start of remove time-travel logo switching ===
            // Upstream switches logo_img.src per mode here.
            // Smalruby always uses the same logo, so this is removed.
            // === Smalruby: End of remove time-travel logo switching ===

            this.props.onSetTimeTravelMode(mode);
        };
    }
    handleRestoreOption (restoreFun) {
        return () => {
            restoreFun();
        };
    }
    handleKeyPress (event) {
        const modifier = bowser.mac ? event.metaKey : event.ctrlKey;
        if (modifier && event.key === 's') {
            this.props.onClickSave();
            event.preventDefault();
        }
    }
    getSaveToComputerHandler (downloadProjectCallback) {
        return () => {
            downloadProjectCallback();
            if (this.props.onProjectTelemetryEvent) {
                const metadata = collectMetadata(this.props.vm, this.props.projectTitle, this.props.locale);
                this.props.onProjectTelemetryEvent('projectDidSave', metadata);
            }
        };
    }
    getSaveAIHandler (downloadProjectCallback) {
        return () => {
            // Set AI save status to 'saving'
            this.props.onSetAiSaveStatus('saving');
            // Call download callback
            downloadProjectCallback();
        };
    }
    handleAISaveFinished () {
        // Set AI save status to 'saved'
        this.props.onSetAiSaveStatus('saved');
        // Clear status after 3 seconds
        setTimeout(() => {
            this.props.onClearAiSaveStatus();
        }, 3000);
    }
    handleClickKoshienEntryForm () {
        window.open('https://smalruby-koshien.netlab.jp/entry-form.html', '_blank', 'noopener,noreferrer');
    }
    handleClickTutorials () {
        if (this.props.showTutorialTooltip) {
            // First-time user: activate tutorial directly
            this.props.onActivateTutorial();
        } else {
            // Returning user: open tips library
            this.props.onOpenTipsLibrary();
        }
    }
    getSaveAIAsHandler (downloadProjectCallback) {
        return () => {
            // Set AI save status to 'saving'
            this.props.onSetAiSaveStatus('saving');
            // Call download callback
            downloadProjectCallback();
        };
    }
    getTestAIHandler (downloadProjectCallback) {
        return () => {
            // Save first, then open modal via onSaveFinished callback
            this.props.onSetAiSaveStatus('saving');
            downloadProjectCallback();
        };
    }
    handleTestAISaveFinished () {
        this.handleAISaveFinished();
        this.props.onOpenKoshienTestModal();
    }
    handleAISaveAsFinished () {
        // Set AI save status to 'saved'
        this.props.onSetAiSaveStatus('saved');
        // Clear status after 3 seconds
        setTimeout(() => {
            this.props.onClearAiSaveStatus();
        }, 3000);
    }
    handleAISaveError () {
        // Clear AI save status
        this.props.onClearAiSaveStatus();
    }
    handleConversionError (errors) {
        this.props.onActivateRubyTab();
        this.props.onShowConvertRubyToBlocksErrorAlert();
        this.props.onUpdateRubyCodeErrors(errors);
    }
    handleClickLoadFromUrl () {
        if (this.props.onStartSelectingUrlLoad) {
            this.props.onStartSelectingUrlLoad();
        }
    }
    handleSaveDirectlyToGoogleDrive () {
        this.props.onSaveDirectlyToGoogleDrive(true);
    }
    handleClickGenerateRubyFromCode () {
        this.props.updateRubyCodeTargetState(this.props.vm.editingTarget);
    }
    handleExtensionAdded () {
        // Dispatch Redux action to trigger re-render
        if (this.props.onExtensionLoaded) {
            this.props.onExtensionLoaded();
        }
    }
    handleMeshV2MenuClick () {
        // Open connection modal
        this.props.onOpenConnectionModal('meshV2');
    }
    // === Smalruby: Start of smalrubot firmware menu ===
    handleSmalrubotS1FirmwareFlash () {
        this.props.onRequestCloseSmalrubotS1();
        // Opening firmware modal automatically closes connection modal
        // via cross-reducer in modals.js
        this.props.onOpenSmalrubotFirmwareModal();
    }
    // === Smalruby: End of smalrubot firmware menu ===
    syncMeshV2Domain () {
        const extension = this.props.vm && this.props.vm.runtime &&
            this.props.vm.runtime.peripheralExtensions &&
            this.props.vm.runtime.peripheralExtensions.meshV2;
        if (extension && extension.domain !== this.props.meshV2Domain) {
            if (this.props.onSetMeshV2Domain) {
                this.props.onSetMeshV2Domain(extension.domain);
            }
        }
    }
    getMeshV2Status () {
        const vm = this.props.vm;

        if (!vm) return {loaded: false};

        // In Smalruby 3 / Scratch 3, extensionManager is directly on the vm instance
        const extensionManager = vm.extensionManager;
        if (!extensionManager) {
            return {loaded: false};
        }

        const isLoaded = extensionManager.isExtensionLoaded('meshV2');

        if (!isLoaded) {
            return {loaded: false};
        }

        // peripheralExtensions is on vm.runtime
        const runtime = vm.runtime;
        if (!runtime || !runtime.peripheralExtensions) {
            return {loaded: true, connected: false};
        }

        const extension = runtime.peripheralExtensions.meshV2;

        if (!extension) {
            return {loaded: true, connected: false};
        }

        const connected = extension.connectionState === 'connected';
        const message = extension.menuMessage();

        return {
            loaded: true,
            connected: connected,
            message: message,
            icon: connected ? meshConnectedIcon : meshDisconnectedIcon
        };
    }
    restoreOptionMessage (deletedItem) {
        switch (deletedItem) {
        case 'Sprite':
            return (<FormattedMessage
                defaultMessage="Restore Sprite"
                description="Menu bar item for restoring the last deleted sprite."
                id="gui.menuBar.restoreSprite"
            />);
        case 'Sound':
            return (<FormattedMessage
                defaultMessage="Restore Sound"
                description="Menu bar item for restoring the last deleted sound."
                id="gui.menuBar.restoreSound"
            />);
        case 'Costume':
            return (<FormattedMessage
                defaultMessage="Restore Costume"
                description="Menu bar item for restoring the last deleted costume."
                id="gui.menuBar.restoreCostume"
            />);
        default: {
            return (<FormattedMessage
                defaultMessage="Restore"
                description="Menu bar item for restoring the last deleted item in its disabled state."  
                id="gui.menuBar.restore"
            />);
        }
        }
    }
    buildAboutMenu (onClickAbout) {
        if (!onClickAbout) {
            // hide the button
            return null;
        }
        if (typeof onClickAbout === 'function') {
            // make a button which calls a function
            return <AboutButton onClick={onClickAbout} />;
        }
        // assume it's an array of objects
        // each item must have a 'title' FormattedMessage and a 'handleClick' function
        // generate a menu with items for each object in the array
        return (
            <div
                className={classNames(styles.menuBarItem, styles.hoverable, {
                    [styles.active]: this.props.aboutMenuOpen
                })}
                onClick={this.props.onRequestOpenAbout}
            >
                <img
                    className={styles.aboutIcon}
                    src={aboutIcon}
                />
                <MenuBarMenu
                    className={classNames(styles.menuBarMenu)}
                    open={this.props.aboutMenuOpen}
                    place={this.props.isRtl ? 'right' : 'left'}
                    onRequestClose={this.props.onRequestCloseAbout}
                >
                    {
                        onClickAbout.map(itemProps => (
                            <MenuItem
                                key={itemProps.title}
                                isRtl={this.props.isRtl}
                                onClick={this.wrapAboutMenuCallback(itemProps.onClick)}
                            >
                                {itemProps.title}
                            </MenuItem>
                        ))
                    }
                </MenuBarMenu>
            </div>
        );
    }
    wrapAboutMenuCallback (callback) {
        return () => {
            callback();
        };
    }
    render () {
        const saveNowMessage = (
            <FormattedMessage
                defaultMessage="Save now"
                description="Menu bar item for saving now"
                id="gui.menuBar.saveNow"
            />
        );
        const createCopyMessage = (
            <FormattedMessage
                defaultMessage="Save as a copy"
                description="Menu bar item for saving as a copy"
                id="gui.menuBar.saveAsCopy"
            />
        );
        const remixMessage = (
            <FormattedMessage
                defaultMessage="Remix"
                description="Menu bar item for remixing"
                id="gui.menuBar.remix"
            />
        );
        const newProjectMessage = (
            <FormattedMessage
                defaultMessage="New"
                description="Menu bar item for creating a new project"
                id="gui.menuBar.new"
            />
        );
        const generateRubyFromCodeMessage = (
            <FormattedMessage
                defaultMessage="Generate Ruby from Code"
                description="Menu bar item for generating ruby from code"
                id="gui.smalruby3.menuBar.generateRubyFromCode"
            />
        );
        const remixButton = (
            <Button
                className={classNames(
                    styles.menuBarButton,
                    styles.remixButton
                )}
                iconClassName={styles.remixButtonIcon}
                iconSrc={remixIcon}
                onClick={this.handleClickRemix}
            >
                {remixMessage}
            </Button>
        );
        // Show the About button only if we have a handler for it (like in the desktop app)
        const aboutButton = this.buildAboutMenu(this.props.onClickAbout);

        const menuOpts = this.props.accountMenuOptions;

        return (
            <Box
                className={classNames(
                    this.props.className,
                    styles.menuBar
                )}
                aria-label={this.props.ariaLabel}
                role={this.props.ariaRole}
                element="header"
            >
                <div className={styles.mainMenu}>
                    <div className={styles.fileGroup}>
                        {/* === Smalruby: Start of version update notification UI === */}
                        <div className={classNames(styles.menuBarItem)}>
                            <img
                                id="logo_img"
                                alt="Smalruby"
                                className={classNames(styles.scratchLogo, {
                                    [styles.clickable]: typeof this.props.onClickLogo !== 'undefined' ||
                                        this.state.updateAvailable
                                })}
                                draggable={false}
                                src={this.state.updateAvailable ? hattiGreeting : this.props.logo}
                                onClick={this.state.updateAvailable ?
                                    this.handleUpdateNotificationClick :
                                    this.props.onClickLogo}
                            />
                            {this.state.updateAvailable && (
                                <div
                                    className={styles.updateTooltip}
                                    onClick={this.handleUpdateNotificationClick}
                                >
                                    <div className={styles.updateTooltipArrow} />
                                    <div className={styles.updateTooltipContent}>
                                        <FormattedMessage
                                            {...updateMessages.updateTooltip}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* === Smalruby: End of version update notification UI === */}
                        {(this.props.canChangeColorMode || this.props.canChangeLanguage || this.props.canChangeTheme) &&
                        (<SettingsMenu
                            canChangeLanguage={this.props.canChangeLanguage}
                            canChangeColorMode={this.props.canChangeColorMode}
                            canChangeTheme={this.props.canChangeTheme}
                            hasActiveMembership={this.props.hasActiveMembership}
                            isRtl={this.props.isRtl}
                            onRequestClose={this.props.onRequestCloseSettings}
                            onRequestOpen={this.props.onClickSettings}
                            onOpenBlockDisplayModal={this.props.onOpenBlockDisplayModal}
                            settingsMenuOpen={this.props.settingsMenuOpen}
                        />)}
                        {(this.props.canManageFiles) && (
                            <div
                                className={classNames(styles.menuBarItem, styles.hoverable, {
                                    [styles.active]: this.props.fileMenuOpen
                                })}
                                onClick={this.props.onClickFile}
                            >
                                <img src={fileIcon} />
                                <span className={styles.collapsibleLabel}>
                                    <FormattedMessage
                                        defaultMessage="File"
                                        description="Text for file dropdown menu"
                                        id="gui.menuBar.file"
                                    />
                                </span>
                                <img src={dropdownCaret} />
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.fileMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                    onRequestClose={this.props.onRequestCloseFile}
                                >
                                    <MenuSection>
                                        <MenuItem
                                            isRtl={this.props.isRtl}
                                            onClick={this.handleClickNew}
                                        >
                                            {newProjectMessage}
                                        </MenuItem>
                                    </MenuSection>
                                    {(this.props.canSave || this.props.canCreateCopy || this.props.canRemix) && (
                                        <MenuSection>
                                            {this.props.canSave && (
                                                <MenuItem onClick={this.handleClickSave}>
                                                    {saveNowMessage}
                                                </MenuItem>
                                            )}
                                            {this.props.canCreateCopy && (
                                                <MenuItem onClick={this.handleClickSaveAsCopy}>
                                                    {createCopyMessage}
                                                </MenuItem>
                                            )}
                                            {this.props.canRemix && (
                                                <MenuItem onClick={this.handleClickRemix}>
                                                    {remixMessage}
                                                </MenuItem>
                                            )}
                                        </MenuSection>
                                    )}
                                    <MenuSection>
                                        <MenuItem
                                            onClick={this.props.onStartSelectingFileUpload}
                                        >
                                            {this.props.intl.formatMessage(sharedMessages.loadFromComputerTitle)}
                                        </MenuItem>
                                        <SB3Downloader>{(className, downloadProjectCallback) => (
                                            <MenuItem
                                                className={className}
                                                onClick={this.getSaveToComputerHandler(downloadProjectCallback)}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Save to your computer"
                                                    description="Menu bar item for downloading a project to your computer"  
                                                    id="gui.menuBar.downloadToComputer"
                                                />
                                            </MenuItem>
                                        )}</SB3Downloader>
                                    </MenuSection>
                                    <MenuSection>
                                        <MenuItem
                                            onClick={this.handleClickLoadFromUrl}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Load from Scratch"
                                                description="Menu bar item for loading from Scratch"
                                                id="gui.menuBar.loadFromUrl"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                    <MenuSection>
                                        <MenuItem
                                            onClick={this.props.onStartSelectingGoogleDrive}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Load from Google Drive"
                                                description="Menu bar item for loading from Google Drive"
                                                id="gui.menuBar.loadFromGoogleDrive"
                                            />
                                        </MenuItem>
                                        <MenuItem
                                            className={classNames({[styles.disabled]: !this.props.isGoogleDriveFile})}
                                            onClick={this.props.onSaveDirectlyToGoogleDrive}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Save directly to Google Drive"
                                                description="Menu bar item for direct save to current Google Drive file"
                                                id="gui.menuBar.saveDirectlyToGoogleDrive"
                                            />
                                        </MenuItem>
                                        <MenuItem
                                            onClick={this.props.onStartSavingToGoogleDrive}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Save a copy to Google Drive..."
                                                description="Menu bar item for saving a copy to Google Drive"
                                                id="gui.menuBar.saveToGoogleDrive"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                </MenuBarMenu>
                            </div>
                        )}
                        <div
                            className={classNames(styles.menuBarItem, styles.hoverable, {
                                [styles.active]: this.props.editMenuOpen
                            })}
                            onClick={this.props.onClickEdit}
                        >
                            <img src={editIcon} />
                            <span className={styles.collapsibleLabel}>
                                <FormattedMessage
                                    defaultMessage="Edit"
                                    description="Text for edit dropdown menu"
                                    id="gui.menuBar.edit"
                                />
                            </span>
                            <img src={dropdownCaret} />
                            <MenuBarMenu
                                className={classNames(styles.menuBarMenu)}
                                open={this.props.editMenuOpen}
                                place={this.props.isRtl ? 'left' : 'right'}
                                onRequestClose={this.props.onRequestCloseEdit}
                            >
                                <DeletionRestorer>{(handleRestore, {restorable, deletedItem}) => (
                                    <MenuItem
                                        className={classNames({[styles.disabled]: !restorable})}
                                        onClick={this.handleRestoreOption(handleRestore)}
                                    >
                                        {this.restoreOptionMessage(deletedItem)}
                                    </MenuItem>
                                )}</DeletionRestorer>
                                <MenuSection>
                                    <TurboMode>{(toggleTurboMode, {turboMode}) => (
                                        <MenuItem
                                            closeOnClick={false}
                                            onClick={toggleTurboMode}
                                        >
                                            {turboMode ? (
                                                <FormattedMessage
                                                    defaultMessage="Turn off Turbo Mode"
                                                    description="Menu bar item for turning off turbo mode"
                                                    id="gui.menuBar.turboModeOff"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Turn on Turbo Mode"
                                                    description="Menu bar item for turning on turbo mode"
                                                    id="gui.menuBar.turboModeOn"
                                                />
                                            )}
                                        </MenuItem>
                                    )}</TurboMode>
                                </MenuSection>
                                <MenuSection>
                                    <MenuItem
                                        isRtl={this.props.isRtl}
                                        onClick={this.handleClickGenerateRubyFromCode}
                                    >
                                        {generateRubyFromCodeMessage}
                                    </MenuItem>
                                </MenuSection>
                            </MenuBarMenu>

                        </div>
                        {this.props.isTotallyNormal && (
                            <div
                                className={classNames(styles.menuBarItem, styles.hoverable, {
                                    [styles.active]: this.props.modeMenuOpen
                                })}
                                onClick={this.props.onClickMode}
                            >
                                <div className={classNames(styles.editMenu)}>
                                    <FormattedMessage
                                        defaultMessage="Mode"
                                        description="Mode menu item in the menu bar"
                                        id="gui.menuBar.modeMenu"
                                    />
                                </div>
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.modeMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                    onRequestClose={this.props.onRequestCloseMode}
                                >
                                    <MenuSection>
                                        <MenuItem onClick={this.handleSetMode('NOW')}>
                                            <span className={classNames({[styles.inactive]: !this.props.modeNow})}>
                                                {'✓'}
                                            </span>
                                            {' '}
                                            <FormattedMessage
                                                defaultMessage="Normal mode"
                                                description="April fools: resets editor to not have any pranks"
                                                id="gui.menuBar.normalMode"
                                            />
                                        </MenuItem>
                                        <MenuItem onClick={this.handleSetMode('2020')}>
                                            <span className={classNames({[styles.inactive]: !this.props.mode2020})}>
                                                {'✓'}
                                            </span>
                                            {' '}
                                            <FormattedMessage
                                                defaultMessage="Caturday mode"
                                                description="April fools: Cat blocks mode"
                                                id="gui.menuBar.caturdayMode"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                </MenuBarMenu>
                            </div>
                        )}
                    </div>
                    {this.props.canEditTitle ? (
                        <div className={classNames(styles.menuBarItem, styles.growable)}>
                            <MenuBarItemTooltip
                                enable
                                id="title-field"
                            >
                                <ProjectTitleInput
                                    className={classNames(styles.titleFieldGrowable)}
                                />
                            </MenuBarItemTooltip>
                        </div>
                    ) : ((this.props.authorUsername && this.props.authorUsername !== this.props.username) ? (
                        <AuthorInfo
                            className={styles.authorInfo}
                            imageUrl={this.props.authorThumbnailUrl}
                            projectTitle={this.props.projectTitle}
                            userId={this.props.authorId}
                            username={this.props.authorUsername}
                            avatarBadge={this.props.authorAvatarBadge}
                        />
                    ) : null)}
                    <div className={classNames(styles.menuBarItem)}>
                        {this.props.canShare ? (
                            (this.props.isShowingProject || this.props.isUpdating) && (
                                <ProjectWatcher onDoneUpdating={this.props.onSeeCommunity}>
                                    {
                                        waitForUpdate => (
                                            <ShareButton
                                                className={styles.menuBarButton}
                                                isShared={this.props.isShared}
                                                /* eslint-disable react/jsx-no-bind */
                                                onClick={() => {
                                                    this.handleClickShare(waitForUpdate);
                                                }}
                                                /* eslint-enable react/jsx-no-bind */
                                            />
                                        )
                                    }
                                </ProjectWatcher>
                            )
                        ) : (
                            this.props.showComingSoon ? (
                                <MenuBarItemTooltip id="share-button">
                                    <ShareButton className={styles.menuBarButton} />
                                </MenuBarItemTooltip>
                            ) : []
                        )}
                        {this.props.canRemix ? remixButton : []}
                    </div>
                    <div className={classNames(styles.menuBarItem, styles.communityButtonWrapper)}>
                        {this.props.enableCommunity ? (
                            (this.props.isShowingProject || this.props.isUpdating) && (
                                <ProjectWatcher onDoneUpdating={this.props.onSeeCommunity}>
                                    {
                                        waitForUpdate => (
                                            <CommunityButton
                                                className={styles.menuBarButton}
                                                /* eslint-disable react/jsx-no-bind */
                                                onClick={() => {
                                                    this.handleClickSeeCommunity(waitForUpdate);
                                                }}
                                                /* eslint-enable react/jsx-no-bind */
                                            />
                                        )
                                    }
                                </ProjectWatcher>
                            )
                        ) : (this.props.showComingSoon ? (
                            <MenuBarItemTooltip id="community-button">
                                <CommunityButton className={styles.menuBarButton} />
                            </MenuBarItemTooltip>
                        ) : [])}
                    </div>
                    <Divider className={classNames(styles.divider)} />
                    <div className={styles.fileGroup}>
                        <div
                            className={styles.tutorialButtonWrapper}
                        >
                            <div
                                aria-label={this.props.intl.formatMessage(ariaMessages.tutorials)}
                                className={classNames(styles.menuBarItem, styles.noOffset, styles.hoverable)}
                                onClick={this.handleClickTutorials}
                            >
                                <img
                                    className={styles.helpIcon}
                                    src={helpIcon}
                                />
                                <span className={styles.learnLabel}>
                                    <FormattedMessage {...ariaMessages.tutorials} />
                                </span>
                            </div>
                            {this.props.showTutorialTooltip ? (
                                <TutorialTooltip onClick={this.handleClickTutorials} />
                            ) : null}
                        </div>
                        <div
                            aria-label={this.props.intl.formatMessage(ariaMessages.debug)}
                            className={classNames(styles.menuBarItem, styles.noOffset, styles.hoverable)}
                            onClick={this.props.onOpenDebugModal}
                        >
                            <img
                                className={styles.helpIcon}
                                src={debugIcon}
                            />
                            <span className={styles.debugLabel}>
                                <FormattedMessage {...ariaMessages.debug} />
                            </span>
                        </div>
                    </div>
                    <Divider className={classNames(styles.divider)} />
                    <div className={styles.fileGroup}>
                        {(() => {
                            const meshV2Status = this.getMeshV2Status();
                            if (!meshV2Status.loaded) return null;

                            return (
                                <div
                                    className={classNames(styles.menuBarItem, styles.noOffset, styles.hoverable, {
                                        [styles.active]: this.props.meshV2MenuOpen
                                    })}
                                    onClick={this.props.onClickMeshV2}
                                >
                                    <img
                                        className={styles.meshIcon}
                                        src={meshV2Status.icon}
                                    />
                                    <span className={styles.collapsibleLabel}>
                                        <FormattedMessage
                                            defaultMessage="Mesh"
                                            description="Label for Mesh V2 menu"
                                            id="gui.menuBar.meshV2"
                                        />
                                    </span>
                                    <img src={dropdownCaret} />
                                    <MenuBarMenu
                                        className={classNames(styles.menuBarMenu)}
                                        open={this.props.meshV2MenuOpen}
                                        place={this.props.isRtl ? 'left' : 'right'}
                                        onRequestClose={this.props.onRequestCloseMeshV2}
                                    >
                                        <MenuSection>
                                            <MenuItem onClick={this.handleMeshV2MenuClick}>
                                                {typeof meshV2Status.message === 'object' ? (
                                                    <div className={styles.meshV2StatusMultiline}>
                                                        <div className={styles.meshV2StatusLine}>
                                                            <FormattedMessage
                                                                id="mesh.domainLabel"
                                                                defaultMessage="Domain: {domain}"
                                                                description="Label for mesh domain in menu"
                                                                values={{
                                                                    domain: <span className={styles.meshV2Domain}>
                                                                        {meshV2Status.message.domain}
                                                                    </span>
                                                                }}
                                                            />
                                                        </div>
                                                        <div className={styles.meshV2StatusLine}>
                                                            <FormattedMessage
                                                                id="mesh.groupLabel"
                                                                defaultMessage="Group: {group}"
                                                                description="Label for mesh group in menu"
                                                                values={{group: meshV2Status.message.group}}
                                                            />
                                                        </div>
                                                        {meshV2Status.message.expiresAt && (
                                                            <div className={styles.meshV2StatusLine}>
                                                                <FormattedMessage
                                                                    id="mesh.expiresLabel"
                                                                    defaultMessage="Expires: {time}"
                                                                    description="Label for mesh expiration time in menu"
                                                                    values={{time: meshV2Status.message.expiresAt}}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    meshV2Status.message
                                                )}
                                            </MenuItem>
                                        </MenuSection>
                                    </MenuBarMenu>
                                </div>
                            );
                        })()}
                        {/* === Smalruby: Start of smalrubot firmware menu === */}
                        {(() => {
                            const vm = this.props.vm;
                            if (!vm || !vm.extensionManager ||
                                !vm.extensionManager.isExtensionLoaded('smalrubotS1')) {
                                return null;
                            }
                            if (!isFirmwareFlashSupported()) return null;
                            return (
                                <div
                                    className={classNames(
                                        styles.menuBarItem, styles.noOffset, styles.hoverable, {
                                            [styles.active]: this.props.smalrubotS1MenuOpen
                                        })}
                                    data-testid="menu-smalrubot-s1"
                                    onClick={this.props.onClickSmalrubotS1}
                                >
                                    <span className={styles.collapsibleLabel}>
                                        <FormattedMessage
                                            defaultMessage="SmalrubotS1"
                                            description="Label for SmalrubotS1 menu in menu bar"
                                            id="gui.menuBar.smalrubotS1"
                                        />
                                    </span>
                                    <img src={dropdownCaret} />
                                    <MenuBarMenu
                                        className={classNames(styles.menuBarMenu)}
                                        open={this.props.smalrubotS1MenuOpen}
                                        place={this.props.isRtl ? 'left' : 'right'}
                                        onRequestClose={this.props.onRequestCloseSmalrubotS1}
                                    >
                                        <MenuSection>
                                            <MenuItem
                                                data-testid="menu-smalrubot-s1-flash-firmware"
                                                onClick={this.handleSmalrubotS1FirmwareFlash}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Write Firmware"
                                                    description="Menu item to flash firmware to SmalrubotS1"
                                                    id="gui.menuBar.smalrubotS1.flashFirmware"
                                                />
                                            </MenuItem>
                                        </MenuSection>
                                    </MenuBarMenu>
                                </div>
                            );
                        })()}
                        {/* === Smalruby: End of smalrubot firmware menu === */}
                        {/* === Smalruby: Start of classroom button === */}
                        {isClassroomConfigured() && getUrlParams().features.includes('classroom') && (
                            <React.Fragment>
                                <div
                                    className={classNames(styles.menuBarItem, styles.hoverable)}
                                    data-testid="classroom-menu-button"
                                    onClick={this.props.onOpenClassroomModal}
                                >
                                    <span data-testid="classroom-menu-label">
                                        {this.props.classroomClassName ? (
                                            <React.Fragment>
                                                <span data-testid="classroom-menu-class-name">
                                                    {this.props.classroomClassName}
                                                </span>
                                                {this.props.classroomSeatNumber && (
                                                    <React.Fragment>
                                                        {' / '}
                                                        <span data-testid="classroom-menu-seat-number">
                                                            {this.props.classroomSeatNumber}
                                                        </span>
                                                    </React.Fragment>
                                                )}
                                            </React.Fragment>
                                        ) : (
                                            <FormattedMessage
                                                defaultMessage="Classroom"
                                                description="Menu bar button for classroom feature"
                                                id="gui.menuBar.classroom"
                                            />
                                        )}
                                    </span>
                                </div>
                            </React.Fragment>
                        )}
                        {/* === Smalruby: End of classroom button === */}
                        {this.props.vm.extensionManager &&
                            this.props.vm.extensionManager.isExtensionLoaded('koshien') && (
                            <div
                                className={classNames(styles.menuBarItem, styles.noOffset, styles.hoverable, {
                                    [styles.active]: this.props.koshienMenuOpen
                                })}
                                onClick={this.props.onClickKoshien}
                            >
                                <img
                                    className={styles.helpIcon}
                                    height="20"
                                    src={koshienIcon}
                                    width="20"
                                />
                                <span className={styles.collapsibleLabel}>
                                    <FormattedMessage
                                        defaultMessage="Smalruby Koshien"
                                        description="Koshien menu item in the menu bar"
                                        id="gui.menuBar.koshienMenu"
                                    />
                                </span>
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.koshienMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                    onRequestClose={this.props.onRequestCloseKoshien}
                                >
                                    <MenuSection>
                                        <RubyDownloader
                                            onConversionError={this.handleConversionError}
                                            onSaveError={this.handleAISaveError}
                                            onSaveFinished={this.handleAISaveFinished}
                                        >
                                            {(className, downloadProjectCallback) => (
                                                <MenuItem
                                                    className={className}
                                                    onClick={this.getSaveAIHandler(downloadProjectCallback)}
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Save AI"
                                                        description="Menu bar item for saving AI"
                                                        id="gui.menuBar.saveAI"
                                                    />
                                                </MenuItem>
                                            )}
                                        </RubyDownloader>
                                        <RubyDownloader
                                            forceFilePicker
                                            onConversionError={this.handleConversionError}
                                            onSaveError={this.handleAISaveError}
                                            onSaveFinished={this.handleAISaveAsFinished}
                                        >
                                            {(className, downloadProjectCallback) => (
                                                <MenuItem
                                                    className={className}
                                                    onClick={this.getSaveAIAsHandler(downloadProjectCallback)}
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Save AI as..."
                                                        description="Menu bar item for saving AI as a new file"
                                                        id="gui.menuBar.saveAIAs"
                                                    />
                                                </MenuItem>
                                            )}
                                        </RubyDownloader>
                                    </MenuSection>
                                    <MenuSection>
                                        <RubyDownloader
                                            onConversionError={this.handleConversionError}
                                            onSaveError={this.handleAISaveError}
                                            onSaveFinished={this.handleTestAISaveFinished}
                                        >
                                            {(className, downloadProjectCallback) => (
                                                <MenuItem
                                                    className={className}
                                                    onClick={this.getTestAIHandler(downloadProjectCallback)}
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Test AI"
                                                        description="Menu bar item for testing AI"
                                                        id="gui.menuBar.testAI"
                                                    />
                                                </MenuItem>
                                            )}
                                        </RubyDownloader>
                                    </MenuSection>
                                    <MenuSection>
                                        <MenuItem
                                            onClick={this.handleClickKoshienEntryForm}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Entry Form"
                                                description="Menu bar item for Smalruby Koshien entry form"
                                                id="gui.menuBar.koshienEntryForm"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                </MenuBarMenu>
                            </div>
                        )}
                    </div>
                </div>

                {/* show the proper UI in the account menu, given whether the user is
                logged in, and whether a session is available to log in with */}
                <div className={styles.accountInfoGroup}>
                    <div className={styles.menuBarItem}>
                        {this.props.canSave && (
                            <SaveStatus />
                        )}
                    </div>
                    {this.props.googleDriveSaveStatus === 'saving' && (
                        <div className={styles.saveStatus}>
                            <Spinner
                                className={styles.saveStatusSpinner}
                                level="info"
                                small
                            />
                            <FormattedMessage
                                defaultMessage="Saving project..."
                                id="gui.menuBar.savingToGoogleDrive"
                            />
                        </div>
                    )}
                    {this.props.googleDriveSaveStatus === 'saved' && (
                        <div className={styles.saveStatus}>
                            <FormattedMessage
                                defaultMessage="Project saved."
                                id="gui.menuBar.savedToGoogleDrive"
                            />
                        </div>
                    )}
                    {/* === Smalruby: Start of improved auth_error UX === */}
                    {this.props.googleDriveFile &&
                        this.props.googleDriveFile.isGoogleDriveFile &&
                        this.props.projectChanged &&
                        this.props.googleDriveSaveDirectStatus !== 'saving' &&
                        this.props.googleDriveSaveDirectStatus !== 'saved' && (
                        <div className={styles.saveStatus}>
                            <Button
                                className={classNames(
                                    styles.saveDirectlyButton,
                                    {[styles.saveDirectlyButtonAuthError]:
                                        this.props.googleDriveSaveDirectStatus === 'auth_error'}
                                )}
                                title={this.props.googleDriveSaveDirectStatus === 'auth_error' ?
                                    this.props.intl.formatMessage({
                                        id: 'gui.menuBar.authExpired',
                                        defaultMessage: 'Authentication expired. Click to re-authenticate and save.'
                                    }) :
                                    null
                                }
                                onClick={this.handleSaveDirectlyToGoogleDrive}
                            >
                                {this.props.googleDriveSaveDirectStatus === 'auth_error' ? (
                                    <FormattedMessage
                                        defaultMessage="Re-authenticate & Save"
                                        id="gui.menuBar.reAuthAndSaveButton"
                                    />
                                ) : (
                                    <FormattedMessage
                                        defaultMessage="Save directly"
                                        id="gui.menuBar.saveDirectlyButton"
                                    />
                                )}
                            </Button>
                        </div>
                    )}
                    {/* === Smalruby: End of improved auth_error UX === */}
                    {this.props.googleDriveSaveDirectStatus === 'saving' && (
                        <div className={styles.saveStatus}>
                            <Spinner
                                className={styles.saveStatusSpinner}
                                level="info"
                                small
                            />
                            <FormattedMessage
                                defaultMessage="Saving project..."
                                id="gui.menuBar.savingToGoogleDrive"
                            />
                        </div>
                    )}
                    {this.props.googleDriveSaveDirectStatus === 'saved' && (
                        <div className={styles.saveStatus}>
                            <FormattedMessage
                                defaultMessage="Project saved."
                                id="gui.menuBar.savedToGoogleDrive"
                            />
                        </div>
                    )}
                    {this.props.aiSaveStatus === 'saving' && (
                        <div className={styles.saveStatus}>
                            <Spinner
                                className={styles.saveStatusSpinner}
                                level="info"
                                small
                            />
                            <FormattedMessage
                                defaultMessage="Saving AI..."
                                id="gui.menuBar.aiSaving"
                            />
                        </div>
                    )}
                    {this.props.aiSaveStatus === 'saved' && (
                        <div className={styles.saveStatus}>
                            <FormattedMessage
                                defaultMessage="AI saved."
                                id="gui.menuBar.aiSaved"
                            />
                        </div>
                    )}

                    {menuOpts.canHaveSession ? (
                        this.props.username ? (
                            // ************ user is logged in ************
                            <React.Fragment>
                                {menuOpts.myStuffUrl ? (
                                    <a href={menuOpts.myStuffUrl}>
                                        <div
                                            className={classNames(
                                                styles.menuBarItem,
                                                styles.hoverable,
                                                styles.mystuffButton
                                            )}
                                        >
                                            <img
                                                className={styles.mystuffIcon}
                                                src={mystuffIcon}
                                            />
                                        </div>
                                    </a>
                                ) : null}

                                <AccountNav
                                    className={classNames(
                                        styles.menuBarItem,
                                        styles.hoverable,
                                        {[styles.active]: this.props.accountMenuOpen}
                                    )}

                                    isOpen={this.props.accountMenuOpen}
                                    isRtl={this.props.isRtl}

                                    menuBarMenuClassName={classNames(styles.menuBarMenu)}

                                    onClick={this.props.onClickAccount}
                                    onClose={this.props.onRequestCloseAccount}
                                    onLogOut={menuOpts.canLogout ? this.props.onLogOut : null}

                                    username={this.props.username}
                                    avatarBadge={this.props.avatarBadge}

                                    avatarUrl={menuOpts.avatarUrl}
                                    myStuffUrl={menuOpts.myStuffUrl}
                                    profileUrl={menuOpts.profileUrl}
                                    myClassesUrl={menuOpts.myClassesUrl}
                                    myClassUrl={menuOpts.myClassUrl}
                                    accountSettingsUrl={menuOpts.accountSettingsUrl}
                                />
                            </React.Fragment>
                        ) : (
                            // ********* user not logged in, but a session exists
                            // ********* so they can choose to log in
                            <React.Fragment>
                                {menuOpts.canRegister ? (
                                    <div
                                        className={classNames(
                                            styles.menuBarItem,
                                            styles.hoverable
                                        )}
                                        key="join"
                                        onClick={this.props.onOpenRegistration}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Join Scratch"
                                            description="Link for creating a Scratch account"
                                            id="gui.menuBar.joinScratch"
                                        />
                                    </div>
                                ) : null}

                                {menuOpts.canLogin ? (
                                    <div
                                        className={classNames(
                                            styles.menuBarItem,
                                            styles.hoverable
                                        )}
                                        key="login"
                                        onMouseUp={this.props.onClickLogin}
                                        onClick={this.props.onClickLogin}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Sign in"
                                            description="Link for signing in to your Scratch account"
                                            id="gui.menuBar.signIn"
                                        />
                                        <LoginDropdown
                                            className={classNames(styles.menuBarMenu)}
                                            isOpen={this.props.loginMenuOpen}
                                            isRtl={this.props.isRtl}
                                            renderLogin={this.props.renderLogin}
                                            onClose={this.props.onRequestCloseLogin}
                                        />
                                    </div>
                                ) : null}
                            </React.Fragment>
                        )
                    ) : (
                        // ******** no login session is available, so don't show login stuff
                        <React.Fragment>
                            {this.props.showComingSoon ? (
                                <React.Fragment>
                                    <MenuBarItemTooltip id="mystuff">
                                        <div
                                            className={classNames(
                                                styles.menuBarItem,
                                                styles.hoverable,
                                                styles.mystuffButton
                                            )}
                                        >
                                            <img
                                                className={styles.mystuffIcon}
                                                src={mystuffIcon}
                                            />
                                        </div>
                                    </MenuBarItemTooltip>
                                    <MenuBarItemTooltip
                                        id="account-nav"
                                        place={this.props.isRtl ? 'right' : 'left'}
                                    >
                                        <div
                                            className={classNames(
                                                styles.menuBarItem,
                                                styles.hoverable,
                                                styles.accountNavMenu
                                            )}
                                        >
                                            <img
                                                className={styles.profileIcon}
                                                src={profileIcon}
                                            />
                                            <span>
                                                {'smalruby-hatti'}
                                            </span>
                                            <img
                                                className={styles.dropdownCaretIcon}
                                                src={dropdownCaret}
                                            />
                                        </div>
                                    </MenuBarItemTooltip>
                                </React.Fragment>
                            ) : []}
                        </React.Fragment>
                    )}
                </div>

                {aboutButton}

                {/* Google Drive Save Dialog */}
                <GoogleDriveSaveDialog
                    defaultFilename={this.props.projectFilename}
                    isVisible={this.props.googleDriveSaveDialogVisible}
                    locale={this.props.locale}
                    onCancel={this.props.onCancelGoogleDriveSave}
                    onSave={this.props.onSaveToGoogleDrive}
                />
            </Box>
        );
    }
}

MenuBar.propTypes = {
    aboutMenuOpen: PropTypes.bool,
    accountMenuOpen: PropTypes.bool,
    ariaLabel: PropTypes.string,
    ariaRole: PropTypes.string,
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    authorAvatarBadge: PropTypes.number,
    autoUpdateProject: PropTypes.func,
    canChangeLanguage: PropTypes.bool,
    canChangeColorMode: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    className: PropTypes.string,
    confirmReadyToReplaceProject: PropTypes.func,
    currentLocale: PropTypes.string.isRequired,
    editMenuOpen: PropTypes.bool,
    enableCommunity: PropTypes.bool,
    extensionLoadCounter: PropTypes.number,
    fileMenuOpen: PropTypes.bool,
    googleDriveFile: PropTypes.shape({
        fileId: PropTypes.string,
        fileName: PropTypes.string,
        folderId: PropTypes.string,
        isGoogleDriveFile: PropTypes.bool
    }),
    classroomClassName: PropTypes.string, // === Smalruby: classroom button ===
    classroomSeatNumber: PropTypes.number, // === Smalruby: classroom button ===
    googleDriveSaveDialogVisible: PropTypes.bool,
    googleDriveSaveDirectStatus: PropTypes.string,
    googleDriveSaveStatus: PropTypes.string,
    aiSaveStatus: PropTypes.string,
    intl: intlShape,
    isGoogleDriveFile: PropTypes.bool,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isShowingProject: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    isUpdating: PropTypes.bool,
    koshienMenuOpen: PropTypes.bool,
    hasActiveMembership: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    loginMenuOpen: PropTypes.bool,
    logo: PropTypes.string,
    meshV2Domain: PropTypes.string,
    meshV2MenuOpen: PropTypes.bool,
    smalrubotS1MenuOpen: PropTypes.bool, // === Smalruby: smalrubot firmware menu ===
    mode1920: PropTypes.bool,
    mode1990: PropTypes.bool,
    mode2020: PropTypes.bool,
    mode220022BC: PropTypes.bool,
    modeMenuOpen: PropTypes.bool,
    modeNow: PropTypes.bool,
    onClickAbout: PropTypes.oneOfType([
        PropTypes.func, // button mode: call this callback when the About button is clicked
        PropTypes.arrayOf( // menu mode: list of items in the About menu
            PropTypes.shape({
                title: PropTypes.node, // text for the menu item
                onClick: PropTypes.func // call this callback when the menu item is clicked
            })
        )
    ]),
    onClickAccount: PropTypes.func,
    onClickEdit: PropTypes.func,
    onClickFile: PropTypes.func,
    onClickKoshien: PropTypes.func,
    onClickLogin: PropTypes.func,
    onClickLogo: PropTypes.func,
    onOpenTipsLibrary: PropTypes.func,
    onActivateRubyTab: PropTypes.func,
    onActivateTutorial: PropTypes.func,
    showTutorialTooltip: PropTypes.bool,
    onClickMeshV2: PropTypes.func,
    onClickSmalrubotS1: PropTypes.func, // === Smalruby: smalrubot firmware menu ===
    onClickMode: PropTypes.func,
    onClickNew: PropTypes.func,
    onClickRemix: PropTypes.func,
    onClickSave: PropTypes.func,
    onClickSaveAsCopy: PropTypes.func,
    onClickSettings: PropTypes.func,
    onExtensionLoaded: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenRegistration: PropTypes.func,
    onOpenBlockDisplayModal: PropTypes.func,
    onOpenConnectionModal: PropTypes.func,
    onOpenDebugModal: PropTypes.func,
    onOpenKoshienTestModal: PropTypes.func,
    onProjectTelemetryEvent: PropTypes.func,
    onRequestCloseAbout: PropTypes.func,
    onRequestCloseAccount: PropTypes.func,
    onRequestCloseEdit: PropTypes.func,
    onRequestCloseFile: PropTypes.func,
    onRequestCloseKoshien: PropTypes.func,
    onRequestCloseLogin: PropTypes.func,
    onRequestCloseMeshV2: PropTypes.func,
    onRequestCloseSmalrubotS1: PropTypes.func, // === Smalruby: smalrubot firmware menu ===
    onOpenSmalrubotFirmwareModal: PropTypes.func, // === Smalruby: smalrubot firmware menu ===
    onOpenClassroomModal: PropTypes.func, // === Smalruby: classroom button ===
    onRequestCloseMode: PropTypes.func,
    onRequestCloseSettings: PropTypes.func,
    onRequestOpenAbout: PropTypes.func,
    onCancelGoogleDriveSave: PropTypes.func,
    onSaveToGoogleDrive: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onSetTimeTravelMode: PropTypes.func,
    onShare: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onStartSelectingGoogleDrive: PropTypes.func,
    onStartSavingToGoogleDrive: PropTypes.func,
    onSaveDirectlyToGoogleDrive: PropTypes.func,
    onSetAiSaveStatus: PropTypes.func,
    onSetMeshV2Domain: PropTypes.func,
    onShowConvertRubyToBlocksErrorAlert: PropTypes.func,
    onClearAiSaveStatus: PropTypes.func,
    onStartSelectingUrlLoad: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    platform: PropTypes.oneOf(Object.keys(PLATFORM)),
    projectFilename: PropTypes.string,
    projectChanged: PropTypes.bool,
    projectTitle: PropTypes.string,
    renderLogin: PropTypes.func,
    sessionExists: PropTypes.bool,
    settingsMenuOpen: PropTypes.bool,
    shouldSaveBeforeTransition: PropTypes.func,
    showComingSoon: PropTypes.bool,
    onUpdateRubyCodeErrors: PropTypes.func,
    updateRubyCodeTargetState: PropTypes.func,
    username: PropTypes.string,
    avatarBadge: PropTypes.number,
    userOwnsProject: PropTypes.bool,

    accountMenuOptions: AccountMenuOptionsPropTypes,

    vm: PropTypes.instanceOf(VM).isRequired
};

MenuBar.defaultProps = {
    logo: smalrubyLogo,
    onShare: () => {}
};

const mapStateToProps = (state, ownProps) => {
    const loadingState = state.scratchGui.projectState.loadingState;
    const user = state.session && state.session.session && state.session.session.user;
    const permissions = state.session && state.session.permissions;
    const sessionExists = state.session && typeof state.session.session !== 'undefined';

    return {
        aboutMenuOpen: aboutMenuOpen(state),
        accountMenuOpen: accountMenuOpen(state),
        currentLocale: state.locales.locale,
        fileMenuOpen: fileMenuOpen(state),
        editMenuOpen: editMenuOpen(state),
        koshienMenuOpen: koshienMenuOpen(state),
        meshV2Domain: state.scratchGui.meshV2 ? state.scratchGui.meshV2.domain : null,
        meshV2MenuOpen: meshV2MenuOpen(state),
        smalrubotS1MenuOpen: smalrubotS1MenuOpen(state), // === Smalruby: smalrubot firmware menu ===
        // === Smalruby: Start of classroom button ===
        classroomClassName: state.scratchGui.classroom ? state.scratchGui.classroom.className : null,
        classroomSeatNumber: state.scratchGui.classroom ? state.scratchGui.classroom.seatNumber : null,
        // === Smalruby: End of classroom button ===
        extensionLoadCounter: state.scratchGui.koshienFile.extensionLoadCounter,
        aiSaveStatus: state.scratchGui.koshienFile.aiSaveStatus,
        googleDriveFile: state.scratchGui.googleDriveFile,
        isGoogleDriveFile: state.scratchGui.googleDriveFile.isGoogleDriveFile,
        isRtl: state.locales.isRtl,
        isUpdating: getIsUpdating(loadingState),
        isShowingProject: getIsShowingProject(loadingState),
        locale: state.locales.locale,
        loginMenuOpen: loginMenuOpen(state),
        modeMenuOpen: modeMenuOpen(state),
        projectChanged: state.scratchGui.projectChanged,
        projectTitle: state.scratchGui.projectTitle,
        sessionExists: sessionExists ?? false,
        settingsMenuOpen: settingsMenuOpen(state),
        username: ownProps.username ?? (user ? user.username : null),
        avatarBadge: user ? user.membership_avatar_badge : null,
        userIsEducator: permissions && permissions.educator,
        vm: state.scratchGui.vm,
        mode220022BC: isTimeTravel220022BC(state),
        mode1920: isTimeTravel1920(state),
        mode1990: isTimeTravel1990(state),
        mode2020: isTimeTravel2020(state),
        modeNow: isTimeTravelNow(state),

        platform: state.scratchGui.platform.platform,

        userOwnsProject: ownProps.userOwnsProject ?? (
            ownProps.authorUsername && user && (ownProps.authorUsername === user.username)
        ),

        accountMenuOptions: ownProps.accountMenuOptions ?? {
            canHaveSession: sessionExists ?? false,

            canRegister: true,
            canLogin: true,
            canLogout: true,

            avatarUrl: user?.thumbnailUrl,
            myStuffUrl: '/mystuff/',
            profileUrl: user && `/users/${user.username}`,
            myClassesUrl: permissions?.educator ? '/educators/classes/' : null,
            myClassUrl: user && permissions?.student ? `/classes/${user.classroomId}/` : null,
            accountSettingsUrl: '/accounts/settings/'
        }
    };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    autoUpdateProject: () => dispatch(autoUpdateProject()),
    onOpenDebugModal: () => dispatch(openDebugModal()),
    onOpenConnectionModal: id => {
        dispatch(setConnectionModalExtensionId(id));
        dispatch(openConnectionModal());
    },
    onOpenBlockDisplayModal: () => dispatch(openBlockDisplayModal()),
    onOpenKoshienTestModal: () => dispatch(openKoshienTestModal()),
    onClickAccount: () => dispatch(openAccountMenu()),
    onRequestCloseAccount: () => dispatch(closeAccountMenu()),
    onClickFile: () => dispatch(toggleFileMenu()),
    onRequestCloseFile: () => dispatch(closeFileMenu()),
    onClickEdit: () => dispatch(toggleEditMenu()),
    onRequestCloseEdit: () => dispatch(closeEditMenu()),
    onClickKoshien: () => dispatch(openKoshienMenu()),
    onRequestCloseKoshien: () => dispatch(closeKoshienMenu()),
    onClickMeshV2: () => dispatch(openMeshV2Menu()),
    onRequestCloseMeshV2: () => dispatch(closeMeshV2Menu()),
    // === Smalruby: Start of smalrubot firmware menu ===
    onClickSmalrubotS1: () => dispatch(openSmalrubotS1Menu()),
    onRequestCloseSmalrubotS1: () => dispatch(closeSmalrubotS1Menu()),
    onOpenSmalrubotFirmwareModal: () => dispatch(openSmalrubotFirmwareModal()),
    // === Smalruby: End of smalrubot firmware menu ===
    // === Smalruby: Start of classroom button ===
    onOpenClassroomModal: () => dispatch(openClassroomModal()),
    // === Smalruby: End of classroom button ===
    onClickLogin: ownProps.onClickLogin ?? (() => dispatch(openLoginMenu())),
    onRequestCloseLogin: () => dispatch(closeLoginMenu()),
    onClickMode: () => dispatch(openModeMenu()),
    onRequestCloseMode: () => dispatch(closeModeMenu()),
    onRequestOpenAbout: () => dispatch(openAboutMenu()),
    onRequestCloseAbout: () => dispatch(closeAboutMenu()),
    onClickSettings: () => dispatch(toggleSettingsMenu()),
    onRequestCloseSettings: () => dispatch(closeSettingsMenu()),
    onClickNew: needSave => {
        dispatch(requestNewProject(needSave));
        dispatch(clearGoogleDriveFile());
    },
    onClickRemix: () => dispatch(remixProject()),
    onClickSave: () => dispatch(manualUpdateProject()),
    onClickSaveAsCopy: () => dispatch(saveProjectAsCopy()),
    onExtensionLoaded: () => dispatch(incrementExtensionLoad()),
    onSetMeshV2Domain: domain => dispatch(setMeshV2Domain(domain)),
    onSetAiSaveStatus: status => dispatch(setAiSaveStatus(status)),
    onClearAiSaveStatus: () => dispatch(clearAiSaveStatus()),
    onSeeCommunity: ownProps.onSeeCommunity ?? (() => dispatch(setPlayer(true))),
    onSetTimeTravelMode: mode => dispatch(setTimeTravel(mode)),
    updateRubyCodeTargetState: target => dispatch(updateRubyCodeTarget(target)),
    onStartSelectingUrlLoad: () => dispatch(openUrlLoaderModal()),
    onActivateRubyTab: () => dispatch(activateTab(RUBY_TAB_INDEX)),
    onShowConvertRubyToBlocksErrorAlert: () => showAlertWithTimeout(dispatch, 'convertRubyToBlocksError'),
    onUpdateRubyCodeErrors: errors => dispatch(updateRubyCodeErrors(errors))
});

export default compose(
    injectIntl,
    MenuBarHOC,
    GoogleDriveLoaderHOC,
    GoogleDriveSaverHOC,
    connect(
        mapStateToProps,
        mapDispatchToProps
    )
)(MenuBar);
