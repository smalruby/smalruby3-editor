// Studuino の練習用の基板のパネル（#2192・E7 = A）。コードエリアの右上（ステージの列のすぐ左）に重ねる、たためるパネル。
//   - センサー: 光・赤外線（フォトリフレクタ）A4/A5・音はスライダーと数字、タッチは押しているあいだ「押した」値になるボタン。
//   - 仕事を行う部分: LED のオン/オフ、DC モーターの正転/逆転/停止と速さ、サーボのいまの角度（数字と簡単な針）。
//   - 実機につながっているあいだ（mode === 'device'）は「実機につながっています」だけを出し、操作できないようにする。
// 見た目は重要ではない（#2158 Q5）。値がわかることを優先して小さくまとめる。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useId, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import styles from './studuino-practice-board.css';

// アナログのセンサーの範囲（Studuino の analogRead と同じ 0〜1023）
export const ANALOG_MIN = 0;
export const ANALOG_MAX = 1023;

const messages = defineMessages({
    practiceTitle: {
        id: 'gui.studuinoPracticeBoard.practiceTitle',
        description: 'Title of the Studuino practice board panel while no real board is connected',
        defaultMessage: 'Now: practice board',
    },
    practiceNote: {
        id: 'gui.studuinoPracticeBoard.practiceNote',
        description: 'Short line in the Studuino practice board panel: the blocks now talk to the practice board',
        defaultMessage: 'No board is connected, so the blocks use this practice board.',
    },
    deviceTitle: {
        id: 'gui.studuinoPracticeBoard.deviceTitle',
        description: 'Title of the Studuino practice board panel while a real Studuino board is connected',
        defaultMessage: 'Connected to the real board (Studuino)',
    },
    deviceNote: {
        id: 'gui.studuinoPracticeBoard.deviceNote',
        description: 'Shown in the Studuino practice board panel while a real board is connected',
        defaultMessage: 'The blocks use the real board. Disconnect it to use the practice board again.',
    },
    close: {
        id: 'gui.studuinoPracticeBoard.close',
        description: 'Accessible name of the button that folds the Studuino practice board panel',
        defaultMessage: 'Fold the practice board',
    },
    open: {
        id: 'gui.studuinoPracticeBoard.open',
        description: 'Button that opens the folded Studuino practice board panel',
        defaultMessage: 'Practice board',
    },
    openDevice: {
        id: 'gui.studuinoPracticeBoard.openDevice',
        description: 'Button that opens the folded Studuino panel while a real board is connected',
        defaultMessage: 'Studuino: real board',
    },
    sensorsHeading: {
        id: 'gui.studuinoPracticeBoard.sensorsHeading',
        description: 'Heading of the sensors in the Studuino practice board panel',
        defaultMessage: 'Sensors',
    },
    outputsHeading: {
        id: 'gui.studuinoPracticeBoard.outputsHeading',
        description:
            'Heading of the LEDs, motors and servo in the Studuino practice board panel ' +
            '(the textbook calls them "the parts that do work")',
        defaultMessage: 'Parts that do work',
    },
    touchPress: {
        id: 'gui.studuinoPracticeBoard.touchPress',
        description:
            'Button of the touch sensor in the Studuino practice board panel: hold it down to press the sensor',
        defaultMessage: 'Press',
    },
    touchPressed: {
        id: 'gui.studuinoPracticeBoard.touchPressed',
        description: 'Touch sensor state in the Studuino practice board panel: pressed',
        defaultMessage: 'pressed',
    },
    touchReleased: {
        id: 'gui.studuinoPracticeBoard.touchReleased',
        description: 'Touch sensor state in the Studuino practice board panel: not pressed',
        defaultMessage: 'not pressed',
    },
    led: {
        id: 'gui.studuinoPracticeBoard.led',
        description: 'Label of an LED in the Studuino practice board panel ({port} = A0 or A1)',
        defaultMessage: 'LED ({port})',
    },
    ledOn: {
        id: 'gui.studuinoPracticeBoard.ledOn',
        description: 'LED state in the Studuino practice board panel: on',
        defaultMessage: 'on',
    },
    ledOff: {
        id: 'gui.studuinoPracticeBoard.ledOff',
        description: 'LED state in the Studuino practice board panel: off',
        defaultMessage: 'off',
    },
    motor: {
        id: 'gui.studuinoPracticeBoard.motor',
        description: 'Label of a DC motor in the Studuino practice board panel ({port} = M1 or M2)',
        defaultMessage: 'DC motor ({port})',
    },
    motorNormal: {
        id: 'gui.studuinoPracticeBoard.motorNormal',
        description: 'DC motor state in the Studuino practice board panel: turning forward ({speed} = %)',
        defaultMessage: 'forward {speed}%',
    },
    motorReverse: {
        id: 'gui.studuinoPracticeBoard.motorReverse',
        description: 'DC motor state in the Studuino practice board panel: turning in reverse ({speed} = %)',
        defaultMessage: 'reverse {speed}%',
    },
    motorStop: {
        id: 'gui.studuinoPracticeBoard.motorStop',
        description: 'DC motor state in the Studuino practice board panel: stopped',
        defaultMessage: 'stopped',
    },
    servo: {
        id: 'gui.studuinoPracticeBoard.servo',
        description: 'Label of the servo motor in the Studuino practice board panel ({port} = D10)',
        defaultMessage: 'Servo motor ({port})',
    },
    servoDegree: {
        id: 'gui.studuinoPracticeBoard.servoDegree',
        description: 'Angle of the servo motor in the Studuino practice board panel ({degree} = 0-180)',
        defaultMessage: '{degree}°',
    },
});

// センサーの名前は拡張機能の選択肢と同じ文言（#2189 の表示に合わせる）。拡張機能の翻訳キー（smalrubotS1.*）は
// GUI の文言には入らないので、パネル用のキーを持つ
const sensorMessages = defineMessages({
    A6: {
        id: 'gui.studuinoPracticeBoard.sensorA6',
        description:
            'Name of a sensor in the Studuino practice board panel (same as the sensor menu of the extension)',
        defaultMessage: 'light sensor (A6)',
    },
    A4: {
        id: 'gui.studuinoPracticeBoard.sensorA4',
        description:
            'Name of a sensor in the Studuino practice board panel (same as the sensor menu of the extension)',
        defaultMessage: 'infrared sensor (photoreflector) (A4)',
    },
    A5: {
        id: 'gui.studuinoPracticeBoard.sensorA5',
        description:
            'Name of a sensor in the Studuino practice board panel (same as the sensor menu of the extension)',
        defaultMessage: 'infrared sensor (photoreflector) (A5)',
    },
    A7: {
        id: 'gui.studuinoPracticeBoard.sensorA7',
        description:
            'Name of a sensor in the Studuino practice board panel (same as the sensor menu of the extension)',
        defaultMessage: 'sound sensor (A7)',
    },
    A2: {
        id: 'gui.studuinoPracticeBoard.sensorA2',
        description:
            'Name of a sensor in the Studuino practice board panel (same as the sensor menu of the extension)',
        defaultMessage: 'touch sensor (A2)',
    },
});

// スライダーで変えるセンサー（拡張機能の選択肢と同じ順）
const ANALOG_SENSOR_PORTS = ['A6', 'A4', 'A5', 'A7'];

const MOTOR_SYMBOLS = { normal: '↻', reverse: '↺', stop: '■' };

/**
 * サーボの角度の簡単な針（半円の上を 0°=右・180°=左に動く）。
 * @param {object} props - props.
 * @param {number} props.degree - 角度（0〜180）。
 * @returns {React.ReactElement} 針の絵。
 */
const ServoNeedle = ({ degree }) => {
    const rad = (Math.PI * Math.min(180, Math.max(0, degree))) / 180;
    const x = 12 + 10 * Math.cos(rad);
    const y = 12 - 10 * Math.sin(rad);
    return (
        <svg aria-hidden="true" className={styles.needle} height="14" viewBox="0 0 24 14" width="24">
            <path className={styles.needleArc} d="M2 12 A10 10 0 0 1 22 12" fill="none" />
            <line className={styles.needleLine} x1="12" x2={x.toFixed(2)} y1="12" y2={y.toFixed(2)} />
        </svg>
    );
};

ServoNeedle.propTypes = {
    degree: PropTypes.number.isRequired,
};

/**
 * タッチセンサーのボタン。押しているあいだ（ポインター・スペース/Enter）だけ「押した」値にする。
 * @param {object} props - props.
 * @param {boolean} props.pressed - いま押した値か。
 * @param {Function} props.onTouch - 押した（true）・はなした（false）ときに呼ぶ。
 * @param {string} props.label - ボタンの文字。
 * @param {string} props.labelledBy - センサーの名前の要素の id。
 * @returns {React.ReactElement} ボタン。
 */
const TouchButton = ({ label, labelledBy, onTouch, pressed }) => {
    const downRef = useRef(false);
    const press = useCallback(() => {
        if (downRef.current) return;
        downRef.current = true;
        onTouch(true);
    }, [onTouch]);
    const release = useCallback(() => {
        if (!downRef.current) return;
        downRef.current = false;
        onTouch(false);
    }, [onTouch]);
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                press();
            }
        },
        [press],
    );
    const handleKeyUp = useCallback(
        (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                release();
            }
        },
        [release],
    );
    // パネルを閉じたときなどに押したまま消えたら、はなした値にもどす
    useEffect(() => release, [release]);
    return (
        <button
            aria-describedby={labelledBy}
            aria-pressed={pressed}
            className={classNames(styles.touch, { [styles.touchDown]: pressed })}
            data-testid="studuino-practice-board-touch-A2"
            onBlur={release}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onPointerCancel={release}
            onPointerDown={press}
            onPointerLeave={release}
            onPointerUp={release}
            type="button"
        >
            {label}
        </button>
    );
};

TouchButton.propTypes = {
    label: PropTypes.string.isRequired,
    labelledBy: PropTypes.string.isRequired,
    onTouch: PropTypes.func.isRequired,
    pressed: PropTypes.bool.isRequired,
};

const StuduinoPracticeBoard = ({
    boardState,
    onClose,
    onOpen,
    onSensorChange,
    onTouch,
    open,
    position = null,
    touchPressedValue,
}) => {
    const intl = useIntl();
    const idPrefix = useId();
    const device = boardState.mode === 'device';
    const openButtonRef = useRef(null);
    const panelRef = useRef(null);
    const wasOpenRef = useRef(open);
    // 開く・たたむでボタンが消えてフォーカスが body に落ちないように、もう片方のボタンへ移す（最初の描画では動かさない）
    useEffect(() => {
        if (wasOpenRef.current === open) return;
        wasOpenRef.current = open;
        const target = open ? panelRef.current && panelRef.current.querySelector('button') : openButtonRef.current;
        if (target) target.focus();
    }, [open]);

    if (!open) {
        return (
            <button
                className={styles.open}
                data-mode={boardState.mode}
                data-testid="studuino-practice-board-open"
                onClick={onOpen}
                ref={openButtonRef}
                style={position || {}}
                type="button"
            >
                {intl.formatMessage(device ? messages.openDevice : messages.open)}
            </button>
        );
    }

    const title = intl.formatMessage(device ? messages.deviceTitle : messages.practiceTitle);
    const sensors = boardState.sensors || {};
    const leds = boardState.leds || {};
    const motors = boardState.motors || {};
    const servo = (boardState.servo && boardState.servo.D10) || { degree: 0 };
    const touchPressed = sensors.A2 === touchPressedValue;
    const touchLabelId = `${idPrefix}-A2`;
    return (
        <section
            aria-label={title}
            className={classNames(styles.panel, { [styles.device]: device })}
            data-mode={boardState.mode}
            data-testid="studuino-practice-board"
            ref={panelRef}
            style={position || {}}
        >
            <div className={styles.header}>
                <span
                    className={styles.title}
                    data-testid="studuino-practice-board-mode"
                    title={device ? null : intl.formatMessage(messages.practiceNote)}
                >
                    {title}
                </span>
                <button
                    aria-label={intl.formatMessage(messages.close)}
                    className={styles.close}
                    data-testid="studuino-practice-board-close"
                    onClick={onClose}
                    title={intl.formatMessage(messages.close)}
                    type="button"
                >
                    {'−'}
                </button>
            </div>
            {device ? (
                <div className={styles.body}>
                    <p className={styles.note} data-testid="studuino-practice-board-device-note">
                        {intl.formatMessage(messages.deviceNote)}
                    </p>
                </div>
            ) : (
                <div className={styles.body}>
                    <h3 className={styles.heading}>{intl.formatMessage(messages.sensorsHeading)}</h3>
                    <div className={styles.group}>
                        {ANALOG_SENSOR_PORTS.map((port) => {
                            const labelId = `${idPrefix}-${port}`;
                            const value = Number(sensors[port]) || 0;
                            return (
                                <div className={styles.sensor} key={port}>
                                    <span className={styles.label} id={labelId}>
                                        {intl.formatMessage(sensorMessages[port])}
                                    </span>
                                    <div className={styles.sliderRow}>
                                        <input
                                            aria-labelledby={labelId}
                                            className={styles.slider}
                                            data-testid={`studuino-practice-board-sensor-${port}`}
                                            max={ANALOG_MAX}
                                            min={ANALOG_MIN}
                                            // eslint-disable-next-line react/jsx-no-bind
                                            onChange={(e) => onSensorChange(port, Number(e.target.value))}
                                            step={1}
                                            type="range"
                                            value={Math.min(ANALOG_MAX, Math.max(ANALOG_MIN, value))}
                                        />
                                        <span
                                            className={styles.number}
                                            data-testid={`studuino-practice-board-sensor-value-${port}`}
                                        >
                                            {value}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        <div className={styles.touchRow}>
                            <span className={styles.label} id={touchLabelId}>
                                {intl.formatMessage(sensorMessages.A2)}
                            </span>
                            <TouchButton
                                label={intl.formatMessage(messages.touchPress)}
                                labelledBy={touchLabelId}
                                onTouch={onTouch}
                                pressed={touchPressed}
                            />
                            <span
                                className={styles.number}
                                data-testid="studuino-practice-board-sensor-value-A2"
                                title={intl.formatMessage(
                                    touchPressed ? messages.touchPressed : messages.touchReleased,
                                )}
                            >
                                {Number(sensors.A2) || 0}
                            </span>
                        </div>
                    </div>
                    <h3 className={styles.heading}>{intl.formatMessage(messages.outputsHeading)}</h3>
                    <div className={styles.group}>
                        <div className={styles.outputRow}>
                            {['A0', 'A1'].map((port) => {
                                const on = Boolean(leds[port]);
                                return (
                                    <span
                                        className={styles.output}
                                        data-on={String(on)}
                                        data-testid={`studuino-practice-board-led-${port}`}
                                        key={port}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={classNames(styles.lamp, { [styles.lampOn]: on })}
                                        />
                                        {intl.formatMessage(messages.led, { port })}
                                        <span className={styles.state}>
                                            {intl.formatMessage(on ? messages.ledOn : messages.ledOff)}
                                        </span>
                                    </span>
                                );
                            })}
                        </div>
                        {['M1', 'M2'].map((port) => {
                            const motor = motors[port] || { direction: 'stop', speed: 0 };
                            const direction = MOTOR_SYMBOLS[motor.direction] ? motor.direction : 'stop';
                            const stateMessage = {
                                normal: messages.motorNormal,
                                reverse: messages.motorReverse,
                                stop: messages.motorStop,
                            }[direction];
                            return (
                                <div
                                    className={styles.outputRow}
                                    data-direction={direction}
                                    data-testid={`studuino-practice-board-motor-${port}`}
                                    key={port}
                                >
                                    <span className={styles.output}>
                                        <span
                                            aria-hidden="true"
                                            className={classNames(styles.symbol, styles[`motor-${direction}`])}
                                        >
                                            {MOTOR_SYMBOLS[direction]}
                                        </span>
                                        {intl.formatMessage(messages.motor, { port })}
                                    </span>
                                    <span className={styles.state}>
                                        {intl.formatMessage(stateMessage, { speed: motor.speed })}
                                    </span>
                                </div>
                            );
                        })}
                        <div className={styles.outputRow} data-testid="studuino-practice-board-servo-D10">
                            <span className={styles.output}>
                                <ServoNeedle degree={Number(servo.degree) || 0} />
                                {intl.formatMessage(messages.servo, { port: 'D10' })}
                            </span>
                            <span className={styles.state} data-testid="studuino-practice-board-servo-degree">
                                {intl.formatMessage(messages.servoDegree, { degree: servo.degree })}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

StuduinoPracticeBoard.propTypes = {
    // 練習用の基板の状態（VM の getPracticeBoardState() と同じ形。docs/extension-smalrubot-s1/README.md）
    boardState: PropTypes.shape({
        mode: PropTypes.oneOf(['practice', 'device']).isRequired,
        leds: PropTypes.object,
        motors: PropTypes.object,
        servo: PropTypes.object,
        sensors: PropTypes.object,
    }).isRequired,
    onClose: PropTypes.func.isRequired,
    onOpen: PropTypes.func.isRequired,
    // スライダーを動かしたとき（ポート・値）
    onSensorChange: PropTypes.func.isRequired,
    // タッチセンサーのボタンを押した（true）・はなした（false）とき
    onTouch: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired,
    // 置く場所（fixed の top / right。コンテナがステージの列から測る）
    position: PropTypes.shape({ top: PropTypes.number, right: PropTypes.number }),
    // タッチセンサーの「押した」の値（コンテナが決める）
    touchPressedValue: PropTypes.number.isRequired,
};

export default StuduinoPracticeBoard;
