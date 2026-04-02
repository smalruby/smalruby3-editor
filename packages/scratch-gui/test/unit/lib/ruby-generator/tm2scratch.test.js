import RubyGenerator from '../../../../src/lib/ruby-generator';
import TM2ScratchBlocks from '../../../../src/lib/ruby-generator/tm2scratch';

describe('RubyGenerator/TM2Scratch', () => {
    const makeBlock = (id) => ({
        id,
        opcode: 'dummy',
        inputs: {},
        fields: {},
    });

    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        TM2ScratchBlocks(RubyGenerator);
    });

    // --- Image classification ---

    test('whenReceived', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"cat"');
        const block = makeBlock('b1');
        const result = RubyGenerator.tm2scratch_whenReceived(block);
        expect(result).toEqual('tm.when_image_label_received("cat") do\n');
        expect(block.isStatement).toBe(true);
    });

    test('isImageLabelDetected', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"dog"');
        const [code, order] =
            RubyGenerator.tm2scratch_isImageLabelDetected(makeBlock('b1'));
        expect(code).toEqual('tm.image_label_detected?("dog")');
        expect(order).toEqual(RubyGenerator.ORDER_FUNCTION_CALL);
    });

    test('imageLabelConfidence', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"cat"');
        const [code] =
            RubyGenerator.tm2scratch_imageLabelConfidence(makeBlock('b1'));
        expect(code).toEqual('tm.image_label_confidence("cat")');
    });

    test('setImageClassificationModelURL', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValue(
                '"https://teachablemachine.withgoogle.com/models/abc/"',
            );
        expect(
            RubyGenerator.tm2scratch_setImageClassificationModelURL(
                makeBlock('b1'),
            ),
        ).toEqual(
            'tm.set_image_classification_model_url("https://teachablemachine.withgoogle.com/models/abc/")\n',
        );
    });

    test('classifyVideoImageBlock', () => {
        expect(RubyGenerator.tm2scratch_classifyVideoImageBlock()).toEqual(
            'tm.classify_video_image\n',
        );
    });

    test('getImageLabel', () => {
        const [code, order] = RubyGenerator.tm2scratch_getImageLabel();
        expect(code).toEqual('tm.image_label');
        expect(order).toEqual(RubyGenerator.ORDER_FUNCTION_CALL);
    });

    // --- Sound classification ---

    test('whenReceivedSoundLabel', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"clap"');
        const block = makeBlock('b1');
        const result =
            RubyGenerator.tm2scratch_whenReceivedSoundLabel(block);
        expect(result).toEqual(
            'tm.when_sound_label_received("clap") do\n',
        );
        expect(block.isStatement).toBe(true);
    });

    test('isSoundLabelDetected', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"whistle"');
        const [code] =
            RubyGenerator.tm2scratch_isSoundLabelDetected(makeBlock('b1'));
        expect(code).toEqual('tm.sound_label_detected?("whistle")');
    });

    test('soundLabelConfidence', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"snap"');
        const [code] =
            RubyGenerator.tm2scratch_soundLabelConfidence(makeBlock('b1'));
        expect(code).toEqual('tm.sound_label_confidence("snap")');
    });

    test('setSoundClassificationModelURL', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValue(
                '"https://teachablemachine.withgoogle.com/models/xyz/"',
            );
        expect(
            RubyGenerator.tm2scratch_setSoundClassificationModelURL(
                makeBlock('b1'),
            ),
        ).toEqual(
            'tm.set_sound_classification_model_url("https://teachablemachine.withgoogle.com/models/xyz/")\n',
        );
    });

    test('getSoundLabel', () => {
        const [code] = RubyGenerator.tm2scratch_getSoundLabel();
        expect(code).toEqual('tm.sound_label');
    });

    // --- Configuration ---

    test('toggleClassification', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"on"');
        expect(
            RubyGenerator.tm2scratch_toggleClassification(makeBlock('b1')),
        ).toEqual('tm.toggle_classification("on")\n');
    });

    test('setClassificationInterval', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"0.5"');
        expect(
            RubyGenerator.tm2scratch_setClassificationInterval(
                makeBlock('b1'),
            ),
        ).toEqual('tm.classification_interval = "0.5"\n');
    });

    test('setConfidenceThreshold', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('0.8');
        expect(
            RubyGenerator.tm2scratch_setConfidenceThreshold(makeBlock('b1')),
        ).toEqual('tm.confidence_threshold = 0.8\n');
    });

    test('getConfidenceThreshold', () => {
        const [code] = RubyGenerator.tm2scratch_getConfidenceThreshold();
        expect(code).toEqual('tm.confidence_threshold');
    });

    test('videoToggle', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"on"');
        expect(
            RubyGenerator.tm2scratch_videoToggle(makeBlock('b1')),
        ).toEqual('tm.video_toggle("on")\n');
    });

    test('switchCamera', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"abc123"');
        expect(
            RubyGenerator.tm2scratch_switchCamera(makeBlock('b1')),
        ).toEqual('tm.switch_camera("abc123")\n');
    });

    // --- Menus ---

    test('menu_received_menu', () => {
        const block = {
            fields: { received_menu: { value: 'any' } },
        };
        const [code, order] =
            RubyGenerator.tm2scratch_menu_received_menu(block);
        expect(code).toEqual('"any"');
        expect(order).toEqual(RubyGenerator.ORDER_ATOMIC);
    });

    test('menu_video_menu', () => {
        const block = {
            fields: { video_menu: { value: 'on-flipped' } },
        };
        const [code] = RubyGenerator.tm2scratch_menu_video_menu(block);
        expect(code).toEqual('"on-flipped"');
    });

    test('menu_classification_menu', () => {
        const block = {
            fields: { classification_menu: { value: 'off' } },
        };
        const [code] =
            RubyGenerator.tm2scratch_menu_classification_menu(block);
        expect(code).toEqual('"off"');
    });
});
