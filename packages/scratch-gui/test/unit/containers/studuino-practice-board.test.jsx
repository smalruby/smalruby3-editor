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
        expect(screen.getByTestId('studuino-practice-board-mode')).toHaveTextContent('Practice board (Studuino)');
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
