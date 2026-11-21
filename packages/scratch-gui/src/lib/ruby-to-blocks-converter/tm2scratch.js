import { menuInputArg, numberArg, registerSendTable, textArg } from './send-table';

const TM = 'tm';

// A menu of TM2Scratch: any string as it is, or any block (a hat takes only a string).
const tmMenu = (input, menu, defaultValue, { stringOnly = false } = {}) =>
    menuInputArg(input, `tm2scratch_menu_${menu}`, menu, defaultValue, { anyBlock: true, stringOnly });
const labelArg = (menu, defaultValue, options) => tmMenu('LABEL', menu, defaultValue, options);

// The calls of `tm.xxx` that map one to one onto a block (send-table.js).
const TM_SENDS = [
    // Image classification
    {
        name: 'when_image_label_received',
        opcode: 'tm2scratch_whenReceived',
        hat: true,
        args: [labelArg('received_menu', 'any', { stringOnly: true })],
    },
    {
        name: 'image_label_detected?',
        opcode: 'tm2scratch_isImageLabelDetected',
        type: 'value_boolean',
        args: [labelArg('image_labels_menu', 'any')],
    },
    {
        name: 'image_label_confidence',
        opcode: 'tm2scratch_imageLabelConfidence',
        type: 'value',
        args: [labelArg('image_labels_without_any_menu', '')],
    },
    {
        name: 'set_image_classification_model_url',
        opcode: 'tm2scratch_setImageClassificationModelURL',
        args: [textArg('URL', 'https://teachablemachine.withgoogle.com/models/0rX_3hoH/')],
    },
    { name: 'classify_video_image', opcode: 'tm2scratch_classifyVideoImageBlock' },
    { name: 'image_label', opcode: 'tm2scratch_getImageLabel', type: 'value' },
    // Sound classification
    {
        name: 'when_sound_label_received',
        opcode: 'tm2scratch_whenReceivedSoundLabel',
        hat: true,
        args: [labelArg('received_sound_label_menu', 'any', { stringOnly: true })],
    },
    {
        name: 'sound_label_detected?',
        opcode: 'tm2scratch_isSoundLabelDetected',
        type: 'value_boolean',
        args: [labelArg('sound_labels_menu', 'any')],
    },
    {
        name: 'sound_label_confidence',
        opcode: 'tm2scratch_soundLabelConfidence',
        type: 'value',
        args: [labelArg('sound_labels_without_any_menu', '')],
    },
    {
        name: 'set_sound_classification_model_url',
        opcode: 'tm2scratch_setSoundClassificationModelURL',
        args: [textArg('URL', 'https://teachablemachine.withgoogle.com/models/xP0spGSB/')],
    },
    { name: 'sound_label', opcode: 'tm2scratch_getSoundLabel', type: 'value' },
    // Configuration
    {
        name: 'toggle_classification',
        opcode: 'tm2scratch_toggleClassification',
        args: [tmMenu('CLASSIFICATION_STATE', 'classification_menu', 'off')],
    },
    {
        name: 'classification_interval=',
        opcode: 'tm2scratch_setClassificationInterval',
        args: [tmMenu('CLASSIFICATION_INTERVAL', 'classification_interval_menu', '1')],
    },
    {
        name: 'confidence_threshold=',
        opcode: 'tm2scratch_setConfidenceThreshold',
        args: [numberArg('CONFIDENCE_THRESHOLD', 0.5)],
    },
    { name: 'confidence_threshold', opcode: 'tm2scratch_getConfidenceThreshold', type: 'value' },
    { name: 'video_toggle', opcode: 'tm2scratch_videoToggle', args: [tmMenu('VIDEO_STATE', 'video_menu', 'off')] },
    { name: 'switch_camera', opcode: 'tm2scratch_switchCamera', args: [tmMenu('DEVICE', 'mediadevices', '')] },
].map((row) => ({ receiver: TM, changesReceiver: true, ...row }));

const TM2ScratchConverter = {
    sends: TM_SENDS,

    register: function (converter) {
        // Register receiver: tm
        converter.registerOnSend('self', TM, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(TM, node);
        });

        registerSendTable(converter, TM_SENDS);
    },
};

export default TM2ScratchConverter;
