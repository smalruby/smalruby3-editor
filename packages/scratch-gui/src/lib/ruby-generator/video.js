/**
 * Define Ruby code generator for Video Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @return {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.videoSensing_whenMotionGreaterThan = function (block) {
        block.isStatement = true;
        const reference = Generator.valueToCode(block, 'REFERENCE', Generator.ORDER_NONE) || 0;
        return `video_sensing.when_video_motion_greater_than(${reference}) do\n`;
    };

    Generator.videoSensing_videoToggle = function (block) {
        const videoState = Generator.valueToCode(block, 'VIDEO_STATE', Generator.ORDER_NONE);
        return `video_sensing.video_turn(${videoState})\n`;
    };

    Generator.videoSensing_menu_VIDEO_STATE = function (block) {
        const videoState = Generator.quote_(Generator.getFieldValue(block, 'VIDEO_STATE') || 'on');
        return [videoState, Generator.ORDER_ATOMIC];
    };

    Generator.videoSensing_setVideoTransparency = function (block) {
        const transparency = Generator.valueToCode(block, 'TRANSPARENCY', Generator.ORDER_NONE) || 0;
        return `video_sensing.video_transparency = ${transparency}\n`;
    };

    Generator.videoSensing_videoOn = function (block) {
        const attribute = Generator.valueToCode(block, 'ATTRIBUTE', Generator.ORDER_NONE);
        const subject = Generator.valueToCode(block, 'SUBJECT', Generator.ORDER_NONE);
        return [`video_sensing.video_on(${attribute}, ${subject})`, Generator.ORDER_ATOMIC];
    };

    Generator.videoSensing_menu_ATTRIBUTE = function (block) {
        const attribute = Generator.quote_(Generator.getFieldValue(block, 'ATTRIBUTE') || 'motion');
        return [attribute, Generator.ORDER_ATOMIC];
    };

    Generator.videoSensing_menu_SUBJECT = function (block) {
        const subject = Generator.quote_(Generator.getFieldValue(block, 'SUBJECT') || 'this sprite');
        return [subject, Generator.ORDER_ATOMIC];
    };

    return Generator;
}
