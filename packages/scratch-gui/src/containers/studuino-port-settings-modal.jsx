// 入出力の設定のモーダルのコンテナ（#2215）。開いたときの VM の設定を下書きにして変え、
// ［割り当て］で VM（extensionStorage）に書く。閉じる（×）は下書きを捨てる。
import {
    getStuduinoSettings,
    setStuduinoSettings,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { connect } from 'react-redux';
import StuduinoPortSettingsModalComponent from '../components/studuino-port-settings-modal/studuino-port-settings-modal.jsx';
import { clearAllPorts, setCalibration, setPortPart } from '../lib/studuino-port-settings';
import { closeStuduinoPortSettings, isStuduinoPortSettingsVisible } from '../reducers/studuino-mode';

const PortSettingsModal = ({ onClose, vm }) => {
    const [draft, setDraft] = useState(() => getStuduinoSettings(vm.runtime));

    const handleChangePart = useCallback((port, kind) => setDraft((d) => setPortPart(d, port, kind)), []);
    const handleChangeCalibration = useCallback((port, value) => setDraft((d) => setCalibration(d, port, value)), []);
    const handleClearAll = useCallback(() => setDraft((d) => clearAllPorts(d)), []);
    const handleAssign = useCallback(() => {
        // 動かし方（mode）は、開いているあいだに変わっていても VM のいまの値を使う
        const current = getStuduinoSettings(vm.runtime);
        setStuduinoSettings(vm.runtime, { ...current, ports: draft.ports, calibration: draft.calibration });
        onClose();
    }, [draft, onClose, vm]);

    return (
        <StuduinoPortSettingsModalComponent
            settings={draft}
            onAssign={handleAssign}
            onChangeCalibration={handleChangeCalibration}
            onChangePart={handleChangePart}
            onClearAll={handleClearAll}
            onClose={onClose}
        />
    );
};

PortSettingsModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    vm: PropTypes.shape({ runtime: PropTypes.object.isRequired }).isRequired,
};

// 開いているときだけ描く（開くたびに VM のいまの設定から下書きを作り直す）
const StuduinoPortSettingsModal = ({ visible, onClose, vm }) =>
    visible && vm && vm.runtime ? <PortSettingsModal vm={vm} onClose={onClose} /> : null;

StuduinoPortSettingsModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    visible: PropTypes.bool,
    vm: PropTypes.shape({ runtime: PropTypes.object }),
};

const mapStateToProps = (state) => ({
    visible: isStuduinoPortSettingsVisible(state),
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onClose: () => dispatch(closeStuduinoPortSettings()),
});

export { PortSettingsModal };
export default connect(mapStateToProps, mapDispatchToProps)(StuduinoPortSettingsModal);
