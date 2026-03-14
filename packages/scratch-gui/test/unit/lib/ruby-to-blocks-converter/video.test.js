import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Video', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
        expected = null;
    });

    test('videoSensing_whenMotionGreaterThan', async () => {
        code = `
            video_sensing.when_video_motion_greater_than(10) do
              say("motion!")
            end
        `;
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('videoSensing_videoOn (as value block)', async () => {
        code = 'say(video_sensing.video_on("motion", "this sprite"))';
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('videoSensing_videoToggle', async () => {
        code = 'video_sensing.video_turn("on")';
        expected = [
            {
                opcode: 'videoSensing_videoToggle',
                inputs: [
                    {
                        name: 'VIDEO_STATE',
                        block: {
                            opcode: 'videoSensing_menu_VIDEO_STATE',
                            fields: [{name: 'VIDEO_STATE', value: 'on'}],
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('videoSensing_setVideoTransparency', async () => {
        code = 'video_sensing.video_transparency = 50';
        expected = [
            {
                opcode: 'videoSensing_setVideoTransparency',
                inputs: [
                    {
                        name: 'TRANSPARENCY',
                        block: expectedInfo.makeNumber(50)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('invalid', async () => {
        for (const s of [
            'video_sensing.video_turn("invalid_state")',
            'video_sensing.video_transparency = "abc"'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        }
    });
});
