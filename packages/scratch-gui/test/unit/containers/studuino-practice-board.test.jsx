/* eslint-env jest */
// Studuino の練習用の基板のパネル（components/studuino-practice-board）とコンテナ
// （containers/studuino-practice-board.jsx）。VM は EventEmitter のにせもの。
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import {
    OPEN_STORAGE_KEY,
    STATE_EVENT,
    STUDUINO_MODE_STATE_EVENT,
    StuduinoPracticeBoardContainer,
    TOUCH_PRESSED_VALUE,
    TOUCH_RELEASED_VALUE,
} from '../../../src/containers/studuino-practice-board.jsx';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';
import jaHira from '../../../src/locales/ja-Hira';

const makeState = (overrides = {}) => ({
    mode: 'practice',
    leds: { A0: false, A1: false },
    motors: { M1: { direction: 'stop', speed: 50 }, M2: { direction: 'stop', speed: 50 } },
    servo: { D10: { degree: 90, calibration: 0 } },
    sensors: { A2: 1, A4: 0, A5: 0, A6: 0, A7: 0 },
    ...overrides,
});

// 拡張機能のにせもの: setPracticeSensorValue で値を変えて、本物と同じようにイベントを送る
const makeVm = (state = makeState()) => {
    const runtime = new EventEmitter();
    let current = state;
    const ext = {
        getPracticeBoardState: () => current,
        setPracticeSensorValue: jest.fn((port, value) => {
            current = { ...current, sensors: { ...current.sensors, [port]: value } };
            runtime.studuinoPracticeBoardState = current;
            runtime.emit(STATE_EVENT, current);
            return true;
        }),
    };
    runtime.peripheralExtensions = { smalrubotS1: ext };
    runtime.studuinoPracticeBoardState = current;
    const emit = (next) => {
        current = next;
        runtime.emit(STATE_EVENT, next);
    };
    return { vm: { runtime }, ext, emit };
};

const renderContainer = (props, messages = en, locale = 'en') =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <StuduinoPracticeBoardContainer {...props} />
        </IntlProvider>,
    );

describe('StuduinoPracticeBoard container', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });
    afterEach(() => {
        cleanup();
    });

    test('is not shown until the Studuino extension is loaded', () => {
        const runtime = new EventEmitter();
        runtime.peripheralExtensions = {};
        renderContainer({ vm: { runtime } });
        expect(screen.queryByTestId('studuino-practice-board')).toBeNull();
        // 拡張機能を読みこむと状態が送られる
        runtime.peripheralExtensions.smalrubotS1 = { getPracticeBoardState: () => makeState() };
        act(() => {
            runtime.emit(STATE_EVENT, makeState());
        });
        expect(screen.getByTestId('studuino-practice-board')).toBeInTheDocument();
        expect(screen.getByTestId('studuino-practice-board-mode')).toHaveTextContent('Now: practice board');
    });

    test('is not shown on the costumes / sounds tabs', () => {
        const { vm } = makeVm();
        renderContainer({ vm, editorVisible: false });
        expect(screen.queryByTestId('studuino-practice-board')).toBeNull();
    });

    test('a slider changes the sensor value of the practice board', () => {
        const { vm, ext } = makeVm();
        renderContainer({ vm });
        fireEvent.change(screen.getByTestId('studuino-practice-board-sensor-A6'), { target: { value: '700' } });
        expect(ext.setPracticeSensorValue).toHaveBeenCalledWith('A6', 700);
        expect(screen.getByTestId('studuino-practice-board-sensor-value-A6')).toHaveTextContent('700');
        expect(screen.getByTestId('studuino-practice-board-sensor-A6')).toHaveValue('700');
    });

    test('the touch button gives the pressed value only while it is held', () => {
        const { vm, ext } = makeVm();
        renderContainer({ vm });
        const button = screen.getByTestId('studuino-practice-board-touch-A2');
        fireEvent.pointerDown(button);
        expect(ext.setPracticeSensorValue).toHaveBeenLastCalledWith('A2', TOUCH_PRESSED_VALUE);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        fireEvent.pointerUp(button);
        expect(ext.setPracticeSensorValue).toHaveBeenLastCalledWith('A2', TOUCH_RELEASED_VALUE);
        expect(button).toHaveAttribute('aria-pressed', 'false');
        // キーボードでも押せる
        fireEvent.keyDown(button, { key: ' ' });
        expect(ext.setPracticeSensorValue).toHaveBeenLastCalledWith('A2', TOUCH_PRESSED_VALUE);
        fireEvent.keyUp(button, { key: ' ' });
        expect(ext.setPracticeSensorValue).toHaveBeenLastCalledWith('A2', TOUCH_RELEASED_VALUE);
    });

    test('the touch sensor starts released when the extension was just loaded (0 = pressed)', () => {
        const { vm, ext } = makeVm(makeState({ sensors: { A2: 0, A4: 0, A5: 0, A6: 0, A7: 0 } }));
        renderContainer({ vm });
        expect(ext.setPracticeSensorValue).toHaveBeenCalledTimes(1);
        expect(ext.setPracticeSensorValue).toHaveBeenCalledWith('A2', TOUCH_RELEASED_VALUE);
    });

    test('shows the LEDs, motors and servo from the state and follows its changes', () => {
        const { vm, emit } = makeVm();
        renderContainer({ vm });
        expect(screen.getByTestId('studuino-practice-board-led-A0')).toHaveAttribute('data-on', 'false');
        expect(screen.getByTestId('studuino-practice-board-motor-M1')).toHaveAttribute('data-direction', 'stop');
        expect(screen.getByTestId('studuino-practice-board-motor-M1')).toHaveTextContent('stopped');
        expect(screen.getByTestId('studuino-practice-board-servo-degree')).toHaveTextContent('90°');

        act(() => {
            emit(
                makeState({
                    leds: { A0: true, A1: false },
                    motors: { M1: { direction: 'reverse', speed: 30 }, M2: { direction: 'normal', speed: 80 } },
                    servo: { D10: { degree: 45, calibration: 0 } },
                }),
            );
        });
        expect(screen.getByTestId('studuino-practice-board-led-A0')).toHaveAttribute('data-on', 'true');
        expect(screen.getByTestId('studuino-practice-board-led-A0')).toHaveTextContent('on');
        expect(screen.getByTestId('studuino-practice-board-motor-M1')).toHaveAttribute('data-direction', 'reverse');
        expect(screen.getByTestId('studuino-practice-board-motor-M1')).toHaveTextContent('reverse 30%');
        expect(screen.getByTestId('studuino-practice-board-motor-M2')).toHaveTextContent('forward 80%');
        expect(screen.getByTestId('studuino-practice-board-servo-degree')).toHaveTextContent('45°');
    });

    test('while a real board is connected, says so and has no controls', () => {
        const { vm, emit } = makeVm();
        renderContainer({ vm });
        act(() => {
            emit(makeState({ mode: 'device' }));
        });
        expect(screen.getByTestId('studuino-practice-board')).toHaveAttribute('data-mode', 'device');
        expect(screen.getByTestId('studuino-practice-board-mode')).toHaveTextContent(
            'Connected to the real board (Studuino)',
        );
        expect(screen.getByTestId('studuino-practice-board-device-note')).toBeInTheDocument();
        expect(screen.queryByTestId('studuino-practice-board-sensor-A6')).toBeNull();
        expect(screen.queryByTestId('studuino-practice-board-touch-A2')).toBeNull();
    });

    test('folds and opens, and remembers it on the device', () => {
        const { vm } = makeVm();
        const first = renderContainer({ vm });
        fireEvent.click(screen.getByTestId('studuino-practice-board-close'));
        expect(screen.queryByTestId('studuino-practice-board')).toBeNull();
        expect(screen.getByTestId('studuino-practice-board-open')).toHaveFocus();
        expect(window.localStorage.getItem(OPEN_STORAGE_KEY)).toBe('false');
        first.unmount();

        // 次に開いたときもたたんだまま
        renderContainer({ vm });
        expect(screen.queryByTestId('studuino-practice-board')).toBeNull();
        fireEvent.click(screen.getByTestId('studuino-practice-board-open'));
        expect(screen.getByTestId('studuino-practice-board')).toBeInTheDocument();
        expect(window.localStorage.getItem(OPEN_STORAGE_KEY)).toBe('true');
    });

    test('uses the sensor names of the extension menu in Japanese', () => {
        const { vm } = makeVm();
        renderContainer({ vm }, ja, 'ja');
        expect(screen.getByTestId('studuino-practice-board-mode')).toHaveTextContent('いまは練習用の基板');
        expect(screen.getByText('光センサー (A6)')).toBeInTheDocument();
        expect(screen.getByText('赤外線センサー（フォトリフレクタ）(A4)')).toBeInTheDocument();
        expect(screen.getByText('タッチセンサー (A2)')).toBeInTheDocument();
        cleanup();
        renderContainer({ vm }, jaHira, 'ja-Hira');
        expect(screen.getByText('ひかりセンサー (A6)')).toBeInTheDocument();
    });

    test('every panel message is in en, ja and ja-Hira', () => {
        const keys = Object.keys(en).filter((key) => key.startsWith('gui.studuinoPracticeBoard.'));
        expect(keys.length).toBeGreaterThan(10);
        keys.forEach((key) => {
            expect(ja[key]).toEqual(expect.any(String));
            expect(jaHira[key]).toEqual(expect.any(String));
        });
    });
});

// Studuino モードの練習用の基板（#2355）
const makeStuduinoState = (overrides = {}) => ({
    ports: [
        { port: 'D9', part: 'servo_motor', degree: 90 },
        { port: 'M1', part: 'dc_motor', direction: 'stop', speed: 0 },
        { port: 'A0', part: 'led', on: false },
        { port: 'A1', part: 'buzzer', on: false, pitch: 0 },
        { port: 'A2', part: 'touch_sensor', pressed: false },
        { port: 'A6', part: 'light_sensor', value: 0 },
    ],
    reservations: {},
    ...overrides,
});

const makeStuduinoVm = (state = makeStuduinoState()) => {
    const { vm, ext, emit } = makeVm();
    let current = state;
    ext.getStuduinoPracticeState = () => current;
    ext.setStuduinoPracticeInput = jest.fn((port, value) => {
        current = {
            ...current,
            ports: current.ports.map((p) => {
                if (p.port !== port) return p;
                return p.part === 'touch_sensor' ? { ...p, pressed: value } : { ...p, value };
            }),
        };
        vm.runtime.emit(STUDUINO_MODE_STATE_EVENT, current);
        return true;
    });
    vm.start = jest.fn();
    vm.greenFlag = jest.fn();
    const emitStuduino = (next) => {
        current = next;
        vm.runtime.emit(STUDUINO_MODE_STATE_EVENT, next);
    };
    return { vm, ext, emit, emitStuduino };
};

describe('StuduinoPracticeBoard container in the Studuino mode', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });
    afterEach(() => {
        cleanup();
    });

    test('shows the assigned parts instead of the fixed S1 layout', () => {
        const { vm } = makeStuduinoVm();
        renderContainer({ vm, studuinoMode: true });
        expect(screen.getByTestId('studuino-mode-practice-board')).toBeInTheDocument();
        expect(screen.queryByTestId('studuino-practice-board')).toBeNull();
        expect(screen.getByText('Light sensor (A6)')).toBeInTheDocument();
        expect(screen.getByTestId('studuino-mode-practice-board-part-D9')).toHaveTextContent('90°');
        expect(screen.getByTestId('studuino-mode-practice-board-part-A0')).toHaveAttribute('data-state', 'off');
    });

    test('the normal mode keeps the fixed S1 layout', () => {
        const { vm } = makeStuduinoVm();
        renderContainer({ vm, studuinoMode: false });
        expect(screen.getByTestId('studuino-practice-board')).toBeInTheDocument();
        expect(screen.queryByTestId('studuino-mode-practice-board')).toBeNull();
    });

    test('follows the state: LED, DC motor, servo with a reservation, buzzer', () => {
        const { vm, emitStuduino } = makeStuduinoVm();
        renderContainer({ vm, studuinoMode: true });
        act(() => {
            emitStuduino(
                makeStuduinoState({
                    ports: [
                        { port: 'D9', part: 'servo_motor', degree: 30 },
                        { port: 'M1', part: 'dc_motor', direction: 'normal', speed: 200 },
                        { port: 'A0', part: 'led', on: true },
                        { port: 'A1', part: 'buzzer', on: true, pitch: 440 },
                    ],
                    reservations: { D9: 120 },
                }),
            );
        });
        expect(screen.getByTestId('studuino-mode-practice-board-part-A0')).toHaveAttribute('data-state', 'on');
        expect(screen.getByTestId('studuino-mode-practice-board-part-M1')).toHaveTextContent('forward, speed 200');
        expect(screen.getByTestId('studuino-mode-practice-board-part-D9')).toHaveTextContent(
            '30° (reserved 120°)',
        );
        expect(screen.getByTestId('studuino-mode-practice-board-part-A1')).toHaveTextContent('playing 440 Hz');
    });

    test('a slider and a press button change the inputs', () => {
        const { vm, ext } = makeStuduinoVm();
        renderContainer({ vm, studuinoMode: true });
        fireEvent.change(screen.getByTestId('studuino-mode-practice-board-sensor-A6'), { target: { value: '700' } });
        expect(ext.setStuduinoPracticeInput).toHaveBeenCalledWith('A6', 700);
        expect(screen.getByTestId('studuino-mode-practice-board-value-A6')).toHaveTextContent('700');
        const press = screen.getByTestId('studuino-mode-practice-board-press-A2');
        fireEvent.pointerDown(press);
        expect(ext.setStuduinoPracticeInput).toHaveBeenLastCalledWith('A2', true);
        fireEvent.pointerUp(press);
        expect(ext.setStuduinoPracticeInput).toHaveBeenLastCalledWith('A2', false);
    });

    test('[Try the flag script] converts the Ruby code and runs the flag scripts', async () => {
        const { vm } = makeStuduinoVm();
        const apply = jest.fn(() => Promise.resolve());
        const targetCodeToBlocks = jest.fn(() => Promise.resolve({ result: true, apply }));
        renderContainer({ vm, studuinoMode: true, targetCodeToBlocks });
        await act(async () => {
            fireEvent.click(screen.getByTestId('studuino-mode-practice-board-try'));
        });
        expect(apply).toHaveBeenCalled();
        expect(vm.start).toHaveBeenCalled();
        expect(vm.greenFlag).toHaveBeenCalled();
    });

    test('[Try the flag script] does not run when the Ruby code cannot be converted', async () => {
        const { vm } = makeStuduinoVm();
        const targetCodeToBlocks = jest.fn(() => Promise.resolve({ result: false }));
        renderContainer({ vm, studuinoMode: true, targetCodeToBlocks });
        await act(async () => {
            fireEvent.click(screen.getByTestId('studuino-mode-practice-board-try'));
        });
        expect(vm.greenFlag).not.toHaveBeenCalled();
    });

    test('says how to assign parts when no port is assigned', () => {
        const { vm } = makeStuduinoVm(makeStuduinoState({ ports: [] }));
        renderContainer({ vm, studuinoMode: true }, ja, 'ja');
        expect(screen.getByTestId('studuino-mode-practice-board-empty')).toHaveTextContent(
            '入出力の設定で部品を割り当てると、ここに出ます。',
        );
        expect(screen.getByTestId('studuino-mode-practice-board-try')).toHaveTextContent('旗のスクリプトを試す');
    });

    test('every Studuino mode panel message is in en, ja and ja-Hira', () => {
        const keys = Object.keys(en).filter((key) => key.startsWith('gui.studuinoModePracticeBoard.'));
        expect(keys.length).toBeGreaterThan(20);
        keys.forEach((key) => {
            expect(ja[key]).toEqual(expect.any(String));
            expect(jaHira[key]).toEqual(expect.any(String));
        });
    });
});
