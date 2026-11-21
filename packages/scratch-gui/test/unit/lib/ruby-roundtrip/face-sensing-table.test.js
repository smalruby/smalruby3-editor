/**
 * Face sensing blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of face sensing move into a send table
 * (issue #2090).
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const parts = {
    nose: '2',
    mouth: '3',
    left_eye: '0',
    right_eye: '1',
    between_eyes: '6',
    left_ear: '4',
    right_ear: '5',
    top_of_head: '7',
};

const rows = [
    ...Object.entries(parts).map(([name, value]) => ({
        blocks: `faceSensing_goToPart(PART = "${value}")`,
        ruby: `face_sensing.go_to("${name}")`,
    })),
    { blocks: 'faceSensing_goToPart(PART = "2")', ruby: 'face_sensing.go_to("NOSE")', only: 'toBlocks' },
    { blocks: 'faceSensing_pointInFaceTiltDirection', ruby: 'face_sensing.point_in_direction_of_face_tilt' },
    { blocks: 'faceSensing_setSizeToFaceSize', ruby: 'face_sensing.set_size_to_face_size' },
    {
        blocks: `
            faceSensing_whenTilted(DIRECTION = "right")
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            face_sensing.when_face_tilted("right") do
              move(10)
            end
        `,
    },
    {
        blocks: 'faceSensing_whenTilted(DIRECTION = "left")',
        ruby: 'face_sensing.when_face_tilted("Left") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: 'faceSensing_whenSpriteTouchesPart(PART = "3")',
        ruby: 'face_sensing.when_this_sprite_touch("mouth") do\nend',
    },
    { blocks: 'faceSensing_whenFaceDetected', ruby: 'face_sensing.when_face_detected do\nend' },
    { blocks: 'looks_say(MESSAGE: faceSensing_faceIsDetected)', ruby: 'say(face_sensing.face_detected?)' },
    { blocks: 'looks_say(MESSAGE: faceSensing_faceTilt)', ruby: 'say(face_sensing.face_tilt)' },
    { blocks: 'looks_say(MESSAGE: faceSensing_faceSize)', ruby: 'say(face_sensing.face_size)' },
];

defineBlockRubyTable('Face sensing blocks ⇔ Ruby', rows);
