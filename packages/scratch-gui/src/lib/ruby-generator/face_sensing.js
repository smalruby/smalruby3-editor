/**
 * Define Ruby code generator for Face Sensing Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
// === Smalruby: This file is Smalruby-specific (Ruby generator for face_sensing extension) ===

const PartLabel = {
    0: 'left_eye',
    1: 'right_eye',
    2: 'nose',
    3: 'mouth',
    4: 'left_ear',
    5: 'right_ear',
    6: 'between_eyes',
    7: 'top_of_head'
};

export default function (Generator) {
    Generator.faceSensing_goToPart = function (block) {
        const part = Generator.getFieldValue(block, 'PART', '2');
        const partLabel = Generator.quote_(PartLabel[part] || 'nose');
        return `face_sensing.go_to(${partLabel})\n`;
    };

    Generator.faceSensing_pointInFaceTiltDirection = function () {
        return `face_sensing.point_in_direction_of_face_tilt\n`;
    };

    Generator.faceSensing_setSizeToFaceSize = function () {
        return `face_sensing.set_size_to_face_size\n`;
    };

    Generator.faceSensing_whenTilted = function (block) {
        block.isStatement = true;
        const direction = Generator.quote_(Generator.getFieldValue(block, 'DIRECTION', 'left'));
        return `face_sensing.when_face_tilted(${direction}) do\n`;
    };

    Generator.faceSensing_whenSpriteTouchesPart = function (block) {
        block.isStatement = true;
        const part = Generator.getFieldValue(block, 'PART', '2');
        const partLabel = Generator.quote_(PartLabel[part] || 'nose');
        return `face_sensing.when_this_sprite_touch(${partLabel}) do\n`;
    };

    Generator.faceSensing_whenFaceDetected = function (block) {
        block.isStatement = true;
        return `face_sensing.when_face_detected do\n`;
    };

    Generator.faceSensing_faceIsDetected = function () {
        return ['face_sensing.face_detected?', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.faceSensing_faceTilt = function () {
        return ['face_sensing.face_tilt', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.faceSensing_faceSize = function () {
        return ['face_sensing.face_size', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.faceSensing_menu_PART = function (block) {
        const part = Generator.getFieldValue(block, 'PART', '2');
        const partLabel = Generator.quote_(PartLabel[part] || 'nose');
        return [partLabel, Generator.ORDER_ATOMIC];
    };

    Generator.faceSensing_menu_TILT = function (block) {
        const direction = Generator.quote_(Generator.getFieldValue(block, 'TILT', 'left'));
        return [direction, Generator.ORDER_ATOMIC];
    };

    return Generator;
}
