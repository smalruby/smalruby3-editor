import reducer, {
    getStuduinoModeSettings,
    isStuduinoMode,
    setStuduinoModeSettings,
    studuinoModeInitialState,
} from '../../../src/reducers/studuino-mode';

const wrap = (studuinoMode) => ({ scratchGui: { studuinoMode } });

describe('studuino-mode reducer', () => {
    test('starts in the normal mode', () => {
        const state = reducer(undefined, { type: 'anything' });
        expect(state).toEqual(studuinoModeInitialState);
        expect(isStuduinoMode(wrap(state))).toBe(false);
    });

    test('keeps the copy of the VM settings', () => {
        const settings = {
            mode: 'studuino',
            ports: { A6: 'light_sensor' },
            calibration: { dcMotor: {}, servoMotor: {} },
            unknownVersion: null,
        };
        const state = reducer(undefined, setStuduinoModeSettings(settings));
        expect(isStuduinoMode(wrap(state))).toBe(true);
        expect(getStuduinoModeSettings(wrap(state))).toBe(settings);
    });

    test('falls back to the default settings', () => {
        const state = reducer(undefined, setStuduinoModeSettings(null));
        expect(isStuduinoMode(wrap(state))).toBe(false);
        expect(state.settings.mode).toBe('normal');
    });
});
