// === Smalruby: This file is Smalruby-specific (furigana extension handlers) ===

/**
 * Extension-specific furigana handler methods and configuration.
 * Mixed into FuriganaAnnotator.prototype via Object.assign.
 */

// ---- Dispatch configuration ----

/**
 * Maps predefined extension receiver names to their handler method names.
 */
const EXTENSION_HANDLER_MAP = {
    pen: '_annotatePenMethod',
    face_sensing: '_annotateFaceSensingMethod',
    video_sensing: '_annotateVideoSensingMethod',
    text2speech: '_annotateText2SpeechMethod',
    microbit: '_annotateMicrobitMethod',
    mesh_v1: '_annotateMeshV1Method',
    mesh: '_annotateMeshV2Method',
    smalrubot_s1: '_annotateSmalrubotS1Method',
    koshien: '_annotateKoshienMethod',
    tm: '_annotateTmMethod',
    akadako: '_annotateAkadakoMethod',
    // v2 API receivers
    music: '_annotateMusicMethod',
    keyboard: '_annotateKeyboardMethod',
    mouse: '_annotateMouseMethod',
    timer: '_annotateTimerMethod',
    translate: '_annotateTranslateMethod',
};

/**
 * Maps predefined extension receiver names to their Japanese labels.
 */
const EXTENSION_RECEIVER_LABELS = {
    pen: 'ペン',
    face_sensing: '顔認識',
    video_sensing: 'ビデオ',
    text2speech: '音声合成',
    microbit: 'マイクロビット',
    mesh_v1: 'メッシュ(従来)',
    mesh: 'メッシュ',
    smalrubot_s1: 'スモウルボットS1',
    koshien: 'スモウルビー甲子園',
    tm: '機械学習',
    akadako: 'AkaDako',
    // v2 API receivers
    music: '音楽',
    keyboard: 'キーボード',
    mouse: 'マウス',
    timer: 'タイマー',
    translate: '翻訳',
};

// ---- Extension-specific string label maps ----

const VIDEO_SENSING_VIDEO_STATE_LABELS = {
    on: 'オン',
    off: 'オフ',
    'on-flipped': '左右反転',
};

const VIDEO_SENSING_VIDEO_ON_LABELS = {
    motion: '動き',
    direction: '向き',
    'this sprite': 'このスプライト',
    Stage: 'ステージ',
};

const MICROBIT_BUTTON_LABELS = {
    A: 'A',
    B: 'B',
    any: 'どれか',
};

const MICROBIT_GESTURE_LABELS = {
    SHAKE: '振られた',
    FREEFALL: '落下した',
};

const MICROBIT_TILT_LABELS = {
    ANY: 'どれか',
    FRONT: '前',
    BACK: '後ろ',
    LEFT: '左',
    RIGHT: '右',
};

const MICROBIT_AXIS_LABELS = {
    x: 'x',
    y: 'y',
    z: 'z',
    absolute: '絶対値',
};

const MICROBIT_PULL_MODE_LABELS = {
    up: 'プルアップ',
    down: 'プルダウン',
    none: 'なし',
};

const SMALRUBOT_S1_ACTION_LABELS = {
    forward: '進める',
    backward: 'バックさせる',
    turnLeft: '左に曲げる',
    turnRight: '右に曲げる',
    stop: '止める',
};

const SMALRUBOT_S1_POSITION_LABELS = {
    left: '左',
    right: '右',
};

/**
 * Dynamic label function for koshien position strings ("X:Y" → "x:X,y:Y").
 * @param {string} content - string literal value
 * @returns {string|null} furigana label or null
 */
const KOSHIEN_POSITION_LABEL_FN = (content) => {
    const match = content.match(/^(-?\d+):(-?\d+)$/);
    if (match) return `x:${match[1]},y:${match[2]}`;
    return null;
};

const AKADAKO_BOARD_STATE_LABELS = {
    connected: '接続された',
    disconnected: '切断された',
};

const AKADAKO_DIGITAL_LEVEL_LABELS = {
    0: '0',
    1: '1',
};

const AKADAKO_INPUT_BIAS_LABELS = {
    none: 'プルアップしない',
    pullUp: 'プルアップする',
};

const AKADAKO_NEOPIXEL_COLOR_LABELS = {
    red: '赤',
    orange: 'だいだい',
    yellow: '黄',
    green: '緑',
    blue: '青',
    indigo: 'あい',
    violet: 'すみれ',
    purple: '紫',
    white: '白',
    black: '黒',
    rainbow: 'レインボー',
};

const AKADAKO_LOOP_MODE_LABELS = {
    true: '回転する',
    false: '回転しない',
};

const TM_CLASSIFICATION_STATE_LABELS = {
    on: 'オン',
    off: 'オフ',
};

const TM_VIDEO_STATE_LABELS = {
    on: 'オン',
    off: 'オフ',
    'on-flipped': 'オン（左右反転）',
};

/**
 * Maps extension receiver names → { methodName: stringLabelMap|function }.
 * Values can be plain objects (exact match) or functions (dynamic transform).
 * Used to set context-specific _stringLabelMap before walking arguments.
 */
const EXTENSION_STRING_MAPS = {
    video_sensing: {
        video_turn: VIDEO_SENSING_VIDEO_STATE_LABELS,
        video_on: VIDEO_SENSING_VIDEO_ON_LABELS,
    },
    microbit: {
        when_button_is: MICROBIT_BUTTON_LABELS,
        button_pressed: MICROBIT_BUTTON_LABELS,
        'button_pressed?': MICROBIT_BUTTON_LABELS,
        when: MICROBIT_GESTURE_LABELS,
        when_tilted: MICROBIT_TILT_LABELS,
        'tilted?': MICROBIT_TILT_LABELS,
        tilt_angle: MICROBIT_TILT_LABELS,
        magnetic_force: MICROBIT_AXIS_LABELS,
        acceleration: MICROBIT_AXIS_LABELS,
        set_pin_to_input_pull: MICROBIT_PULL_MODE_LABELS,
    },
    smalrubot_s1: {
        action: SMALRUBOT_S1_ACTION_LABELS,
    },
    tm: {
        toggle_classification: TM_CLASSIFICATION_STATE_LABELS,
        video_toggle: TM_VIDEO_STATE_LABELS,
    },
    akadako: {
        when_board_state_changed: AKADAKO_BOARD_STATE_LABELS,
        set_digital_level: AKADAKO_DIGITAL_LEVEL_LABELS,
        when_digital_level_changed: AKADAKO_DIGITAL_LEVEL_LABELS,
        'digital_high?': AKADAKO_DIGITAL_LEVEL_LABELS,
        set_input_bias: AKADAKO_INPUT_BIAS_LABELS,
        neopixel_set_color: AKADAKO_NEOPIXEL_COLOR_LABELS,
        neopixel_fill_color: AKADAKO_NEOPIXEL_COLOR_LABELS,
        neopixel_shift_color: AKADAKO_LOOP_MODE_LABELS,
        neopixel_color_mode: AKADAKO_NEOPIXEL_COLOR_LABELS,
    },
    koshien: {
        move_to: KOSHIEN_POSITION_LABEL_FN,
        get_map_area: KOSHIEN_POSITION_LABEL_FN,
        map: KOSHIEN_POSITION_LABEL_FN,
        map_from: KOSHIEN_POSITION_LABEL_FN,
        position_of_x: KOSHIEN_POSITION_LABEL_FN,
        position_of_y: KOSHIEN_POSITION_LABEL_FN,
    },
};

// ---- Extension handler methods ----

const extensionHandlers = {
    _annotateVideoSensingMethod(node, name) {
        const labels = {
            when_video_motion_greater_than: 'ビデオモーション ＞ のとき',
            video_turn: 'ビデオを切り替える',
            'video_transparency=': 'ビデオの透明度を設定',
            video_on: 'ビデオの値',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateText2SpeechMethod(node, name) {
        const labels = {
            speak: '話す',
            'voice=': '声を設定',
            'language=': '言語を設定',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateMicrobitMethod(node, name) {
        const labels = {
            when_microbit: '接続が変わったとき',
            when_button_is: 'ボタンのとき',
            'button_pressed?': 'ボタンが押されたか',
            when_pin_is: 'ピンのとき',
            'pin_is_touched?': 'ピンに触れたか',
            when_pin_connected: 'ピンがつながったとき',
            when: 'のとき',
            when_tilted: '傾いたとき',
            'tilted?': '傾いているか',
            tilt_angle: '傾きの角度',
            display_pattern: 'LEDに表示',
            display_text: 'テキスト表示',
            display_text_delay: 'テキスト表示(遅延)',
            clear_display: 'LED消去',
            light_intensity: '明るさ',
            temperature: '温度',
            angle_with_north: '北との角度',
            pitch: 'ピッチ',
            roll: 'ロール',
            sound_level: '音の大きさ',
            magnetic_force: '磁力',
            acceleration: '加速度',
            analog_value: 'アナログ値',
            set_pin_to_input_pull: 'ピンのプル設定',
            'is_pin_high?': 'ピンがHighか',
            set_digital: 'デジタル出力',
            set_analog: 'アナログ出力',
            set_servo: 'サーボ設定',
            play_tone: '音を鳴らす',
            stop_tone: '音を止める',
            listen_event_on: 'イベント監視',
            when_catch_at_pin: 'ピンイベントのとき',
            value_of: 'イベントの値',
            when_data_received_from_microbit: 'データ受信のとき',
            send_data_to_microbit: 'データ送信',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateMeshV1Method(node, name) {
        if (name === 'sensor_value') {
            this._addAnnotation(node.messageLoc, 'センサーの値');
        }
    },

    _annotateMeshV2Method(node, name) {
        if (name === 'sensor_value') {
            this._addAnnotation(node.messageLoc, 'センサーの値');
        }
    },

    _annotateSmalrubotS1Method(node, name) {
        const labels = {
            action: '動作する',
            bend_arm: 'アームを曲げる',
            led: 'LED設定',
            set_motor_speed: 'モーター速度を設定',
            sensor_value: 'センサーの値',
            get_motor_speed: 'モーター速度',
            'arm_calibration=': 'アーム調整',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    // v2 API handlers

    _annotateMusicMethod(node, name) {
        const labels = {
            play_drum: 'ドラムを鳴らす',
            rest: '休む',
            play_note: '音符を鳴らす',
            'instrument=': '楽器を設定',
            'tempo=': 'テンポを設定',
            tempo: 'テンポ',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateKeyboardMethod(node, name) {
        const labels = {
            'pressed?': 'キーが押されたか',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateMouseMethod(node, name) {
        const labels = {
            x: 'X座標',
            y: 'Y座標',
            'down?': '押されたか',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateTimerMethod(node, name) {
        const labels = {
            value: '値',
            reset: 'リセット',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateTranslateMethod(node, name) {
        const labels = {
            call: '翻訳する',
            language: '言語',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateKoshienMethod(node, name) {
        const labels = {
            connect_game: 'ゲームに接続',
            move_to: '移動する',
            turn_over: 'ターン終了',
            calc_route: 'ルート計算',
            locate_objects: 'オブジェクト配置',
            get_map_area: 'マップエリア',
            map: 'マップ',
            map_from: 'マップ(変数)',
            map_all: '全マップ',
            position: '座標',
            position_of_x: 'X座標取得',
            position_of_y: 'Y座標取得',
            object: 'オブジェクト',
            set_message: 'メッセージ設定',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateAkadakoMethod(node, name) {
        const labels = {
            connect_board: 'ボードを接続',
            disconnect_board: 'ボードを切断',
            'connected?': '接続している',
            when_board_state_changed: 'ボードが変わったとき',
            board_version: 'バージョン',
            analog_level_a1: 'アナログA(A1)の値',
            analog_level_a2: 'アナログA(A2)の値',
            analog_level_b1: 'アナログB(B1)の値',
            analog_level_b2: 'アナログB(B2)の値',
            digital_level_a1: 'デジタルA(A1)の値',
            digital_level_a2: 'デジタルA(A2)の値',
            digital_level_b1: 'デジタルB(B1)の値',
            digital_level_b2: 'デジタルB(B2)の値',
            set_digital_level: 'デジタル出力',
            'digital_high?': '1であるか',
            when_digital_level_changed: 'レベルが変わったとき',
            set_input_bias: '入力バイアス設定',
            set_pwm_duty: 'PWMデューティー比を設定',
            servo_turn: 'サーボを回す',
            send_ir_remote: '赤外線リモコン送信',
            ultrasonic_distance_a: '超音波A距離(cm)',
            ultrasonic_distance_b: '超音波B距離(cm)',
            laser_distance: 'レーザー距離(cm)',
            motion_sensor_value: '人感センサーの値',
            when_shaken: 'ゆさぶられたとき',
            pitch: 'ピッチ(度)',
            roll: 'ロール(度)',
            acceleration_x: '加速度X',
            acceleration_y: '加速度Y',
            acceleration_z: '加速度Z',
            acceleration_absolute: '加速度の絶対値',
            brightness: '明るさ(lx)',
            analog_brightness: 'アナログの明るさ',
            temperature: '温度(°C)',
            pressure: '気圧(hPa)',
            humidity: '湿度(%)',
            water_temperature_a: '水温A(°C)',
            water_temperature_b: '水温B(°C)',
            neopixel_config: 'カラーLED設定',
            neopixel_set_color: 'カラーLEDの色を設定',
            neopixel_fill_color: 'カラーLEDの全色を設定',
            neopixel_shift_color: 'カラーLEDをずらす',
            neopixel_color: 'カラーLED RGB',
            neopixel_color_mode: 'カラーLEDモード',
            neopixel_show: 'カラーLEDを光らせる',
            neopixel_clear: 'カラーLEDを消す',
            i2c_write: 'I2C書き込み',
            i2c_read: 'I2C読み出し',
            number_at: '数列の番目',
            splice_numbers: '数列を操作',
            numbers_length: '数列の長さ',
            read_bytes_as: 'バイト列を読む',
            int64_op: 'int64演算',
            bit_op: 'ビット演算',
            bit_not: 'ビットNOT',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },

    _annotateTmMethod(node, name) {
        const labels = {
            when_image_label_received: '画像ラベルを受け取ったとき',
            'image_label_detected?': '画像ラベル？',
            image_label_confidence: '画像ラベルの確度',
            set_image_classification_model_url: '画像分類モデルURLを設定',
            classify_video_image: '画像を分類する',
            image_label: '画像ラベル',
            when_sound_label_received: '音声ラベルを受け取ったとき',
            'sound_label_detected?': '音声ラベル？',
            sound_label_confidence: '音声ラベルの確度',
            set_sound_classification_model_url: '音声分類モデルURLを設定',
            sound_label: '音声ラベル',
            toggle_classification: '分類を切り替え',
            'classification_interval=': '分類間隔を設定',
            'confidence_threshold=': '確信度のしきい値を設定',
            confidence_threshold: '確信度のしきい値',
            video_toggle: 'ビデオを切り替え',
            switch_camera: 'カメラを切り替え',
        };
        const label = labels[name];
        if (label) this._addAnnotation(node.messageLoc, label);
    },
};

export { EXTENSION_HANDLER_MAP, EXTENSION_RECEIVER_LABELS, EXTENSION_STRING_MAPS, extensionHandlers };
