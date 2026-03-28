// === Smalruby: This file is Smalruby-specific (furigana label mappings) ===

/**
 * Simple method-name → furigana label mappings for operator/conversion calls
 * (any receiver). Used by FuriganaAnnotator._handleCallNode.
 */
const RECEIVER_METHOD_LABELS = {
  to_i: '整数化',
  to_f: '浮動小数点数化',
  to_s: '文字列化',
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
  round: '四捨五入',
  abs: '絶対値',
  floor: '切り捨て',
  ceil: '切り上げ',
  length: '長さ',
  'include?': '含むか',
  // === Smalruby: regex match operators ===
  '=~': '正規表現マッチ',
  '!~': '正規表現マッチしない',
  // Control
  times: '回繰り返す',
  // List operations
  push: '追加する',
  delete_at: '削除する',
  insert: '挿入する',
  index: '検索する',
  clear: '全削除する',
}

/**
 * Simple method-name → furigana label mappings for top-level calls
 * (no receiver). Used by FuriganaAnnotator._handleCallNode.
 */
const TOPLEVEL_METHOD_LABELS = {
  // Module
  include: '取り込む',
  // Standard I/O
  puts: '表示する',
  print: '表示する',
  gets: '入力する',
  wait: '待つ',
  // Motion
  move: '動かす',
  turn_right: '時計回りに回す',
  turn_left: '反時計回りに回す',
  go_to: '移動する',
  point_towards: '向く',
  bounce_if_on_edge: 'もし端に着いたら、跳ね返る',
  // Looks
  say: '言う',
  think: '考える',
  switch_costume: 'コスチュームにする',
  next_costume: '次のコスチュームにする',
  switch_backdrop: '背景にする',
  switch_backdrop_and_wait: '背景にして待つ',
  next_backdrop: '次の背景にする',
  set_effect: '画像効果を設定',
  change_effect_by: '画像効果を変える',
  clear_graphic_effects: '画像効果をなくす',
  show: '表示する',
  hide: '隠す',
  // Sound
  play: '音を鳴らす',
  play_until_done: '音が終わるまで鳴らす',
  stop_all_sounds: '音をすべて止める',
  change_sound_effect_by: '音の効果を変える',
  set_sound_effect: '音の効果を設定',
  clear_sound_effects: '音の効果をなくす',
  // Events
  when_flag_clicked: '⚑が押されたとき',
  when_key_pressed: 'キーが押されたとき',
  when_clicked: 'このスプライトが押されたとき',
  when_backdrop_switches: '背景が切り替わったとき',
  when_receive: '受け取ったとき',
  broadcast: '送る',
  broadcast_and_wait: '送って待つ',
  // Control
  sleep: '待つ',
  loop: 'ずっと繰り返す',
  stop: '止める',
  create_clone: 'クローンを作る',
  delete_this_clone: 'このクローンを削除',
  when_start_as_a_clone: 'クローンされたとき',
  // Sensing
  'touching?': '触れているか',
  'touching_color?': '色に触れているか',
  'color_is_touching_color?': '色が色に触れているか',
  distance: '距離',
  ask: '質問する',
  // Operators
  rand: '乱数',
  // Data
  show_variable: '変数を表示',
  hide_variable: '変数を隠す',
  show_list: 'リストを表示',
  hide_list: 'リストを隠す',
  // Music
  play_drum: 'ドラムを鳴らす',
  play_note: '音符を鳴らす',
  // Pen (v1 top-level)
  pen_down: 'ペンを下ろす',
  pen_up: 'ペンを上げる',
  pen_clear: '全部消す',
  pen_stamp: 'スタンプ',
  // Translate
  translate: '翻訳する',
  // Class configuration (set_xxx) — sprite
  set_name: '名前を設定',
  set_sprite: 'スプライトを設定',
  set_x: 'X座標を設定',
  set_y: 'Y座標を設定',
  set_direction: '向きを設定',
  set_visible: '表示を設定',
  set_size: '大きさを設定',
  set_current_costume: 'コスチュームを設定',
  set_rotation_style: '回転方法を設定',
  set_costumes: 'コスチュームを設定',
  set_sounds: '音を設定',
  set_variables: '変数を設定',
  set_lists: 'リストを設定',
  // Class configuration (set_xxx) — stage
  set_current_backdrop: '現在の背景を設定',
  set_backdrops: '背景を設定',
}

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
  tempo: 'テンポ',
  language: '言語',
}

/**
 * Special string values used in smalruby that represent UI menu options.
 * Labels are sourced from scratch-l10n editor/blocks/ja.json.
 */
const SPECIAL_STRING_LABELS = {
  // Special sprite/location targets
  _mouse_: 'マウスのポインター',
  _edge_: '端',
  _random_: 'ランダムな場所',
  _myself_: '自分自身',
  // Key names (EVENT_WHENKEYPRESSED_*)
  space: 'スペース',
  'left arrow': '左向き矢印',
  'right arrow': '右向き矢印',
  'down arrow': '下向き矢印',
  'up arrow': '上向き矢印',
  any: 'どれかのキー',
  // Stop options (CONTROL_STOP_*)
  all: 'すべて',
  'this script': 'このスクリプト',
  'other scripts in sprite': 'スプライトの他のスクリプト',
  // Rotation styles (MOTION_SETROTATIONSTYLE_*)
  'all around': '自由に回転',
  'left-right': '左右のみ',
  "don't rotate": '回転しない',
  // Drag modes (SENSING_SETDRAGMODE_*)
  draggable: 'できる',
  'not draggable': 'できない',
  // Sound effects (SOUND_EFFECTS_*)
  PITCH: 'ピッチ',
  PAN: '左右にパン',
  // Graphic effects (LOOKS_EFFECT_*)
  color: '色',
  fisheye: '魚眼レンズ',
  whirl: '渦巻き',
  pixelate: 'ピクセル化',
  mosaic: 'モザイク',
  brightness: '明るさ',
  ghost: '幽霊',
}

/**
 * Methods whose literal arguments should use a unit suffix instead of 数値/文字列.
 * e.g. move(10) → 「10歩」 instead of 「数値10」
 */
const METHOD_ARG_UNITS = {
  move: '歩',
  turn_right: '度',
  turn_left: '度',
  sleep: '秒',
}

/**
 * Context-specific string labels for face_sensing PART menu arguments.
 */
const FACE_SENSING_PART_LABELS = {
  nose: '鼻',
  mouth: '口',
  left_eye: '左目',
  right_eye: '右目',
  between_eyes: '両目の間',
  left_ear: '左耳',
  right_ear: '右耳',
  top_of_head: '頭のてっぺん',
}

/**
 * Context-specific string labels for face_sensing DIRECTION menu arguments.
 */
const FACE_SENSING_DIRECTION_LABELS = {
  left: '左',
  right: '右',
}

/**
 * Maps face_sensing method names to their context-specific string label maps.
 */
const FACE_SENSING_STRING_MAP = {
  go_to: FACE_SENSING_PART_LABELS,
  when_this_sprite_touch: FACE_SENSING_PART_LABELS,
  when_face_tilted: FACE_SENSING_DIRECTION_LABELS,
}

export {
  RECEIVER_METHOD_LABELS,
  TOPLEVEL_METHOD_LABELS,
  TOPLEVEL_PROPERTY_LABELS,
  SPECIAL_STRING_LABELS,
  METHOD_ARG_UNITS,
  FACE_SENSING_PART_LABELS,
  FACE_SENSING_DIRECTION_LABELS,
  FACE_SENSING_STRING_MAP,
}
