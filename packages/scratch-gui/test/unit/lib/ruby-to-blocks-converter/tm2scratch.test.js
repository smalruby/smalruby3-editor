import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo,
} from '../../../helpers/expect-to-equal-blocks';

const makeMenuInput = (inputName, menuOpcode, fieldName, value) => ({
    name: inputName,
    block: {
        opcode: menuOpcode,
        fields: [{ name: fieldName, value }],
        shadow: true,
    },
});

describe('RubyToBlocksConverter/TM2Scratch', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, { version: '2' });
        target = null;
    });

    // --- Image classification ---

    test('tm.when_image_label_received("cat") do; end', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.when_image_label_received("cat") do; end',
            [
                {
                    opcode: 'tm2scratch_whenReceived',
                    inputs: [
                        makeMenuInput(
                            'LABEL',
                            'tm2scratch_menu_received_menu',
                            'received_menu',
                            'cat',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.image_label_detected?("dog")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.image_label_detected?("dog")',
            [
                {
                    opcode: 'tm2scratch_isImageLabelDetected',
                    inputs: [
                        makeMenuInput(
                            'LABEL',
                            'tm2scratch_menu_image_labels_menu',
                            'image_labels_menu',
                            'dog',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.image_label_confidence("cat")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.image_label_confidence("cat")',
            [
                {
                    opcode: 'tm2scratch_imageLabelConfidence',
                    inputs: [
                        makeMenuInput(
                            'LABEL',
                            'tm2scratch_menu_image_labels_without_any_menu',
                            'image_labels_without_any_menu',
                            'cat',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.set_image_classification_model_url("https://example.com/")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.set_image_classification_model_url("https://example.com/")',
            [
                {
                    opcode: 'tm2scratch_setImageClassificationModelURL',
                    inputs: [
                        {
                            name: 'URL',
                            block: expectedInfo.makeText(
                                'https://example.com/',
                            ),
                        },
                    ],
                },
            ],
        );
    });

    test('tm.classify_video_image', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.classify_video_image',
            [{ opcode: 'tm2scratch_classifyVideoImageBlock' }],
        );
    });

    test('tm.image_label', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.image_label',
            [{ opcode: 'tm2scratch_getImageLabel' }],
        );
    });

    // --- Sound classification ---

    test('tm.when_sound_label_received("clap") do; end', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.when_sound_label_received("clap") do; end',
            [
                {
                    opcode: 'tm2scratch_whenReceivedSoundLabel',
                    inputs: [
                        makeMenuInput(
                            'LABEL',
                            'tm2scratch_menu_received_sound_label_menu',
                            'received_sound_label_menu',
                            'clap',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.sound_label_detected?("whistle")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.sound_label_detected?("whistle")',
            [
                {
                    opcode: 'tm2scratch_isSoundLabelDetected',
                    inputs: [
                        makeMenuInput(
                            'LABEL',
                            'tm2scratch_menu_sound_labels_menu',
                            'sound_labels_menu',
                            'whistle',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.sound_label_confidence("snap")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.sound_label_confidence("snap")',
            [
                {
                    opcode: 'tm2scratch_soundLabelConfidence',
                    inputs: [
                        makeMenuInput(
                            'LABEL',
                            'tm2scratch_menu_sound_labels_without_any_menu',
                            'sound_labels_without_any_menu',
                            'snap',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.set_sound_classification_model_url("https://example.com/")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.set_sound_classification_model_url("https://example.com/")',
            [
                {
                    opcode: 'tm2scratch_setSoundClassificationModelURL',
                    inputs: [
                        {
                            name: 'URL',
                            block: expectedInfo.makeText(
                                'https://example.com/',
                            ),
                        },
                    ],
                },
            ],
        );
    });

    test('tm.sound_label', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.sound_label',
            [{ opcode: 'tm2scratch_getSoundLabel' }],
        );
    });

    // --- Configuration ---

    test('tm.toggle_classification("on")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.toggle_classification("on")',
            [
                {
                    opcode: 'tm2scratch_toggleClassification',
                    inputs: [
                        makeMenuInput(
                            'CLASSIFICATION_STATE',
                            'tm2scratch_menu_classification_menu',
                            'classification_menu',
                            'on',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.classification_interval = "0.5"', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.classification_interval = "0.5"',
            [
                {
                    opcode: 'tm2scratch_setClassificationInterval',
                    inputs: [
                        makeMenuInput(
                            'CLASSIFICATION_INTERVAL',
                            'tm2scratch_menu_classification_interval_menu',
                            'classification_interval_menu',
                            '0.5',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.confidence_threshold = 0.8', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.confidence_threshold = 0.8',
            [
                {
                    opcode: 'tm2scratch_setConfidenceThreshold',
                    inputs: [
                        {
                            name: 'CONFIDENCE_THRESHOLD',
                            block: expectedInfo.makeNumber(0.8),
                        },
                    ],
                },
            ],
        );
    });

    test('tm.confidence_threshold (getter)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.confidence_threshold',
            [{ opcode: 'tm2scratch_getConfidenceThreshold' }],
        );
    });

    test('tm.video_toggle("on")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.video_toggle("on")',
            [
                {
                    opcode: 'tm2scratch_videoToggle',
                    inputs: [
                        makeMenuInput(
                            'VIDEO_STATE',
                            'tm2scratch_menu_video_menu',
                            'video_menu',
                            'on',
                        ),
                    ],
                },
            ],
        );
    });

    test('tm.switch_camera("abc123")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'tm.switch_camera("abc123")',
            [
                {
                    opcode: 'tm2scratch_switchCamera',
                    inputs: [
                        makeMenuInput(
                            'DEVICE',
                            'tm2scratch_menu_mediadevices',
                            'mediadevices',
                            'abc123',
                        ),
                    ],
                },
            ],
        );
    });
});
