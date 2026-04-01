const TM = 'tm';

const TM2ScratchConverter = {
    register: function (converter) {
        // Register receiver: tm
        converter.registerOnSend('self', TM, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(TM, node);
        });

        // --- Image classification ---

        // tm.when_image_label_received("label") do ... end
        converter.registerOnSendWithBlock(
            TM,
            'when_image_label_received',
            1,
            0,
            (params) => {
                const { receiver, args, rubyBlock } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_whenReceived',
                    'hat',
                );
                converter.addFieldInput(
                    block,
                    'LABEL',
                    'tm2scratch_menu_received_menu',
                    'received_menu',
                    args[0],
                    'any',
                );
                converter.setParent(rubyBlock, block);
                return block;
            },
        );

        // tm.image_label_detected?("label")
        converter.registerOnSend(
            TM,
            'image_label_detected?',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_isImageLabelDetected',
                    'value_boolean',
                );
                converter.addFieldInput(
                    block,
                    'LABEL',
                    'tm2scratch_menu_image_labels_menu',
                    'image_labels_menu',
                    args[0],
                    'any',
                );
                return block;
            },
        );

        // tm.image_label_confidence("label")
        converter.registerOnSend(
            TM,
            'image_label_confidence',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_imageLabelConfidence',
                    'value',
                );
                converter.addFieldInput(
                    block,
                    'LABEL',
                    'tm2scratch_menu_image_labels_without_any_menu',
                    'image_labels_without_any_menu',
                    args[0],
                    '',
                );
                return block;
            },
        );

        // tm.set_image_classification_model_url("url")
        converter.registerOnSend(
            TM,
            'set_image_classification_model_url',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_setImageClassificationModelURL',
                    'statement',
                );
                converter.addTextInput(
                    block,
                    'URL',
                    args[0],
                    'https://teachablemachine.withgoogle.com/models/0rX_3hoH/',
                );
                return block;
            },
        );

        // tm.classify_video_image
        converter.registerOnSend(
            TM,
            'classify_video_image',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_classifyVideoImageBlock',
                    'statement',
                );
            },
        );

        // tm.image_label
        converter.registerOnSend(TM, 'image_label', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'tm2scratch_getImageLabel',
                'value',
            );
        });

        // --- Sound classification ---

        // tm.when_sound_label_received("label") do ... end
        converter.registerOnSendWithBlock(
            TM,
            'when_sound_label_received',
            1,
            0,
            (params) => {
                const { receiver, args, rubyBlock } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_whenReceivedSoundLabel',
                    'hat',
                );
                converter.addFieldInput(
                    block,
                    'LABEL',
                    'tm2scratch_menu_received_sound_label_menu',
                    'received_sound_label_menu',
                    args[0],
                    'any',
                );
                converter.setParent(rubyBlock, block);
                return block;
            },
        );

        // tm.sound_label_detected?("label")
        converter.registerOnSend(
            TM,
            'sound_label_detected?',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_isSoundLabelDetected',
                    'value_boolean',
                );
                converter.addFieldInput(
                    block,
                    'LABEL',
                    'tm2scratch_menu_sound_labels_menu',
                    'sound_labels_menu',
                    args[0],
                    'any',
                );
                return block;
            },
        );

        // tm.sound_label_confidence("label")
        converter.registerOnSend(
            TM,
            'sound_label_confidence',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_soundLabelConfidence',
                    'value',
                );
                converter.addFieldInput(
                    block,
                    'LABEL',
                    'tm2scratch_menu_sound_labels_without_any_menu',
                    'sound_labels_without_any_menu',
                    args[0],
                    '',
                );
                return block;
            },
        );

        // tm.set_sound_classification_model_url("url")
        converter.registerOnSend(
            TM,
            'set_sound_classification_model_url',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_setSoundClassificationModelURL',
                    'statement',
                );
                converter.addTextInput(
                    block,
                    'URL',
                    args[0],
                    'https://teachablemachine.withgoogle.com/models/xP0spGSB/',
                );
                return block;
            },
        );

        // tm.sound_label
        converter.registerOnSend(TM, 'sound_label', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'tm2scratch_getSoundLabel',
                'value',
            );
        });

        // --- Configuration ---

        // tm.toggle_classification("on")
        converter.registerOnSend(
            TM,
            'toggle_classification',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_toggleClassification',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CLASSIFICATION_STATE',
                    'tm2scratch_menu_classification_menu',
                    'classification_menu',
                    args[0],
                    'off',
                );
                return block;
            },
        );

        // tm.classification_interval = value (Ruby setter: classification_interval=)
        converter.registerOnSend(
            TM,
            'classification_interval=',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_setClassificationInterval',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CLASSIFICATION_INTERVAL',
                    'tm2scratch_menu_classification_interval_menu',
                    'classification_interval_menu',
                    args[0],
                    '1',
                );
                return block;
            },
        );

        // tm.confidence_threshold = value (Ruby setter: confidence_threshold=)
        converter.registerOnSend(
            TM,
            'confidence_threshold=',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isNumberOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_setConfidenceThreshold',
                    'statement',
                );
                converter.addNumberInput(
                    block,
                    'CONFIDENCE_THRESHOLD',
                    'math_number',
                    args[0],
                    0.5,
                );
                return block;
            },
        );

        // tm.confidence_threshold (getter)
        converter.registerOnSend(
            TM,
            'confidence_threshold',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'tm2scratch_getConfidenceThreshold',
                    'value',
                );
            },
        );

        // tm.video_toggle("on")
        converter.registerOnSend(TM, 'video_toggle', 1, (params) => {
            const { receiver, args } = params;
            if (!converter.isStringOrBlock(args[0])) return null;
            const block = converter.changeRubyExpressionBlock(
                receiver,
                'tm2scratch_videoToggle',
                'statement',
            );
            converter.addFieldInput(
                block,
                'VIDEO_STATE',
                'tm2scratch_menu_video_menu',
                'video_menu',
                args[0],
                'off',
            );
            return block;
        });

        // tm.switch_camera("device")
        converter.registerOnSend(TM, 'switch_camera', 1, (params) => {
            const { receiver, args } = params;
            if (!converter.isStringOrBlock(args[0])) return null;
            const block = converter.changeRubyExpressionBlock(
                receiver,
                'tm2scratch_switchCamera',
                'statement',
            );
            converter.addFieldInput(
                block,
                'DEVICE',
                'tm2scratch_menu_mediadevices',
                'mediadevices',
                args[0],
                '',
            );
            return block;
        });
    },
};

export default TM2ScratchConverter;
