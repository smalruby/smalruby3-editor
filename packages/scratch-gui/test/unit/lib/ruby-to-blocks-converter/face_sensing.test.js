import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/FaceSensing', () => {
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

    test('face_sensing.go_to("nose")', async () => {
        code = 'face_sensing.go_to("nose")';
        expected = [
            {
                opcode: 'faceSensing_goToPart',
                fields: [
                    {
                        name: 'PART',
                        value: '2'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.go_to("left_eye")', async () => {
        code = 'face_sensing.go_to("left_eye")';
        expected = [
            {
                opcode: 'faceSensing_goToPart',
                fields: [
                    {
                        name: 'PART',
                        value: '0'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.go_to("top_of_head")', async () => {
        code = 'face_sensing.go_to("top_of_head")';
        expected = [
            {
                opcode: 'faceSensing_goToPart',
                fields: [
                    {
                        name: 'PART',
                        value: '7'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.point_in_direction_of_face_tilt', async () => {
        code = 'face_sensing.point_in_direction_of_face_tilt';
        expected = [
            {
                opcode: 'faceSensing_pointInFaceTiltDirection'
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.set_size_to_face_size', async () => {
        code = 'face_sensing.set_size_to_face_size';
        expected = [
            {
                opcode: 'faceSensing_setSizeToFaceSize'
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.when_face_tilted("left")', async () => {
        code = 'face_sensing.when_face_tilted("left") do; end';
        expected = [
            {
                opcode: 'faceSensing_whenTilted',
                fields: [
                    {
                        name: 'DIRECTION',
                        value: 'left'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.when_face_tilted("right")', async () => {
        code = 'face_sensing.when_face_tilted("right") do; end';
        expected = [
            {
                opcode: 'faceSensing_whenTilted',
                fields: [
                    {
                        name: 'DIRECTION',
                        value: 'right'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.when_this_sprite_touch("nose")', async () => {
        code = 'face_sensing.when_this_sprite_touch("nose") do; end';
        expected = [
            {
                opcode: 'faceSensing_whenSpriteTouchesPart',
                fields: [
                    {
                        name: 'PART',
                        value: '2'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.when_this_sprite_touch("right_ear")', async () => {
        code = 'face_sensing.when_this_sprite_touch("right_ear") do; end';
        expected = [
            {
                opcode: 'faceSensing_whenSpriteTouchesPart',
                fields: [
                    {
                        name: 'PART',
                        value: '5'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.when_face_detected', async () => {
        code = 'face_sensing.when_face_detected do; end';
        expected = [
            {
                opcode: 'faceSensing_whenFaceDetected'
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.face_detected?', async () => {
        code = 'face_sensing.face_detected?';
        expected = [
            {
                opcode: 'faceSensing_faceIsDetected'
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.face_tilt', async () => {
        code = 'face_sensing.face_tilt';
        expected = [
            {
                opcode: 'faceSensing_faceTilt'
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('face_sensing.face_size', async () => {
        code = 'face_sensing.face_size';
        expected = [
            {
                opcode: 'faceSensing_faceSize'
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
