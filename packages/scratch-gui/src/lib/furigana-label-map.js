// === Smalruby: This file is Smalruby-specific (furigana label mappings) ===

/**
 * Simple method-name → furigana label mappings for operator/conversion calls
 * (any receiver). Used by FuriganaAnnotator._handleCallNode.
 */
const RECEIVER_METHOD_LABELS = {
    'to_i': '整数化',
    'to_f': '浮動小数点数化',
    'to_s': '文字列化',
    '-': '引く',
    '*': '掛ける',
    '/': '割る',
    '%': '余り',
    '**': 'べき乗',
    '+@': '正',
    '-@': '負',
    '<=': '以下',
    '>=': '以上',
    '<': '小さい',
    '>': '大きい',
    '==': '等しい',
    '!=': '等しくない',
    '!': 'ではない',
    // Numeric / String methods
    'round': '四捨五入',
    'abs': '絶対値',
    'floor': '切り捨て',
    'ceil': '切り上げ',
    'length': '長さ',
    'include?': '含むか',
    // Control
    'times': '回繰り返す',
    // List operations
    'push': '追加する',
    'delete_at': '削除する',
    'insert': '挿入する',
    'index': '検索する',
    'clear': '全削除する'
};

/**
 * Simple method-name → furigana label mappings for top-level calls
 * (no receiver). Used by FuriganaAnnotator._handleCallNode.
 */
const TOPLEVEL_METHOD_LABELS = {
    // Standard I/O
    'puts': '表示する',
    'print': '表示する',
    'gets': '入力する',
    'wait': '待つ',
    // Motion
    'move': '動かす',
    'turn_right': '時計回りに回す',
    'turn_left': '反時計回りに回す',
    'go_to': '移動する',
    'point_towards': '向く',
    'bounce_if_on_edge': 'もし端に着いたら、跳ね返る',
    // Looks
    'say': '言う',
    'think': '考える',
    'switch_costume': 'コスチュームにする',
    'next_costume': '次のコスチュームにする',
    'switch_backdrop': '背景にする',
    'switch_backdrop_and_wait': '背景にして待つ',
    'next_backdrop': '次の背景にする',
    'set_effect': '画像効果を設定',
    'change_effect_by': '画像効果を変える',
    'clear_graphic_effects': '画像効果をなくす',
    'show': '表示する',
    'hide': '隠す',
    // Sound
    'play': '音を鳴らす',
    'play_until_done': '音が終わるまで鳴らす',
    'stop_all_sounds': '音をすべて止める',
    'change_sound_effect_by': '音の効果を変える',
    'set_sound_effect': '音の効果を設定',
    'clear_sound_effects': '音の効果をなくす',
    // Events
    'when_flag_clicked': '⚑が押されたとき',
    'when_key_pressed': 'キーが押されたとき',
    'when_clicked': 'このスプライトが押されたとき',
    'when_backdrop_switches': '背景が切り替わったとき',
    'when_receive': '受け取ったとき',
    'broadcast': '送る',
    'broadcast_and_wait': '送って待つ',
    // Control
    'sleep': '待つ',
    'loop': 'ずっと繰り返す',
    'stop': '止める',
    'create_clone': 'クローンを作る',
    'delete_this_clone': 'このクローンを削除',
    'when_start_as_a_clone': 'クローンされたとき',
    // Sensing
    'touching?': '触れているか',
    'touching_color?': '色に触れているか',
    'color_is_touching_color?': '色が色に触れているか',
    'distance': '距離',
    'ask': '質問する',
    // Operators
    'rand': '乱数',
    // Data
    'show_variable': '変数を表示',
    'hide_variable': '変数を隠す',
    'show_list': 'リストを表示',
    'hide_list': 'リストを隠す',
    // Music
    'play_drum': 'ドラムを鳴らす',
    'play_note': '音符を鳴らす',
    // Class configuration (set_xxx)
    'set_name': '名前を設定',
    'set_sprite': 'スプライトを設定',
    'set_x': 'X座標を設定',
    'set_y': 'Y座標を設定',
    'set_direction': '向きを設定',
    'set_visible': '表示を設定',
    'set_size': '大きさを設定',
    'set_current_costume': 'コスチュームを設定',
    'set_rotation_style': '回転方法を設定',
    'set_costumes': 'コスチュームを設定',
    'set_sounds': '音を設定',
    'set_variables': '変数を設定',
    'set_lists': 'リストを設定'
};

/**
 * Property-getter method names that should only be annotated when
 * called without arguments (no receiver version).
 */
const TOPLEVEL_PROPERTY_LABELS = {
    x: 'X座標',
    y: 'Y座標',
    direction: '向き',
    costume_number: 'コスチューム番号',
    costume_name: 'コスチューム名',
    backdrop_number: '背景番号',
    backdrop_name: '背景名',
    size: '大きさ',
    volume: '音量',
    answer: '答え',
    loudness: 'マイクの音量',
    days_since_2000: '2000年からの日数',
    user_name: 'ユーザー名',
    tempo: 'テンポ'
};

export {
    RECEIVER_METHOD_LABELS,
    TOPLEVEL_METHOD_LABELS,
    TOPLEVEL_PROPERTY_LABELS
};
