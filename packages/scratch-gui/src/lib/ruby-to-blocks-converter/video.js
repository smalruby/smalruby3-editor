import { menuInputArg, numberArg, registerSendTable } from './send-table';

const VideoSensing = 'video_sensing';

const SensingAttributeMenu = ['motion', 'direction'];

const SensingSubjectMenu = ['Stage', 'this sprite'];
const SensingSubjectMenuLower = SensingSubjectMenu.map((x) => x.toLowerCase());

const VideoStateMenu = ['off', 'on', 'on-flipped'];

// A string of a menu is looked up without regard to case (`"Stage"` / `"stage"`).
const lower = (value) => value.toLowerCase();
const subjectOf = (value) => {
    const index = SensingSubjectMenuLower.indexOf(value.toLowerCase());
    return index < 0 ? '' : SensingSubjectMenu[index];
};

// The calls that map one to one onto a block (send-table.js).
const VIDEO_SENDS = [
    {
        receiver: VideoSensing,
        name: 'when_video_motion_greater_than',
        opcode: 'videoSensing_whenMotionGreaterThan',
        hat: true,
        changesReceiver: true,
        args: [numberArg('REFERENCE', 10)],
    },
    {
        receiver: VideoSensing,
        name: 'video_on',
        opcode: 'videoSensing_videoOn',
        type: 'value',
        changesReceiver: true,
        args: [
            menuInputArg('ATTRIBUTE', 'videoSensing_menu_ATTRIBUTE', 'ATTRIBUTE', 'motion', {
                choices: SensingAttributeMenu,
                normalize: lower,
            }),
            menuInputArg('SUBJECT', 'videoSensing_menu_SUBJECT', 'SUBJECT', 'this sprite', {
                choices: SensingSubjectMenu,
                normalize: subjectOf,
            }),
        ],
    },
    {
        receiver: VideoSensing,
        name: 'video_turn',
        opcode: 'videoSensing_videoToggle',
        changesReceiver: true,
        args: [
            menuInputArg('VIDEO_STATE', 'videoSensing_menu_VIDEO_STATE', 'VIDEO_STATE', 'on', {
                choices: VideoStateMenu,
                normalize: lower,
            }),
        ],
    },
    {
        receiver: VideoSensing,
        name: 'video_transparency=',
        opcode: 'videoSensing_setVideoTransparency',
        changesReceiver: true,
        args: [numberArg('TRANSPARENCY', 50)],
    },
];

/**
 * Video converter
 */
const VideoConverter = {
    sends: VIDEO_SENDS,

    register: function (converter) {
        // `video_sensing` itself is a Ruby expression that the calls of the table turn into their blocks.
        converter.registerOnSend('self', VideoSensing, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(VideoSensing, node);
        });

        registerSendTable(converter, VIDEO_SENDS);
    },
};

export default VideoConverter;
