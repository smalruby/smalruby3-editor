import { defaultSettings } from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import {
    clearAllPorts,
    getCalibration,
    INPUT_PORTS,
    OUTPUT_PORTS,
    partsForPort,
    setCalibration,
    setPortPart,
} from '../../../src/lib/studuino-port-settings';

describe('studuino-port-settings', () => {
    test('lays out every port once (left: outputs, right: A0〜A7)', () => {
        expect([...OUTPUT_PORTS, ...INPUT_PORTS].sort()).toEqual(
            [
                'D2',
                'D4',
                'D7',
                'D8',
                'D9',
                'D10',
                'D11',
                'D12',
                'M1',
                'M2',
                'A0',
                'A1',
                'A2',
                'A3',
                'A4',
                'A5',
                'A6',
                'A7',
            ].sort(),
        );
    });

    test('offers the parts of each port', () => {
        expect(partsForPort('D9')).toEqual(['servo_motor']);
        expect(partsForPort('M1')).toEqual(['dc_motor']);
        expect(partsForPort('A0')).toContain('push_switch');
        expect(partsForPort('A4')).not.toContain('push_switch');
        expect(partsForPort('A6')).toEqual([
            'light_sensor',
            'sound_sensor',
            'ir_photoreflector',
            'temperature_sensor',
        ]);
    });

    test('changes and removes a part', () => {
        let s = setPortPart(defaultSettings(), 'A0', 'buzzer');
        expect(s.ports.A0).toBe('buzzer');
        s = setPortPart(s, 'A0', '');
        expect(s.ports.A0).toBeUndefined();
    });

    test('ignores a part the port cannot take', () => {
        const s = setPortPart(defaultSettings(), 'A6', 'led');
        expect(s.ports.A6).toBeUndefined();
    });

    test('resets the calibration when the part changes', () => {
        let s = setPortPart(defaultSettings(), 'D9', 'servo_motor');
        s = setCalibration(s, 'D9', '-5');
        expect(getCalibration(s, 'D9')).toBe(-5);
        s = setPortPart(s, 'D9', '');
        expect(s.calibration.servoMotor.D9).toBeUndefined();
        expect(getCalibration(s, 'D9')).toBeNull();
    });

    test('clamps and rounds the calibration, and does not keep the default', () => {
        let s = defaultSettings();
        s = setCalibration(s, 'M2', 150);
        expect(getCalibration(s, 'M2')).toBe(100);
        expect(s.calibration.dcMotor.M2).toBeUndefined();
        s = setCalibration(s, 'M2', '89.6');
        expect(s.calibration.dcMotor.M2).toBe(90);
        s = setCalibration(s, 'D10', -40);
        expect(s.calibration.servoMotor.D10).toBe(-15);
        expect(setCalibration(s, 'M2', '')).toBe(s);
        expect(setCalibration(s, 'A0', 3)).toBe(s);
    });

    test('unassigns all ports', () => {
        const s = clearAllPorts(setCalibration(defaultSettings(), 'M1', 80));
        expect(s.ports).toEqual({});
        expect(s.calibration).toEqual({ dcMotor: {}, servoMotor: {} });
    });
});
