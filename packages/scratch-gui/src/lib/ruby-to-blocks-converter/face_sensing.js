// === Smalruby: This file is Smalruby-specific (Ruby-to-blocks converter for face_sensing extension) ===
import { fieldArg, registerSendTable } from './send-table';

const FaceSensing = 'face_sensing';

const PartMenu = {
    nose: '2',
    mouth: '3',
    left_eye: '0',
    right_eye: '1',
    between_eyes: '6',
    left_ear: '4',
    right_ear: '5',
    top_of_head: '7',
};
const PartMenuKeys = Object.keys(PartMenu);

const TiltMenu = ['left', 'right'];

// A part of the face: a name (without regard to case) that the field keeps as its number.
const partArg = () =>
    fieldArg('PART', Object.values(PartMenu), {
        normalize: (value) => {
            const key = value.toLowerCase();
            return Object.prototype.hasOwnProperty.call(PartMenu, key) ? PartMenu[key] : '';
        },
    });

// The calls that map one to one onto a block (send-table.js).
const FACE_SENSING_SENDS = [
    { name: 'go_to', opcode: 'faceSensing_goToPart', args: [partArg()] },
    { name: 'point_in_direction_of_face_tilt', opcode: 'faceSensing_pointInFaceTiltDirection' },
    { name: 'set_size_to_face_size', opcode: 'faceSensing_setSizeToFaceSize' },
    {
        name: 'when_face_tilted',
        opcode: 'faceSensing_whenTilted',
        hat: true,
        args: [fieldArg('DIRECTION', TiltMenu, { normalize: (value) => value.toLowerCase() })],
    },
    { name: 'when_this_sprite_touch', opcode: 'faceSensing_whenSpriteTouchesPart', hat: true, args: [partArg()] },
    { name: 'when_face_detected', opcode: 'faceSensing_whenFaceDetected', hat: true },
    { name: 'face_detected?', opcode: 'faceSensing_faceIsDetected', type: 'value_boolean' },
    { name: 'face_tilt', opcode: 'faceSensing_faceTilt', type: 'value' },
    { name: 'face_size', opcode: 'faceSensing_faceSize', type: 'value' },
].map((row) => ({ receiver: FaceSensing, changesReceiver: true, ...row }));

/**
 * FaceSensing converter
 */
const FaceSensingConverter = {
    sends: FACE_SENSING_SENDS,

    register: function (converter) {
        // `face_sensing` itself is a Ruby expression that the calls of the table turn into their blocks.
        converter.registerOnSend('self', FaceSensing, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(FaceSensing, node);
        });

        registerSendTable(converter, FACE_SENSING_SENDS);
    },
};

export default FaceSensingConverter;
