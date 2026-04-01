/**
 * TM2Scratch — Teachable Machine extension for Smalruby.
 * Block names and arguments are fully compatible with
 * champierre/tm2scratch (https://github.com/champierre/tm2scratch).
 * Implementation is original, using TensorFlow.js directly.
 * @license AGPL-3.0
 */

const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Cast = require('../../util/cast');
const MathUtil = require('../../util/math-util');
const log = require('../../util/log');
const formatMessage = require('format-message');

const blockIconURI =
    'data:image/png;base64,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';

// ---------------------------------------------------------------------------
// Translations — compatible with champierre/tm2scratch
// ---------------------------------------------------------------------------

const Message = {
    image_classification_model_url: {
        ja: '画像分類モデルURL[URL]',
        'ja-Hira': 'がぞうぶんるいモデル[URL]',
        en: 'image classification model URL [URL]',
    },
    image_classification_sample_model_url: {
        ja: 'https://teachablemachine.withgoogle.com/models/0rX_3hoH/',
        'ja-Hira': 'https://teachablemachine.withgoogle.com/models/0rX_3hoH/',
        en: 'https://teachablemachine.withgoogle.com/models/0rX_3hoH/',
    },
    sound_classification_model_url: {
        ja: '音声分類モデルURL[URL]',
        'ja-Hira': 'おんせいぶんるいモデル[URL]',
        en: 'sound classification model URL [URL]',
    },
    sound_classification_sample_model_url: {
        ja: 'https://teachablemachine.withgoogle.com/models/xP0spGSB/',
        'ja-Hira': 'https://teachablemachine.withgoogle.com/models/xP0spGSB/',
        en: 'https://teachablemachine.withgoogle.com/models/xP0spGSB/',
    },
    classify_image: {
        ja: '画像を分類する',
        'ja-Hira': 'がぞうをぶんるいする',
        en: 'classify image',
    },
    image_label: {
        ja: '画像ラベル',
        'ja-Hira': 'がぞうラベル',
        en: 'image label',
    },
    sound_label: {
        ja: '音声ラベル',
        'ja-Hira': 'おんせいラベル',
        en: 'sound label',
    },
    when_received_block: {
        ja: '画像ラベル[LABEL]を受け取ったとき',
        'ja-Hira': 'がぞうラベル[LABEL]をうけとったとき',
        en: 'when received image label:[LABEL]',
    },
    is_image_label_detected: {
        ja: '[LABEL]の画像が見つかった',
        'ja-Hira': '[LABEL]のがぞうがみつかった',
        en: 'image [LABEL] detected',
    },
    is_sound_label_detected: {
        ja: '[LABEL]の音声が聞こえた',
        'ja-Hira': '[LABEL]のおんせいがきこえた',
        en: 'sound [LABEL] detected',
    },
    image_label_confidence: {
        ja: '画像ラベル[LABEL]の確度',
        'ja-Hira': 'がぞうラベル[LABEL]のかくど',
        en: 'confidence of image [LABEL]',
    },
    sound_label_confidence: {
        ja: '音声ラベル[LABEL]の確度',
        'ja-Hira': 'おんせいラベル[LABEL]のかくど',
        en: 'confidence of sound [LABEL]',
    },
    when_received_sound_label_block: {
        ja: '音声ラベル[LABEL]を受け取ったとき',
        'ja-Hira': 'おんせいラベル[LABEL]をうけとったとき',
        en: 'when received sound label:[LABEL]',
    },
    any: {
        ja: 'のどれか',
        'ja-Hira': 'のどれか',
        en: 'any',
    },
    any_without_of: {
        ja: 'どれか',
        'ja-Hira': 'どれか',
        en: 'any',
    },
    toggle_classification: {
        ja: 'ラベル付けを[CLASSIFICATION_STATE]にする',
        'ja-Hira': 'ラベルづけを[CLASSIFICATION_STATE]にする',
        en: 'turn classification [CLASSIFICATION_STATE]',
    },
    set_confidence_threshold: {
        ja: '確度のしきい値を[CONFIDENCE_THRESHOLD]にする',
        'ja-Hira': 'かくどのしきいちを[CONFIDENCE_THRESHOLD]にする',
        en: 'set confidence threshold [CONFIDENCE_THRESHOLD]',
    },
    get_confidence_threshold: {
        ja: '確度のしきい値',
        'ja-Hira': 'かくどのしきいち',
        en: 'confidence threshold',
    },
    set_classification_interval: {
        ja: 'ラベル付けを[CLASSIFICATION_INTERVAL]秒間に1回行う',
        'ja-Hira': 'ラベルづけを[CLASSIFICATION_INTERVAL]びょうかんに1かいおこなう',
        en: 'Label once every [CLASSIFICATION_INTERVAL] seconds',
    },
    video_toggle: {
        ja: 'ビデオを[VIDEO_STATE]にする',
        'ja-Hira': 'ビデオを[VIDEO_STATE]にする',
        en: 'turn video [VIDEO_STATE]',
    },
    on: {
        ja: '入',
        'ja-Hira': 'いり',
        en: 'on',
    },
    off: {
        ja: '切',
        'ja-Hira': 'きり',
        en: 'off',
    },
    video_on_flipped: {
        ja: '左右反転',
        'ja-Hira': 'さゆうはんてん',
        en: 'on flipped',
    },
    switch_webcam: {
        ja: 'カメラを[DEVICE]に切り替える',
        'ja-Hira': 'カメラを[DEVICE]にきりかえる',
        en: 'switch webcam to [DEVICE]',
    },
};

const AvailableLocales = ['en', 'ja', 'ja-Hira'];

// ---------------------------------------------------------------------------
// TensorFlow.js lazy loaders
// ---------------------------------------------------------------------------

const IMAGE_SIZE = 224;

let _tfPromise = null;
let _speechCommandsPromise = null;

const loadTf = () => {
    if (!_tfPromise) {
        _tfPromise = import(/* webpackChunkName: "tfjs" */ '@tensorflow/tfjs');
    }
    return _tfPromise;
};

const loadSpeechCommands = () => {
    if (!_speechCommandsPromise) {
        _speechCommandsPromise = import(
            /* webpackChunkName: "speech-commands" */ '@tensorflow-models/speech-commands'
        );
    }
    return _speechCommandsPromise;
};

// ---------------------------------------------------------------------------
// Extension class
// ---------------------------------------------------------------------------

class Scratch3TM2ScratchBlocks {
    constructor (runtime) {
        this.runtime = runtime;
        this.locale = this._getLocale();

        // Video element for image classification
        this.video = document.createElement('video');
        this.video.autoplay = true;

        // Classification timing
        this.interval = 1000;
        this._minInterval = 100;

        // Start video capture
        const media = navigator.mediaDevices.getUserMedia({
            video: {width: 360, height: 360},
            audio: false
        });
        media.then(stream => {
            this.video.srcObject = stream;
        });

        // Periodic image classification timer
        this._timer = setInterval(() => {
            this._classifyVideoImage();
        }, this._minInterval);

        // Image classification state
        this._imageModelUrl = null;
        this._imageMetadata = null;
        this._imageClassifier = null;
        this._isImageClassifying = false;
        this._imageProbableLabels = [];

        // Sound classification state
        this._soundModelUrl = null;
        this._soundMetadata = null;
        this._soundClassifier = null;
        this._soundClassifierEnabled = false;
        this._soundProbableLabels = [];

        // Confidence threshold
        this.confidenceThreshold = 0.5;

        // Enable video I/O on the stage
        this.runtime.ioDevices.video.enableVideo();

        // Camera device list
        this._devices = [{text: 'default', value: ''}];
        try {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                for (const device of devices) {
                    if (device.kind === 'videoinput') {
                        this._devices.push({
                            text: device.label,
                            value: device.deviceId
                        });
                    }
                }
            });
        } catch (e) {
            log.warn('Failed to enumerate media devices', e);
        }
    }

    // -----------------------------------------------------------------------
    // Block definitions
    // -----------------------------------------------------------------------

    getInfo () {
        this.locale = this._getLocale();

        return {
            id: 'tm2scratch',
            name: 'TM2Scratch',
            blockIconURI: blockIconURI,
            blocks: [
                // --- Image classification ---
                {
                    opcode: 'whenReceived',
                    text: Message.when_received_block[this.locale],
                    blockType: BlockType.HAT,
                    arguments: {
                        LABEL: {
                            type: ArgumentType.STRING,
                            menu: 'received_menu',
                            defaultValue: Message.any[this.locale]
                        }
                    }
                },
                {
                    opcode: 'isImageLabelDetected',
                    text: Message.is_image_label_detected[this.locale],
                    blockType: BlockType.BOOLEAN,
                    arguments: {
                        LABEL: {
                            type: ArgumentType.STRING,
                            menu: 'image_labels_menu',
                            defaultValue: Message.any_without_of[this.locale]
                        }
                    }
                },
                {
                    opcode: 'imageLabelConfidence',
                    text: Message.image_label_confidence[this.locale],
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    arguments: {
                        LABEL: {
                            type: ArgumentType.STRING,
                            menu: 'image_labels_without_any_menu',
                            defaultValue: ''
                        }
                    }
                },
                {
                    opcode: 'setImageClassificationModelURL',
                    text: Message.image_classification_model_url[this.locale],
                    blockType: BlockType.COMMAND,
                    arguments: {
                        URL: {
                            type: ArgumentType.STRING,
                            defaultValue: Message.image_classification_sample_model_url[this.locale]
                        }
                    }
                },
                {
                    opcode: 'classifyVideoImageBlock',
                    text: Message.classify_image[this.locale],
                    blockType: BlockType.COMMAND
                },
                {
                    opcode: 'getImageLabel',
                    text: Message.image_label[this.locale],
                    blockType: BlockType.REPORTER
                },
                '---',
                // --- Sound classification ---
                {
                    opcode: 'whenReceivedSoundLabel',
                    text: Message.when_received_sound_label_block[this.locale],
                    blockType: BlockType.HAT,
                    arguments: {
                        LABEL: {
                            type: ArgumentType.STRING,
                            menu: 'received_sound_label_menu',
                            defaultValue: Message.any[this.locale]
                        }
                    }
                },
                {
                    opcode: 'isSoundLabelDetected',
                    text: Message.is_sound_label_detected[this.locale],
                    blockType: BlockType.BOOLEAN,
                    arguments: {
                        LABEL: {
                            type: ArgumentType.STRING,
                            menu: 'sound_labels_menu',
                            defaultValue: Message.any_without_of[this.locale]
                        }
                    }
                },
                {
                    opcode: 'soundLabelConfidence',
                    text: Message.sound_label_confidence[this.locale],
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    arguments: {
                        LABEL: {
                            type: ArgumentType.STRING,
                            menu: 'sound_labels_without_any_menu',
                            defaultValue: ''
                        }
                    }
                },
                {
                    opcode: 'setSoundClassificationModelURL',
                    text: Message.sound_classification_model_url[this.locale],
                    blockType: BlockType.COMMAND,
                    arguments: {
                        URL: {
                            type: ArgumentType.STRING,
                            defaultValue: Message.sound_classification_sample_model_url[this.locale]
                        }
                    }
                },
                {
                    opcode: 'getSoundLabel',
                    text: Message.sound_label[this.locale],
                    blockType: BlockType.REPORTER
                },
                '---',
                // --- Configuration ---
                {
                    opcode: 'toggleClassification',
                    text: Message.toggle_classification[this.locale],
                    blockType: BlockType.COMMAND,
                    arguments: {
                        CLASSIFICATION_STATE: {
                            type: ArgumentType.STRING,
                            menu: 'classification_menu',
                            defaultValue: 'off'
                        }
                    }
                },
                {
                    opcode: 'setClassificationInterval',
                    text: Message.set_classification_interval[this.locale],
                    blockType: BlockType.COMMAND,
                    arguments: {
                        CLASSIFICATION_INTERVAL: {
                            type: ArgumentType.STRING,
                            menu: 'classification_interval_menu',
                            defaultValue: '1'
                        }
                    }
                },
                {
                    opcode: 'setConfidenceThreshold',
                    text: Message.set_confidence_threshold[this.locale],
                    blockType: BlockType.COMMAND,
                    arguments: {
                        CONFIDENCE_THRESHOLD: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0.5
                        }
                    }
                },
                {
                    opcode: 'getConfidenceThreshold',
                    text: Message.get_confidence_threshold[this.locale],
                    blockType: BlockType.REPORTER,
                    disableMonitor: true
                },
                {
                    opcode: 'videoToggle',
                    text: Message.video_toggle[this.locale],
                    blockType: BlockType.COMMAND,
                    arguments: {
                        VIDEO_STATE: {
                            type: ArgumentType.STRING,
                            menu: 'video_menu',
                            defaultValue: 'off'
                        }
                    }
                },
                {
                    opcode: 'switchCamera',
                    blockType: BlockType.COMMAND,
                    text: Message.switch_webcam[this.locale],
                    arguments: {
                        DEVICE: {
                            type: ArgumentType.STRING,
                            defaultValue: '',
                            menu: 'mediadevices'
                        }
                    }
                }
            ],
            menus: {
                received_menu: {
                    acceptReporters: true,
                    items: 'getLabelsMenu'
                },
                image_labels_menu: {
                    acceptReporters: true,
                    items: 'getLabelsWithAnyWithoutOfMenu'
                },
                image_labels_without_any_menu: {
                    acceptReporters: true,
                    items: 'getLabelsWithoutAnyMenu'
                },
                received_sound_label_menu: {
                    acceptReporters: true,
                    items: 'getSoundLabelsWithoutBackgroundMenu'
                },
                sound_labels_menu: {
                    acceptReporters: true,
                    items: 'getSoundLabelsWithoutBackgroundWithAnyWithoutOfMenu'
                },
                sound_labels_without_any_menu: {
                    acceptReporters: true,
                    items: 'getSoundLabelsWithoutAnyMenu'
                },
                video_menu: this._getVideoMenu(),
                classification_interval_menu: this._getClassificationIntervalMenu(),
                classification_menu: this._getClassificationMenu(),
                mediadevices: {
                    acceptReporters: true,
                    items: 'getDevices'
                }
            }
        };
    }

    // -----------------------------------------------------------------------
    // Block handlers — Image
    // -----------------------------------------------------------------------

    whenReceived (args) {
        const label = this.getImageLabel();
        if (args.LABEL === Message.any[this.locale]) {
            return label !== '';
        }
        return label === args.LABEL;
    }

    isImageLabelDetected (args) {
        const label = this.getImageLabel();
        if (args.LABEL === Message.any_without_of[this.locale]) {
            return label !== '';
        }
        return label === args.LABEL;
    }

    imageLabelConfidence (args) {
        if (args.LABEL === '') return 0;
        const entry = this._imageProbableLabels.find(e => e.label === args.LABEL);
        return entry ? entry.confidence : 0;
    }

    setImageClassificationModelURL (args) {
        return this._loadImageModel(args.URL);
    }

    classifyVideoImageBlock (_args, util) {
        if (this._isImageClassifying) {
            if (util) util.yield();
            return;
        }
        return this._classifyImage(this.video)
            .then(result => JSON.stringify(result));
    }

    getImageLabel () {
        if (this._imageProbableLabels.length === 0) return '';
        const best = this._getMostProbable(this._imageProbableLabels);
        return best.confidence >= this.confidenceThreshold ? best.label : '';
    }

    // -----------------------------------------------------------------------
    // Block handlers — Sound
    // -----------------------------------------------------------------------

    whenReceivedSoundLabel (args) {
        if (!this._soundClassifierEnabled) return false;
        const label = this.getSoundLabel();
        if (args.LABEL === Message.any[this.locale]) {
            return label !== '';
        }
        return label === args.LABEL;
    }

    isSoundLabelDetected (args) {
        const label = this.getSoundLabel();
        if (args.LABEL === Message.any_without_of[this.locale]) {
            return label !== '';
        }
        return label === args.LABEL;
    }

    soundLabelConfidence (args) {
        if (this._soundProbableLabels.length === 0) return 0;
        if (args.LABEL === '') return 0;
        const entry = this._soundProbableLabels.find(e => e.label === args.LABEL);
        return entry ? entry.confidence : 0;
    }

    setSoundClassificationModelURL (args) {
        return this._loadSoundModel(args.URL);
    }

    getSoundLabel () {
        if (this._soundProbableLabels.length === 0) return '';
        const best = this._getMostProbable(this._soundProbableLabels);
        return best.confidence >= this.confidenceThreshold ? best.label : '';
    }

    // -----------------------------------------------------------------------
    // Block handlers — Configuration
    // -----------------------------------------------------------------------

    toggleClassification (args) {
        const state = args.CLASSIFICATION_STATE;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        this._soundClassifierEnabled = false;
        if (state === 'on') {
            this._timer = setInterval(() => {
                this._classifyVideoImage();
            }, this._minInterval);
            this._soundClassifierEnabled = true;
        }
    }

    setClassificationInterval (args) {
        if (this._timer) {
            clearInterval(this._timer);
        }
        this.interval = args.CLASSIFICATION_INTERVAL * 1000;
        this._timer = setInterval(() => {
            this._classifyVideoImage();
        }, this._minInterval);
    }

    setConfidenceThreshold (args) {
        let threshold = Cast.toNumber(args.CONFIDENCE_THRESHOLD);
        threshold = MathUtil.clamp(threshold, 0, 1);
        this.confidenceThreshold = threshold;
    }

    getConfidenceThreshold () {
        return this.confidenceThreshold;
    }

    videoToggle (args) {
        const state = args.VIDEO_STATE;
        if (state === 'off') {
            this.runtime.ioDevices.video.disableVideo();
        } else {
            this.runtime.ioDevices.video.enableVideo();
            this.runtime.ioDevices.video.mirror = state === 'on';
        }
    }

    switchCamera (args) {
        if (args.DEVICE === '') return;
        const provider = this.runtime.ioDevices.video.provider;
        if (!provider || !provider._track) return;

        provider._track.stop();
        const deviceId = args.DEVICE;
        navigator.mediaDevices
            .getUserMedia({audio: false, video: {deviceId}})
            .then(stream => {
                try {
                    provider._video.srcObject = stream;
                } catch (_e) {
                    provider._video.src = window.URL.createObjectURL(stream);
                }
                provider._video.play();
                provider._track = stream.getTracks()[0];
            });
    }

    // -----------------------------------------------------------------------
    // Dynamic menus
    // -----------------------------------------------------------------------

    getLabelsMenu () {
        const items = [Message.any[this.locale]];
        if (this._imageMetadata) {
            return items.concat(this._imageMetadata.labels);
        }
        return items;
    }

    getLabelsWithAnyWithoutOfMenu () {
        const items = [Message.any_without_of[this.locale]];
        if (this._imageMetadata) {
            return items.concat(this._imageMetadata.labels);
        }
        return items;
    }

    getLabelsWithoutAnyMenu () {
        if (this._imageMetadata) {
            return [''].concat(this._imageMetadata.labels);
        }
        return [''];
    }

    getSoundLabelsWithoutBackgroundMenu () {
        const items = [Message.any[this.locale]];
        if (!this._soundMetadata) return items;
        return items.concat(
            this._soundMetadata.wordLabels.filter(l => l !== '_background_noise_')
        );
    }

    getSoundLabelsWithoutBackgroundWithAnyWithoutOfMenu () {
        const items = [Message.any_without_of[this.locale]];
        if (!this._soundMetadata) return items;
        return items.concat(
            this._soundMetadata.wordLabels.filter(l => l !== '_background_noise_')
        );
    }

    getSoundLabelsWithoutAnyMenu () {
        if (this._soundMetadata) {
            return this._soundMetadata.wordLabels;
        }
        return [''];
    }

    getDevices () {
        return this._devices;
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    _getLocale () {
        const locale = formatMessage.setup().locale;
        if (AvailableLocales.includes(locale)) return locale;
        return 'en';
    }

    _getMostProbable (probabilities) {
        let best = probabilities[0];
        for (let i = 1; i < probabilities.length; i++) {
            if (probabilities[i].confidence > best.confidence) {
                best = probabilities[i];
            }
        }
        return best;
    }

    _getVideoMenu () {
        return [
            {text: Message.off[this.locale], value: 'off'},
            {text: Message.on[this.locale], value: 'on'},
            {text: Message.video_on_flipped[this.locale], value: 'on-flipped'}
        ];
    }

    _getClassificationIntervalMenu () {
        return {
            acceptReporters: true,
            items: [
                {text: '1', value: '1'},
                {text: '0.5', value: '0.5'},
                {text: '0.2', value: '0.2'},
                {text: '0.1', value: '0.1'}
            ]
        };
    }

    _getClassificationMenu () {
        return [
            {text: Message.off[this.locale], value: 'off'},
            {text: Message.on[this.locale], value: 'on'}
        ];
    }

    // -----------------------------------------------------------------------
    // Model loading & classification
    // -----------------------------------------------------------------------

    async _loadImageModel (url) {
        try {
            const tf = await loadTf();
            await tf.ready();

            const timestamp = Date.now();
            const res = await fetch(`${url}metadata.json?${timestamp}`);
            const metadata = await res.json();

            // Skip if same model is already loaded
            if (
                url === this._imageModelUrl &&
                this._imageMetadata &&
                new Date(metadata.timeStamp).getTime() ===
                    new Date(this._imageMetadata.timeStamp).getTime()
            ) {
                log.info(`Image model already loaded: ${url}`);
                return;
            }

            const model = await tf.loadLayersModel(`${url}model.json?${timestamp}`);

            this._imageModelUrl = url;
            this._imageMetadata = metadata;
            this._imageClassifier = model;
            this._imageProbableLabels = [];
            log.info(`Image model loaded from: ${url}`);
        } catch (error) {
            log.warn('Failed to load image classification model', error);
        }
    }

    async _loadSoundModel (url) {
        try {
            const speechCommands = await loadSpeechCommands();
            const timestamp = Date.now();
            const res = await fetch(`${url}metadata.json?${timestamp}`);
            const metadata = await res.json();

            // Skip if same model is already loaded
            if (
                url === this._soundModelUrl &&
                this._soundMetadata &&
                new Date(metadata.timeStamp).getTime() ===
                    new Date(this._soundMetadata.timeStamp).getTime()
            ) {
                log.info(`Sound model already loaded: ${url}`);
                return;
            }

            const recognizer = speechCommands.create(
                'BROWSER_FFT',
                undefined,
                `${url}model.json`,
                `${url}metadata.json`
            );
            await recognizer.ensureModelLoaded();

            this._soundModelUrl = url;
            this._soundMetadata = metadata;
            this._soundClassifier = recognizer;
            this._soundProbableLabels = [];
            this._soundClassifierEnabled = true;
            this._startSoundClassification();
            log.info(`Sound model loaded from: ${url}`);
        } catch (error) {
            log.warn('Failed to load sound classification model', error);
        }
    }

    _classifyVideoImage () {
        if (this._isImageClassifying) return;
        this._classifyImage(this.video);
    }

    async _classifyImage (input) {
        if (!this._imageMetadata || !this._imageClassifier) {
            this._isImageClassifying = false;
            return [];
        }
        this._isImageClassifying = true;
        try {
            const tf = await loadTf();
            // Convert input to tensor and resize for Teachable Machine (224x224)
            const tensor = tf.tidy(() => {
                const img = tf.browser.fromPixels(input);
                const resized = tf.image.resizeBilinear(img, [IMAGE_SIZE, IMAGE_SIZE]);
                const normalized = resized.toFloat().div(tf.scalar(127)).sub(tf.scalar(1));
                return normalized.expandDims(0);
            });

            const predictions = this._imageClassifier.predict(tensor);
            const data = await predictions.as1D().data();
            tensor.dispose();
            predictions.dispose();

            const labels = this._imageMetadata.labels || [];
            const result = Array.from(data).map((confidence, index) => ({
                label: labels[index] || String(index),
                confidence
            }));

            this._imageProbableLabels = result;
            return result;
        } catch (error) {
            log.warn('Image classification failed', error);
            return [];
        } finally {
            setTimeout(() => {
                this._imageProbableLabels = [];
                this._isImageClassifying = false;
            }, this.interval);
        }
    }

    _startSoundClassification () {
        if (!this._soundClassifier) return;
        const wordLabels = this._soundClassifier.wordLabels();
        this._soundClassifier.listen(result => {
            if (!this._soundClassifierEnabled || !result || !result.scores) return;
            const scores = Array.from(result.scores);
            this._soundProbableLabels = scores.map((confidence, index) => ({
                label: wordLabels[index],
                confidence
            }));
            setTimeout(() => {
                this._soundProbableLabels = [];
            }, this.interval);
        }, {probabilityThreshold: 0.0});
    }
}

module.exports = Scratch3TM2ScratchBlocks;
