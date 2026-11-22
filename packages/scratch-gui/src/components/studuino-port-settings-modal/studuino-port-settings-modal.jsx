// 入出力の設定のモーダル（#2215・S2・S14）。ポートは基板で決まっているので、ポートごとにつなぐ部品を
// ドロップダウンから選ぶ。左に出力（D2〜D12 = サーボモーター・M1/M2 = DC モーター）、まん中に基板の絵、
// 右に入力・出力（A0〜A7）。補正値（サーボの角度のずれ・DC モーターの速さの割合）は、その部品を選んだ
// ポートの行に出す。画面は独自に描く（本家の画面・写真は写さない）。基板の絵（studuino-board.png）は
// 生成 AI で描いた絵から、背景の飾りと会社のロゴに見える形を消して基板だけにしたもの（S15。アーテック社の
// 絵や写真は使わない）。
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Modal from '../../containers/modal.jsx';
import {
    calibrationFor,
    getCalibration,
    INPUT_PORTS,
    OUTPUT_PORTS,
    partsForPort,
} from '../../lib/studuino-port-settings';
import Box from '../box/box.jsx';
import boardImage from './studuino-board.png';
import styles from './studuino-port-settings-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Port Settings',
        description: 'Title of the Studuino port settings modal',
        id: 'gui.studuinoPortSettings.title',
    },
    none: {
        defaultMessage: 'Not connected',
        description: 'Option meaning nothing is connected to the port',
        id: 'gui.studuinoPortSettings.none',
    },
    servoCalibration: {
        defaultMessage: 'Offset (°)',
        description: 'Label of the servo motor angle offset input (-15 to 15 degrees)',
        id: 'gui.studuinoPortSettings.servoCalibration',
    },
    dcMotorCalibration: {
        defaultMessage: 'Max speed (%)',
        description: 'Label of the DC motor max speed rate input (0 to 100 percent)',
        id: 'gui.studuinoPortSettings.dcMotorCalibration',
    },
});

const partMessages = defineMessages({
    servo_motor: {
        defaultMessage: 'Servo motor',
        description: 'Studuino part name',
        id: 'gui.studuinoPortSettings.part.servoMotor',
    },
    dc_motor: {
        defaultMessage: 'DC motor',
        description: 'Studuino part name',
        id: 'gui.studuinoPortSettings.part.dcMotor',
    },
    led: { defaultMessage: 'LED', description: 'Studuino part name', id: 'gui.studuinoPortSettings.part.led' },
    buzzer: {
        defaultMessage: 'Buzzer',
        description: 'Studuino part name',
        id: 'gui.studuinoPortSettings.part.buzzer',
    },
    light_sensor: {
        defaultMessage: 'Light sensor',
        description: 'Studuino part name',
        id: 'gui.studuinoPortSettings.part.lightSensor',
    },
    sound_sensor: {
        defaultMessage: 'Sound sensor',
        description: 'Studuino part name',
        id: 'gui.studuinoPortSettings.part.soundSensor',
    },
    ir_photoreflector: {
        defaultMessage: 'IR photoreflector',
        description: 'Studuino part name',
        id: 'gui.studuinoPortSettings.part.irPhotoreflector',
    },
    temperature_sensor: {
        defaultMessage: 'Temperature sensor',
        description: 'Studuino part name',
        id: 'gui.studuinoPortSettings.part.temperatureSensor',
    },
    touch_sensor: {
        defaultMessage: 'Touch sensor',
        description: 'Studuino part name',
        id: 'gui.studuinoPortSettings.part.touchSensor',
    },
    push_switch: {
        defaultMessage: 'Button',
        description: 'Studuino part name (the cross buttons on the board)',
        id: 'gui.studuinoPortSettings.part.pushSwitch',
    },
});

const PortRow = ({ port, settings, onChangePart, onChangeCalibration }) => {
    const intl = useIntl();
    const kind = settings.ports[port] || '';
    const calibration = calibrationFor(port, settings.ports[port]);
    const testId = port.toLowerCase();
    const handleChangePart = useCallback((e) => onChangePart(port, e.target.value), [onChangePart, port]);
    const handleChangeCalibration = useCallback(
        (e) => onChangeCalibration(port, e.target.value),
        [onChangeCalibration, port],
    );
    return (
        <div className={styles.portRow}>
            <label className={styles.portName} htmlFor={`studuino-port-${testId}`}>
                {port}
            </label>
            <select
                className={styles.partSelect}
                data-testid={`studuino-port-settings-port-${testId}`}
                id={`studuino-port-${testId}`}
                value={kind}
                onChange={handleChangePart}
            >
                <option value="">{intl.formatMessage(messages.none)}</option>
                {partsForPort(port).map((part) => (
                    <option key={part} value={part}>
                        {intl.formatMessage(partMessages[part])}
                    </option>
                ))}
            </select>
            {calibration ? (
                <label className={styles.calibration}>
                    <span className={styles.calibrationLabel}>
                        {intl.formatMessage(
                            calibration.key === 'dcMotor' ? messages.dcMotorCalibration : messages.servoCalibration,
                        )}
                    </span>
                    <input
                        className={styles.calibrationInput}
                        data-testid={`studuino-port-settings-calibration-${testId}`}
                        max={calibration.range.max}
                        min={calibration.range.min}
                        step={1}
                        type="number"
                        value={getCalibration(settings, port)}
                        onChange={handleChangeCalibration}
                    />
                </label>
            ) : null}
        </div>
    );
};

PortRow.propTypes = {
    onChangeCalibration: PropTypes.func.isRequired,
    onChangePart: PropTypes.func.isRequired,
    port: PropTypes.string.isRequired,
    settings: PropTypes.shape({
        calibration: PropTypes.object.isRequired,
        ports: PropTypes.object.isRequired,
    }).isRequired,
};

const StuduinoPortSettingsModal = ({
    settings,
    onAssign,
    onChangeCalibration,
    onChangePart,
    onClearAll,
    onClose,
}) => {
    const intl = useIntl();
    const rowProps = { settings, onChangeCalibration, onChangePart };
    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            id="studuinoPortSettingsModal"
            onRequestClose={onClose}
        >
            <Box className={styles.body} data-testid="studuino-port-settings-modal">
                <p className={styles.description}>
                    <FormattedMessage
                        defaultMessage="Choose the part connected to each port of the board. Only the parts you assign appear in the blocks."
                        description="Description of the Studuino port settings modal"
                        id="gui.studuinoPortSettings.description"
                    />
                </p>
                <div className={styles.columns}>
                    <div className={styles.column}>
                        {OUTPUT_PORTS.map((port) => (
                            <PortRow key={port} port={port} {...rowProps} />
                        ))}
                    </div>
                    <div aria-hidden="true" className={styles.board}>
                        <img
                            alt=""
                            className={styles.boardImage}
                            data-testid="studuino-port-settings-board"
                            draggable={false}
                            src={boardImage}
                        />
                    </div>
                    <div className={styles.column}>
                        {INPUT_PORTS.map((port) => (
                            <PortRow key={port} port={port} {...rowProps} />
                        ))}
                    </div>
                </div>
                <div className={styles.buttonRow}>
                    <button
                        className={styles.secondaryButton}
                        data-testid="studuino-port-settings-clear-all"
                        onClick={onClearAll}
                    >
                        <FormattedMessage
                            defaultMessage="Unassign All"
                            description="Button to set every port of the Studuino to not connected"
                            id="gui.studuinoPortSettings.clearAll"
                        />
                    </button>
                    <button
                        className={styles.primaryButton}
                        data-testid="studuino-port-settings-assign"
                        onClick={onAssign}
                    >
                        <FormattedMessage
                            defaultMessage="Assign"
                            description="Button to save the Studuino port settings"
                            id="gui.studuinoPortSettings.assign"
                        />
                    </button>
                </div>
                <p className={styles.trademark}>
                    <FormattedMessage
                        defaultMessage="Studuino® is a registered trademark of Artec Co., Ltd."
                        description="Trademark notice for Studuino"
                        id="gui.studuinoPortSettings.trademark"
                    />
                </p>
            </Box>
        </Modal>
    );
};

StuduinoPortSettingsModal.propTypes = {
    onAssign: PropTypes.func.isRequired,
    onChangeCalibration: PropTypes.func.isRequired,
    onChangePart: PropTypes.func.isRequired,
    onClearAll: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    settings: PropTypes.shape({
        calibration: PropTypes.object.isRequired,
        ports: PropTypes.object.isRequired,
    }).isRequired,
};

export default StuduinoPortSettingsModal;
