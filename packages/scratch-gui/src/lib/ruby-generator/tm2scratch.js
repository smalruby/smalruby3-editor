/**
 * Define Ruby code generator for TM2Scratch Blocks.
 * @param {object} Generator - The Ruby code generator instance.
 * @returns {object} same as param.
 */
export default function (Generator) {
    // --- Image classification ---

    Generator.tm2scratch_whenReceived = function (block) {
        block.isStatement = true;
        const label =
            Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) ||
            Generator.quote_('any');
        return `tm.when_image_label_received(${label}) do\n`;
    };

    Generator.tm2scratch_isImageLabelDetected = function (block) {
        const label =
            Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) ||
            Generator.quote_('any');
        return [
            `tm.image_label_detected?(${label})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.tm2scratch_imageLabelConfidence = function (block) {
        const label =
            Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) ||
            Generator.quote_('');
        return [
            `tm.image_label_confidence(${label})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.tm2scratch_setImageClassificationModelURL = function (block) {
        const url =
            Generator.valueToCode(block, 'URL', Generator.ORDER_NONE) ||
            Generator.quote_('');
        return `tm.set_image_classification_model_url(${url})\n`;
    };

    Generator.tm2scratch_classifyVideoImageBlock = function () {
        return `tm.classify_video_image\n`;
    };

    Generator.tm2scratch_getImageLabel = function () {
        return ['tm.image_label', Generator.ORDER_FUNCTION_CALL];
    };

    // --- Sound classification ---

    Generator.tm2scratch_whenReceivedSoundLabel = function (block) {
        block.isStatement = true;
        const label =
            Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) ||
            Generator.quote_('any');
        return `tm.when_sound_label_received(${label}) do\n`;
    };

    Generator.tm2scratch_isSoundLabelDetected = function (block) {
        const label =
            Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) ||
            Generator.quote_('any');
        return [
            `tm.sound_label_detected?(${label})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.tm2scratch_soundLabelConfidence = function (block) {
        const label =
            Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) ||
            Generator.quote_('');
        return [
            `tm.sound_label_confidence(${label})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.tm2scratch_setSoundClassificationModelURL = function (block) {
        const url =
            Generator.valueToCode(block, 'URL', Generator.ORDER_NONE) ||
            Generator.quote_('');
        return `tm.set_sound_classification_model_url(${url})\n`;
    };

    Generator.tm2scratch_getSoundLabel = function () {
        return ['tm.sound_label', Generator.ORDER_FUNCTION_CALL];
    };

    // --- Configuration ---

    Generator.tm2scratch_toggleClassification = function (block) {
        const state =
            Generator.valueToCode(
                block,
                'CLASSIFICATION_STATE',
                Generator.ORDER_NONE,
            ) || Generator.quote_('off');
        return `tm.toggle_classification(${state})\n`;
    };

    Generator.tm2scratch_setClassificationInterval = function (block) {
        const interval =
            Generator.valueToCode(
                block,
                'CLASSIFICATION_INTERVAL',
                Generator.ORDER_NONE,
            ) || Generator.quote_('1');
        return `tm.classification_interval = ${interval}\n`;
    };

    Generator.tm2scratch_setConfidenceThreshold = function (block) {
        const threshold =
            Generator.valueToCode(
                block,
                'CONFIDENCE_THRESHOLD',
                Generator.ORDER_NONE,
            ) || '0.5';
        return `tm.confidence_threshold = ${threshold}\n`;
    };

    Generator.tm2scratch_getConfidenceThreshold = function () {
        return ['tm.confidence_threshold', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.tm2scratch_videoToggle = function (block) {
        const state =
            Generator.valueToCode(
                block,
                'VIDEO_STATE',
                Generator.ORDER_NONE,
            ) || Generator.quote_('off');
        return `tm.video_toggle(${state})\n`;
    };

    Generator.tm2scratch_switchCamera = function (block) {
        const device =
            Generator.valueToCode(block, 'DEVICE', Generator.ORDER_NONE) ||
            Generator.quote_('');
        return `tm.switch_camera(${device})\n`;
    };

    // --- Menus ---

    Generator.tm2scratch_menu_received_menu = function (block) {
        const label = Generator.quote_(
            Generator.getFieldValue(block, 'received_menu', 'any'),
        );
        return [label, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_image_labels_menu = function (block) {
        const label = Generator.quote_(
            Generator.getFieldValue(block, 'image_labels_menu', 'any'),
        );
        return [label, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_image_labels_without_any_menu = function (
        block,
    ) {
        const label = Generator.quote_(
            Generator.getFieldValue(
                block,
                'image_labels_without_any_menu',
                '',
            ),
        );
        return [label, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_received_sound_label_menu = function (block) {
        const label = Generator.quote_(
            Generator.getFieldValue(block, 'received_sound_label_menu', 'any'),
        );
        return [label, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_sound_labels_menu = function (block) {
        const label = Generator.quote_(
            Generator.getFieldValue(block, 'sound_labels_menu', 'any'),
        );
        return [label, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_sound_labels_without_any_menu = function (
        block,
    ) {
        const label = Generator.quote_(
            Generator.getFieldValue(
                block,
                'sound_labels_without_any_menu',
                '',
            ),
        );
        return [label, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_video_menu = function (block) {
        const state = Generator.quote_(
            Generator.getFieldValue(block, 'video_menu', 'off'),
        );
        return [state, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_classification_interval_menu = function (block) {
        const interval = Generator.quote_(
            Generator.getFieldValue(
                block,
                'classification_interval_menu',
                '1',
            ),
        );
        return [interval, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_classification_menu = function (block) {
        const state = Generator.quote_(
            Generator.getFieldValue(block, 'classification_menu', 'off'),
        );
        return [state, Generator.ORDER_ATOMIC];
    };

    Generator.tm2scratch_menu_mediadevices = function (block) {
        const device = Generator.quote_(
            Generator.getFieldValue(block, 'mediadevices', ''),
        );
        return [device, Generator.ORDER_ATOMIC];
    };

    return Generator;
}
