/**
 * Studuino mode in Ruby (#2218): `class Studuino` at the top of the Stage holds the port settings,
 * and the parts are called as `studuino.<part>_<port>` (docs/studuino-mode/README.md「Ruby」).
 */
import { getStuduinoSettings } from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    parsePartMethodName,
    partMethodName,
    studuinoClassCode,
} from '../../../../src/lib/studuino-ruby/studuino-ruby';
import {
    blockTrees,
    expectRoundTrip,
    makeConverter,
    makeSpriteTarget,
    makeStageTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const STUDUINO_STORAGE = {
    version: 1,
    mode: 'studuino',
    ports: { D9: 'servo_motor', M1: 'dc_motor', A0: 'led', A2: 'touch_sensor', A6: 'light_sensor' },
};

const withRuntimeApi = (made, storage) => {
    made.runtime.emit = () => {};
    made.runtime.extensionStorage = storage ? { smalrubotS1: storage } : {};
    return made;
};

const convertErrors = async (converter, target, code) => {
    const ok = await converter.targetCodeToBlocks(target, code);
    expect(ok).toBe(false);
    return converter.errors.map((e) => e.text);
};

describe('studuino-ruby helpers', () => {
    test('the method name of a part is <part>_<port in lower case>', () => {
        expect(partMethodName('light_sensor', 'A6')).toBe('light_sensor_a6');
        expect(parsePartMethodName('servo_motor_d10')).toEqual({ kind: 'servo_motor', port: 'D10' });
        expect(parsePartMethodName('action')).toBeNull();
    });

    test('class Studuino is written in the order of the ports, without the default calibration', () => {
        const code = studuinoClassCode({
            ports: { A6: 'light_sensor', M2: 'dc_motor', M1: 'dc_motor', D9: 'servo_motor' },
            calibration: { dcMotor: { M2: 90 }, servoMotor: { D9: -5 } },
        });
        expect(code).toBe(
            dedent`
            class Studuino
              servo_motor :D9, calibration: -5
              dc_motor :M1
              dc_motor :M2, calibration: 90
              light_sensor :A6
            end
        ` + '\n',
        );
    });
});

describe('Ruby Roundtrip: Studuino mode (stage)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = withRuntimeApi(makeStageTarget()));
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test('class Studuino and the parts come back as they are, and set the port settings', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            class Studuino
              servo_motor :D9
              dc_motor :M1
              dc_motor :M2, calibration: 90
              led :A0
              buzzer :A1
              touch_sensor :A2
              push_switch :A3
              ir_photoreflector :A4
              temperature_sensor :A5
              light_sensor :A6
              sound_sensor :A7
            end

            when_flag_clicked do
              loop do
                if studuino.light_sensor_a6 < 300
                  studuino.led_a0.on
                else
                  studuino.led_a0.off
                end
                if studuino.touch_sensor_a2.pressed?
                  studuino.servo_motor_d9.angle = 90
                  studuino.dc_motor_m1.speed = 200
                  studuino.dc_motor_m1.forward
                  sleep(1)
                  studuino.dc_motor_m1.brake
                end
                studuino.dc_motor_m2.backward
                studuino.dc_motor_m2.coast
                studuino.buzzer_a1.on(440)
                studuino.buzzer_a1.off
                wait until studuino.push_switch_a3.pressed?
                $x = studuino.sound_sensor_a7 + studuino.ir_photoreflector_a4 + studuino.temperature_sensor_a5
              end
            end
            `,
        );
        const settings = getStuduinoSettings(runtime);
        expect(settings.mode).toBe('studuino');
        expect(settings.ports.M2).toBe('dc_motor');
        expect(settings.ports.D10).toBeUndefined();
        expect(settings.calibration.dcMotor).toEqual({ M2: 90 });
    });

    test('the part blocks have the opcodes and the arguments of the docs', async () => {
        await rubyToBlocksToRuby(
            converter,
            target,
            dedent`
            class Studuino
              servo_motor :D9
              servo_motor :D10
              dc_motor :M1
            end

            when_flag_clicked do
              studuino.dc_motor_m1.speed = 200
              studuino.dc_motor_m1.forward
              studuino.servo_motors(d9: 90, d10: 45)
            end
            `,
        );
        const [script] = blockTrees(target);
        const speed = script.next;
        expect(speed.opcode).toBe('smalrubotS1_studuinoDcMotorSpeed');
        expect(speed.fields).toEqual({ PORT: 'M1' });
        expect(speed.inputs.SPEED.fields).toEqual({ NUM: '200' });
        expect(speed.next.opcode).toBe('smalrubotS1_studuinoDcMotorDirection');
        expect(speed.next.fields).toEqual({ PORT: 'M1', DIRECTION: 'normal' });
        const pair = speed.next.next;
        expect(pair.opcode).toBe('smalrubotS1_studuinoServoPair');
        expect(pair.fields).toEqual({ PORT1: 'D9', PORT2: 'D10' });
        expect(RubyGenerator.targetToCode(target, { version: '2' })).toContain(
            'studuino.servo_motors(d9: 90, d10: 45)',
        );
    });

    test('an empty class Studuino means that nothing is connected', async () => {
        await expectRoundTrip(converter, target, 'class Studuino\nend');
        const settings = getStuduinoSettings(runtime);
        expect(settings.mode).toBe('studuino');
        expect(settings.ports).toEqual({});
    });

    test('without class Studuino the port settings are left as they are', async () => {
        runtime.extensionStorage = { smalrubotS1: STUDUINO_STORAGE };
        // The class is written again from the settings
        await expectRoundTrip(
            converter,
            target,
            'studuino.led_a0.on',
            dedent`
            class Studuino
              servo_motor :D9
              dc_motor :M1
              led :A0
              touch_sensor :A2
              light_sensor :A6
            end

            studuino.led_a0.on
            `,
        );
        expect(getStuduinoSettings(runtime).ports).toEqual(STUDUINO_STORAGE.ports);
    });

    test('normal mode writes no class Studuino and keeps the Ruby of normal mode', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            studuino.action("forward")

            studuino.light_sensor_a6
            `,
        );
        expect(getStuduinoSettings(runtime).mode).toBe('normal');
    });

    test('errors of class Studuino', async () => {
        const cases = [
            ['class Studuino\n  led :A6\nend', 'cannot be connected to port A6'],
            ['class Studuino\n  lamp :A0\nend', 'not a part of Studuino'],
            ['class Studuino\n  led :X1\nend', 'not a port of Studuino'],
            ['class Studuino\n  led :A0\n  buzzer :A0\nend', 'declared twice'],
            ['class Studuino\n  led "A0"\nend', 'not a declaration of a part'],
            ['class Studuino\n  dc_motor :M1, calibration: 120\nend', 'from 0 to 100'],
            ['class Studuino\n  led :A0, calibration: 1\nend', 'has no calibration'],
            ['class Studuino\nend\nclass Studuino\nend', 'only once'],
            ['class Studuino < Foo\nend', 'not a declaration of a part'],
            ['when_flag_clicked do\n  class Studuino\n  end\nend', 'at the top of the Stage script'],
        ];
        for (const [code, message] of cases) {
            const errors = await convertErrors(converter, target, code);
            expect(errors.join('\n')).toContain(message);
        }
    });

    test('errors of the calls of the parts', async () => {
        const head = 'class Studuino\n  led :A0\n  servo_motor :D9\nend\n';
        const cases = [
            [`${head}studuino.led_a1.on`, 'led is not connected to port A1'],
            [`${head}studuino.buzzer_a0.on(440)`, 'buzzer is not connected to port A0'],
            [`${head}studuino.led_a6.on`, 'cannot be connected to port A6'],
            [`${head}studuino.action("forward")`, 'cannot be used in Studuino mode'],
            [`${head}studuino.servo_motors(d9: 90)`, 'two different servo motors'],
            [`${head}studuino.servo_motors(d9: 90, d10: 45)`, 'servo_motor is not connected to port D10'],
        ];
        for (const [code, message] of cases) {
            const errors = await convertErrors(converter, target, code);
            expect(errors.join('\n')).toContain(message);
        }
    });
});

describe('Ruby Roundtrip: Studuino mode (sprite)', () => {
    test('a sprite uses the port settings of the project and has no class Studuino', async () => {
        const { target, runtime } = withRuntimeApi(makeSpriteTarget(), STUDUINO_STORAGE);
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, { version: '2' });
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              studuino.servo_motor_d9.angle = 45
            end
            `,
        );
        const errors = await convertErrors(converter, target, 'class Studuino\nend');
        expect(errors.join('\n')).toContain('only be written in the Stage');
        const notDeclared = await convertErrors(converter, target, 'studuino.dc_motor_m2.forward');
        expect(notDeclared.join('\n')).toContain('dc_motor is not connected to port M2');
    });
});
