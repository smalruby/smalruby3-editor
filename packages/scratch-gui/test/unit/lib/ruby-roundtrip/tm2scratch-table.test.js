/**
 * TM2Scratch (Teachable Machine) blocks ⇔ Ruby, as a table (block notation:
 * test/unit/helpers/block-notation.js). It fixes the output of the converter before the calls of
 * `tm` move into a send table (issue #2090).
 *
 * The menus take any string as it is. The hats take only a string; the others take a block too.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const menu = (name, value) => `tm2scratch_menu_${name}(${name} = "${value}")`;

const rows = [
    {
        blocks: `
            tm2scratch_whenReceived(LABEL: ${menu('received_menu', 'cat')})
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            tm.when_image_label_received("cat") do
              move(10)
            end
        `,
    },
    {
        blocks: `looks_say(MESSAGE: tm2scratch_isImageLabelDetected(LABEL: ${menu('image_labels_menu', 'any')}))`,
        ruby: 'say(tm.image_label_detected?("any"))',
    },
    {
        blocks: `looks_say(MESSAGE: tm2scratch_isImageLabelDetected(LABEL: $l))`,
        ruby: 'say(tm.image_label_detected?($l))',
    },
    {
        blocks: `looks_say(MESSAGE: tm2scratch_imageLabelConfidence(LABEL: ${menu('image_labels_without_any_menu', 'dog')}))`,
        ruby: 'say(tm.image_label_confidence("dog"))',
    },
    {
        blocks: 'tm2scratch_setImageClassificationModelURL(URL: "https://example.com/m/")',
        ruby: 'tm.set_image_classification_model_url("https://example.com/m/")',
    },
    {
        blocks: 'tm2scratch_setImageClassificationModelURL(URL: $u)',
        ruby: 'tm.set_image_classification_model_url($u)',
    },
    { blocks: 'tm2scratch_classifyVideoImageBlock', ruby: 'tm.classify_video_image' },
    { blocks: 'looks_say(MESSAGE: tm2scratch_getImageLabel)', ruby: 'say(tm.image_label)' },
    {
        blocks: `tm2scratch_whenReceivedSoundLabel(LABEL: ${menu('received_sound_label_menu', 'clap')})`,
        ruby: 'tm.when_sound_label_received("clap") do\nend',
    },
    {
        blocks: `looks_say(MESSAGE: tm2scratch_isSoundLabelDetected(LABEL: ${menu('sound_labels_menu', 'any')}))`,
        ruby: 'say(tm.sound_label_detected?("any"))',
    },
    {
        blocks: `looks_say(MESSAGE: tm2scratch_soundLabelConfidence(LABEL: ${menu('sound_labels_without_any_menu', 'clap')}))`,
        ruby: 'say(tm.sound_label_confidence("clap"))',
    },
    {
        blocks: 'tm2scratch_setSoundClassificationModelURL(URL: "https://example.com/s/")',
        ruby: 'tm.set_sound_classification_model_url("https://example.com/s/")',
    },
    { blocks: 'looks_say(MESSAGE: tm2scratch_getSoundLabel)', ruby: 'say(tm.sound_label)' },
    {
        blocks: `tm2scratch_toggleClassification(CLASSIFICATION_STATE: ${menu('classification_menu', 'on')})`,
        ruby: 'tm.toggle_classification("on")',
    },
    {
        blocks: `tm2scratch_setClassificationInterval(CLASSIFICATION_INTERVAL: ${menu('classification_interval_menu', '0.5')})`,
        ruby: 'tm.classification_interval = "0.5"',
    },
    { blocks: 'tm2scratch_setConfidenceThreshold(CONFIDENCE_THRESHOLD: 0.5)', ruby: 'tm.confidence_threshold = 0.5' },
    { blocks: 'tm2scratch_setConfidenceThreshold(CONFIDENCE_THRESHOLD: $c)', ruby: 'tm.confidence_threshold = $c' },
    { blocks: 'looks_say(MESSAGE: tm2scratch_getConfidenceThreshold)', ruby: 'say(tm.confidence_threshold)' },
    {
        blocks: `tm2scratch_videoToggle(VIDEO_STATE: ${menu('video_menu', 'on-flipped')})`,
        ruby: 'tm.video_toggle("on-flipped")',
    },
    { blocks: 'tm2scratch_videoToggle(VIDEO_STATE: $v)', ruby: 'tm.video_toggle($v)' },
    {
        blocks: `tm2scratch_switchCamera(DEVICE: ${menu('mediadevices', 'cam-1')})`,
        ruby: 'tm.switch_camera("cam-1")',
    },
];

defineBlockRubyTable('TM2Scratch blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'TM2Scratch blocks ⇔ Ruby (stage)',
    [{ blocks: 'tm2scratch_classifyVideoImageBlock', ruby: 'tm.classify_video_image' }],
    { stage: true },
);
