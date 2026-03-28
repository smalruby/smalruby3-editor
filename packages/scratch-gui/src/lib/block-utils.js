/**
 * @file Utility functions and constants for block handling
 */

// Extended blocks: Blocks added after the initial implementation
// These are assigned to bits starting from 99 (after the base 99 blocks: bits 0-98)
// Order in this array determines bit position (99, 100, 101, ...)
export const EXTENDED_BLOCKS = [
  'sensing_online', // bit 99 (added in upstream merge 2026-02)
]

// Define blocks for each category based on make-toolbox-xml.js
// NOTE: Display order follows make-toolbox-xml.js, but bit order is different
// Extended blocks appear in display order but are mapped to bits 99+ for URLs
export const CATEGORY_BLOCKS = {
  motion: [
    'motion_movesteps',
    'motion_turnright',
    'motion_turnleft',
    'motion_goto',
    'motion_gotoxy',
    'motion_glideto',
    'motion_glidesecstoxy',
    'motion_pointindirection',
    'motion_pointtowards',
    'motion_changexby',
    'motion_setx',
    'motion_changeyby',
    'motion_sety',
    'motion_ifonedgebounce',
    'motion_setrotationstyle',
  ],
  looks: [
    'looks_sayforsecs',
    'looks_say',
    'looks_thinkforsecs',
    'looks_think',
    'looks_switchcostumeto',
    'looks_nextcostume',
    'looks_switchbackdropto',
    'looks_nextbackdrop',
    'looks_changesizeby',
    'looks_setsizeto',
    'looks_changeeffectby',
    'looks_seteffectto',
    'looks_cleargraphiceffects',
    'looks_show',
    'looks_hide',
    'looks_gotofrontback',
    'looks_goforwardbackwardlayers',
    'looks_costumenumbername',
    'looks_backdropnumbername',
    'looks_size',
    // for Stage
    'looks_switchbackdroptoandwait',
  ],
  sound: [
    'sound_playuntildone',
    'sound_play',
    'sound_stopallsounds',
    'sound_changeeffectby',
    'sound_seteffectto',
    'sound_cleareffects',
    'sound_changevolumeby',
    'sound_setvolumeto',
  ],
  event: [
    'event_whenflagclicked',
    'event_whenkeypressed',
    'event_whenthisspriteclicked',
    'event_whenbackdropswitchesto',
    'event_whengreaterthan',
    'event_whenbroadcastreceived',
    'event_broadcast',
    'event_broadcastandwait',
  ],
  control: [
    'control_wait',
    'control_repeat',
    'control_forever',
    'control_if',
    'control_if_else',
    'control_wait_until',
    'control_repeat_until',
    'control_stop',
    'control_start_as_clone',
    'control_create_clone_of',
    'control_delete_this_clone',
  ],
  sensing: [
    'sensing_touchingobject', // bit 63
    'sensing_touchingcolor', // bit 64
    'sensing_coloristouchingcolor', // bit 65
    'sensing_distanceto', // bit 66
    'sensing_askandwait', // bit 67
    'sensing_answer', // bit 68
    'sensing_keypressed', // bit 69
    'sensing_mousedown', // bit 70
    'sensing_mousex', // bit 71
    'sensing_mousey', // bit 72
    'sensing_setdragmode', // bit 73
    'sensing_loudness', // bit 74
    'sensing_timer', // bit 75
    'sensing_resettimer', // bit 76
    'sensing_of', // bit 77
    'sensing_current', // bit 78
    'sensing_dayssince2000', // bit 79
    'sensing_username', // bit 80
    'sensing_online', // bit 99 (extended) - display order from make-toolbox-xml
  ],
  operators: [
    'operator_add',
    'operator_subtract',
    'operator_multiply',
    'operator_divide',
    'operator_random',
    'operator_gt',
    'operator_lt',
    'operator_equals',
    'operator_and',
    'operator_or',
    'operator_not',
    'operator_join',
    'operator_letter_of',
    'operator_length',
    'operator_contains',
    'operator_mod',
    'operator_round',
    'operator_mathop',
  ],
}

/**
 * Generate ordered list of all blocks for bit mapping (URL parameters)
 * Base blocks (non-extended) come first (bits 0-98), then extended blocks (bits 99+)
 * This ensures backward compatibility: old URLs only reference bits 0-98
 * @returns {Array} - Ordered array of all block IDs for bit mapping
 */
export const generateBlockOrder = function () {
  const baseBlocks = []
  const categoryOrder = ['motion', 'looks', 'sound', 'event', 'control', 'sensing', 'operators']

  // Add base blocks (excluding extended blocks) - these get bits 0-98
  categoryOrder.forEach(categoryId => {
    const categoryBlocks = CATEGORY_BLOCKS[categoryId] || []
    categoryBlocks.forEach(blockId => {
      if (!EXTENDED_BLOCKS.includes(blockId)) {
        baseBlocks.push(blockId)
      }
    })
  })

  // Add extended blocks at the end - these get bits 99, 100, 101, ...
  // Order matters: EXTENDED_BLOCKS array defines bit assignment
  return [...baseBlocks, ...EXTENDED_BLOCKS]
}

/**
 * Parse hex format only_blocks parameter and return selected blocks object
 * @param {string} hexString - Hex string starting with '0'
 * @returns {object} - Selected blocks object with categories
 */
export const parseHexFormatToSelectedBlocks = function (hexString) {
  const selectedBlocks = {}

  // Always initialize each category
  Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
    selectedBlocks[categoryId] = []
  })

  // Parse hex format
  const hexData = hexString.slice(1) // Remove leading '0'

  // Convert hex to binary (reverse bit order within each hex digit for proper bit indexing)
  let binaryString = ''
  for (let i = 0; i < hexData.length; i++) {
    const hexDigit = hexData[i]
    const decimal = parseInt(hexDigit, 16)
    const binary = decimal.toString(2).padStart(4, '0')
    // Reverse the binary string to match bit ordering (LSB first)
    const reversedBinary = binary.split('').reverse().join('')
    binaryString += reversedBinary
  }

  // Get the ordered list of all blocks
  const blockOrder = generateBlockOrder()

  // Backward compatibility: Old smalruby URLs (before sensing_online) only reference
  // bits 0-98 (99 blocks total). Bit 99 = sensing_online (first extended block).
  // For old URLs, we ignore bits beyond bit 98 to prevent unintended block selection.
  // We detect old URLs by checking if they're shorter than needed for new extended blocks.
  const OLD_FORMAT_MAX_BIT = 98 // Old format includes up to bit 98

  // Determine effective bit limit
  // If hex is 25+ digits (100+ bits), use all bits (new format with room for extended blocks)
  // Otherwise, limit to first 99 bits (0-98) to ignore unintended high bits in old URLs
  const effectiveBitLimit = hexData.length >= 25 ? blockOrder.length : OLD_FORMAT_MAX_BIT + 1

  // Map binary bits to block selections
  for (let i = 0; i < Math.min(binaryString.length, effectiveBitLimit); i++) {
    const bit = binaryString[i]
    const blockId = blockOrder[i]

    if (bit === '1') {
      // Find which category this block belongs to
      Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
        const categoryBlocks = CATEGORY_BLOCKS[categoryId] || []
        if (categoryBlocks.includes(blockId)) {
          if (!selectedBlocks[categoryId].includes(blockId)) {
            selectedBlocks[categoryId].push(blockId)
          }
        }
      })
    }
  }

  return selectedBlocks
}

/**
 * Initialize block selection from only_blocks parameter
 * @param {string} onlyBlocks - The only_blocks parameter value
 * @returns {object} - Selected blocks object with categories initialized based on only_blocks
 */
export const initializeBlockSelectionFromOnlyBlocks = onlyBlocks => {
  const selectedBlocks = {}

  // Always initialize each category
  Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
    selectedBlocks[categoryId] = []
  })

  // If no onlyBlocks parameter provided (null/undefined), select all blocks (default behavior)
  if (onlyBlocks === null || typeof onlyBlocks === 'undefined') {
    Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
      selectedBlocks[categoryId] = [...CATEGORY_BLOCKS[categoryId]]
    })
    return selectedBlocks
  }

  // If empty string provided, return empty selections
  if (!onlyBlocks) return selectedBlocks

  // Backward compatibility: convert "events_" to "event_" (legacy format)
  // This supports old URLs that used "events" category name
  const processedBlocks = onlyBlocks.replace(/events_/g, 'event_')

  // Check if hex format (starts with '0')
  if (processedBlocks.startsWith('0') && processedBlocks.length > 1) {
    return parseHexFormatToSelectedBlocks(processedBlocks)
  }

  // Parse only_blocks parameter (legacy format)
  const patterns = processedBlocks
    .split(/[,.]/)
    .map(pattern => pattern.trim())
    .filter(pattern => pattern.length > 0)

  // Process patterns to determine which blocks should be initially selected
  patterns.forEach(pattern => {
    Object.keys(CATEGORY_BLOCKS).forEach(categoryId => {
      const categoryBlocks = CATEGORY_BLOCKS[categoryId] || []

      // Check if pattern matches category prefix (e.g., "motion_" matches motion category)
      if (pattern.endsWith('_') && pattern === `${categoryId}_`) {
        // Select all blocks in this category
        selectedBlocks[categoryId] = [...categoryBlocks]
      } else if (categoryBlocks.includes(pattern)) {
        // Select specific block if it exists in this category
        if (!selectedBlocks[categoryId].includes(pattern)) {
          selectedBlocks[categoryId].push(pattern)
        }
      }
    })
  })

  return selectedBlocks
}
