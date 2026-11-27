// Studuino モードの使えないブロックの印と「使えないブロックが n 個あります」（#2214・M6・S5・M4）。
// 押すと、その 1 つ目のブロックへ移る（もう一度押すと次のブロック）。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';
import { jumpToBlock, markUnusableBlocks } from '../lib/studuino-block-marks';
import { findStuduinoUnusableBlocks, targetsFromVm } from '../lib/studuino-mode-check';
import { getStuduinoModeSettings, isStuduinoMode } from '../reducers/studuino-mode';
import styles from './studuino-unusable-blocks.css';

/** ブロックを動かしている途中に何度も数え直さないための待ち時間（ms）。 */
const RECHECK_DELAY = 300;

const StuduinoUnusableBlocks = ({ settings, studuinoMode, vm }) => {
    const [blocks, setBlocks] = useState([]);
    const nextIndex = useRef(0);

    useEffect(() => {
        if (!vm || !studuinoMode) {
            setBlocks([]);
            markUnusableBlocks([]);
            return () => {};
        }
        let timer = null;
        const check = () => {
            const found = findStuduinoUnusableBlocks(targetsFromVm(vm), settings);
            setBlocks(found);
            const editingId = vm.editingTarget && vm.editingTarget.id;
            markUnusableBlocks(found.filter((b) => b.targetId === editingId).map((b) => b.blockId));
        };
        const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(check, RECHECK_DELAY);
        };
        schedule();
        vm.on('PROJECT_CHANGED', schedule);
        vm.on('workspaceUpdate', schedule);
        return () => {
            clearTimeout(timer);
            vm.removeListener('PROJECT_CHANGED', schedule);
            vm.removeListener('workspaceUpdate', schedule);
            markUnusableBlocks([]);
        };
    }, [vm, studuinoMode, settings]);

    const handleClick = useCallback(() => {
        if (blocks.length === 0) return;
        const index = nextIndex.current % blocks.length;
        nextIndex.current = index + 1;
        jumpToBlock(vm, blocks[index]);
    }, [vm, blocks]);

    if (!studuinoMode || blocks.length === 0) return null;
    return (
        <button className={styles.banner} data-testid="studuino-unusable-blocks-banner" onClick={handleClick}>
            <FormattedMessage
                defaultMessage="{count} blocks can not be used in the Studuino mode"
                description="Banner that shows how many blocks can not be used in the Studuino mode"
                id="gui.studuinoMode.unusableBlocks"
                values={{ count: blocks.length }}
            />
        </button>
    );
};

StuduinoUnusableBlocks.propTypes = {
    settings: PropTypes.object,
    studuinoMode: PropTypes.bool,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    settings: getStuduinoModeSettings(state),
    studuinoMode: isStuduinoMode(state),
    vm: state.scratchGui.vm,
});

export default connect(mapStateToProps)(StuduinoUnusableBlocks);
