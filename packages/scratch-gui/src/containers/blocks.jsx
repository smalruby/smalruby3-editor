import bindAll from 'lodash.bindall';
import debounce from 'lodash.debounce';
import defaultsDeep from 'lodash.defaultsdeep';
import makeToolboxXML from '../lib/make-toolbox-xml';
import {CATEGORY_BLOCKS} from '../lib/block-utils';
import PropTypes from 'prop-types';
import queryString from 'query-string';
import React from 'react';
import VMScratchBlocks from '../lib/blocks';
import VM from '@smalruby/scratch-vm';

import analytics from '../lib/analytics';
import log from '../lib/log.js';
import Prompt from './prompt.jsx';
import BlocksComponent from '../components/blocks/blocks.jsx';
import ExtensionLibrary from './extension-library.jsx';
import extensionData from '../lib/libraries/extensions/index.jsx';
import CustomProcedures from './custom-procedures.jsx';
import errorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import {BLOCKS_DEFAULT_SCALE, STAGE_DISPLAY_SIZES} from '../lib/layout-constants';
import DropAreaHOC from '../lib/drop-area-hoc.jsx';
import DragConstants from '../lib/drag-constants';
import defineDynamicBlock from '../lib/define-dynamic-block';
import {DEFAULT_MODE, getColorsForMode, colorModeMap} from '../lib/settings/color-mode';
import {CAT_BLOCKS_THEME} from '../lib/settings/theme';
import {injectExtensionBlockMode, injectExtensionCategoryMode} from '../lib/settings/color-mode/blockHelpers';

import {connect} from 'react-redux';
import {updateToolbox} from '../reducers/toolbox';
import {setScratchBlocks} from '../reducers/block-display';
import {activateColorPicker} from '../reducers/color-picker';
import {closeExtensionLibrary, openSoundRecorder, openConnectionModal} from '../reducers/modals';
import {activateCustomProcedures, deactivateCustomProcedures} from '../reducers/custom-procedures';
import {setConnectionModalExtensionId} from '../reducers/connection-modal';
import {updateMetrics} from '../reducers/workspace-metrics';
import {isTimeTravel2020} from '../reducers/time-travel';

import {
    activateTab,
    SOUNDS_TAB_INDEX,
    RUBY_TAB_INDEX
} from '../reducers/editor-tab';
import {togglePalette} from '../reducers/palette-visibility';
import PaletteToggle from '../components/palette-toggle/palette-toggle.jsx';
import BlocksScreenshotButton from '../components/blocks-screenshot-button/blocks-screenshot-button.jsx';
import {downloadBlocksAsImage} from '../lib/blocks-screenshot';
// === Smalruby: Start of DNCL block filtering ===
import {DNCL_ALLOWED_BLOCKS} from '../lib/dncl/dncl-block-filter';
// === Smalruby: End of DNCL block filtering ===

const addFunctionListener = (object, property, callback) => {
    const oldFn = object[property];
    object[property] = function (...args) {
        const result = oldFn.apply(this, args);
        callback.apply(this, result);
        return result;
    };
};

const TOTAL_DEFAULT_BLOCKS = Object.values(CATEGORY_BLOCKS).reduce((total, blocks) => total + blocks.length, 0);

const DroppableBlocks = DropAreaHOC([
    DragConstants.BACKPACK_CODE
])(BlocksComponent);

class Blocks extends React.Component {
    constructor (props) {
        super(props);
        this.ScratchBlocks = VMScratchBlocks(props.vm, false);
        bindAll(this, [
            'attachVM',
            'detachVM',
            'getToolboxXML',
            'handleCategorySelected',
            'handleConnectionModalStart',
            'handleDrop',
            'handleStatusButtonUpdate',
            'handleOpenSoundRecorder',
            'handlePromptStart',
            'handlePromptCallback',
            'handlePromptClose',
            'handleCustomProceduresClose',
            'handleTogglePalette',
            'onScriptGlowOn',
            'onScriptGlowOff',
            'onBlockGlowOn',
            'onBlockGlowOff',
            'handleMonitorsUpdate',
            'handleExtensionAdded',
            'handleBlocksInfoUpdate',
            'onTargetsUpdate',
            'onVisualReport',
            'onWorkspaceUpdate',
            'onWorkspaceMetricsChange',
            'setBlocks',
            'setLocale',
            'handleDownloadBlocksImage'
        ]);
        this.ScratchBlocks.prompt = this.handlePromptStart;
        this.ScratchBlocks.statusButtonCallback = this.handleConnectionModalStart;
        this.ScratchBlocks.recordSoundCallback = this.handleOpenSoundRecorder;

        this.state = {
            prompt: null
        };
        this.onTargetsUpdate = debounce(this.onTargetsUpdate, 100);
        this.toolboxUpdateQueue = [];
        this._pendingScrollCenter = false;
    }
    componentDidMount () {
        this.ScratchBlocks = VMScratchBlocks(this.props.vm, this.props.useCatBlocks);
        this.props.onSetScratchBlocks(this.ScratchBlocks);
        this.ScratchBlocks.prompt = this.handlePromptStart;
        this.ScratchBlocks.statusButtonCallback = this.handleConnectionModalStart;
        this.ScratchBlocks.recordSoundCallback = this.handleOpenSoundRecorder;

        this.ScratchBlocks.FieldColourSlider.activateEyedropper_ = this.props.onActivateColorPicker;
        this.ScratchBlocks.Procedures.externalProcedureDefCallback = this.props.onActivateCustomProcedures;
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);

        const workspaceConfig = defaultsDeep({},
            Blocks.defaultOptions,
            this.props.options,
            {rtl: this.props.isRtl, toolbox: this.props.toolboxXML, colours: getColorsForMode(this.props.colorMode)}
        );
        this.workspace = this.ScratchBlocks.inject(this.blocks, workspaceConfig);

        // Register buttons under new callback keys for creating variables,
        // lists, and procedures from extensions.

        const toolboxWorkspace = this.workspace.getFlyout().getWorkspace();

        const varListButtonCallback = type =>
            (() => this.ScratchBlocks.Variables.createVariable(this.workspace, null, type));
        const procButtonCallback = () => {
            this.ScratchBlocks.Procedures.createProcedureDefCallback_(this.workspace);
        };

        toolboxWorkspace.registerButtonCallback('MAKE_A_VARIABLE', varListButtonCallback(''));
        toolboxWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));
        toolboxWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);

        // Store the xml of the toolbox that is actually rendered.
        // This is used in componentDidUpdate instead of prevProps, because
        // the xml can change while e.g. on the costumes tab.
        this._renderedToolboxXML = this.props.toolboxXML;

        // we actually never want the workspace to enable "refresh toolbox" - this basically re-renders the
        // entire toolbox every time we reset the workspace.  We call updateToolbox as a part of
        // componentDidUpdate so the toolbox will still correctly be updated
        this.setToolboxRefreshEnabled = this.workspace.setToolboxRefreshEnabled.bind(this.workspace);
        this.workspace.setToolboxRefreshEnabled = () => {
            this.setToolboxRefreshEnabled(false);
        };

        // @todo change this when blockly supports UI events
        addFunctionListener(this.workspace, 'translate', this.onWorkspaceMetricsChange);
        addFunctionListener(this.workspace, 'zoom', this.onWorkspaceMetricsChange);

        this.attachVM();
        // Only update blocks/vm locale when visible to avoid sizing issues
        // If locale changes while not visible it will get handled in didUpdate
        if (this.props.isVisible) {
            this.setLocale();
        }

        window.addEventListener('load-extension', () => {
            this.props.vm.extensionManager.loadExtensionURL('faceSensing').then(() => {
                this.handleCategorySelected('faceSensing');
            });
        });
    }
    shouldComponentUpdate (nextProps, nextState) {
        return (
            this.state.prompt !== nextState.prompt ||
            this.props.isVisible !== nextProps.isVisible ||
            this._renderedToolboxXML !== nextProps.toolboxXML ||
            this.props.extensionLibraryVisible !== nextProps.extensionLibraryVisible ||
            this.props.customProceduresVisible !== nextProps.customProceduresVisible ||
            this.props.locale !== nextProps.locale ||
            this.props.anyModalVisible !== nextProps.anyModalVisible ||
            this.props.stageSize !== nextProps.stageSize ||
            this.props.selectedBlocks !== nextProps.selectedBlocks ||
            this.props.tutorialAllowedBlocks !== nextProps.tutorialAllowedBlocks ||
            this.props.paletteVisible !== nextProps.paletteVisible
        );
    }
    componentDidUpdate (prevProps) {
        // If any modals are open, call hideChaff to close z-indexed field editors
        if (this.props.anyModalVisible && !prevProps.anyModalVisible) {
            this.ScratchBlocks.hideChaff();
        }

        // If selectedBlocks, tutorialAllowedBlocks, or dnclMode changed, update toolbox
        if (this.props.selectedBlocks !== prevProps.selectedBlocks ||
            this.props.tutorialAllowedBlocks !== prevProps.tutorialAllowedBlocks ||
            this.props.dnclMode !== prevProps.dnclMode) { // === Smalruby: DNCL block filtering ===
            const toolboxXML = this.getToolboxXML();
            if (toolboxXML) {
                this.props.updateToolboxState(toolboxXML);
            }
        }

        // Only rerender the toolbox when the blocks are visible and the xml is
        // different from the previously rendered toolbox xml.
        // Do not check against prevProps.toolboxXML because that may not have been rendered.
        if (this.props.isVisible && this.props.toolboxXML !== this._renderedToolboxXML) {
            this.requestToolboxUpdate();
        }

        if (this.props.paletteVisible !== prevProps.paletteVisible) {
            this._applyPaletteVisibility(this.props.paletteVisible);
        }

        if (this.props.isVisible === prevProps.isVisible) {
            if (this.props.stageSize !== prevProps.stageSize) {
                // force workspace to redraw for the new stage size
                window.dispatchEvent(new Event('resize'));
            }
            return;
        }
        // @todo hack to resize blockly manually in case resize happened while hidden
        // @todo hack to reload the workspace due to gui bug #413
        if (this.props.isVisible) { // Scripts tab
            this.workspace.setVisible(true);
            if (prevProps.locale !== this.props.locale || this.props.locale !== this.props.vm.getLocale()) {
                // call setLocale if the locale has changed, or changed while the blocks were hidden.
                // vm.getLocale() will be out of sync if locale was changed while not visible
                this.setLocale();
            } else {
                this.props.vm.refreshWorkspace();
                this.requestToolboxUpdate();
            }

            window.dispatchEvent(new Event('resize'));

            // Restore palette visibility state when switching back to the code tab
            this._applyPaletteVisibility(this.props.paletteVisible);

            if (this._pendingScrollCenter) {
                this._pendingScrollCenter = false;
                if (this.workspace.options && this.workspace.options.zoomOptions) {
                    this.workspace.markFocused();
                    this.workspace.setScale(this.workspace.options.zoomOptions.startScale);
                    this.workspace.scrollCenter();
                }
            }
        } else {
            this.workspace.setVisible(false);
        }
    }
    componentWillUnmount () {
        this.detachVM();
        this.workspace.dispose();
        clearTimeout(this.toolboxUpdateTimeout);

        // Clear the flyout blocks so that they can be recreated on mount.
        this.props.vm.clearFlyoutBlocks();
    }
    handleTogglePalette () {
        this.props.onTogglePalette();
    }
    _applyPaletteVisibility (visible) {
        if (!this.workspace) return;
        const flyout = this.workspace.getFlyout();
        const toolbox = this.workspace.getToolbox();
        if (!flyout || !toolbox) return;
        const extensionButton = document.querySelector('[class*="extension-button_extension-button-container"]');
        if (visible) {
            toolbox.HtmlDiv.style.display = '';
            if (extensionButton) extensionButton.style.display = '';
            if (flyout.svgGroup_) flyout.svgGroup_.style.display = '';
            const selectedItem = toolbox.getSelectedItem();
            if (selectedItem) {
                toolbox.setSelectedItem(selectedItem);
            }
        } else {
            flyout.hide();
            toolbox.HtmlDiv.style.display = 'none';
            if (extensionButton) extensionButton.style.display = 'none';
            // flyout.hide() only sets isVisible_=false, but workspace.setVisible(true)
            // restores containerVisible_=true which makes updateDisplay_ show the flyout again.
            // Directly hide the SVG group to ensure it stays hidden regardless of containerVisible_.
            if (flyout.svgGroup_) flyout.svgGroup_.style.display = 'none';
        }
        this.ScratchBlocks.svgResize(this.workspace);
    }
    requestToolboxUpdate () {
        clearTimeout(this.toolboxUpdateTimeout);
        this.toolboxUpdateTimeout = setTimeout(() => {
            this.updateToolbox();
        }, 0);
    }
    setLocale () {
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);

        // Add Smalruby-specific block translations that differ from upstream
        if (this.props.locale === 'ja' || this.props.locale === 'ja-Hira') {
            // Override Japanese translation for sensing_online to use Japanese text
            this.ScratchBlocks.Msg.SENSING_ONLINE = 'オンライン?';
        }

        this.props.vm.setLocale(this.props.locale, this.props.messages)
            .then(() => {
                this.workspace.getFlyout().setRecyclingEnabled(false);
                this.props.vm.refreshWorkspace();
                this.requestToolboxUpdate();
                this.withToolboxUpdates(() => {
                    this.workspace.getFlyout().setRecyclingEnabled(true);
                });
            });
    }

    updateToolbox () {
        this.toolboxUpdateTimeout = false;

        const categoryId = this.workspace.toolbox_.getSelectedCategoryId();
        const offset = this.workspace.toolbox_.getCategoryScrollOffset();
        this.workspace.updateToolbox(this.props.toolboxXML);
        this._renderedToolboxXML = this.props.toolboxXML;

        // In order to catch any changes that mutate the toolbox during "normal runtime"
        // (variable changes/etc), re-enable toolbox refresh.
        // Using the setter function will rerender the entire toolbox which we just rendered.
        this.workspace.toolboxRefreshEnabled_ = true;

        const currentCategoryPos = this.workspace.toolbox_.getCategoryPositionById(categoryId);
        const currentCategoryLen = this.workspace.toolbox_.getCategoryLengthById(categoryId);
        if (offset < currentCategoryLen) {
            this.workspace.toolbox_.setFlyoutScrollPos(currentCategoryPos + offset);
        } else {
            this.workspace.toolbox_.setFlyoutScrollPos(currentCategoryPos);
        }

        const queue = this.toolboxUpdateQueue;
        this.toolboxUpdateQueue = [];
        queue.forEach(fn => fn());

        // Re-apply palette visibility since updateToolbox/setFlyoutScrollPos may re-show the flyout
        if (!this.props.paletteVisible) {
            this._applyPaletteVisibility(false);
        }
    }

    withToolboxUpdates (fn) {
        // if there is a queued toolbox update, we need to wait
        if (this.toolboxUpdateTimeout) {
            this.toolboxUpdateQueue.push(fn);
        } else {
            fn();
        }
    }

    attachVM () {
        this.workspace.addChangeListener(this.props.vm.blockListener);
        this.flyoutWorkspace = this.workspace
            .getFlyout()
            .getWorkspace();
        this.flyoutWorkspace.addChangeListener(this.props.vm.flyoutBlockListener);
        this.flyoutWorkspace.addChangeListener(this.props.vm.monitorBlockListener);
        this.props.vm.addListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.addListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.addListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.addListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.addListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.addListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.addListener('targetsUpdate', this.onTargetsUpdate);
        this.props.vm.addListener('MONITORS_UPDATE', this.handleMonitorsUpdate);
        this.props.vm.addListener('EXTENSION_ADDED', this.handleExtensionAdded);
        this.props.vm.addListener('BLOCKSINFO_UPDATE', this.handleBlocksInfoUpdate);
        this.props.vm.addListener('PERIPHERAL_CONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.addListener('PERIPHERAL_DISCONNECTED', this.handleStatusButtonUpdate);
    }
    detachVM () {
        this.props.vm.removeListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.removeListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.removeListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.removeListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.removeListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.removeListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.removeListener('targetsUpdate', this.onTargetsUpdate);
        this.props.vm.removeListener('MONITORS_UPDATE', this.handleMonitorsUpdate);
        this.props.vm.removeListener('EXTENSION_ADDED', this.handleExtensionAdded);
        this.props.vm.removeListener('BLOCKSINFO_UPDATE', this.handleBlocksInfoUpdate);
        this.props.vm.removeListener('PERIPHERAL_CONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.removeListener('PERIPHERAL_DISCONNECTED', this.handleStatusButtonUpdate);
    }

    updateToolboxBlockValue (id, value) {
        this.withToolboxUpdates(() => {
            const block = this.workspace
                .getFlyout()
                .getWorkspace()
                .getBlockById(id);
            if (block) {
                block.inputList[0].fieldRow[0].setValue(value);
            }
        });
    }

    onTargetsUpdate () {
        if (this.props.vm.editingTarget && this.workspace.getFlyout()) {
            ['glide', 'move', 'set'].forEach(prefix => {
                this.updateToolboxBlockValue(`${prefix}x`, Math.round(this.props.vm.editingTarget.x).toString());
                this.updateToolboxBlockValue(`${prefix}y`, Math.round(this.props.vm.editingTarget.y).toString());
            });
        }
    }
    onWorkspaceMetricsChange () {
        const target = this.props.vm.editingTarget;
        if (target && target.id) {
            // Dispatch updateMetrics later, since onWorkspaceMetricsChange may be (very indirectly)
            // called from a reducer, i.e. when you create a custom procedure.
            // TODO: Is this a vehement hack?
            setTimeout(() => {
                this.props.updateMetrics({
                    targetID: target.id,
                    scrollX: this.workspace.scrollX,
                    scrollY: this.workspace.scrollY,
                    scale: this.workspace.scale
                });
            }, 0);
        }
    }
    onScriptGlowOn (data) {
        this.workspace.glowStack(data.id, true);
    }
    onScriptGlowOff (data) {
        this.workspace.glowStack(data.id, false);
    }
    onBlockGlowOn (data) {
        this.workspace.glowBlock(data.id, true);
    }
    onBlockGlowOff (data) {
        this.workspace.glowBlock(data.id, false);
    }
    onVisualReport (data) {
        // Don't show visual report in Code tab when Ruby tab is active
        if (this.props.activeTabIndex === RUBY_TAB_INDEX) {
            return;
        }
        this.workspace.reportValue(data.id, data.value);
    }

    // Extract only_blocks setting from Stage comments
    extractOnlyBlocksFromStageComments () {
        try {
            const stage = this.props.vm.runtime.getTargetForStage();
            if (!stage || !stage.comments) return null;

            // Search through Stage comments for only_blocks pattern
            for (const commentId in stage.comments) {
                const comment = stage.comments[commentId];
                if (comment && comment.text) {
                    const match = comment.text.match(/only_blocks=([^\s\n]+)/);
                    if (match) {
                        return match[1];
                    }
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    getToolboxXML () {
        // Use try/catch because this requires digging pretty deep into the VM
        // Code inside intentionally ignores several error situations (no stage, etc.)
        // Because they would get caught by this try/catch
        try {
            let {editingTarget: target, runtime} = this.props.vm;
            const stage = runtime.getTargetForStage();
            if (!target) target = stage; // If no editingTarget, use the stage

            const stageCostumes = stage.getCostumes();
            const targetCostumes = target.getCostumes();
            const targetSounds = target.getSounds();
            const dynamicBlocksXML = injectExtensionCategoryMode(
                this.props.vm.runtime.getBlocksXML(target),
                this.props.colorMode
            );

            let onlyBlocks;

            // === Smalruby: Start of DNCL block filtering ===
            // DNCL mode has the absolute highest priority for block filtering.
            if (this.props.dnclMode) {
                onlyBlocks = DNCL_ALLOWED_BLOCKS.join(',');
            }
            // === Smalruby: End of DNCL block filtering ===

            // tutorialAllowedBlocks has highest priority (active tutorial overrides stage comments and URL params)
            if (!onlyBlocks && this.props.tutorialAllowedBlocks) {
                const allowedBlockIds = [];
                Object.values(this.props.tutorialAllowedBlocks).forEach(categoryBlocks => {
                    allowedBlockIds.push(...categoryBlocks);
                });
                if (allowedBlockIds.length < TOTAL_DEFAULT_BLOCKS) {
                    onlyBlocks = allowedBlockIds.join(',');
                }
            }

            // Check for only_blocks setting in Stage comments (second priority)
            if (!onlyBlocks) {
                onlyBlocks = this.extractOnlyBlocksFromStageComments();
            }

            // If no Stage comment setting, check URL parameter
            if (!onlyBlocks) {
                const queryParams = queryString.parse(window.location.search);
                onlyBlocks = queryParams.only_blocks;
            }

            // If no URL parameter, use GUI selectedBlocks setting
            if (!onlyBlocks && this.props.selectedBlocks) {
                const selectedBlockIds = [];
                Object.values(this.props.selectedBlocks).forEach(categoryBlocks => {
                    selectedBlockIds.push(...categoryBlocks);
                });
                if (selectedBlockIds.length < TOTAL_DEFAULT_BLOCKS) {
                    onlyBlocks = selectedBlockIds.join(',');
                }
            }

            return makeToolboxXML(false, target.isStage, target.id, dynamicBlocksXML,
                targetCostumes[targetCostumes.length - 1].name,
                stageCostumes[stageCostumes.length - 1].name,
                targetSounds.length > 0 ? targetSounds[targetSounds.length - 1].name : '',
                getColorsForMode(this.props.colorMode),
                onlyBlocks,
                !!onlyBlocks, // isOnlyBlocksSpecified: true if onlyBlocks has a value
                this.props.dnclMode // === Smalruby: hide extensions in DNCL mode ===
            );
        } catch {
            return null;
        }
    }
    onWorkspaceUpdate (data) {
        // When we change sprites, update the toolbox to have the new sprite's blocks
        const toolboxXML = this.getToolboxXML();
        if (toolboxXML) {
            this.props.updateToolboxState(toolboxXML);
        }

        if (this.props.vm.editingTarget && !this.props.workspaceMetrics.targets[this.props.vm.editingTarget.id]) {
            this.onWorkspaceMetricsChange();
        }

        // Remove and reattach the workspace listener (but allow flyout events)
        this.workspace.removeChangeListener(this.props.vm.blockListener);
        const dom = this.ScratchBlocks.Xml.textToDom(data.xml);
        let fromRuby = false;
        try {
            this.ScratchBlocks.Xml.clearWorkspaceAndLoadFromXml(dom, this.workspace);

            // When we converted blocks from Ruby, update top block positions.
            if (this.props.vm.editingTarget) {
                const blocks = this.props.vm.editingTarget.blocks;
                const scripts = blocks.getScripts();
                for (let i = 0; i < scripts.length; i++) {
                    const topBlockId = scripts[i];
                    const topBlock = blocks.getBlock(topBlockId);
                    if (typeof topBlock.x === 'undefined' || typeof topBlock.y === 'undefined') {
                        fromRuby = true;
                        break;
                    }
                }
                if (fromRuby) {
                    this.workspace.cleanUp();

                    // Re-calculate the position of the comments.
                    const firstTopBlock = this.workspace.getTopBlocks(true)[0];
                    this.workspace.getTopComments(false).forEach(comment => {
                        if (comment.blockId) {
                            const block = this.workspace.getBlockById(comment.blockId);
                            if (block) {
                                // Minimize @ruby:return comments (internal metadata)
                                if (comment.text && comment.text.startsWith('@ruby:return')) {
                                    comment.setMinimized(true);
                                }

                                const blockXY = block.getRelativeToSurfaceXY();
                                const commentHW = comment.getHeightWidth();
                                const rtl = this.workspace.RTL;
                                const x = rtl ? 20 : -commentHW.width - 20;
                                const y = blockXY.y;
                                comment.moveTo(x, y);

                                const targetComments = this.props.vm.editingTarget.comments;
                                if (targetComments && targetComments[comment.id]) {
                                    targetComments[comment.id].x = x;
                                    targetComments[comment.id].y = y;
                                }
                            }
                        } else if (firstTopBlock) {
                            // Workspace-level comments (e.g. @ruby:class) have no blockId.
                            // Place them to the left of the first top block, at the same y.
                            const blockXY = firstTopBlock.getRelativeToSurfaceXY();
                            const commentHW = comment.getHeightWidth();
                            const rtl = this.workspace.RTL;
                            const x = rtl ? 20 : -commentHW.width - 20;
                            const y = blockXY.y;
                            comment.moveTo(x, y);

                            const targetComments = this.props.vm.editingTarget.comments;
                            if (targetComments && targetComments[comment.id]) {
                                targetComments[comment.id].x = x;
                                targetComments[comment.id].y = y;
                            }
                        }
                    });

                    this.workspace.getTopBlocks(false).forEach(wsTopBlock => {
                        const topBlock = blocks.getBlock(wsTopBlock.id);
                        if (topBlock) {
                            const xy = wsTopBlock.getRelativeToSurfaceXY();
                            topBlock.x = xy.x;
                            topBlock.y = xy.y;
                        }
                    });

                    if (this.workspace.options && this.workspace.options.zoomOptions) {
                        if (this.props.isVisible) {
                            this.workspace.markFocused();
                            this.workspace.setScale(this.workspace.options.zoomOptions.startScale);
                            this.workspace.scrollCenter();
                        } else {
                            this._pendingScrollCenter = true;
                        }
                    }

                    this.updateToolbox();
                }
            }
        } catch (error) {
            // The workspace is likely incomplete. What did update should be
            // functional.
            //
            // Instead of throwing the error, by logging it and continuing as
            // normal lets the other workspace update processes complete in the
            // gui and vm, which lets the vm run even if the workspace is
            // incomplete. Throwing the error would keep things like setting the
            // correct editing target from happening which can interfere with
            // some blocks and processes in the vm.
            if (error.message) {
                error.message = `Workspace Update Error: ${error.message}`;
            }
            log.error(error);
        }
        this.workspace.addChangeListener(this.props.vm.blockListener);

        if (!fromRuby &&
            this.props.vm.editingTarget &&
            this.props.workspaceMetrics.targets[this.props.vm.editingTarget.id]
        ) {
            const {scrollX, scrollY, scale} = this.props.workspaceMetrics.targets[this.props.vm.editingTarget.id];
            this.workspace.scrollX = scrollX;
            this.workspace.scrollY = scrollY;
            this.workspace.scale = scale;
            this.workspace.resize();
        }

        // Clear the undo state of the workspace since this is a
        // fresh workspace and we don't want any changes made to another sprites
        // workspace to be 'undone' here.
        this.workspace.clearUndo();
    }
    handleMonitorsUpdate (monitors) {
        // Update the checkboxes of the relevant monitors.
        // TODO: What about monitors that have fields? See todo in scratch-vm blocks.js changeBlock:
        // https://github.com/LLK/scratch-vm/blob/2373f9483edaf705f11d62662f7bb2a57fbb5e28/src/engine/blocks.js#L569-L576
        const flyout = this.workspace.getFlyout();
        for (const monitor of monitors.values()) {
            const blockId = monitor.get('id');
            const isVisible = monitor.get('visible');
            flyout.setCheckboxState(blockId, isVisible);
            // We also need to update the isMonitored flag for this block on the VM, since it's used to determine
            // whether the checkbox is activated or not when the checkbox is re-displayed (e.g. local variables/blocks
            // when switching between sprites).
            const block = this.props.vm.runtime.monitorBlocks.getBlock(blockId);
            if (block) {
                block.isMonitored = isVisible;
            }
        }
    }
    handleExtensionAdded (categoryInfo) {
        analytics.event({
            category: 'extensions',
            action: 'added',
            label: categoryInfo.id
        });

        const defineBlocks = blockInfoArray => {
            if (blockInfoArray && blockInfoArray.length > 0) {
                const staticBlocksJson = [];
                const dynamicBlocksInfo = [];
                blockInfoArray.forEach(blockInfo => {
                    if (blockInfo.info && blockInfo.info.isDynamic) {
                        dynamicBlocksInfo.push(blockInfo);
                    } else if (blockInfo.json) {
                        staticBlocksJson.push(injectExtensionBlockMode(blockInfo.json, this.props.colorMode));
                    }
                    // otherwise it's a non-block entry such as '---'
                });

                this.ScratchBlocks.defineBlocksWithJsonArray(staticBlocksJson);
                dynamicBlocksInfo.forEach(blockInfo => {
                    // This is creating the block factory / constructor -- NOT a specific instance of the block.
                    // The factory should only know static info about the block: the category info and the opcode.
                    // Anything else will be picked up from the XML attached to the block instance.
                    const extendedOpcode = `${categoryInfo.id}_${blockInfo.info.opcode}`;
                    const blockDefinition =
                        defineDynamicBlock(this.ScratchBlocks, categoryInfo, blockInfo, extendedOpcode);
                    this.ScratchBlocks.Blocks[extendedOpcode] = blockDefinition;
                });
            }
        };

        // scratch-blocks implements a menu or custom field as a special kind of block ("shadow" block)
        // these actually define blocks and MUST run regardless of the UI state
        defineBlocks(
            Object.getOwnPropertyNames(categoryInfo.customFieldTypes)
                .map(fieldTypeName => categoryInfo.customFieldTypes[fieldTypeName].scratchBlocksDefinition));
        defineBlocks(categoryInfo.menus);
        defineBlocks(categoryInfo.blocks);

        // Update the toolbox with new blocks if possible
        const toolboxXML = this.getToolboxXML();
        if (toolboxXML) {
            this.props.updateToolboxState(toolboxXML);
        }
    }
    handleBlocksInfoUpdate (categoryInfo) {
        // @todo Later we should replace this to avoid all the warnings from redefining blocks.
        this.handleExtensionAdded(categoryInfo);
    }
    handleCategorySelected (categoryId) {
        const extension = extensionData.find(ext => ext.extensionId === categoryId);
        if (extension && extension.launchPeripheralConnectionFlow) {
            this.handleConnectionModalStart(categoryId);
        }

        this.withToolboxUpdates(() => {
            this.workspace.toolbox_.setSelectedCategoryById(categoryId);
        });
    }
    setBlocks (blocks) {
        this.blocks = blocks;
    }
    handlePromptStart (message, defaultValue, callback, optTitle, optVarType) {
        const p = {prompt: {callback, message, defaultValue}};
        p.prompt.title = optTitle ? optTitle :
            this.ScratchBlocks.Msg.VARIABLE_MODAL_TITLE;
        p.prompt.varType = typeof optVarType === 'string' ?
            optVarType : this.ScratchBlocks.SCALAR_VARIABLE_TYPE;
        p.prompt.showVariableOptions = // This flag means that we should show variable/list options about scope
            optVarType !== this.ScratchBlocks.BROADCAST_MESSAGE_VARIABLE_TYPE &&
            p.prompt.title !== this.ScratchBlocks.Msg.RENAME_VARIABLE_MODAL_TITLE &&
            p.prompt.title !== this.ScratchBlocks.Msg.RENAME_LIST_MODAL_TITLE;
        p.prompt.showCloudOption = (optVarType === this.ScratchBlocks.SCALAR_VARIABLE_TYPE) && this.props.canUseCloud;
        this.setState(p);
    }
    handleConnectionModalStart (extensionId) {
        this.props.onOpenConnectionModal(extensionId);
    }
    handleStatusButtonUpdate () {
        this.ScratchBlocks.refreshStatusButtons(this.workspace);
    }
    handleOpenSoundRecorder () {
        this.props.onOpenSoundRecorder();
    }

    /*
     * Pass along information about proposed name and variable options (scope and isCloud)
     * and additional potentially conflicting variable names from the VM
     * to the variable validation prompt callback used in scratch-blocks.
     */
    handlePromptCallback (input, variableOptions) {
        this.state.prompt.callback(
            input,
            this.props.vm.runtime.getAllVarNamesOfType(this.state.prompt.varType),
            variableOptions);
        this.handlePromptClose();
    }
    handlePromptClose () {
        this.setState({prompt: null});
    }
    handleCustomProceduresClose (data) {
        this.props.onRequestCloseCustomProcedures(data);
        const ws = this.workspace;
        ws.refreshToolboxSelection_();
        ws.toolbox_.scrollToCategoryById('myBlocks');
    }
    handleDrop (dragInfo) {
        fetch(dragInfo.payload.bodyUrl)
            .then(response => response.json())
            .then(blocks => this.props.vm.shareBlocksToTarget(blocks, this.props.vm.editingTarget.id))
            .then(() => {
                this.props.vm.refreshWorkspace();
                this.updateToolbox(); // To show new variables/custom blocks
            });
    }
    handleDownloadBlocksImage () {
        if (!this.workspace) return;
        const target = this.props.vm.editingTarget;
        const spriteName = target ? target.sprite.name : 'sprite';
        const projectTitle = this.props.projectTitle || 'project';
        const costumeDataUri = target?.sprite?.costumes?.[target.currentCostume]?.asset?.encodeDataURI();
        downloadBlocksAsImage(this.workspace, projectTitle, spriteName, costumeDataUri);
    }
    render () {
        const {
            anyModalVisible: _anyModalVisible,
            canUseCloud: _canUseCloud,
            customProceduresVisible,
            extensionLibraryVisible,
            options,
            stageSize: _stageSize,
            vm,
            isRtl: _isRtl,
            isVisible: _isVisible,
            onActivateColorPicker: _onActivateColorPicker,
            onOpenConnectionModal: _onOpenConnectionModal,
            onOpenSoundRecorder: _onOpenSoundRecorder,
            onSetScratchBlocks: _onSetScratchBlocks,
            updateToolboxState: _updateToolboxState,
            onActivateCustomProcedures: _onActivateCustomProcedures,
            onRequestCloseExtensionLibrary,
            onRequestCloseCustomProcedures: _onRequestCloseCustomProcedures,
            toolboxXML: _toolboxXML,
            updateMetrics: _updateMetricsProp,
            useCatBlocks: _useCatBlocks,
            workspaceMetrics: _workspaceMetrics,
            paletteVisible,
            onTogglePalette: _onTogglePalette,
            projectTitle: _projectTitle,
            ...props
        } = this.props;

        // Calculate toggle button position based on toolbox width (toolbox + flyout combined)
        const toolbox = this.workspace ? this.workspace.getToolbox() : null;
        const toggleButtonLeft = paletteVisible && toolbox ? toolbox.getWidth() : 0;

        return (
            <React.Fragment>
                <DroppableBlocks
                    componentRef={this.setBlocks}
                    onDrop={this.handleDrop}
                    {...props}
                />
                {toolbox ? (
                    <PaletteToggle
                        paletteVisible={paletteVisible}
                        style={{left: `${toggleButtonLeft}px`}}
                        onClick={this.handleTogglePalette}
                    />
                ) : null}
                {toolbox ? (
                    <BlocksScreenshotButton
                        onClick={this.handleDownloadBlocksImage}
                    />
                ) : null}
                {this.state.prompt ? (
                    <Prompt
                        defaultValue={this.state.prompt.defaultValue}
                        isStage={vm.runtime.getEditingTarget().isStage}
                        showListMessage={this.state.prompt.varType === this.ScratchBlocks.LIST_VARIABLE_TYPE}
                        label={this.state.prompt.message}
                        showCloudOption={this.state.prompt.showCloudOption}
                        showVariableOptions={this.state.prompt.showVariableOptions}
                        title={this.state.prompt.title}
                        vm={vm}
                        onCancel={this.handlePromptClose}
                        onOk={this.handlePromptCallback}
                    />
                ) : null}
                {extensionLibraryVisible ? (
                    <ExtensionLibrary
                        vm={vm}
                        onCategorySelected={this.handleCategorySelected}
                        onRequestClose={onRequestCloseExtensionLibrary}
                    />
                ) : null}
                {customProceduresVisible ? (
                    <CustomProcedures
                        options={{
                            media: options.media
                        }}
                        onRequestClose={this.handleCustomProceduresClose}
                    />
                ) : null}
            </React.Fragment>
        );
    }
}

Blocks.propTypes = {
    selectedBlocks: PropTypes.object,
    tutorialAllowedBlocks: PropTypes.object,
    anyModalVisible: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    customProceduresVisible: PropTypes.bool,
    extensionLibraryVisible: PropTypes.bool,
    isRtl: PropTypes.bool,
    isVisible: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    messages: PropTypes.objectOf(PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.object
    ])),
    onActivateColorPicker: PropTypes.func,
    onActivateCustomProcedures: PropTypes.func,
    onOpenConnectionModal: PropTypes.func,
    onOpenSoundRecorder: PropTypes.func,
    onRequestCloseCustomProcedures: PropTypes.func,
    onRequestCloseExtensionLibrary: PropTypes.func,
    onSetScratchBlocks: PropTypes.func,
    options: PropTypes.shape({
        media: PropTypes.string,
        zoom: PropTypes.shape({
            controls: PropTypes.bool,
            wheel: PropTypes.bool,
            startScale: PropTypes.number
        }),
        comments: PropTypes.bool,
        collapse: PropTypes.bool
    }),
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    colorMode: PropTypes.oneOf(Object.keys(colorModeMap)),
    dnclMode: PropTypes.bool, // === Smalruby: DNCL block filtering ===
    toolboxXML: PropTypes.string,
    updateMetrics: PropTypes.func,
    updateToolboxState: PropTypes.func,
    useCatBlocks: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired,
    activeTabIndex: PropTypes.number,
    workspaceMetrics: PropTypes.shape({
        targets: PropTypes.objectOf(PropTypes.object)
    }),
    paletteVisible: PropTypes.bool,
    onTogglePalette: PropTypes.func,
    projectTitle: PropTypes.string
};

Blocks.defaultOptions = {
    zoom: {
        controls: true,
        wheel: true,
        startScale: BLOCKS_DEFAULT_SCALE
    },
    grid: {
        spacing: 40,
        length: 2,
        colour: '#ddd'
    },
    comments: true,
    collapse: false,
    sounds: false
};

Blocks.defaultProps = {
    isVisible: true,
    options: Blocks.defaultOptions,
    colorMode: DEFAULT_MODE
};

const mapStateToProps = state => ({
    anyModalVisible: (
        Object.keys(state.scratchGui.modals).some(key => state.scratchGui.modals[key]) ||
        state.scratchGui.mode.isFullScreen
    ),
    extensionLibraryVisible: state.scratchGui.modals.extensionLibrary,
    isRtl: state.locales.isRtl,
    locale: state.locales.locale,
    messages: state.locales.messages,
    dnclMode: state.scratchGui.dnclMode.dnclMode, // === Smalruby: DNCL block filtering ===
    selectedBlocks: state.scratchGui.blockDisplay.selectedBlocks,
    tutorialAllowedBlocks: state.scratchGui.cards.tutorialAllowedBlocks,
    toolboxXML: state.scratchGui.toolbox.toolboxXML,
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
    customProceduresVisible: state.scratchGui.customProcedures.active,
    workspaceMetrics: state.scratchGui.workspaceMetrics,
    useCatBlocks: isTimeTravel2020(state) || state.scratchGui.settings.theme === CAT_BLOCKS_THEME,
    paletteVisible: state.scratchGui.paletteVisibility.paletteVisible,
    projectTitle: state.scratchGui.projectTitle
});

const mapDispatchToProps = dispatch => ({
    onActivateColorPicker: callback => dispatch(activateColorPicker(callback)),
    onActivateCustomProcedures: (data, callback) => dispatch(activateCustomProcedures(data, callback)),
    onOpenConnectionModal: id => {
        dispatch(setConnectionModalExtensionId(id));
        dispatch(openConnectionModal());
    },
    onOpenSoundRecorder: () => {
        dispatch(activateTab(SOUNDS_TAB_INDEX));
        dispatch(openSoundRecorder());
    },
    onRequestCloseExtensionLibrary: () => {
        dispatch(closeExtensionLibrary());
    },
    onRequestCloseCustomProcedures: data => {
        dispatch(deactivateCustomProcedures(data));
    },
    onSetScratchBlocks: scratchBlocks => {
        dispatch(setScratchBlocks(scratchBlocks));
    },
    updateToolboxState: toolboxXML => {
        dispatch(updateToolbox(toolboxXML));
    },
    updateMetrics: metrics => {
        dispatch(updateMetrics(metrics));
    },
    onTogglePalette: () => {
        dispatch(togglePalette());
    }
});

export default errorBoundaryHOC('Blocks')(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(Blocks)
);
