/**
 * Video sensing blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of video sensing move into a send table
 * (issue #2090); ruby-roundtrip/extension_video_sensing.test.js stays as the long round trip.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const attribute = (value) => `videoSensing_menu_ATTRIBUTE(ATTRIBUTE = "${value}")`;
const subject = (value) => `videoSensing_menu_SUBJECT(SUBJECT = "${value}")`;
const state = (value) => `videoSensing_menu_VIDEO_STATE(VIDEO_STATE = "${value}")`;
const videoOn = (a, s) => `looks_say(MESSAGE: videoSensing_videoOn(ATTRIBUTE: ${a}, SUBJECT: ${s}))`;

const rows = [
    {
        blocks: `
            videoSensing_whenMotionGreaterThan(REFERENCE: 10)
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            video_sensing.when_video_motion_greater_than(10) do
              move(10)
            end
        `,
    },
    {
        blocks: 'videoSensing_whenMotionGreaterThan(REFERENCE: $r)',
        ruby: 'video_sensing.when_video_motion_greater_than($r) do\nend',
    },
    {
        blocks: videoOn(attribute('motion'), subject('this sprite')),
        ruby: 'say(video_sensing.video_on("motion", "this sprite"))',
    },
    {
        blocks: videoOn(attribute('direction'), subject('Stage')),
        ruby: 'say(video_sensing.video_on("direction", "Stage"))',
    },
    {
        blocks: videoOn(attribute('direction'), subject('Stage')),
        ruby: 'say(video_sensing.video_on("Direction", "stage"))',
        only: 'toBlocks',
    },
    {
        blocks: videoOn(attribute('motion'), subject('this sprite')),
        ruby: 'say(video_sensing.video_on("MOTION", "This Sprite"))',
        only: 'toBlocks',
    },
    { blocks: videoOn('$a', '$s'), ruby: 'say(video_sensing.video_on($a, $s))' },
    ...['on', 'off', 'on-flipped'].map((value) => ({
        blocks: `videoSensing_videoToggle(VIDEO_STATE: ${state(value)})`,
        ruby: `video_sensing.video_turn("${value}")`,
    })),
    {
        blocks: `videoSensing_videoToggle(VIDEO_STATE: ${state('off')})`,
        ruby: 'video_sensing.video_turn("OFF")',
        only: 'toBlocks',
    },
    { blocks: 'videoSensing_videoToggle(VIDEO_STATE: $v)', ruby: 'video_sensing.video_turn($v)' },
    { blocks: 'videoSensing_setVideoTransparency(TRANSPARENCY: 50)', ruby: 'video_sensing.video_transparency = 50' },
    { blocks: 'videoSensing_setVideoTransparency(TRANSPARENCY: $t)', ruby: 'video_sensing.video_transparency = $t' },
];

defineBlockRubyTable('Video sensing blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'Video sensing blocks ⇔ Ruby (stage)',
    [
        { blocks: `videoSensing_videoToggle(VIDEO_STATE: ${state('on')})`, ruby: 'video_sensing.video_turn("on")' },
        {
            blocks: 'videoSensing_setVideoTransparency(TRANSPARENCY: 50)',
            ruby: 'video_sensing.video_transparency = 50',
        },
    ],
    { stage: true },
);
