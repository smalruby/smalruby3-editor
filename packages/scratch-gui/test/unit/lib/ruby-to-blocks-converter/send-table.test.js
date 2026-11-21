import RubyGenerator from '../../../../src/lib/ruby-generator';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import BoostConverter from '../../../../src/lib/ruby-to-blocks-converter/boost';
import ControlConverter from '../../../../src/lib/ruby-to-blocks-converter/control';
import EventConverter from '../../../../src/lib/ruby-to-blocks-converter/event';
import FaceSensingConverter from '../../../../src/lib/ruby-to-blocks-converter/face_sensing';
import LooksConverter from '../../../../src/lib/ruby-to-blocks-converter/looks';
import MakeyMakeyConverter from '../../../../src/lib/ruby-to-blocks-converter/makeymakey';
import MotionConverter from '../../../../src/lib/ruby-to-blocks-converter/motion';
import MusicConverter from '../../../../src/lib/ruby-to-blocks-converter/music';
import OperatorsConverter from '../../../../src/lib/ruby-to-blocks-converter/operators';
import PenConverter from '../../../../src/lib/ruby-to-blocks-converter/pen';
import {
    menuArg,
    menuInputArg,
    numberArg,
    onSelf,
    registerSendTable,
} from '../../../../src/lib/ruby-to-blocks-converter/send-table';
import SensingConverter from '../../../../src/lib/ruby-to-blocks-converter/sensing';
import SoundConverter from '../../../../src/lib/ruby-to-blocks-converter/sound';
import Text2SpeechConverter from '../../../../src/lib/ruby-to-blocks-converter/text2speech';
import TranslateConverter from '../../../../src/lib/ruby-to-blocks-converter/translate';
import VideoConverter from '../../../../src/lib/ruby-to-blocks-converter/video';
import Wedo2Converter from '../../../../src/lib/ruby-to-blocks-converter/wedo2';
import { makeConverter, makeStageTarget } from '../../helpers/ruby-roundtrip-helper';

/**
 * The opcodes that the rows of a send table make, menus included.
 * @param {Array<object>} rows - The rows.
 * @returns {Array<string>} The opcodes.
 */
const opcodesOf = (rows) =>
    rows.flatMap((row) => [
        row.opcode,
        ...[...(row.args || []), ...(row.keywords || []).map(([, arg]) => arg)]
            .filter((arg) => /^menu/.test(arg.kind))
            .map((arg) => arg.menuOpcode),
        ...Object.values(row.menus || {}).map(([menuOpcode]) => menuOpcode),
    ]);

describe('RubyToBlocksConverter/send table', () => {
    const tables = {
        motion: MotionConverter,
        looks: LooksConverter,
        sound: SoundConverter,
        control: ControlConverter,
        event: EventConverter,
        sensing: SensingConverter,
        operators: OperatorsConverter,
        pen: PenConverter,
        music: MusicConverter,
        text2speech: Text2SpeechConverter,
        translate: TranslateConverter,
        video: VideoConverter,
        boost: BoostConverter,
        wedo2: Wedo2Converter,
        faceSensing: FaceSensingConverter,
        makeymakey: MakeyMakeyConverter,
    };

    test.each(Object.keys(tables))('every opcode of the %s table has a generator', (area) => {
        const missing = opcodesOf(tables[area].sends).filter((opcode) => typeof RubyGenerator[opcode] !== 'function');
        expect(missing).toEqual([]);
    });

    test('a row with an unknown kind of argument is an error, not a block without the argument', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        registerSendTable(converter, [
            { receiver: 'sprite', name: 'jump', opcode: 'motion_movesteps', args: [{ kind: 'paint', input: 'C' }] },
        ]);

        expect(await converter.targetCodeToBlocks(null, 'jump(3)')).toBe(false);
        expect(converter.errors.map((error) => error.text)).toEqual(['unknown kind of argument: paint']);
    });

    test('a row of keywords takes only a hash of exactly its keys', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        registerSendTable(converter, [
            {
                receiver: 'sprite',
                name: 'jump',
                opcode: 'motion_movesteps',
                keywords: [['steps', numberArg('STEPS', 10)]],
            },
        ]);
        converter.registerOnSend('sprite', 'jump', 1, () =>
            converter._createBlock('motion_ifonedgebounce', 'statement'),
        );

        for (const code of ['jump(3)', 'jump(far: 3)', 'jump(steps: 3, far: 1)', 'jump(steps: "far")']) {
            await converter.targetCodeToBlocks(null, code);
            expect(Object.values(converter.blocks).map((block) => block.opcode)).toEqual(['motion_ifonedgebounce']);
        }

        await converter.targetCodeToBlocks(null, 'jump(steps: 3)');
        expect(Object.values(converter.blocks).map((block) => block.opcode)).toEqual([
            'motion_movesteps',
            'math_number',
        ]);
    });

    test('a row gives way to the next handler when an argument is of another kind', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        registerSendTable(converter, [
            { receiver: 'sprite', name: 'jump', opcode: 'motion_movesteps', args: [numberArg('STEPS', 10)] },
        ]);
        converter.registerOnSend('sprite', 'jump', 1, () =>
            converter._createBlock('motion_ifonedgebounce', 'statement'),
        );

        await converter.targetCodeToBlocks(null, 'jump("far")');
        expect(Object.values(converter.blocks).map((block) => block.opcode)).toEqual(['motion_ifonedgebounce']);

        await converter.targetCodeToBlocks(null, 'jump(3)');
        expect(Object.values(converter.blocks).map((block) => block.opcode)).toEqual([
            'motion_movesteps',
            'math_number',
        ]);
    });

    test('a row checks its arguments before it makes the block', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        registerSendTable(converter, [
            {
                receiver: 'sprite',
                name: 'jump',
                opcode: 'looks_switchcostumeto',
                args: [
                    menuArg('COSTUME', 'looks_costume', 'COSTUME', {
                        validate: () => {
                            throw new Error('no such costume');
                        },
                    }),
                ],
            },
        ]);

        expect(await converter.targetCodeToBlocks(null, 'jump("far")')).toBe(false);
        expect(converter.errors.map((error) => error.text)).toEqual(['no such costume']);
        expect(Object.values(converter.blocks).map((block) => block.opcode)).not.toContain('looks_switchcostumeto');
    });

    test('a menu input can normalize the string and take its default from the converter', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        registerSendTable(converter, [
            {
                receiver: 'sprite',
                name: 'jump',
                opcode: 'looks_switchcostumeto',
                args: [
                    menuInputArg('COSTUME', 'looks_costume', 'COSTUME', () => 'B', {
                        choices: ['A', 'B'],
                        normalize: (value) => value.toUpperCase(),
                    }),
                ],
            },
        ]);
        const menuValues = () =>
            Object.values(converter.blocks)
                .filter((block) => block.opcode === 'looks_costume')
                .map((block) => block.fields.COSTUME.value);

        expect(await converter.targetCodeToBlocks(null, 'jump("a")')).toBe(true);
        expect(menuValues()).toEqual(['A']);

        expect(await converter.targetCodeToBlocks(null, 'jump($v)')).toBe(true);
        expect(menuValues()).toEqual(['B']);

        expect(await converter.targetCodeToBlocks(null, 'jump("c")')).toBe(false);
    });

    test('a row on self takes self.xxx and xxx, not a Ruby expression of the same name', async () => {
        const { target, runtime } = makeStageTarget();
        const converter = makeConverter(target, runtime, { version: '2' });
        registerSendTable(converter, onSelf([{ receiver: 'stage', name: 'jump', opcode: 'motion_ifonedgebounce' }]));

        await converter.targetCodeToBlocks(target, 'self.jump');
        expect(Object.values(converter.blocks).map((block) => block.opcode)).toEqual(['motion_ifonedgebounce']);

        await converter.targetCodeToBlocks(target, 'stage.jump');
        expect(Object.values(converter.blocks).map((block) => block.opcode)).not.toContain('motion_ifonedgebounce');
    });
});
