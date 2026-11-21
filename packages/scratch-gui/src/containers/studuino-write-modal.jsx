// Studuino モードの書きこみのモーダルのつなぎこみ（#2219・S13）。
// 開くと、検査（構文木の生成）→ hex を作る（Lambda）まで進み、［書きこむ］で Studuino に書きこむ
// （Web Serial のポートを選ぶのは、押したときでないとできないため）。停止（緑の旗の横）で中断する。
import { getStuduinoSettings } from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import StuduinoWriteModal from '../components/studuino-write-modal/studuino-write-modal.jsx';
import log from '../lib/log';
import { FirmwareFlasher, isWebSerialSupported } from '../lib/smalrubot-firmware-flasher';
import { jumpToBlock } from '../lib/studuino-block-marks';
import { compileStuduinoIr, studuinoCompileErrorMessageId } from '../lib/studuino-compile';
import { buildStuduinoIrFromVm } from '../lib/studuino-ir/build-studuino-ir';
import { STEP, stepAfterCheck, writePercent } from '../lib/studuino-write-steps';
import { closeStuduinoWrite, getStuduinoWriteState } from '../reducers/studuino-mode';

class WriteAborted extends Error {}

const StuduinoWriteModalContainer = ({ abortCount, visible, vm, onClose }) => {
    const [state, setState] = useState({ step: STEP.CHECKING });
    const abortRef = useRef(null);
    const abortedRef = useRef(false);

    const start = useCallback(() => {
        abortedRef.current = false;
        const check = stepAfterCheck(buildStuduinoIrFromVm(vm, getStuduinoSettings(vm.runtime)));
        setState(check);
        if (check.step !== STEP.COMPILING) return;
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        abortRef.current = controller;
        compileStuduinoIr(check.ir, controller ? { signal: controller.signal } : {}).then((result) => {
            if (abortedRef.current) return;
            if (result.ok) setState({ step: STEP.READY, compiled: result });
            else setState({ step: STEP.COMPILE_FAILED, messageId: studuinoCompileErrorMessageId(result), result });
        });
    }, [vm]);

    useEffect(() => {
        if (visible) start();
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [visible, start]);

    // 停止 = 書きこみの中断（S13）
    const firstAbort = useRef(abortCount);
    useEffect(() => {
        if (!visible || abortCount === firstAbort.current) return;
        firstAbort.current = abortCount;
        abortedRef.current = true;
        if (abortRef.current) abortRef.current.abort();
        setState((s) => (s.step === STEP.DONE ? s : { step: STEP.ABORTED }));
    }, [abortCount, visible]);

    const handleWrite = useCallback(() => {
        const compiled = state.compiled;
        if (!compiled) return;
        abortedRef.current = false;
        setState({ step: STEP.WRITING, compiled, percent: 0 });
        const onProgress = (written, total) => {
            if (abortedRef.current) throw new WriteAborted('aborted');
            setState({ step: STEP.WRITING, compiled, percent: writePercent(written, total) });
        };
        new FirmwareFlasher()
            .flashHexText(compiled.hex, onProgress)
            .then(() => setState({ step: STEP.DONE, compiled }))
            .catch((e) => {
                if (e instanceof WriteAborted || abortedRef.current) {
                    setState({ step: STEP.ABORTED, compiled });
                    return;
                }
                log.error('Studuino write failed:', e);
                // ポートを選ばずに閉じたとき（NotFoundError）は、書きこむ前にもどす
                if (e && e.name === 'NotFoundError') setState({ step: STEP.READY, compiled });
                else setState({ step: STEP.WRITE_FAILED, compiled });
            });
    }, [state]);

    const handleShowBlocks = useCallback(() => {
        const first = state.blocks && state.blocks[0];
        onClose();
        if (first) jumpToBlock(vm, first);
    }, [state, vm, onClose]);

    const handleSaveSource = useCallback(() => {
        const source = state.compiled && state.compiled.source;
        if (!source) return;
        const url = URL.createObjectURL(new Blob([source], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'studuino_program.ino';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, [state]);

    if (!visible) return null;
    return (
        <StuduinoWriteModal
            {...state}
            webSerialSupported={isWebSerialSupported()}
            onClose={onClose}
            onRetry={start}
            onSaveSource={handleSaveSource}
            onShowBlocks={handleShowBlocks}
            onWrite={handleWrite}
        />
    );
};

StuduinoWriteModalContainer.propTypes = {
    abortCount: PropTypes.number,
    visible: PropTypes.bool,
    vm: PropTypes.object,
    onClose: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
    const write = getStuduinoWriteState(state);
    return { abortCount: write.abortCount, visible: write.visible, vm: state.scratchGui.vm };
};

const mapDispatchToProps = (dispatch) => ({
    onClose: () => dispatch(closeStuduinoWrite()),
});

export { StuduinoWriteModalContainer as WriteModal };
export default connect(mapStateToProps, mapDispatchToProps)(StuduinoWriteModalContainer);
