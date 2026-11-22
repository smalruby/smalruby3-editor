// Studuino モードの練習用の基板のパネル（#2355・S16）。通常モードのパネル（studuino-practice-board.jsx）と同じ場所・
// 同じ見た目で、入出力の設定で割り当てた部品だけを出す。
//   - センサー: 光・音・赤外線フォトリフレクタ・温度はスライダー（0〜1023）、タッチセンサー・ボタンは押しているあいだ
//     「押した」になるボタン。
//   - 仕事を行う部分: LED のオン/オフ、DC モーターの向きと速さ（ライブラリの 0〜255）、サーボの角度（と予約の角度）、
//     ブザーの音の高さ。
//   - ［旗のスクリプトを試す］で、旗のスクリプトをブラウザで動かす（緑の旗は書きこみのまま）。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useId, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { partMessages } from '../studuino-port-settings-modal/studuino-port-settings-modal.jsx';
import styles from './studuino-practice-board.css';
import { ANALOG_MAX, ANALOG_MIN, ServoNeedle, TouchButton } from './studuino-practice-board.jsx';

const messages = defineMessages({
    title: {
        id: 'gui.studuinoModePracticeBoard.title',
        description: 'Title of the practice board panel in the Studuino mode',
        defaultMessage: 'Practice board (Studuino mode)',
    },
    note: {
        id: 'gui.studuinoModePracticeBoard.note',
        description:
            'Short line in the practice board panel of the Studuino mode: how to run the program on it ' +
            '(the green flag writes the program to the board instead)',
        defaultMessage:
            'Click a block or a script, or press "Try the flag script", to run it on this board. ' +
            'The green flag writes the program to the Studuino.',
    },
    try: {
        id: 'gui.studuinoModePracticeBoard.try',
        description:
            'Button in the practice board panel of the Studuino mode: runs the green flag script in the browser ' +
            'on the practice board (the green flag itself writes the program to the board)',
        defaultMessage: 'Try the flag script',
    },
    empty: {
        id: 'gui.studuinoModePracticeBoard.empty',
        description: 'Shown in the practice board panel of the Studuino mode when no part is assigned to a port',
        defaultMessage: 'Assign parts in the port settings to show them here.',
    },
    close: {
        id: 'gui.studuinoModePracticeBoard.close',
        description: 'Accessible name of the button that folds the practice board panel of the Studuino mode',
        defaultMessage: 'Fold the practice board',
    },
    open: {
        id: 'gui.studuinoModePracticeBoard.open',
        description: 'Button that opens the folded practice board panel of the Studuino mode',
        defaultMessage: 'Practice board',
    },
    sensorsHeading: {
        id: 'gui.studuinoModePracticeBoard.sensorsHeading',
        description: 'Heading of the sensors in the practice board panel of the Studuino mode',
        defaultMessage: 'Sensors',
    },
    outputsHeading: {
        id: 'gui.studuinoModePracticeBoard.outputsHeading',
        description:
            'Heading of the LEDs, motors, servos and buzzers in the practice board panel of the Studuino mode ' +
            '(the textbook calls them "the parts that do work")',
        defaultMessage: 'Parts that do work',
    },
    partWithPort: {
        id: 'gui.studuinoModePracticeBoard.partWithPort',
        description: 'Name of a part and its port in the practice board panel of the Studuino mode',
        defaultMessage: '{part} ({port})',
    },
    press: {
        id: 'gui.studuinoModePracticeBoard.press',
        description: 'Button of a touch sensor or a button part: hold it down to press it',
        defaultMessage: 'Press',
    },
    pressed: {
        id: 'gui.studuinoModePracticeBoard.pressed',
        description: 'State of a touch sensor or a button part: pressed',
        defaultMessage: 'pressed',
    },
    released: {
        id: 'gui.studuinoModePracticeBoard.released',
        description: 'State of a touch sensor or a button part: not pressed',
        defaultMessage: 'not pressed',
    },
    on: {
        id: 'gui.studuinoModePracticeBoard.on',
        description: 'LED state: on',
        defaultMessage: 'on',
    },
    off: {
        id: 'gui.studuinoModePracticeBoard.off',
        description: 'LED state: off',
        defaultMessage: 'off',
    },
    motorNormal: {
        id: 'gui.studuinoModePracticeBoard.motorNormal',
        description: 'DC motor state: turning forward ({speed} = 0-255, the value of the speed block)',
        defaultMessage: 'forward, speed {speed}',
    },
    motorReverse: {
        id: 'gui.studuinoModePracticeBoard.motorReverse',
        description: 'DC motor state: turning backward ({speed} = 0-255, the value of the speed block)',
        defaultMessage: 'backward, speed {speed}',
    },
    motorBrake: {
        id: 'gui.studuinoModePracticeBoard.motorBrake',
        description: 'DC motor state: stopped with the brake',
        defaultMessage: 'stopped (brake)',
    },
    motorCoast: {
        id: 'gui.studuinoModePracticeBoard.motorCoast',
        description: 'DC motor state: stopped by coasting',
        defaultMessage: 'stopped (coast)',
    },
    motorStop: {
        id: 'gui.studuinoModePracticeBoard.motorStop',
        description: 'DC motor state: not turned yet',
        defaultMessage: 'stopped',
    },
    servoDegree: {
        id: 'gui.studuinoModePracticeBoard.servoDegree',
        description: 'Angle of a servo motor ({degree} = 0-180)',
        defaultMessage: '{degree}°',
    },
    servoReserved: {
        id: 'gui.studuinoModePracticeBoard.servoReserved',
        description: 'Angle of a servo motor and the angle reserved for it ({degree}, {reserved} = 0-180)',
        defaultMessage: '{degree}° (reserved {reserved}°)',
    },
    buzzerOn: {
        id: 'gui.studuinoModePracticeBoard.buzzerOn',
        description: 'Buzzer state: playing ({pitch} = Hz)',
        defaultMessage: 'playing {pitch} Hz',
    },
    buzzerOff: {
        id: 'gui.studuinoModePracticeBoard.buzzerOff',
        description: 'Buzzer state: not playing',
        defaultMessage: 'not playing',
    },
});

export const ANALOG_PARTS = ['light_sensor', 'sound_sensor', 'ir_photoreflector', 'temperature_sensor'];
export const BUTTON_PARTS = ['touch_sensor', 'push_switch'];

const MOTOR_SYMBOLS = { normal: '↻', reverse: '↺', brake: '■', coast: '■', stop: '■' };

/**
 * 仕事を行う部分の 1 行の、絵と状態の文言。
 * @param {object} intl - react-intl。
 * @param {object} item - ポートの状態（VM の getStuduinoPracticeState().ports の 1 つ）。
 * @param {object} reservations - 予約した角度（ポート → 角度）。
 * @returns {{icon: React.ReactNode, text: string, state: string}} 表示。
 */
const outputView = (intl, item, reservations) => {
    switch (item.part) {
        case 'led':
            return {
                icon: (
                    <span aria-hidden="true" className={item.on ? `${styles.lamp} ${styles.lampOn}` : styles.lamp} />
                ),
                text: intl.formatMessage(item.on ? messages.on : messages.off),
                state: item.on ? 'on' : 'off',
            };
        case 'dc_motor': {
            const direction = MOTOR_SYMBOLS[item.direction] ? item.direction : 'stop';
            const message = {
                normal: messages.motorNormal,
                reverse: messages.motorReverse,
                brake: messages.motorBrake,
                coast: messages.motorCoast,
                stop: messages.motorStop,
            }[direction];
            const symbolClass = direction === 'normal' || direction === 'reverse' ? direction : 'stop';
            return {
                icon: (
                    <span aria-hidden="true" className={`${styles.symbol} ${styles[`motor-${symbolClass}`]}`}>
                        {MOTOR_SYMBOLS[direction]}
                    </span>
                ),
                text: intl.formatMessage(message, { speed: item.speed }),
                state: direction,
            };
        }
        case 'servo_motor': {
            const reserved = reservations && Object.prototype.hasOwnProperty.call(reservations, item.port);
            return {
                icon: <ServoNeedle degree={Number(item.degree) || 0} />,
                text: reserved
                    ? intl.formatMessage(messages.servoReserved, {
                          degree: item.degree,
                          reserved: reservations[item.port],
                      })
                    : intl.formatMessage(messages.servoDegree, { degree: item.degree }),
                state: String(item.degree),
            };
        }
        case 'buzzer':
            return {
                icon: (
                    <span aria-hidden="true" className={`${styles.symbol} ${item.on ? styles['motor-normal'] : ''}`}>
                        {'♪'}
                    </span>
                ),
                text: intl.formatMessage(item.on ? messages.buzzerOn : messages.buzzerOff, { pitch: item.pitch }),
                state: item.on ? String(item.pitch) : 'off',
            };
        default:
            return null;
    }
};

/**
 * タッチセンサー・ボタンの「押す」ボタン。押した・はなしたをポートつきで知らせる。
 * 関数をレンダーごとに作り直すと、押しているあいだに TouchButton が「はなした」と見なしてしまうので、
 * ポートごとに useCallback で固定する。
 * @param {object} props - props.
 * @param {string} props.label - ボタンの文字。
 * @param {string} props.labelledBy - 部品の名前の要素の id。
 * @param {Function} props.onInputChange - (ポート, 押したか) で呼ぶ。
 * @param {string} props.port - ポート名。
 * @param {boolean} props.pressed - いま押しているか。
 * @returns {React.ReactElement} ボタン。
 */
const PressButton = ({ label, labelledBy, onInputChange, port, pressed }) => {
    const handleTouch = useCallback((value) => onInputChange(port, value), [onInputChange, port]);
    return (
        <TouchButton
            label={label}
            labelledBy={labelledBy}
            onTouch={handleTouch}
            pressed={pressed}
            testId={`studuino-mode-practice-board-press-${port}`}
        />
    );
};

PressButton.propTypes = {
    label: PropTypes.string.isRequired,
    labelledBy: PropTypes.string.isRequired,
    onInputChange: PropTypes.func.isRequired,
    port: PropTypes.string.isRequired,
    pressed: PropTypes.bool.isRequired,
};

const StuduinoModePracticeBoard = ({ boardState, onClose, onInputChange, onOpen, onTry, open, position = null }) => {
    const intl = useIntl();
    const idPrefix = useId();
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
    const handleSlider = useCallback(
        (e) => onInputChange(e.target.dataset.port, Number(e.target.value)),
        [onInputChange],
    );

    if (!open) {
        return (
            <button
                className={styles.open}
                data-mode="studuino"
                data-testid="studuino-mode-practice-board-open"
                onClick={onOpen}
                ref={openButtonRef}
                style={position || {}}
                type="button"
            >
                {intl.formatMessage(messages.open)}
            </button>
        );
    }

    const ports = boardState.ports || [];
    const reservations = boardState.reservations || {};
    const sensors = ports.filter((p) => ANALOG_PARTS.includes(p.part) || BUTTON_PARTS.includes(p.part));
    const outputs = ports.filter((p) => !ANALOG_PARTS.includes(p.part) && !BUTTON_PARTS.includes(p.part));
    const label = (item) =>
        intl.formatMessage(messages.partWithPort, {
            part: intl.formatMessage(partMessages[item.part]),
            port: item.port,
        });
    const title = intl.formatMessage(messages.title);
    return (
        <section
            aria-label={title}
            className={styles.panel}
            data-mode="studuino"
            data-testid="studuino-mode-practice-board"
            ref={panelRef}
            style={position || {}}
        >
            <div className={styles.header}>
                <span className={styles.title}>{title}</span>
                <button
                    aria-label={intl.formatMessage(messages.close)}
                    className={styles.close}
                    data-testid="studuino-mode-practice-board-close"
                    onClick={onClose}
                    title={intl.formatMessage(messages.close)}
                    type="button"
                >
                    {'−'}
                </button>
            </div>
            <div className={`${styles.body} ${styles.scroll}`}>
                <button
                    className={styles.try}
                    data-testid="studuino-mode-practice-board-try"
                    onClick={onTry}
                    title={intl.formatMessage(messages.note)}
                    type="button"
                >
                    {intl.formatMessage(messages.try)}
                </button>
                <p className={styles.note}>{intl.formatMessage(messages.note)}</p>
                {ports.length === 0 ? (
                    <p className={styles.note} data-testid="studuino-mode-practice-board-empty">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : null}
                {sensors.length > 0 ? (
                    <>
                        <h3 className={styles.heading}>{intl.formatMessage(messages.sensorsHeading)}</h3>
                        <div className={styles.group}>
                            {sensors.map((item) => {
                                const labelId = `${idPrefix}-${item.port}`;
                                if (BUTTON_PARTS.includes(item.part)) {
                                    return (
                                        <div className={styles.touchRow} key={item.port}>
                                            <span className={styles.label} id={labelId}>
                                                {label(item)}
                                            </span>
                                            <PressButton
                                                label={intl.formatMessage(messages.press)}
                                                labelledBy={labelId}
                                                onInputChange={onInputChange}
                                                port={item.port}
                                                pressed={Boolean(item.pressed)}
                                            />
                                            <span
                                                className={styles.number}
                                                data-testid={`studuino-mode-practice-board-value-${item.port}`}
                                            >
                                                {intl.formatMessage(
                                                    item.pressed ? messages.pressed : messages.released,
                                                )}
                                            </span>
                                        </div>
                                    );
                                }
                                const value = Number(item.value) || 0;
                                return (
                                    <div className={styles.sensor} key={item.port}>
                                        <span className={styles.label} id={labelId}>
                                            {label(item)}
                                        </span>
                                        <div className={styles.sliderRow}>
                                            <input
                                                aria-labelledby={labelId}
                                                className={styles.slider}
                                                data-port={item.port}
                                                data-testid={`studuino-mode-practice-board-sensor-${item.port}`}
                                                max={ANALOG_MAX}
                                                min={ANALOG_MIN}
                                                onChange={handleSlider}
                                                step={1}
                                                type="range"
                                                value={Math.min(ANALOG_MAX, Math.max(ANALOG_MIN, value))}
                                            />
                                            <span
                                                className={styles.number}
                                                data-testid={`studuino-mode-practice-board-value-${item.port}`}
                                            >
                                                {value}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : null}
                {outputs.length > 0 ? (
                    <>
                        <h3 className={styles.heading}>{intl.formatMessage(messages.outputsHeading)}</h3>
                        <div className={styles.group}>
                            {outputs.map((item) => {
                                const view = outputView(intl, item, reservations);
                                if (!view) return null;
                                return (
                                    <div
                                        className={styles.outputRow}
                                        data-state={view.state}
                                        data-testid={`studuino-mode-practice-board-part-${item.port}`}
                                        key={item.port}
                                    >
                                        <span className={styles.output}>
                                            {view.icon}
                                            {label(item)}
                                        </span>
                                        <span className={styles.state}>{view.text}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : null}
            </div>
        </section>
    );
};

StuduinoModePracticeBoard.propTypes = {
    // VM の getStuduinoPracticeState() と同じ形（docs/studuino-mode/README.md の「練習用の基板で試す」）
    boardState: PropTypes.shape({
        ports: PropTypes.arrayOf(PropTypes.object),
        reservations: PropTypes.object,
    }).isRequired,
    onClose: PropTypes.func.isRequired,
    // センサーのスライダー・ボタン（ポート・値。ボタンは押したか）
    onInputChange: PropTypes.func.isRequired,
    onOpen: PropTypes.func.isRequired,
    // ［旗のスクリプトを試す］
    onTry: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired,
    position: PropTypes.shape({ top: PropTypes.number, right: PropTypes.number }),
};

export default StuduinoModePracticeBoard;
