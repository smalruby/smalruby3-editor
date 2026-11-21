// 動かし方を切り替えられないときのダイアログのつなぎこみ（#2214・S11）。
// ［すべて消して切り替える］は新規と同じふるまい: 保存していない変更があれば確かめてから新規の作品にし、
// 読みこみが終わったら（containers/studuino-mode-sync.jsx）ポートの設定を残したまま動かし方を変える。
import { getStuduinoSettings } from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import StuduinoModeSwitchDialog from '../components/studuino-mode-switch-dialog/studuino-mode-switch-dialog.jsx';
import sharedMessages from '../lib/shared-messages';
import { jumpToBlock } from '../lib/studuino-block-marks';
import { settingsAfterClear } from '../lib/studuino-mode-check';
import { clearGoogleDriveFile } from '../reducers/google-drive-file';
import { requestNewProject } from '../reducers/project-state';
import {
    closeStuduinoSwitchDialog,
    getStuduinoSwitchDialog,
    setStuduinoPendingSettings,
} from '../reducers/studuino-mode';

const StuduinoModeSwitchDialogContainer = ({ dialog, projectChanged, vm, onClear, onClose }) => {
    const intl = useIntl();
    const handleShowBlocks = useCallback(() => {
        onClose();
        if (dialog && dialog.blocks.length > 0) jumpToBlock(vm, dialog.blocks[0]);
    }, [dialog, vm, onClose]);
    const handleClear = useCallback(() => {
        // 新規と同じ: 保存していない変更があれば確かめる（menu-bar-hoc の confirmReadyToReplaceProject と同じ文言）
        // eslint-disable-next-line no-alert
        if (projectChanged && !window.confirm(intl.formatMessage(sharedMessages.replaceProjectWarning))) return;
        onClear(settingsAfterClear(getStuduinoSettings(vm.runtime), dialog.toStuduino));
    }, [dialog, intl, projectChanged, vm, onClear]);
    if (!dialog) return null;
    return (
        <StuduinoModeSwitchDialog
            count={dialog.blocks.length}
            toStuduino={dialog.toStuduino}
            onCancel={onClose}
            onClearAndSwitch={handleClear}
            onShowBlocks={handleShowBlocks}
        />
    );
};

StuduinoModeSwitchDialogContainer.propTypes = {
    dialog: PropTypes.shape({
        blocks: PropTypes.arrayOf(PropTypes.object).isRequired,
        toStuduino: PropTypes.bool.isRequired,
    }),
    projectChanged: PropTypes.bool,
    vm: PropTypes.object,
    onClear: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => ({
    dialog: getStuduinoSwitchDialog(state),
    projectChanged: state.scratchGui.projectChanged,
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onClose: () => dispatch(closeStuduinoSwitchDialog()),
    onClear: (settings) => {
        dispatch(closeStuduinoSwitchDialog());
        dispatch(setStuduinoPendingSettings(settings));
        dispatch(requestNewProject(false));
        dispatch(clearGoogleDriveFile());
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(StuduinoModeSwitchDialogContainer);
