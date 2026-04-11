// === Smalruby: This file is Smalruby-specific (DNCL block filter) ===

/**
 * Blocks allowed in DNCL mode.
 *
 * Each entry is a block opcode or prefix pattern (ending with `_`).
 * Prefix patterns match all blocks in that category
 * (e.g., `operator_` matches all operator blocks).
 */
const DNCL_ALLOWED_BLOCKS = [
  // Control: DNCL control flow only
  'control_repeat',
  'control_if',
  'control_if_else',
  'control_repeat_until',

  // Operators: all
  'operator_',

  // Looks: 表示する only (say with duration)
  'looks_sayforsecs',

  // Sensing: 【外部からの入力】 only (ask/answer)
  'sensing_askandwait',
  'sensing_answer',

  // Variables: all
  'data_variable',
  'data_setvariableto',
  'data_changevariableby',
  'data_showvariable',
  'data_hidevariable',

  // Lists: all
  'data_listcontents',
  'data_addtolist',
  'data_deleteoflist',
  'data_deletealloflist',
  'data_insertatlist',
  'data_replaceitemoflist',
  'data_itemoflist',
  'data_itemnumoflist',
  'data_lengthoflist',
  'data_listcontainsitem',
  'data_showlist',
  'data_hidelist',

  // Procedures (My Blocks): all
  'procedures_definition',
  'procedures_call',
  'procedures_prototype',
  'argument_reporter_string_number',
  'argument_reporter_boolean',
]

/**
 * Check if a block opcode is allowed in DNCL mode.
 * @param {string} opcode - The block opcode.
 * @returns {boolean} True if the block is allowed.
 */
const isDnclAllowedBlock = (opcode) =>
  DNCL_ALLOWED_BLOCKS.some((pattern) => {
    if (pattern.endsWith('_')) {
      return opcode.startsWith(pattern)
    }
    return opcode === pattern
  })

/**
 * Categories that are completely hidden in DNCL mode.
 */
const DNCL_HIDDEN_CATEGORIES = [
  'motion',
  'sound',
  'events',
]

/**
 * Check if a category is hidden in DNCL mode.
 * @param {string} categoryId - The category identifier.
 * @returns {boolean} True if the category should be hidden.
 */
const isDnclHiddenCategory = (categoryId) =>
  DNCL_HIDDEN_CATEGORIES.includes(categoryId)

export {
  DNCL_ALLOWED_BLOCKS,
  DNCL_HIDDEN_CATEGORIES,
  isDnclAllowedBlock,
  isDnclHiddenCategory,
}
