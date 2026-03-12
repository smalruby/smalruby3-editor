// === Smalruby: This file is Smalruby-specific (Ruby-to-blocks converter for face_sensing extension) ===

import Primitive from './primitive';

const FaceSensing = 'face_sensing';

const PartMenu = {
    nose: '2',
    mouth: '3',
    left_eye: '0',
    right_eye: '1',
    between_eyes: '6',
    left_ear: '4',
    right_ear: '5',
    top_of_head: '7'
};
const PartMenuKeys = Object.keys(PartMenu);

const TiltMenu = [
    'left',
    'right'
];

/**
 * FaceSensing converter
 */
const FaceSensingConverter = {
    register: function (converter) {
        converter.registerOnSend('self', FaceSensing, 0, params => {
            const {node} = params;

            return converter.createRubyExpressionBlock(FaceSensing, node);
        });

        // goToPart: face_sensing.go_to("nose")
        converter.registerOnSend(FaceSensing, 'go_to', 1, params => {
            const {receiver, args} = params;

            if (!converter.isString(args[0])) return null;
            const partKey = args[0].toString().toLowerCase();
            if (!PartMenuKeys.includes(partKey)) return null;

            args[0] = new Primitive('str', PartMenu[partKey], args[0].node);

            const block = converter.changeRubyExpressionBlock(receiver, 'faceSensing_goToPart', 'statement');
            converter.addField(block, 'PART', args[0]);
            return block;
        });

        // pointInFaceTiltDirection: face_sensing.point_in_direction_of_face_tilt
        converter.registerOnSend(FaceSensing, 'point_in_direction_of_face_tilt', 0, params => {
            const {receiver} = params;

            const block =
                converter.changeRubyExpressionBlock(receiver, 'faceSensing_pointInFaceTiltDirection', 'statement');
            return block;
        });

        // setSizeToFaceSize: face_sensing.set_size_to_face_size
        converter.registerOnSend(FaceSensing, 'set_size_to_face_size', 0, params => {
            const {receiver} = params;

            const block = converter.changeRubyExpressionBlock(receiver, 'faceSensing_setSizeToFaceSize', 'statement');
            return block;
        });

        // whenTilted: face_sensing.when_face_tilted("left") do ... end
        converter.registerOnSendWithBlock(FaceSensing, 'when_face_tilted', 1, 0, params => {
            const {receiver, args, rubyBlock} = params;

            if (!converter.isString(args[0])) return null;
            const direction = args[0].toString().toLowerCase();
            if (!TiltMenu.includes(direction)) return null;

            args[0] = new Primitive('str', direction, args[0].node);

            const block = converter.changeRubyExpressionBlock(receiver, 'faceSensing_whenTilted', 'hat');
            converter.addField(block, 'DIRECTION', args[0]);
            converter.setParent(rubyBlock, block);
            return block;
        });

        // whenSpriteTouchesPart: face_sensing.when_this_sprite_touch("nose") do ... end
        converter.registerOnSendWithBlock(FaceSensing, 'when_this_sprite_touch', 1, 0, params => {
            const {receiver, args, rubyBlock} = params;

            if (!converter.isString(args[0])) return null;
            const partKey = args[0].toString().toLowerCase();
            if (!PartMenuKeys.includes(partKey)) return null;

            args[0] = new Primitive('str', PartMenu[partKey], args[0].node);

            const block =
                converter.changeRubyExpressionBlock(receiver, 'faceSensing_whenSpriteTouchesPart', 'hat');
            converter.addField(block, 'PART', args[0]);
            converter.setParent(rubyBlock, block);
            return block;
        });

        // whenFaceDetected: face_sensing.when_face_detected do ... end
        converter.registerOnSendWithBlock(FaceSensing, 'when_face_detected', 0, 0, params => {
            const {receiver, rubyBlock} = params;

            const block = converter.changeRubyExpressionBlock(receiver, 'faceSensing_whenFaceDetected', 'hat');
            converter.setParent(rubyBlock, block);
            return block;
        });

        // faceIsDetected: face_sensing.face_detected?
        converter.registerOnSend(FaceSensing, 'face_detected?', 0, params => {
            const {receiver} = params;

            const block =
                converter.changeRubyExpressionBlock(receiver, 'faceSensing_faceIsDetected', 'value_boolean');
            return block;
        });

        // faceTilt: face_sensing.face_tilt
        converter.registerOnSend(FaceSensing, 'face_tilt', 0, params => {
            const {receiver} = params;

            const block = converter.changeRubyExpressionBlock(receiver, 'faceSensing_faceTilt', 'value');
            return block;
        });

        // faceSize: face_sensing.face_size
        converter.registerOnSend(FaceSensing, 'face_size', 0, params => {
            const {receiver} = params;

            const block = converter.changeRubyExpressionBlock(receiver, 'faceSensing_faceSize', 'value');
            return block;
        });
    }
};

export default FaceSensingConverter;
