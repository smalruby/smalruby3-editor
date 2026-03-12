import RubyGenerator from '../../../../src/lib/ruby-generator';
import FaceSensingBlocks from '../../../../src/lib/ruby-generator/face_sensing';

describe('RubyGenerator/FaceSensing', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        FaceSensingBlocks(RubyGenerator);
    });

    test('faceSensing_goToPart with nose', () => {
        const block = {
            opcode: 'faceSensing_goToPart',
            fields: {
                PART: {
                    value: '2'
                }
            }
        };
        expect(RubyGenerator.faceSensing_goToPart(block)).toEqual('face_sensing.go_to("nose")\n');
    });

    test('faceSensing_goToPart with left_eye', () => {
        const block = {
            opcode: 'faceSensing_goToPart',
            fields: {
                PART: {
                    value: '0'
                }
            }
        };
        expect(RubyGenerator.faceSensing_goToPart(block)).toEqual('face_sensing.go_to("left_eye")\n');
    });

    test('faceSensing_pointInFaceTiltDirection', () => {
        const block = {
            opcode: 'faceSensing_pointInFaceTiltDirection'
        };
        expect(RubyGenerator.faceSensing_pointInFaceTiltDirection(block))
            .toEqual('face_sensing.point_in_direction_of_face_tilt\n');
    });

    test('faceSensing_setSizeToFaceSize', () => {
        const block = {
            opcode: 'faceSensing_setSizeToFaceSize'
        };
        expect(RubyGenerator.faceSensing_setSizeToFaceSize(block))
            .toEqual('face_sensing.set_size_to_face_size\n');
    });

    test('faceSensing_whenTilted with left', () => {
        const block = {
            opcode: 'faceSensing_whenTilted',
            fields: {
                DIRECTION: {
                    value: 'left'
                }
            }
        };
        expect(RubyGenerator.faceSensing_whenTilted(block))
            .toEqual('face_sensing.when_face_tilted("left") do\n');
    });

    test('faceSensing_whenTilted with right', () => {
        const block = {
            opcode: 'faceSensing_whenTilted',
            fields: {
                DIRECTION: {
                    value: 'right'
                }
            }
        };
        expect(RubyGenerator.faceSensing_whenTilted(block))
            .toEqual('face_sensing.when_face_tilted("right") do\n');
    });

    test('faceSensing_whenSpriteTouchesPart with nose', () => {
        const block = {
            opcode: 'faceSensing_whenSpriteTouchesPart',
            fields: {
                PART: {
                    value: '2'
                }
            }
        };
        expect(RubyGenerator.faceSensing_whenSpriteTouchesPart(block))
            .toEqual('face_sensing.when_this_sprite_touch("nose") do\n');
    });

    test('faceSensing_whenSpriteTouchesPart with right_ear', () => {
        const block = {
            opcode: 'faceSensing_whenSpriteTouchesPart',
            fields: {
                PART: {
                    value: '5'
                }
            }
        };
        expect(RubyGenerator.faceSensing_whenSpriteTouchesPart(block))
            .toEqual('face_sensing.when_this_sprite_touch("right_ear") do\n');
    });

    test('faceSensing_whenFaceDetected', () => {
        const block = {
            opcode: 'faceSensing_whenFaceDetected'
        };
        expect(RubyGenerator.faceSensing_whenFaceDetected(block))
            .toEqual('face_sensing.when_face_detected do\n');
    });

    test('faceSensing_faceIsDetected', () => {
        const block = {
            opcode: 'faceSensing_faceIsDetected'
        };
        const result = RubyGenerator.faceSensing_faceIsDetected(block);
        expect(result[0]).toEqual('face_sensing.face_detected?');
    });

    test('faceSensing_faceTilt', () => {
        const block = {
            opcode: 'faceSensing_faceTilt'
        };
        const result = RubyGenerator.faceSensing_faceTilt(block);
        expect(result[0]).toEqual('face_sensing.face_tilt');
    });

    test('faceSensing_faceSize', () => {
        const block = {
            opcode: 'faceSensing_faceSize'
        };
        const result = RubyGenerator.faceSensing_faceSize(block);
        expect(result[0]).toEqual('face_sensing.face_size');
    });

    test('faceSensing_menu_PART', () => {
        const block = {
            opcode: 'faceSensing_menu_PART',
            fields: {
                PART: {
                    value: '3'
                }
            }
        };
        const result = RubyGenerator.faceSensing_menu_PART(block);
        expect(result[0]).toEqual('"mouth"');
    });

    test('faceSensing_menu_TILT', () => {
        const block = {
            opcode: 'faceSensing_menu_TILT',
            fields: {
                TILT: {
                    value: 'left'
                }
            }
        };
        const result = RubyGenerator.faceSensing_menu_TILT(block);
        expect(result[0]).toEqual('"left"');
    });
});
