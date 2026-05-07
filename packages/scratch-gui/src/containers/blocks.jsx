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
import {injectExtensionBlockIcons, injectExtensionCategoryMode} from '../lib/settings/color-mode/blockHelpers';

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
        this.ScratchBlocks = VMScratchBlocks(props.vm);
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
        this.ScratchBlocks.dialog.setPrompt(this.handlePromptStart);
        this.ScratchBlocks.ScratchVariables.setPromptHandler(
            this.handlePromptStart
        );
        this.ScratchBlocks.StatusIndicatorLabel.statusButtonCallback = this.handleConnectionModalStart;
        this.ScratchBlocks.recordSoundCallback = this.handleOpenSoundRecorder;

        this.state = {
            prompt: null
        };
        this.onTargetsUpdate = debounce(this.onTargetsUpdate, 100);
        this.toolboxUpdateQueue = [];
        this._pendingScrollCenter = false;
        // === Smalruby: Start of deferred flyout rebuild ===
        // Track whether the code tab has ever been visible. When the workspace
        // is first created while a non-code tab is active (?tab=ruby etc.),
        // Blockly computes SVG text widths as 0 because the container is hidden.
        // On the first visibility we must rebuild the flyout without recycling
        // so that all blocks get correct measurements.
        this._hasBeenVisible = false;
        // === Smalruby: End of deferred flyout rebuild ===
    }
    componentDidMount () {
        this.ScratchBlocks = VMScratchBlocks(this.props.vm);
        this.props.onSetScratchBlocks(this.ScratchBlocks);
        this.ScratchBlocks.dialog.setPrompt(this.handlePromptStart);
        this.ScratchBlocks.ScratchVariables.setPromptHandler(
            this.handlePromptStart
        );
        this.ScratchBlocks.StatusIndicatorLabel.statusButtonCallback = this.handleConnectionModalStart;
        this.ScratchBlocks.recordSoundCallback = this.handleOpenSoundRecorder;

        this.ScratchBlocks.FieldColourSlider.activateEyedropper_ = this.props.onActivateColorPicker;
        this.ScratchBlocks.ScratchProcedures.externalProcedureDefCallback = this.props.onActivateCustomProcedures;
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);

        const workspaceConfig = defaultsDeep({},
            Blocks.defaultOptions,
            this.props.options,
            {
                rtl: this.props.isRtl,
                toolbox: this.props.toolboxXML,
                theme: new this.ScratchBlocks.Theme(
                    this.props.colorMode,
                    getColorsForMode(this.props.colorMode)
                ),
                // TODO: use scratch-blocks constants instead of bare strings
                scratchTheme: this.props.useCatBlocks ? 'catblocks' : 'classic'
            }
        );
        this.workspace = this.ScratchBlocks.inject(this.blocks, workspaceConfig);
        this.workspace.registerToolboxCategoryCallback(
            'VARIABLE',
            this.ScratchBlocks.ScratchVariables.getVariablesCategory
        );
        this.workspace.registerToolboxCategoryCallback(
            'PROCEDURE',
            this.ScratchBlocks.ScratchProcedures.getProceduresCategory
        );

        this.toolboxUpdateChangeListener = event => {
            if (
                event.type === this.ScratchBlocks.Events.VAR_CREATE ||
                event.type === this.ScratchBlocks.Events.VAR_RENAME ||
                event.type === this.ScratchBlocks.Events.VAR_DELETE ||
                (event.type === this.ScratchBlocks.Events.BLOCK_DELETE &&
                    event.oldJson.type === 'procedures_definition') ||
                // Only refresh the toolbox when procedure block creations are
                // triggered by undoing a deletion (implied by recordUndo being
                // false on the event).
                (event.type === this.ScratchBlocks.Events.BLOCK_CREATE &&
                    event.json.type === 'procedures_definition' &&
                    !event.recordUndo)
            ) {
                this.requestToolboxUpdate();
            }
        };
        this.workspace.addChangeListener(this.toolboxUpdateChangeListener);

        // Register buttons under new callback keys for creating variables,
        // lists, and procedures from extensions.

        const toolboxWorkspace = this.workspace.getFlyout().getWorkspace();

        const varListButtonCallback = type =>
            (() => this.ScratchBlocks.ScratchVariables.createVariable(this.workspace, null, type));
        const procButtonCallback = () => {
            this.ScratchBlocks.ScratchProcedures.createProcedureDefCallback(this.workspace);
        };

        toolboxWorkspace.registerButtonCallback('MAKE_A_VARIABLE', varListButtonCallback(''));
        toolboxWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));
        toolboxWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);

        // Store the xml of the toolbox that is actually rendered.
        // This is used in componentDidUpdate instead of prevProps, because
        // the xml can change while e.g. on the costumes tab.
        this._renderedToolboxXML = this.props.toolboxXML;

        // === Smalruby: scratch-blocks v2 removed workspace.setToolboxRefreshEnabled.
        // The toolbox refresh suppression is handled differently in v2.

        // @todo change this when blockly supports UI events
        addFunctionListener(this.workspace, 'translate', this.onWorkspaceMetricsChange);
        addFunctionListener(this.workspace, 'zoom', this.onWorkspaceMetricsChange);

        this.attachVM();
        // Only update blocks/vm locale when visible to avoid sizing issues
        // If locale changes while not visible it will get handled in didUpdate
        if (this.props.isVisible) {
            this.setLocale();
            this._hasBeenVisible = true; // === Smalruby: deferred flyout rebuild ===
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
            // === Smalruby: Start of deferred flyout rebuild ===
            if (!this._hasBeenVisible) {
                // First time the code tab becomes visible after being initially
                // hidden (e.g. ?tab=ruby). Flyout blocks were created while the
                // container was display:none, so their SVG text measurements are
                // wrong. Disable flyout recycling and force a full rebuild.
                this._hasBeenVisible = true;
                this.workspace.getFlyout().setRecyclingEnabled(false);
                this.props.vm.refreshWorkspace();
                this.requestToolboxUpdate();
                this.withToolboxUpdates(() => {
                    this.workspace.getFlyout().setRecyclingEnabled(true);
                });
            } else
            // === Smalruby: End of deferred flyout rebuild ===
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
        // Hide any open field editor and move Blockly focus to the workspace
        // root before disposing. Without this, BlockSvg.dispose() detects the
        // focused element is inside a block and schedules a stale
        // setTimeout(() => focusTree(workspace)), which fires after the
        // workspace is unregistered and throws
        // "Attempted to focus unregistered tree" (scratch-blocks#3460).
        //
        // focusNode(workspace) — not focusTree(workspace) — is used here
        // because focusTree would restore focus to whatever was previously
        // focused in this workspace (likely the same block about to be
        // disposed). focusNode pins focus to the workspace root directly,
        // ensuring no block is focused when dispose() runs.
        try {
            this.ScratchBlocks.WidgetDiv?.hide?.();
            // focusNode requires the workspace to be a focusable IFocusableNode;
            // skip silently if the workspace is already in a non-focusable state.
            if (this.workspace?.canBeFocused?.()) {
                this.ScratchBlocks.getFocusManager().focusNode(this.workspace);
            }
        } catch {
            // Workspace may already be unregistered — fall through to dispose.
        }
        this.workspace?.dispose?.();
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
        // Re-render so the palette-toggle button picks up the now-correct
        // toolbox.getWidth() + flyout.getWidth() — render() runs *before*
        // this method, so the first render after a paletteVisible change
        // sees stale flyout dimensions and lands the toggle on top of the
        // blocks (issue: toggle button at toolbox.getWidth() instead of
        // toolbox.getWidth() + flyout.getWidth() after re-open).
        this.forceUpdate();
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

        const scale = this.workspace.getFlyout().getWorkspace().scale;
        let selectedCategoryName = null;
        const selectedItem = this.workspace.getToolbox()?.getSelectedItem?.();
        if (selectedItem) {
            selectedCategoryName = selectedItem.getName();
        }
        const selectedCategoryScrollPosition = selectedCategoryName ?
            this.workspace
                .getFlyout()
                .getCategoryScrollPosition(selectedCategoryName) * scale :
            0;
        const offsetWithinCategory =
            this.workspace.getFlyout().getWorkspace()
                .getMetrics().viewTop -
            selectedCategoryScrollPosition;

        this.workspace.updateToolbox(this.props.toolboxXML);
        if (selectedCategoryName) {
            this.workspace.getToolbox().runAfterRerender(() => {
                const newCategoryScrollPosition = this.workspace
                    .getFlyout()
                    .getCategoryScrollPosition(selectedCategoryName);
                if (newCategoryScrollPosition) {
                    this.workspace
                        .getFlyout()
                        .getWorkspace()
                        .scrollbar.setY(
                            (newCategoryScrollPosition * scale) + offsetWithinCategory
                        );
                }
            });
        }
        // === Smalruby: Start of forceRerender error guard ===
        // scratch-blocks v2 throws "Cannot read properties of undefined
        // (reading '2')" inside the toolbox flyout's recycling/dispose path
        // (clearOldBlocks → disposeItem → block.dispose) for some Ruby
        // converted scripts (e.g. `a = [1,2,3]; a.each do |i| puts i end`
        // creates a list variable that, when the dynamic Variables category
        // re-renders, hits a v2 bug). If forceRerender throws and we don't
        // mark _renderedToolboxXML as updated, componentDidUpdate immediately
        // queues another updateToolbox via requestToolboxUpdate(), causing
        // an infinite loop that floods the console and freezes the UI.
        //
        // Always update _renderedToolboxXML so the loop is broken, and
        // swallow the v2 internal error: the toolbox shows previously
        // recycled / fallback content, but the editor stays usable.
        // Recycling is also disabled across the call to take the
        // non-recycling dispose path when possible.
        this._renderedToolboxXML = this.props.toolboxXML;
        const flyout = this.workspace.getFlyout();
        const recyclingWasEnabled = flyout && typeof flyout.recyclingEnabled === 'function' ?
            flyout.recyclingEnabled() : true;
        if (flyout && typeof flyout.setRecyclingEnabled === 'function') {
            flyout.setRecyclingEnabled(false);
        }
        try {
            this.workspace.getToolbox().forceRerender();
        } catch (err) {
            log.error('Toolbox forceRerender failed (scratch-blocks v2):', err);
        } finally {
            if (flyout && typeof flyout.setRecyclingEnabled === 'function') {
                flyout.setRecyclingEnabled(recyclingWasEnabled);
            }
        }
        // === Smalruby: End of forceRerender error guard ===

        const queue = this.toolboxUpdateQueue;
        this.toolboxUpdateQueue = [];
        queue.forEach(fn => fn());

        // === Smalruby: Re-apply palette visibility since updateToolbox may re-show the flyout
        if (!this.props.paletteVisible) {
            this._applyPaletteVisibility(false);
        }

        // === Smalruby: scroll the flyout to a newly added extension category.
        // `handleExtensionAdded` flags the extension id; once the toolbox has
        // been rebuilt (now), look the category up and scroll to it.
        const pendingId = this._pendingScrollToCategoryId;
        if (pendingId) {
            this._pendingScrollToCategoryId = null;
            const toolbox = this.workspace?.getToolbox?.();
            const items = toolbox?.getToolboxItems?.() || [];
            const item = items.find(it => it.toolboxItemDef_?.id === pendingId);
            const name = item?.toolboxItemDef_?.name || item?.name_;
            if (item && name) {
                if (typeof toolbox.selectCategoryByName === 'function') {
                    toolbox.selectCategoryByName(name);
                }
                // ContinuousToolbox.selectCategoryByName updates the toolbox
                // selection but does not scroll the flyout. The continuous
                // flyout exposes scrollToCategory(item) for that.
                const flyout = this.workspace.getFlyout?.();
                if (flyout && typeof flyout.scrollToCategory === 'function') {
                    flyout.scrollToCategory(item);
                }
            }
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
        this.ScratchBlocks.glowStack(data.id, true);
    }
    onScriptGlowOff (data) {
        this.ScratchBlocks.glowStack(data.id, false);
    }
    onBlockGlowOn (/* data */) {
        // No-op in scratch-blocks v2: per-block glow is not supported
        // by the Blockly v12 WorkspaceSvg API. Upstream upstreamed the
        // same no-op pattern; per-block glow may return in a future
        // scratch-blocks release.
    }
    onBlockGlowOff (/* data */) {
        // No-op (see onBlockGlowOn).
    }
    onVisualReport (data) {
        // Don't show visual report in Code tab when Ruby tab is active
        if (this.props.activeTabIndex === RUBY_TAB_INDEX) {
            return;
        }
        this.ScratchBlocks.reportValue(data.id, data.value);
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

        // Disable Blockly events during workspace reload. In Blockly v2, Events.fire()
        // enqueues events for async dispatch (after rendering), so the old pattern of
        // removing and re-adding the blockListener no longer prevents spurious events
        // from reaching the VM — the queued events fire after the listener is re-added.
        // Disabling events entirely during the load ensures nothing is queued.
        this.workspace.removeChangeListener(this.toolboxUpdateChangeListener);
        let fromRuby = false;
        const rubyCommentIconsToMinimize = [];
        const rubyWorkspaceCommentsToCollapse = [];
        try {
            this.ScratchBlocks.Events.disable();
            const dom = this.ScratchBlocks.utils.xml.textToDom(data.xml);
            this.ScratchBlocks.clearWorkspaceAndLoadFromXml(dom, this.workspace);

            // === Smalruby: Start of Ruby-converted block positioning ===
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

                    // Block-attached comments are rendered as comment icons
                    // on the block in scratch-blocks v2 (no longer as separate
                    // WorkspaceComment objects), so workspace.getTopComments()
                    // does not return them. Collect block IDs whose comment
                    // starts with `@ruby:` and apply setBubbleVisible(false)
                    // + setBubbleLocation in the finally block — calling them
                    // while Events are disabled is a no-op in v2, and stale
                    // icon references can be invalidated by Blockly during
                    // workspace settling.
                    //
                    // Also propagate the comment x/y in the VM target back to
                    // a block-relative offset (right of the block at the
                    // block's y). The Ruby converter creates every `@ruby:*`
                    // comment at the same workspace coord (200, 0), which
                    // causes multiple comment bubbles to stack on top of each
                    // other in scratch-blocks v2 (it preserves explicit
                    // comment coords instead of auto-positioning per block).
                    // Helper: walk up to the top-level (root statement) block
                    // for x-alignment. Comments on nested input blocks (e.g.
                    // a variable input inside a say block) would otherwise
                    // misalign because each nested block has a different x.
                    const getRootBlockX = wsBlock => {
                        let cur = wsBlock;
                        while (cur && typeof cur.getParent === 'function' && cur.getParent()) {
                            cur = cur.getParent();
                        }
                        if (cur && typeof cur.getRelativeToSurfaceXY === 'function') {
                            return cur.getRelativeToSurfaceXY().x;
                        }
                        return 0;
                    };
                    const allBlocks = this.workspace.getAllBlocks(false);
                    allBlocks.forEach(wsBlock => {
                        const commentText = typeof wsBlock.getCommentText === 'function' ?
                            wsBlock.getCommentText() : null;
                        if (commentText && commentText.startsWith('@ruby:')) {
                            rubyCommentIconsToMinimize.push(wsBlock.id);
                            const targetComments = this.props.vm.editingTarget.comments;
                            const blockData = blocks.getBlock(wsBlock.id);
                            const commentId = blockData && blockData.comment;
                            if (targetComments && commentId && targetComments[commentId]) {
                                const blockXY = wsBlock.getRelativeToSurfaceXY();
                                const rootX = getRootBlockX(wsBlock);
                                const rtl = this.workspace.RTL;
                                const dx = rtl ? 20 : -220;
                                // Align x to the root (top-level) block so
                                // every `@ruby:*` comment in a single script
                                // shares the same left edge regardless of how
                                // deeply nested its source block is.
                                targetComments[commentId].x = rootX + dx;
                                targetComments[commentId].y = blockXY.y;
                            }
                        }
                    });

                    // Workspace-level comments (e.g. `@ruby:class`) have no
                    // blockId — they are returned by getTopComments() and are
                    // separate WorkspaceComment objects in scratch-blocks v2.
                    // Collapse `@ruby:*` ones via the v2 API (setCollapsed,
                    // replacing v1's setMinimized) and align them to the
                    // left of the first top block.
                    const firstTopBlock = this.workspace.getTopBlocks(true)[0];
                    this.workspace.getTopComments(false).forEach(comment => {
                        if (!firstTopBlock || comment.blockId) return;
                        const text = typeof comment.getText === 'function' ?
                            comment.getText() : comment.text;
                        if (!text || !text.startsWith('@ruby:')) return;
                        // Defer setCollapsed(true) to the finally block:
                        // calling it while Events are disabled is a no-op,
                        // and a synchronous call here is overridden by
                        // scratch-blocks v2's post-load rendering pass.
                        rubyWorkspaceCommentsToCollapse.push(comment.id);

                        const blockXY = firstTopBlock.getRelativeToSurfaceXY();
                        const rtl = this.workspace.RTL;
                        const dx = rtl ? 20 : -220;
                        const x = blockXY.x + dx;
                        const y = blockXY.y;
                        if (typeof comment.moveTo === 'function') {
                            comment.moveTo(new this.ScratchBlocks.utils.Coordinate(x, y));
                        }

                        const targetComments = this.props.vm.editingTarget.comments;
                        if (targetComments && targetComments[comment.id]) {
                            targetComments[comment.id].x = x;
                            targetComments[comment.id].y = y;
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
            // === Smalruby: End of Ruby-converted block positioning ===
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
        } finally {
            this.ScratchBlocks.Events.enable();
            // === Smalruby: Start of @ruby:* comment minimize ===
            // setBubbleVisible(false) only takes effect when Events are enabled,
            // because scratch-blocks v2 gates the visibility update on its
            // event dispatch path. Apply the collected minimizations now that
            // the event system is back online.
            if (this.workspace &&
                (rubyCommentIconsToMinimize.length > 0 ||
                    rubyWorkspaceCommentsToCollapse.length > 0)) {
                // Defer: scratch-blocks v2 finishes its post-load rendering
                // pass after onWorkspaceUpdate returns, and a synchronous
                // setBubbleVisible(false) call is overridden by that pass.
                // Re-fetch icons by block ID inside the timer because the
                // icon references collected synchronously can be detached
                // before this point. Also nudge the bubble location to be
                // adjacent to its own block — the Ruby converter places
                // every `@ruby:*` comment at the same workspace coord
                // (200, 0), which makes scratch-blocks v2 stack the
                // comment bubbles on top of each other.
                const blockIds = rubyCommentIconsToMinimize;
                const ws = this.workspace;
                setTimeout(() => {
                    blockIds.forEach(blockId => {
                        const wsBlock = ws.getBlockById && ws.getBlockById(blockId);
                        if (!wsBlock || typeof wsBlock.getIcons !== 'function') return;
                        const icons = wsBlock.getIcons();
                        const commentIcon = icons.find(icon => {
                            const t = icon.getType && icon.getType();
                            return t && t.name === 'comment';
                        });
                        if (!commentIcon) return;
                        if (typeof commentIcon.setBubbleLocation === 'function') {
                            const blockXY = wsBlock.getRelativeToSurfaceXY();
                            // Align x to the top-level ancestor so nested
                            // input blocks' comments share the same left edge.
                            let rootBlock = wsBlock;
                            while (
                                rootBlock &&
                                typeof rootBlock.getParent === 'function' &&
                                rootBlock.getParent()
                            ) {
                                rootBlock = rootBlock.getParent();
                            }
                            const rootX = rootBlock && typeof rootBlock.getRelativeToSurfaceXY === 'function' ?
                                rootBlock.getRelativeToSurfaceXY().x : 0;
                            const rtl = ws.RTL;
                            const dx = rtl ? 20 : -220;
                            commentIcon.setBubbleLocation(
                                new this.ScratchBlocks.utils.Coordinate(
                                    rootX + dx, blockXY.y
                                )
                            );
                        }
                        if (typeof commentIcon.setBubbleVisible === 'function') {
                            commentIcon.setBubbleVisible(false);
                        }
                    });
                    // Workspace-level comments (@ruby:class etc.) need
                    // setCollapsed(true) for the v2 collapse path. Re-fetch
                    // by ID since references collected during onWorkspaceUpdate
                    // can be detached.
                    rubyWorkspaceCommentsToCollapse.forEach(commentId => {
                        const wsComment = ws.getCommentById && ws.getCommentById(commentId);
                        if (wsComment && typeof wsComment.setCollapsed === 'function') {
                            wsComment.setCollapsed(true);
                        }
                    });
                }, 100);
            }
            // === Smalruby: End of @ruby:* comment minimize ===
        }

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
        // Let events get flushed before readding the toolbox-updater listener
        // to avoid unneeded refreshes.
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.workspace.addChangeListener(
                    this.toolboxUpdateChangeListener
                );
            });
        });
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
                        staticBlocksJson.push(injectExtensionBlockIcons(blockInfo.json, this.props.colorMode));
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

        // After the toolbox finishes its async rebuild, scroll the flyout to
        // the newly added extension category. In scratch-blocks v1 the flyout
        // automatically focused the just-added category, but the v2
        // continuous toolbox does not do this on its own — the flyout stays
        // scrolled to wherever it was, so the user never sees the new blocks.
        //
        // `updateToolboxState` only dispatches the Redux update; the actual
        // `workspace.updateToolbox(...)` rebuild happens later from
        // `componentDidUpdate` -> `requestToolboxUpdate` (setTimeout 0). Mark
        // the pending category and let the post-rebuild path scroll to it.
        this._pendingScrollToCategoryId = categoryInfo.id;
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
            const toolbox = this.workspace.getToolbox();
            toolbox.setSelectedItem(toolbox.getToolboxItemById(categoryId));
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
        this.workspace.getFlyout().refreshStatusButtons();
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
        // scratch-blocks v2 renamed `refreshToolboxSelection_` → `refreshToolboxSelection`
        // and replaced `toolbox_.scrollToCategoryById(id)` with `getToolbox().scrollToCategory(id)`.
        if (typeof ws.refreshToolboxSelection === 'function') {
            ws.refreshToolboxSelection();
        }
        const toolbox = ws.getToolbox?.();
        if (toolbox && typeof toolbox.scrollToCategory === 'function') {
            toolbox.scrollToCategory('myBlocks');
        }
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

        // Calculate toggle button position based on toolbox + flyout combined width.
        // In scratch-blocks v2 toolbox.getWidth() returns only the category-column
        // width, so we add the flyout width separately to land on the visual edge
        // of the open palette (matching docs/mobile-ui/screenshots/02-code-palette-open.png).
        const toolbox = this.workspace ? this.workspace.getToolbox() : null;
        const flyout = this.workspace ? this.workspace.getFlyout() : null;
        const toggleButtonLeft = paletteVisible && toolbox ?
            toolbox.getWidth() + (flyout?.getWidth?.() ?? 0) :
            0;

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
        pinch: true,
        startScale: BLOCKS_DEFAULT_SCALE
    },
    move: {
        wheel: true
    },
    grid: {
        spacing: 40,
        length: 2,
        colour: '#ddd'
    },
    comments: true,
    collapse: false,
    sounds: false,
    trashcan: false,
    modalInputs: false
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

export {Blocks};
export default errorBoundaryHOC('Blocks')(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(Blocks)
);
